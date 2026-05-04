import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Handshake, FileText, CheckCircle2, Calendar, Loader2, IndianRupee } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { processAutoRepayment } from '../utils/loanHelpers';
import clsx from 'clsx';

export default function Loans() {
  const { user, account, refreshAccount } = useAuth();
  const [activeTab, setActiveTab] = useState('lent'); // 'lent' | 'borrowed'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Data state
  const [loansLent, setLoansLent] = useState([]);
  const [loansBorrowed, setLoansBorrowed] = useState([]);
  
  // Modal state
  const [showSendModal, setShowSendModal] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    borrowerAccount: '',
    amount: '',
    description: '',
    dueDate: '',
  });
  const [repayAmount, setRepayAmount] = useState('');

  const fetchLoans = useCallback(async () => {
    if (!account) return;
    try {
      // Fetch loans lent
      const { data: lentData, error: lentError } = await supabase
        .from('loans')
        .select('*')
        .eq('lender_account', account.account_number)
        .order('created_at', { ascending: false });
        
      if (lentError) throw lentError;
      setLoansLent(lentData || []);

      // Fetch loans borrowed
      const { data: borrowedData, error: borrowedError } = await supabase
        .from('loans')
        .select('*')
        .eq('borrower_account', account.account_number)
        .order('created_at', { ascending: false });

      if (borrowedError) throw borrowedError;
      setLoansBorrowed(borrowedData || []);
    } catch (err) {
      console.error('Failed to fetch loans:', err);
    }
  }, [account]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLoans();
  }, [fetchLoans]);

  const handleSendLoanRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const amountNum = Number(formData.amount);
    if (amountNum <= 0) {
      setError('Amount must be greater than zero.');
      setLoading(false); return;
    }
    if (amountNum > Number(account.balance)) {
      setError('Insufficient funds to offer this loan.');
      setLoading(false); return;
    }
    if (formData.borrowerAccount === account.account_number) {
      setError('You cannot lend money to yourself.');
      setLoading(false); return;
    }

    try {
      // Find borrower
      const { data: borrowerAcc, error: borrowerError } = await supabase
        .from('accounts')
        .select('*')
        .eq('account_number', formData.borrowerAccount)
        .single();

      if (borrowerError || !borrowerAcc) throw new Error('Borrower account not found.');

      // Insert pending loan
      const { data: insertedLoan, error: insertError } = await supabase
        .from('loans')
        .insert([{
          lender_account: account.account_number,
          borrower_account: formData.borrowerAccount,
          amount: amountNum,
          remaining_amount: amountNum,
          description: formData.description,
          status: 'pending',
          due_date: formData.dueDate,
          auto_repay: true
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      await supabase.functions.invoke('send-transaction-email', {
        body: {
          emailType: 'loan_request',
          recipientAccountNumber: formData.borrowerAccount,
          amount: amountNum,
          dueDate: formData.dueDate,
          date: new Date().toLocaleString(),
          loanId: insertedLoan.id
        }
      });

      setShowSendModal(false);
      setFormData({ borrowerAccount: '', amount: '', description: '', dueDate: '' });
      fetchLoans();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptLoan = async (loan) => {
    setLoading(true);
    try {
      // 1. Verify lender has enough balance
      const { data: lenderAcc } = await supabase
        .from('accounts')
        .select('*')
        .eq('account_number', loan.lender_account)
        .single();
        
      if (!lenderAcc || Number(lenderAcc.balance) < Number(loan.amount)) {
        throw new Error("Lender currently doesn't have sufficient funds.");
      }

      // 2. Deduct from lender
      const newLenderBalance = Number(lenderAcc.balance) - Number(loan.amount);
      await supabase.from('accounts').update({ balance: newLenderBalance }).eq('id', lenderAcc.id);

      // 3. Add to borrower (current user)
      const newBorrowerBalance = Number(account.balance) + Number(loan.amount);
      await supabase.from('accounts').update({ balance: newBorrowerBalance }).eq('id', account.id);

      // 4. Update loan status
      await supabase.from('loans').update({ status: 'active' }).eq('id', loan.id);

      // 5. Record transactions
      // eslint-disable-next-line react-hooks/purity
      const refId = 'LNA' + Math.floor(100000000 + Date.now() % 900000000);
      await supabase.from('transactions').insert([
        {
          user_id: lenderAcc.user_id,
          type: 'Expense',
          amount: Number(loan.amount),
          description: `Loan given to ${account.account_number} (${loan.id})`,
          category: 'Loan',
          reference_id: refId
        },
        {
          user_id: account.user_id,
          type: 'Income',
          amount: Number(loan.amount),
          description: `Loan received from ${loan.lender_account} (${loan.id})`,
          category: 'Loan',
          reference_id: refId
        }
      ]);

      // 6. Notify via email
      await supabase.functions.invoke('send-transaction-email', {
        body: {
          emailType: 'loan_accepted',
          senderEmail: user.email,
          senderAccountNumber: account.account_number,
          recipientAccountNumber: loan.lender_account,
          amount: Number(loan.amount),
          senderBalance: newBorrowerBalance,
          recipientBalance: newLenderBalance,
          date: new Date().toLocaleString(),
          loanId: loan.id
        }
      });

      await refreshAccount();
      fetchLoans();
      
      // Borrower balance just increased, trigger auto-repay for ANY OTHER loans they might owe!
      processAutoRepayment(account.account_number, user.email);

    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectLoan = async (loanId) => {
    try {
      await supabase.from('loans').update({ status: 'rejected' }).eq('id', loanId);
      fetchLoans();
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualRepay = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const amountNum = Number(repayAmount);
    if (amountNum <= 0) {
      setError("Amount must be greater than zero.");
      setLoading(false); return;
    }
    if (amountNum > Number(account.balance)) {
      setError("Insufficient funds.");
      setLoading(false); return;
    }
    if (amountNum > Number(selectedLoan.remaining_amount)) {
      setError("Amount exceeds remaining loan balance.");
      setLoading(false); return;
    }

    try {
      // 1. Deduct from borrower (current user)
      const newBorrowerBalance = Number(account.balance) - amountNum;
      await supabase.from('accounts').update({ balance: newBorrowerBalance }).eq('id', account.id);

      // 2. Add to lender
      const { data: lenderAcc } = await supabase.from('accounts').select('*').eq('account_number', selectedLoan.lender_account).single();
      const newLenderBalance = Number(lenderAcc.balance) + amountNum;
      await supabase.from('accounts').update({ balance: newLenderBalance }).eq('id', lenderAcc.id);

      // 3. Update loan
      const newRemaining = Number(selectedLoan.remaining_amount) - amountNum;
      const newStatus = newRemaining <= 0 ? 'repaid' : 'active';
      await supabase.from('loans').update({ remaining_amount: newRemaining, status: newStatus }).eq('id', selectedLoan.id);

      // 4. Record repayment
      await supabase.from('loan_repayments').insert([{
        loan_id: selectedLoan.id,
        amount: amountNum,
        repayment_type: 'manual'
      }]);

      // 5. Record transactions
       
      const refId = 'LNR' + Math.floor(100000000 + Date.now() % 900000000);
      await supabase.from('transactions').insert([
        {
          user_id: account.user_id,
          type: 'Expense',
          amount: amountNum,
          description: `Manual repayment for Loan ${selectedLoan.id}`,
          category: 'Loan Repayment',
          reference_id: refId
        },
        {
          user_id: lenderAcc.user_id,
          type: 'Income',
          amount: amountNum,
          description: `Repayment received for Loan ${selectedLoan.id}`,
          category: 'Loan Repayment',
          reference_id: refId
        }
      ]);

      // 6. Send email notification
      await supabase.functions.invoke('send-transaction-email', {
        body: {
          emailType: 'loan_repaid',
          senderEmail: user.email,
          senderAccountNumber: account.account_number,
          recipientAccountNumber: selectedLoan.lender_account,
          amount: amountNum,
          senderBalance: newBorrowerBalance,
          recipientBalance: newLenderBalance,
          date: new Date().toLocaleString(),
          loanId: selectedLoan.id
        }
      });

      await refreshAccount();
      fetchLoans();
      setShowRepayModal(false);
      setSelectedLoan(null);
      setRepayAmount('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status, dueDate) => {
    if (status === 'repaid') return 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400';
    if (status === 'rejected') return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    if (status === 'pending') return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400';
    
    // Check overdue
    if (new Date(dueDate) < new Date() && status === 'active') {
      return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400';
    }
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Handshake className="mr-2 h-6 w-6 text-primary" />
            Smart Lending
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Lend and borrow money securely with automatic repayment.
          </p>
        </div>
        <button
          onClick={() => setShowSendModal(true)}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center"
        >
          <IndianRupee className="h-4 w-4 mr-2" />
          Send Loan Request
        </button>
      </div>

      <div className="bg-white dark:bg-surface rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          <button
            className={clsx(
              "flex-1 py-4 text-sm font-medium transition-colors border-b-2",
              activeTab === 'lent' 
                ? "border-primary text-primary bg-primary/5" 
                : "border-transparent text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/50"
            )}
            onClick={() => setActiveTab('lent')}
          >
            Money I Lent
          </button>
          <button
            className={clsx(
              "flex-1 py-4 text-sm font-medium transition-colors border-b-2",
              activeTab === 'borrowed' 
                ? "border-primary text-primary bg-primary/5" 
                : "border-transparent text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/50"
            )}
            onClick={() => setActiveTab('borrowed')}
          >
            Money I Borrowed
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(activeTab === 'lent' ? loansLent : loansBorrowed).length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400">
                <Handshake className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No loans found in this category.</p>
              </div>
            ) : (
              (activeTab === 'lent' ? loansLent : loansBorrowed).map(loan => (
                <motion.div
                  key={loan.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20 hover:border-primary/30 transition-colors"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {activeTab === 'lent' ? 'Borrower' : 'Lender'}
                      </span>
                      <p className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                        {activeTab === 'lent' ? loan.borrower_account : loan.lender_account}
                      </p>
                    </div>
                    <span className={clsx("px-2.5 py-1 rounded-full text-xs font-semibold capitalize", getStatusColor(loan.status, loan.due_date))}>
                      {new Date(loan.due_date) < new Date() && loan.status === 'active' ? 'overdue' : loan.status}
                    </span>
                  </div>

                  <div className="mb-4">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      ₹{Number(loan.amount).toLocaleString('en-IN')}
                    </p>
                    {loan.status === 'active' && (
                      <p className="text-sm text-primary font-medium mt-1">
                        Remaining: ₹{Number(loan.remaining_amount).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 mb-5">
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <FileText className="h-3.5 w-3.5 mr-2 opacity-70" />
                      <span className="truncate">{loan.description || 'No description'}</span>
                    </div>
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="h-3.5 w-3.5 mr-2 opacity-70" />
                      Due: {new Date(loan.due_date).toLocaleDateString()}
                    </div>
                    {loan.auto_repay && loan.status === 'active' && (
                      <div className="flex items-center text-xs text-secondary font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                        Auto-Repay Enabled
                      </div>
                    )}
                  </div>

                  {activeTab === 'borrowed' && loan.status === 'pending' && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleAcceptLoan(loan)}
                        disabled={loading}
                        className="flex-1 bg-primary text-white py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => handleRejectLoan(loan.id)}
                        disabled={loading}
                        className="flex-1 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-2 rounded-xl text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {activeTab === 'borrowed' && loan.status === 'active' && (
                    <button 
                      onClick={() => {
                        setSelectedLoan(loan);
                        setRepayAmount(loan.remaining_amount);
                        setShowRepayModal(true);
                      }}
                      className="w-full bg-white dark:bg-surface border border-gray-200 dark:border-gray-700 hover:border-primary text-gray-900 dark:text-white py-2 rounded-xl text-sm font-medium transition-colors"
                    >
                      Repay Now
                    </button>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Send Loan Modal */}
      <AnimatePresence>
        {showSendModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-surface rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Offer a Loan</h3>
                <p className="text-sm text-gray-500 mt-1">Send a loan request. Funds will be transferred once accepted.</p>
              </div>
              <form onSubmit={handleSendLoanRequest} className="p-6 space-y-4">
                {error && <div className="p-3 bg-danger/10 text-danger rounded-xl text-sm">{error}</div>}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Borrower Account</label>
                  <input
                    type="text"
                    required
                    value={formData.borrowerAccount}
                    onChange={(e) => setFormData({...formData, borrowerAccount: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={formData.dueDate}
                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white"
                    placeholder="e.g. Rent money"
                  />
                </div>
                <div className="bg-secondary/10 border border-secondary/20 p-3 rounded-xl flex items-start mt-2">
                  <CheckCircle2 className="h-5 w-5 text-secondary mr-2 shrink-0 mt-0.5" />
                  <p className="text-xs text-secondary font-medium">
                    Auto-repay is strictly enabled. Any funds the borrower receives will automatically pay off this loan.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowSendModal(false)} className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl">Cancel</button>
                  <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-primary text-white rounded-xl font-medium flex items-center justify-center">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Offer Loan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Repay Modal */}
      <AnimatePresence>
        {showRepayModal && selectedLoan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-surface rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden"
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Repay Loan</h3>
                <p className="text-sm text-gray-500 mt-1">Remaining: ₹{Number(selectedLoan.remaining_amount).toLocaleString('en-IN')}</p>
              </div>
              <form onSubmit={handleManualRepay} className="p-6 space-y-4">
                {error && <div className="p-3 bg-danger/10 text-danger rounded-xl text-sm">{error}</div>}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Repayment Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedLoan.remaining_amount}
                    required
                    value={repayAmount}
                    onChange={(e) => setRepayAmount(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white"
                  />
                  <p className="text-xs text-gray-500 mt-2">Available Balance: ₹{Number(account.balance).toLocaleString('en-IN')}</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowRepayModal(false)} className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl">Cancel</button>
                  <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-primary text-white rounded-xl font-medium flex items-center justify-center">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirm Pay'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
