import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, User, FileText, CheckCircle2, ScanLine, X } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { processAutoRepayment } from '../utils/loanHelpers';

export default function FundTransfer() {
  const { user, account, refreshAccount } = useAuth();
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

  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner("qr-reader", { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      }, false);
      
      scanner.render((decodedText) => {
        setFormData(prev => ({ ...prev, recipientAccount: decodedText }));
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

    if (amountNum <= 0) {
      setError('Amount must be greater than zero.');
      setLoading(false);
      return;
    }

    if (!account) {
      setError('Your account data is not loaded yet. Please try again.');
      setLoading(false);
      return;
    }

    if (amountNum > Number(account.balance)) {
      setError('Insufficient funds.');
      setLoading(false);
      return;
    }

    if (formData.recipientAccount === account.account_number) {
      setError('You cannot transfer to your own account.');
      setLoading(false);
      return;
    }

    try {
      // 1. Find recipient
      const { data: recipientAcc, error: recipientError } = await supabase
        .from('accounts')
        .select('*')
        .eq('account_number', formData.recipientAccount)
        .single();

      if (recipientError || !recipientAcc) {
        throw new Error('Recipient account not found.');
      }

      // 2. Deduct from sender
      const newSenderBalance = Number(account.balance) - amountNum;
      const { error: deductError } = await supabase
        .from('accounts')
        .update({ balance: newSenderBalance })
        .eq('id', account.id);

      if (deductError) throw new Error('Failed to deduct from sender.');

      // 3. Add to recipient
      const newRecipientBalance = Number(recipientAcc.balance) + amountNum;
      const { error: addError } = await supabase
        .from('accounts')
        .update({ balance: newRecipientBalance })
        .eq('id', recipientAcc.id);

      if (addError) throw new Error('Failed to transfer to recipient.');

      // 4. Record transactions
      const refId = 'TRX' + Math.floor(100000000 + Math.random() * 900000000);
      setReferenceId(refId);

      const senderTx = {
        user_id: user.id,
        type: 'Transfer',
        amount: amountNum,
        description: formData.remarks || `Transfer to ${formData.recipientAccount}`,
        category: 'Transfer',
        reference_id: refId
      };

      const recipientTx = {
        user_id: recipientAcc.user_id,
        type: 'Income',
        amount: amountNum,
        description: `Transfer from ${account.account_number}`,
        category: 'Transfer',
        reference_id: refId
      };

      await supabase.from('transactions').insert([senderTx, recipientTx]);

      // Call Edge Function for email notification
      const { error: fnError } = await supabase.functions.invoke('send-transaction-email', {
        body: {
          senderEmail: user.email,
          recipientAccountNumber: formData.recipientAccount,
          amount: amountNum,
          senderBalance: newSenderBalance,
          recipientBalance: newRecipientBalance,
          date: new Date().toLocaleString(),
          referenceId: refId
        }
      });
      
      if (fnError) {
        console.error('Edge function failed:', fnError);
      }

      await refreshAccount();
      
      // Hook into Auto-Repay
      // The recipient balance just went up. Check if they have active auto-repay loans
      // Note: We don't await this so it doesn't block the UI update
      const { data: recipientUser } = await supabase.auth.admin?.getUserById?.(recipientAcc.user_id) || {};
      processAutoRepayment(formData.recipientAccount, recipientUser?.user?.email || '');

      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({ recipientAccount: '', amount: '', remarks: '' });
    setError(null);
    setStep(1);
  };

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
                </div>
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
                      Processing...
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Transfer Successful!</h2>
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
