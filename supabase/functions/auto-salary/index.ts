// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with Service Role to bypass RLS and access auth.users
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Fetch eligible users for auto-salary
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('*')
      .eq('auto_salary_enabled', true)
      .lte('next_salary_date', new Date().toISOString());

    if (usersError) throw usersError;
    
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: 'No eligible users found for auto-salary deposit today.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const results = [];

    // Process each user
    for (const userSettings of users) {
      try {
        // Find their primary account (first created)
        const { data: accounts, error: accountError } = await supabaseClient
          .from('accounts')
          .select('*')
          .eq('user_id', userSettings.id)
          .order('created_at', { ascending: true })
          .limit(1);

        if (accountError || !accounts || accounts.length === 0) {
          console.error(`No account found for user ${userSettings.id}`);
          continue; // Skip this user
        }

        const account = accounts[0];
        const salaryAmount = userSettings.salary_amount || 15000;
        const newBalance = Number(account.balance) + Number(salaryAmount);
        const referenceId = `SAL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        console.log(`Processing salary deposit for user: ${userSettings.id}, Amount: ${salaryAmount}`);

        // Create transaction
        const { error: txError } = await supabaseClient
          .from('transactions')
          .insert({
            user_id: userSettings.id,
            account_id: account.id,
            type: 'Salary Credit',
            amount: salaryAmount,
            description: 'Monthly Salary Auto-Credit',
            category: 'Salary',
            reference_id: referenceId,
            status: 'completed'
          });

        if (txError) throw txError;

        // Update account balance
        const { error: balanceError } = await supabaseClient
          .from('accounts')
          .update({ balance: newBalance })
          .eq('id', account.id);

        if (balanceError) throw balanceError;

        // Calculate next salary date (add 1 month)
        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + 1);

        // Update user settings dates
        const { error: updateSettingsError } = await supabaseClient
          .from('users')
          .update({
            last_salary_date: new Date().toISOString(),
            next_salary_date: nextDate.toISOString()
          })
          .eq('id', userSettings.id);

        if (updateSettingsError) throw updateSettingsError;

        // Send Email Notification if enabled
        if (userSettings.salary_alerts && RESEND_API_KEY) {
          const { data: authUser, error: authError } = await supabaseClient.auth.admin.getUserById(userSettings.id);
          
          if (!authError && authUser?.user?.email) {
            const formatCurrency = (amt: number | string) => `₹${Number(amt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
            const html = `
              <div style="font-family: sans-serif; max-w-md; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #3B82F6;">Qubix Bank</h2>
                <h3>Salary Credited</h3>
                <p>Dear ${userSettings.full_name || 'Customer'},</p>
                <p>Your monthly salary of <strong>${formatCurrency(salaryAmount)}</strong> has been successfully credited to your account ending in <strong>${account.account_number.slice(-4)}</strong>.</p>
                <ul>
                  <li><strong>Reference ID:</strong> ${referenceId}</li>
                  <li><strong>Date:</strong> ${new Date().toLocaleDateString()}</li>
                  <li><strong>Available Balance:</strong> ${formatCurrency(newBalance)}</li>
                </ul>
                <p>Thank you for banking with Qubix Bank.</p>
              </div>
            `;

            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`,
              },
              body: JSON.stringify({
                from: 'Qubix Bank <onboarding@resend.dev>',
                to: [authUser.user.email],
                subject: 'Salary Credited',
                html: html,
              })
            });
          }
        }

        console.log(`Successfully deposited ${salaryAmount} for user ${userSettings.id}. New Balance: ${newBalance}`);
        results.push({ userId: userSettings.id, status: 'success' });
      } catch (err) {
        console.error(`Error processing salary for user ${userSettings.id}:`, err);
        results.push({ userId: userSettings.id, status: 'error', error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
