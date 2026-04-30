import { supabase } from '../lib/supabase';

export const processAutoRepayment = async (borrowerAccountNumber, borrowerEmail) => {
  try {
    // 1. Fetch borrower account
    const { data: borrowerAccount, error: accError } = await supabase
      .from('accounts')
      .select('*')
      .eq('account_number', borrowerAccountNumber)
      .single();

    if (accError || !borrowerAccount) return;

    let currentBalance = Number(borrowerAccount.balance);
    if (currentBalance <= 0) return;

    // 2. Fetch active loans with auto_repay = true
    const { data: activeLoans, error: loansError } = await supabase
      .from('loans')
      .select('*')
      .eq('borrower_account', borrowerAccountNumber)
      .eq('status', 'active')
      .eq('auto_repay', true)
      .order('created_at', { ascending: true });

    if (loansError || !activeLoans || activeLoans.length === 0) return;

    for (const loan of activeLoans) {
      if (currentBalance <= 0) break;

      const remaining = Number(loan.remaining_amount);
      const repaymentAmount = Math.min(currentBalance, remaining);

      currentBalance -= repaymentAmount;
      const newRemaining = remaining - repaymentAmount;
      const newStatus = newRemaining <= 0 ? 'repaid' : 'active';

      // 3. Update loan
      await supabase
        .from('loans')
        .update({ remaining_amount: newRemaining, status: newStatus })
        .eq('id', loan.id);

      // 4. Update borrower balance
      await supabase
        .from('accounts')
        .update({ balance: currentBalance })
        .eq('id', borrowerAccount.id);

      // 5. Fetch lender account
      const { data: lenderAccount } = await supabase
        .from('accounts')
        .select('*')
        .eq('account_number', loan.lender_account)
        .single();

      if (lenderAccount) {
        // 6. Update lender balance
        const newLenderBalance = Number(lenderAccount.balance) + repaymentAmount;
        await supabase
          .from('accounts')
          .update({ balance: newLenderBalance })
          .eq('id', lenderAccount.id);

        // 7. Record loan_repayments
        await supabase.from('loan_repayments').insert([{
          loan_id: loan.id,
          amount: repaymentAmount,
          repayment_type: 'auto'
        }]);

        // 8. Record transactions
        const refId = 'REP' + Math.floor(100000000 + Math.random() * 900000000);
        await supabase.from('transactions').insert([
          {
            user_id: borrowerAccount.user_id,
            type: 'Expense',
            amount: repaymentAmount,
            description: `Auto-repayment for Loan ${loan.id}`,
            category: 'Loan Repayment',
            reference_id: refId
          },
          {
            user_id: lenderAccount.user_id,
            type: 'Income',
            amount: repaymentAmount,
            description: `Auto-repayment received for Loan ${loan.id}`,
            category: 'Loan Repayment',
            reference_id: refId
          }
        ]);

        // 9. Send Email
        await supabase.functions.invoke('send-transaction-email', {
          body: {
            emailType: 'loan_repaid',
            senderEmail: borrowerEmail, // The person who repaid
            senderAccountNumber: borrowerAccountNumber,
            recipientAccountNumber: loan.lender_account,
            amount: repaymentAmount,
            senderBalance: currentBalance,
            recipientBalance: newLenderBalance,
            date: new Date().toLocaleString(),
            referenceId: refId,
            loanId: loan.id
          }
        });
      }
    }
  } catch (error) {
    console.error("Auto-repay failed:", error);
  }
};
