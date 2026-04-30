import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
    const { 
      emailType = 'transfer', // 'transfer' | 'loan_request' | 'loan_accepted' | 'loan_repaid'
      senderEmail, 
      recipientAccountNumber, 
      amount, 
      senderBalance, 
      recipientBalance, 
      date,
      referenceId,
      senderAccountNumber,
      // For loans:
      loanId,
      dueDate,
      lenderEmail // To notify lender when borrower acts
    } = await req.json()

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is missing')
    }

    // Initialize Supabase client with Service Role to access auth.users
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    // Lookup recipient email using account number
    const { data: accounts, error: accountError } = await supabaseClient
      .from('accounts')
      .select('user_id')
      .eq('account_number', recipientAccountNumber)
      .single()

    if (accountError || !accounts) {
      throw new Error('Recipient account not found')
    }

    // Lookup recipient email using Admin API
    const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(accounts.user_id)
    
    if (userError || !userData.user) {
      throw new Error('Recipient user not found')
    }

    const recipientEmail = userData.user.email

    // Lookup sender email if missing but senderAccountNumber is provided
    let finalSenderEmail = senderEmail;
    if (!finalSenderEmail && senderAccountNumber) {
      const { data: senderAcc } = await supabaseClient.from('accounts').select('user_id').eq('account_number', senderAccountNumber).single();
      if (senderAcc) {
        const { data: senderUser } = await supabaseClient.auth.admin.getUserById(senderAcc.user_id);
        if (senderUser?.user) {
          finalSenderEmail = senderUser.user.email;
        }
      }
    }

    // Format currency
    const formatCurrency = (amt: number | string) => `₹${Number(amt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

    // Helper function to send email via Resend API
    const sendEmail = async (to: string, subject: string, html: string) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Qubix Bank <onboarding@resend.dev>', // Must use this for unverified domains on free tier
          to: [to],
          subject: subject,
          html: html,
        })
      })
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('Failed to send email:', errorText)
        throw new Error('Failed to send email')
      }
      return res.json()
    }

    let emailsToSend = [];

    if (emailType === 'transfer') {
      const senderHtml = `
        <div style="font-family: sans-serif; max-w-md; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #3B82F6;">Qubix Bank</h2>
          <h3>Transaction Alert: Fund Transfer</h3>
          <p>Dear Customer,</p>
          <p>Your fund transfer of <strong>${formatCurrency(amount)}</strong> to account number <strong>${recipientAccountNumber}</strong> was successful.</p>
          <ul>
            <li><strong>Reference ID:</strong> ${referenceId}</li>
            <li><strong>Date:</strong> ${date}</li>
            <li><strong>Available Balance:</strong> ${formatCurrency(senderBalance)}</li>
          </ul>
          <p>Thank you for banking with us.</p>
        </div>
      `

      const recipientHtml = `
        <div style="font-family: sans-serif; max-w-md; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #3B82F6;">Qubix Bank</h2>
          <h3>Transaction Alert: Fund Received</h3>
          <p>Dear Customer,</p>
          <p>You have received <strong>${formatCurrency(amount)}</strong> in your account.</p>
          <ul>
            <li><strong>Reference ID:</strong> ${referenceId}</li>
            <li><strong>Date:</strong> ${date}</li>
            <li><strong>Available Balance:</strong> ${formatCurrency(recipientBalance)}</li>
          </ul>
          <p>Thank you for banking with us.</p>
        </div>
      `

      emailsToSend = [
        sendEmail(finalSenderEmail, `Transfer Successful - ${referenceId}`, senderHtml),
        sendEmail(recipientEmail, `Funds Received - ${referenceId}`, recipientHtml)
      ];
    } else if (emailType === 'loan_request') {
      const recipientHtml = `
        <div style="font-family: sans-serif; max-w-md; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #3B82F6;">Qubix Bank</h2>
          <h3>Smart Lending: New Loan Request</h3>
          <p>Dear Customer,</p>
          <p>You have received a new loan request of <strong>${formatCurrency(amount)}</strong>.</p>
          <ul>
            <li><strong>Loan ID:</strong> ${loanId}</li>
            <li><strong>Due Date:</strong> ${dueDate}</li>
            <li><strong>Date:</strong> ${date}</li>
          </ul>
          <p>Please log in to your Qubix Bank account to review and accept this loan.</p>
        </div>
      `
      emailsToSend = [sendEmail(recipientEmail, `New Loan Request - ${loanId}`, recipientHtml)];
    } else if (emailType === 'loan_accepted') {
      const lenderHtml = `
        <div style="font-family: sans-serif; max-w-md; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #3B82F6;">Qubix Bank</h2>
          <h3>Smart Lending: Loan Accepted</h3>
          <p>Dear Customer,</p>
          <p>Your loan offer of <strong>${formatCurrency(amount)}</strong> has been accepted by the borrower.</p>
          <ul>
            <li><strong>Loan ID:</strong> ${loanId}</li>
            <li><strong>Date:</strong> ${date}</li>
            <li><strong>Available Balance:</strong> ${formatCurrency(senderBalance)}</li>
          </ul>
          <p>The funds have been transferred to the borrower.</p>
        </div>
      `
      const borrowerHtml = `
        <div style="font-family: sans-serif; max-w-md; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #3B82F6;">Qubix Bank</h2>
          <h3>Smart Lending: Loan Accepted</h3>
          <p>Dear Customer,</p>
          <p>You have accepted the loan of <strong>${formatCurrency(amount)}</strong>.</p>
          <ul>
            <li><strong>Loan ID:</strong> ${loanId}</li>
            <li><strong>Date:</strong> ${date}</li>
            <li><strong>Available Balance:</strong> ${formatCurrency(recipientBalance)}</li>
          </ul>
          <p>The funds have been credited to your account.</p>
        </div>
      `
      emailsToSend = [
        sendEmail(finalSenderEmail, `Loan Accepted - ${loanId}`, lenderHtml),
        sendEmail(recipientEmail, `Loan Funds Received - ${loanId}`, borrowerHtml)
      ];
    } else if (emailType === 'loan_repaid') {
      const lenderHtml = `
        <div style="font-family: sans-serif; max-w-md; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #3B82F6;">Qubix Bank</h2>
          <h3>Smart Lending: Loan Repayment Received</h3>
          <p>Dear Customer,</p>
          <p>You have received a loan repayment of <strong>${formatCurrency(amount)}</strong>.</p>
          <ul>
            <li><strong>Loan ID:</strong> ${loanId}</li>
            <li><strong>Date:</strong> ${date}</li>
            <li><strong>Available Balance:</strong> ${formatCurrency(recipientBalance)}</li>
          </ul>
        </div>
      `
      const borrowerHtml = `
        <div style="font-family: sans-serif; max-w-md; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #3B82F6;">Qubix Bank</h2>
          <h3>Smart Lending: Loan Repayment Made</h3>
          <p>Dear Customer,</p>
          <p>A loan repayment of <strong>${formatCurrency(amount)}</strong> has been successfully processed.</p>
          <ul>
            <li><strong>Loan ID:</strong> ${loanId}</li>
            <li><strong>Date:</strong> ${date}</li>
            <li><strong>Available Balance:</strong> ${formatCurrency(senderBalance)}</li>
          </ul>
        </div>
      `
      emailsToSend = [
        sendEmail(recipientEmail, `Loan Repayment Received - ${loanId}`, lenderHtml),
        sendEmail(finalSenderEmail, `Loan Repayment Processed - ${loanId}`, borrowerHtml)
      ];
    }

    // Execute email requests in parallel
    await Promise.all(emailsToSend)

    return new Response(JSON.stringify({ success: true }), {
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
