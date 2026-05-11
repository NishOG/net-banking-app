import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, FileText, CheckCircle2, ScanLine, X, Loader2 } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { processAutoRepayment } from '../utils/loanHelpers';

export default function FundTransfer() {
  const { user, account, accounts, refreshAccount, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    recipientAccount: '',
    amount: '',
    remarks: ''
  });
  const [referenceId, setReferenceId] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [recipientInfo, setRecipientInfo] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [recentRecipients, setRecentRecipients] = useState([]);

  useEffect(() => {
    const verifyAccount = async () => {
      const accNum = formData.recipientAccount.trim();
      if (accNum.length === 10) {
        setIsVerifying(true);
        setError(null);
        try {
          const { data, error: fetchError } = await supabase
            .from('accounts')
            .select('nickname, account_type')
            .eq('account_number', accNum)
            .single();
          
          if (fetchError || !data) {
            setRecipientInfo(null);
            setError('Account not found');
          } else {
            setRecipientInfo(data);
          }
        } catch {
          setRecipientInfo(null);
        } finally {
          setIsVerifying(false);
        }
      } else {
        setRecipientInfo(null);
      }
    };

    const timer = setTimeout(verifyAccount, 500);
    return () => clearTimeout(timer);
  }, [formData.recipientAccount]);

  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner("qr-reader", { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      }, false);
      
      scanner.render((decodedText) => {
        // Support qubix:ACCOUNT:AMOUNT format
        if (decodedText.startsWith('qubix:')) {
          const [, account, amount] = decodedText.split(':');
          setFormData(prev => ({ 
            ...prev, 
            recipientAccount: account || '', 
            amount: amount || prev.amount 
          }));
        } else {
          setFormData(prev => ({ ...prev, recipientAccount: decodedText }));
        }
        setShowScanner(false);
        scanner.clear();
      }, () => {
        // Ignore scan errors
      });

      return () => {
        scanner.clear().catch(console.error);
      };
    }
  }, [showScanner]);

  const handleTransfer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const amountNum = Number(formData.amount);
    const recipientAccNum = formData.recipientAccount.trim();

    if (amountNum <= 0) {
      setError('Invalid amount');
      setLoading(false);
      return;
    }

    if (recipientAccNum.length !== 10) {
      setError('Account not found');
      setLoading(false);
      return;
    }

    if (!account) {
      setError('Account not found');
      setLoading(false);
      return;
    }

    if (amountNum > Number(account.balance)) {
      setError('Insufficient balance');
      setLoading(false);
      return;
    }

    if (recipientAccNum === account.account_number) {
      // Allow internal transfer but skip the recipient check logic since we already have the account
    }

    try {
      // b) Recipient account exists in database
      const { data: recipientAcc, error: recipientError } = await supabase
        .from('accounts')
        .select('*')
        .eq('account_number', recipientAccNum)
        .single();

      if (recipientError || !recipientAcc) {
        throw new Error('Account not found');
      }

      const refId = 'TRX' + Math.floor(100000000 + Math.random() * 900000000);
      setReferenceId(refId);

      const newSenderBalance = Number(account.balance) - amountNum;
      const newRecipientBalance = Number(recipientAcc.balance) + amountNum;

      // 3. Execute transfer instantly via RPC (Bypasses RLS using SECURITY DEFINER)
      const { data: rpcData, error: rpcError } = await supabase.rpc('transfer_funds', {
        p_sender_account: account.account_number,
        p_recipient_account: recipientAccNum,
        p_amount: amountNum
      });

      if (rpcError) throw new Error(rpcError.message);
      if (rpcData?.status === 'error') throw new Error(rpcData.message);

      // 3. Fire off notifications and background tasks without blocking the UI
      supabase
        .from('users')
        .select('email')
        .eq('id', recipientAcc.user_id)
        .single()
        .then(({ data: recipientUser }) => {
          supabase.functions.invoke('send-transaction-email', {
            body: {
              senderEmail: user.email,
              recipientEmail: recipientUser?.email,
              recipientAccountNumber: formData.recipientAccount,
              amount: amountNum,
              senderBalance: newSenderBalance,
              recipientBalance: newRecipientBalance,
              date: new Date().toLocaleString(),
              referenceId: refId
            }
          }).catch(console.error);
        })
        .catch(console.error);

      // Refresh sender account balance in background
      refreshAccount();
      
      // Hook into Auto-Repay
      processAutoRepayment(formData.recipientAccount, '');

      setStep(2);
    } catch (err) {
      setError(err.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({ recipientAccount: '', amount: '', remarks: '' });
    setError(null);
    setStep(1);
  };

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        if (!user || !account?.account_number) return;
        const { data } = await supabase
          .from('transactions')
          .select('to_account, created_at')
          .eq('from_account', account.account_number)
          .order('created_at', { ascending: false });
        
        if (data) {
          const unique = [...new Set(data.map(t => t.to_account))]
            .filter(acc => acc && acc !== account.account_number)
            .slice(0, 5);
          setRecentRecipients(unique);
        }
      } catch (err) {
        console.error("Error fetching recent recipients:", err);
      }
    };
    fetchRecent();
  }, [user, account?.account_number]);

  // Loading state
  if (authLoading && !account) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // No accounts case
  if (!authLoading && accounts && accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="bg-white dark:bg-surface rounded-3xl p-10 border border-gray-200 dark:border-gray-800 shadow-xl max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">No Accounts Found</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            You need to create an account before you can transfer funds.
          </p>
          <Link 
            to="/add-account"
            className="inline-flex items-center justify-center px-6 py-4 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-primary hover:bg-primary/90 transition-all w-full"
          >
            Create Your First Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fund Transfer</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Send money securely to any account.</p>
        {account && (
          <p className="text-gray-700 dark:text-gray-300 text-sm mt-2 font-medium">
            Available Balance: ₹{Number(account.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>

      <div className="bg-white dark:bg-surface rounded-2xl border border-gray-200 dark:border-gray-800/60 shadow-sm dark:shadow-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gray-100 dark:bg-gray-800">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: '50%' }}
            animate={{ width: step === 1 ? '50%' : '100%' }}
          />
        </div>

        {step === 1 ? (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-8"
          >
            <form onSubmit={handleTransfer} className="space-y-6">
              {error && (
                <div className="bg-danger/10 border border-danger/20 text-danger text-sm rounded-xl p-4">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex justify-between items-center">
                  <span>Recipient Account Number</span>
                  <button 
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="text-primary hover:text-primary/80 flex items-center text-xs font-medium"
                  >
                    <ScanLine className="h-4 w-4 mr-1" />
                    Scan & Pay
                  </button>
                </label>

                {/* Quick Select for Own Accounts */}
                {accounts && accounts.length > 1 && account && (
                  <div className="mb-4">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-bold">Your Other Accounts</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {accounts.filter(acc => acc.id !== account.id).map(acc => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, recipientAccount: acc.account_number })}
                          className={`flex-none px-4 py-2 rounded-xl text-xs font-medium transition-all border ${
                            formData.recipientAccount === acc.account_number 
                              ? 'bg-primary/10 border-primary text-primary' 
                              : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 text-gray-500 hover:border-gray-300 dark:hover:border-gray-700'
                          }`}
                        >
                          {acc.nickname || acc.account_type} (..{acc.account_number.slice(-4)})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Recipients */}
                {recentRecipients && recentRecipients.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-bold">Recent Recipients</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {recentRecipients.map(acc => (
                        <button
                          key={acc}
                          type="button"
                          onClick={() => setFormData({ ...formData, recipientAccount: acc })}
                          className={`flex-none px-4 py-2 rounded-xl text-xs font-medium transition-all border ${
                            formData.recipientAccount === acc 
                              ? 'bg-secondary/10 border-secondary text-secondary' 
                              : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 text-gray-500 hover:border-gray-300 dark:hover:border-gray-700'
                          }`}
                        >
                          Account ..{acc.slice(-4)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.recipientAccount}
                    onChange={(e) => setFormData({...formData, recipientAccount: e.target.value})}
                    className="block w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                    placeholder="Enter 10-digit account number"
                  />
                  {isVerifying && (
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    </div>
                  )}
                </div>
                {recipientInfo && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 flex items-center text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-100 dark:border-green-500/20"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Recipient: {recipientInfo.nickname || `${recipientInfo.account_type} Account`}
                  </motion.div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Amount (₹)
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-gray-400 dark:text-gray-500 font-medium">₹</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className="block w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all font-mono text-lg"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Remarks (Optional)
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-4 pt-3 pointer-events-none">
                    <FileText className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <textarea
                    rows={3}
                    value={formData.remarks}
                    onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                    className="block w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all resize-none"
                    placeholder="What is this for?"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface focus:ring-primary transition-all disabled:opacity-70 group"
                >
                  {loading ? (
                    <span className="flex items-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3" />
                      Transfer processing...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Send className="mr-2 h-5 w-5 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
                      Transfer Funds
                    </span>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-12 text-center"
          >
            <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-secondary/10 mb-6 relative">
              <div className="absolute inset-0 bg-secondary/20 rounded-full animate-ping" />
              <CheckCircle2 className="h-12 w-12 text-secondary relative z-10" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Transfer successful</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              ₹{parseFloat(formData.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} has been successfully sent to account {formData.recipientAccount}.
            </p>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 mb-8 text-left border border-gray-200 dark:border-gray-800">
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-800/60">
                <span className="text-gray-500 dark:text-gray-400 text-sm">Reference ID</span>
                <span className="text-gray-900 dark:text-white font-mono text-sm">{referenceId}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500 dark:text-gray-400 text-sm">Date & Time</span>
                <span className="text-gray-900 dark:text-white text-sm">{new Date().toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-medium transition-colors"
            >
              Make Another Transfer
            </button>
          </motion.div>
        )}
      </div>

      {/* QR Scanner Modal */}
      <AnimatePresence>
        {showScanner && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-surface rounded-3xl shadow-2xl max-w-sm w-full relative flex flex-col items-center overflow-hidden"
            >
              <div className="w-full p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center">
                  <ScanLine className="h-5 w-5 mr-2 text-primary" />
                  Scan QR Code
                </h3>
                <button 
                  onClick={() => setShowScanner(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="w-full p-4 bg-gray-50 dark:bg-gray-900/50">
                <div id="qr-reader" className="w-full rounded-xl overflow-hidden border-none shadow-sm bg-white dark:bg-surface"></div>
                <p className="text-xs text-center text-gray-500 mt-4">
                  Position the QR code inside the frame to scan.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
