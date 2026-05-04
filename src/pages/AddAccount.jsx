import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Building2, PlusCircle, Type } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AddAccount() {
  const { user, refreshAccount } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    nickname: '',
    accountType: 'Savings'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      
      const { error: insertError } = await supabase
        .from('accounts')
        .insert([{
          user_id: user.id,
          account_number: accountNumber,
          balance: 0,
          account_type: formData.accountType,
          nickname: formData.nickname || `${formData.accountType} Account`
        }]);

      if (insertError) throw insertError;

      await refreshAccount();
      navigate('/');
    } catch (err) {
      if (err.message && err.message.includes('Lock')) {
        window.location.reload();
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add New Account</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Create a new account for your daily banking needs.</p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-surface rounded-2xl border border-gray-200 dark:border-gray-800/60 shadow-sm dark:shadow-xl overflow-hidden relative p-8"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        
        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger text-sm rounded-xl p-4 flex items-start">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Account Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {['Savings', 'Current', 'Fixed Deposit'].map((type) => (
                <div
                  key={type}
                  onClick={() => setFormData({ ...formData, accountType: type })}
                  className={`cursor-pointer rounded-xl border p-4 flex flex-col items-center justify-center transition-all ${
                    formData.accountType === type 
                      ? 'border-primary bg-primary/5 text-primary' 
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Building2 className={`h-6 w-6 mb-2 ${formData.accountType === type ? 'text-primary' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium">{type}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Account Nickname
            </label>
            <div className="relative rounded-xl shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Type className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                className="block w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                placeholder="e.g. My Salary Account"
                required
              />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Give your account a descriptive name so you can easily identify it.
            </p>
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
                  Creating Account...
                </span>
              ) : (
                <span className="flex items-center">
                  <PlusCircle className="mr-2 h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
                  Create {formData.accountType} Account
                </span>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
