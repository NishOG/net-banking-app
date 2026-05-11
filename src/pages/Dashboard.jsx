import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  CreditCard, 
  DollarSign, 
  Activity,
  Send,
  QrCode,
  X,
  PlusCircle,
  Wallet,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, displayName, accounts, account, setAccount, refreshAccount } = useAuth();
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [qrAccount, setQrAccount] = useState(null); // Which account to show QR for
  const [qrAmount, setQrAmount] = useState(''); // Requested amount
  const [userSettings, setUserSettings] = useState(null);
  const [showBalance, setShowBalance] = useState(() => {
    return localStorage.getItem('showBalance') === 'true';
  });
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleBalance = () => {
    const newVal = !showBalance;
    setShowBalance(newVal);
    localStorage.setItem('showBalance', String(newVal));
  };

  const fetchData = useCallback(async () => {
    if (!user) return;
    // Fetch recent transactions
    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (txData) {
      setRecentTransactions(txData);
    }

    // Fetch total spent
    const { data: spentData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .in('type', ['Expense', 'Transfer']);

    if (spentData) {
      const spent = spentData.reduce((acc, curr) => acc + Number(curr.amount), 0);
      setTotalSpent(spent);
    }

    // Fetch user settings for salary date
    const { data: settingsData } = await supabase
      .from('users')
      .select('next_salary_date, auto_salary_enabled')
      .eq('id', user.id)
      .single();
      
    if (settingsData) {
      setUserSettings(settingsData);
    }
  }, [user]);

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;
    
    // Safety check
    if (Number(accountToDelete.balance) > 0) {
      setDeleteError("Cannot delete an account with a positive balance. Please transfer funds out first.");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', accountToDelete.id);

      if (error) throw error;

      await refreshAccount();
      setShowDeleteModal(false);
      setAccountToDelete(null);

      // If all accounts deleted, navigate to add-account
      if (accounts.length <= 1) {
        navigate('/add-account');
      }
    } catch (err) {
      setDeleteError(err.message || "Failed to delete account. It might have transaction history.");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // If no accounts, show welcome screen
  if (accounts && accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-lg mx-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-surface rounded-3xl p-10 border border-gray-200 dark:border-gray-800 shadow-xl"
        >
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-primary/10 mb-6">
            <Wallet className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Welcome to Qubix Bank</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            You don't have any accounts yet. Create your first account to start managing your money, making transfers, and tracking expenses.
          </p>
          <Link 
            to="/add-account"
            className="inline-flex items-center justify-center px-6 py-4 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-primary hover:bg-primary/90 transition-all group w-full"
          >
            <PlusCircle className="mr-2 h-5 w-5 group-hover:rotate-90 transition-transform" />
            Create Your First Account
          </Link>
        </motion.div>
      </div>
    );
  }

  const totalBalance = accounts?.reduce((acc, curr) => acc + Number(curr.balance), 0) || 0;

  const stats = [
    { name: 'Total Balance', value: `₹${totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, change: '+0.00%', type: 'neutral', icon: DollarSign },
    { name: 'Total Spent', value: `₹${totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, change: '0.00%', type: 'neutral', icon: CreditCard },
    { name: 'Active Accounts', value: accounts?.length || 0, change: '0%', type: 'neutral', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Welcome back, {displayName}</p>
          {userSettings?.auto_salary_enabled && userSettings?.next_salary_date && (
            <p className="text-sm font-medium text-primary mt-2 flex items-center bg-primary/10 w-fit px-3 py-1 rounded-full border border-primary/20">
              <DollarSign className="w-4 h-4 mr-1" />
              Next Salary: {new Date(userSettings.next_salary_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link 
            to="/add-account"
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm text-sm font-medium text-gray-700 dark:text-white bg-white dark:bg-surface hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Account
          </Link>
          <button 
            onClick={() => setQrAccount(account)}
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm text-sm font-medium text-gray-700 dark:text-white bg-white dark:bg-surface hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <QrCode className="mr-2 h-4 w-4" />
            Receive
          </button>
          <Link 
            to="/transfer"
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-colors"
          >
            <Send className="mr-2 h-4 w-4" />
            Transfer
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const displayValue = showBalance ? stat.value : '••••••';
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              key={stat.name}
              className="bg-white dark:bg-surface rounded-2xl p-6 border border-gray-200 dark:border-gray-800/60 shadow-sm dark:shadow-lg relative overflow-hidden group hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
            >
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/5 dark:bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/10 dark:group-hover:bg-primary/20 transition-colors" />
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <div className="flex items-center">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.name}</p>
                    {stat.name.includes('Balance') && (
                      <button onClick={toggleBalance} className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{stat.name.includes('Active') ? stat.value : displayValue}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center border border-gray-100 dark:border-gray-700">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Accounts (Left Col) */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Your Accounts</h3>
          {accounts?.map((acc, index) => (
            <motion.div 
              key={acc.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + (index * 0.1) }}
              onClick={() => setAccount(acc)}
              className={`rounded-2xl p-6 shadow-lg relative overflow-hidden cursor-pointer transition-all border-2 ${
                account?.id === acc.id 
                  ? 'bg-gradient-to-br from-primary to-blue-600 border-primary text-white scale-[1.02]' 
                  : 'bg-white dark:bg-surface border-transparent hover:border-gray-200 dark:hover:border-gray-700'
              }`}
            >
              {account?.id === acc.id && (
                <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
              )}
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <h3 className={`text-lg font-semibold ${account?.id === acc.id ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    {acc.nickname || `${acc.account_type} Account`}
                  </h3>
                  <p className={`text-xs mt-1 ${account?.id === acc.id ? 'text-white/80' : 'text-gray-500'}`}>
                    {acc.account_type}
                  </p>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setQrAccount(acc);
                  }}
                  className={`p-2 rounded-xl backdrop-blur-sm transition-colors ${
                    account?.id === acc.id 
                      ? 'bg-white/20 hover:bg-white/30 text-white' 
                      : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                  title="Show QR Code"
                >
                  <QrCode className="h-5 w-5" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setAccountToDelete(acc);
                    setShowDeleteModal(true);
                    setDeleteError(null);
                  }}
                  className={`p-2 rounded-xl backdrop-blur-sm transition-colors ml-2 ${
                    account?.id === acc.id 
                      ? 'bg-white/20 hover:bg-red-500/40 text-white' 
                      : 'bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-500/20 text-gray-400 hover:text-red-600'
                  }`}
                  title="Delete Account"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 relative z-10">
                <div className={`flex justify-between items-center text-sm ${account?.id === acc.id ? 'text-white/80' : 'text-gray-500'}`}>
                  <span className="font-mono">{acc.account_number.replace(/.(?=.{4})/g, '•')}</span>
                  <span className={account?.id === acc.id ? 'text-green-300' : 'text-green-500'}>Active</span>
                </div>
                <div className="pt-2 flex justify-between items-end">
                  <span className={`text-2xl font-bold ${account?.id === acc.id ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    {showBalance ? `₹${Number(acc.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '••••••'}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Add New Card Placeholder */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + (accounts?.length || 0) * 0.1 }}
            className="rounded-2xl p-6 border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer flex flex-col items-center justify-center group h-[180px]"
            onClick={() => navigate('/add-account')}
          >
            <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
              <PlusCircle className="h-6 w-6 text-gray-400 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-sm font-medium text-gray-500 group-hover:text-primary transition-colors">Add New Card/Account</p>
          </motion.div>
        </div>

        {/* Recent Transactions (Right Col) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-white dark:bg-surface rounded-2xl border border-gray-200 dark:border-gray-800/60 shadow-sm dark:shadow-lg overflow-hidden flex flex-col"
        >
          <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
            <Link to="/transactions" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
              View All
            </Link>
          </div>
          <div className="flex-1 overflow-auto">
            <ul className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {recentTransactions.map((transaction) => {
                const isIncome = transaction.type === 'Income';
                const formattedAmount = `₹${Number(transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                
                return (
                  <li key={transaction.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center border border-gray-200 dark:border-gray-700/50 group-hover:border-gray-300 dark:group-hover:border-gray-600 transition-colors">
                          {isIncome ? (
                            <ArrowDownRight className="h-5 w-5 text-secondary" />
                          ) : (
                            <ArrowUpRight className="h-5 w-5 text-gray-400 dark:text-gray-400" />
                          )}
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{transaction.description}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{transaction.category} • {new Date(transaction.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${isIncome ? 'text-secondary' : 'text-gray-900 dark:text-white'}`}>
                          {isIncome ? '+' : '-'}{formattedAmount}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Completed</p>
                      </div>
                    </div>
                  </li>
                );
              })}
              {recentTransactions.length === 0 && (
                <li className="p-6 text-center text-gray-500 text-sm">
                  No recent transactions.
                </li>
              )}
            </ul>
          </div>
        </motion.div>
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {qrAccount && (
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
              className="bg-white dark:bg-surface rounded-3xl shadow-2xl p-8 max-w-sm w-full relative flex flex-col items-center"
            >
              <button 
                onClick={() => setQrAccount(null)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
              
              <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <QrCode className="h-8 w-8 text-primary" />
              </div>
              
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Request Payment</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-6">
                Generate a QR code for your {qrAccount.nickname} account. You can optionally include an amount.
              </p>

              <div className="w-full mb-6">
                <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Requested Amount (Optional)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">₹</span>
                  <input 
                    type="number"
                    value={qrAmount}
                    onChange={(e) => setQrAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="bg-white p-4 rounded-3xl shadow-inner border border-gray-100 dark:border-gray-800 mb-6 flex justify-center">
                <QRCodeSVG 
                  value={qrAmount ? `qubix:${qrAccount.account_number}:${qrAmount}` : qrAccount.account_number} 
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#1a1a2e"
                  level="H"
                  includeMargin={false}
                />
              </div>

              <div className="w-full bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center border border-gray-100 dark:border-gray-800">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.email}</p>
                <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mt-1">A/C: {qrAccount.account_number}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && accountToDelete && (
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
              className="bg-white dark:bg-surface rounded-3xl shadow-2xl p-8 max-w-md w-full relative"
            >
              <div className={`h-16 w-16 rounded-2xl flex items-center justify-center mb-6 ${Number(accountToDelete.balance) > 0 ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}`}>
                <AlertTriangle className="h-8 w-8" />
              </div>
              
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {Number(accountToDelete.balance) > 0 ? 'Account Deletion Blocked' : 'Delete Account?'}
              </h2>
              
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                {Number(accountToDelete.balance) > 0 
                  ? `You cannot delete the account "${accountToDelete.nickname || accountToDelete.account_type}" because it has a positive balance of ₹${Number(accountToDelete.balance).toLocaleString()}. Please transfer the funds before closing.`
                  : `Are you sure you want to permanently delete your "${accountToDelete.nickname || accountToDelete.account_type}" account (${accountToDelete.account_number})? This action cannot be undone.`
                }
              </p>

              {deleteError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl p-3 mb-6">
                  {deleteError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                {Number(accountToDelete.balance) > 0 ? (
                  <>
                    <button 
                      onClick={() => setShowDeleteModal(false)}
                      className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-white rounded-xl font-medium transition-colors"
                    >
                      Close
                    </button>
                    <Link 
                      to="/transfer"
                      className="flex-1 px-6 py-3 bg-primary text-white rounded-xl font-medium text-center flex items-center justify-center"
                    >
                      Transfer Now <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => setShowDeleteModal(false)}
                      className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-white rounded-xl font-medium transition-colors"
                      disabled={isDeleting}
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleDeleteAccount}
                      className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete Account'}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
