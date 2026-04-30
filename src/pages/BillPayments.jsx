import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Wifi, Smartphone, CreditCard, Droplets, Zap, ChevronRight, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const billCategories = [
  { id: 'electricity', name: 'Electricity', icon: Lightbulb, color: 'text-yellow-600 dark:text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-500/10', border: 'border-yellow-200 dark:border-yellow-500/20' },
  { id: 'water', name: 'Water', icon: Droplets, color: 'text-blue-600 dark:text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20' },
  { id: 'internet', name: 'Internet & TV', icon: Wifi, color: 'text-purple-600 dark:text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10', border: 'border-purple-200 dark:border-purple-500/20' },
  { id: 'mobile', name: 'Mobile Postpaid', icon: Smartphone, color: 'text-green-600 dark:text-green-500', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/20' },
  { id: 'credit-card', name: 'Credit Card', icon: CreditCard, color: 'text-pink-600 dark:text-pink-500', bg: 'bg-pink-50 dark:bg-pink-500/10', border: 'border-pink-200 dark:border-pink-500/20' },
  { id: 'gas', name: 'Gas Pipe', icon: Zap, color: 'text-orange-600 dark:text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20' },
];

const upcomingBills = [
  { id: 1, biller: 'Pacific Gas & Electric', type: 'Electricity', amount: '₹1,245.50', dueDate: 'Due in 3 days', icon: Lightbulb },
  { id: 2, biller: 'Airtel Broadband', type: 'Internet & TV', amount: '₹899.00', dueDate: 'Due in 5 days', icon: Wifi },
];

export default function BillPayments() {
  const { user, account, refreshAccount } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [step, setStep] = useState('select'); // select, pay, success
  const [billerDetails, setBillerDetails] = useState({ accountNo: '', amount: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [referenceId, setReferenceId] = useState('');

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setStep('pay');
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const amountNum = Number(billerDetails.amount);

    if (amountNum <= 0) {
      setError('Amount must be greater than zero.');
      setLoading(false);
      return;
    }

    if (!account) {
      setError('Account details not found.');
      setLoading(false);
      return;
    }

    if (amountNum > Number(account.balance)) {
      setError('Insufficient funds.');
      setLoading(false);
      return;
    }

    try {
      // Deduct from balance
      const newBalance = Number(account.balance) - amountNum;
      const { error: deductError } = await supabase
        .from('accounts')
        .update({ balance: newBalance })
        .eq('id', account.id);

      if (deductError) throw new Error('Failed to process payment.');

      // Record transaction
      const refId = 'BIL' + Math.floor(100000000 + Math.random() * 900000000);
      setReferenceId(refId);

      const tx = {
        user_id: user.id,
        type: 'Expense',
        amount: amountNum,
        description: `${selectedCategory.name} Bill Payment - ${billerDetails.accountNo}`,
        category: 'Utility',
        reference_id: refId
      };

      const { error: txError } = await supabase.from('transactions').insert(tx);
      
      if (txError) {
        console.error('Transaction record failed:', txError);
      }

      await refreshAccount();
      setStep('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('select');
    setSelectedCategory(null);
    setBillerDetails({ accountNo: '', amount: '' });
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bill Payments</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Pay your utilities and cards instantly.</p>
        {account && (
          <p className="text-gray-700 dark:text-gray-300 text-sm mt-2 font-medium">
            Available Balance: ₹{Number(account.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>

      {step === 'select' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          {/* Categories */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Categories</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {billCategories.map((category, index) => {
                const Icon = category.icon;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    key={category.id}
                    onClick={() => handleCategorySelect(category)}
                    className="bg-white dark:bg-surface border border-gray-200 dark:border-gray-800 rounded-2xl p-6 text-center cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-all group shadow-sm dark:shadow-none"
                  >
                    <div className={clsx("h-12 w-12 mx-auto rounded-xl flex items-center justify-center border mb-4 transition-transform group-hover:scale-110", category.bg, category.color, category.border)}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      {category.name}
                    </p>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Upcoming Bills */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Upcoming Due</h2>
            <div className="bg-white dark:bg-surface rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm dark:shadow-none">
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {upcomingBills.map((bill) => {
                  const Icon = bill.icon;
                  return (
                    <li key={bill.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer flex items-center justify-between group">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{bill.biller}</p>
                          <p className="text-xs text-danger mt-0.5">{bill.dueDate}</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center">
                        <span className="text-sm font-bold text-gray-900 dark:text-white mr-3">{bill.amount}</span>
                        <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-600 group-hover:text-gray-600 dark:group-hover:text-white transition-colors" />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      {step === 'pay' && selectedCategory && (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-xl mx-auto"
        >
          <div className="bg-white dark:bg-surface rounded-2xl border border-gray-200 dark:border-gray-800/60 shadow-sm dark:shadow-xl p-8 relative overflow-hidden">
            <button 
              onClick={() => {
                setStep('select');
                setError(null);
              }}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 flex items-center"
            >
              ← Back to categories
            </button>
            
            <div className="flex items-center mb-8">
              <div className={clsx("h-14 w-14 rounded-2xl flex items-center justify-center border", selectedCategory.bg, selectedCategory.color, selectedCategory.border)}>
                <selectedCategory.icon className="h-7 w-7" />
              </div>
              <div className="ml-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Pay {selectedCategory.name} Bill</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Enter details to fetch your bill</p>
              </div>
            </div>

            <form onSubmit={handlePayment} className="space-y-6">
              {error && (
                <div className="bg-danger/10 border border-danger/20 text-danger text-sm rounded-xl p-4">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Account Number / Consumer Number
                </label>
                <input
                  type="text"
                  required
                  value={billerDetails.accountNo}
                  onChange={(e) => setBillerDetails({...billerDetails, accountNo: e.target.value})}
                  className="block w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                  placeholder="e.g. 1234567890"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={billerDetails.amount}
                  onChange={(e) => setBillerDetails({...billerDetails, amount: e.target.value})}
                  className="block w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all font-mono text-lg"
                  placeholder="0.00"
                />
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
                    <span>Pay Bill</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      )}

      {step === 'success' && selectedCategory && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl mx-auto"
        >
          <div className="bg-white dark:bg-surface rounded-2xl border border-gray-200 dark:border-gray-800/60 shadow-sm dark:shadow-xl p-12 text-center">
            <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-secondary/10 mb-6 relative">
              <div className="absolute inset-0 bg-secondary/20 rounded-full animate-ping" />
              <CheckCircle2 className="h-12 w-12 text-secondary relative z-10" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Payment Successful!</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              Your {selectedCategory.name.toLowerCase()} bill of ₹{parseFloat(billerDetails.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} has been paid.
            </p>
            
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 mb-8 text-left border border-gray-200 dark:border-gray-800">
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-800/60">
                <span className="text-gray-500 dark:text-gray-400 text-sm">Consumer Number</span>
                <span className="text-gray-900 dark:text-white font-mono text-sm">{billerDetails.accountNo}</span>
              </div>
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
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-medium transition-colors w-full"
            >
              Pay Another Bill
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
