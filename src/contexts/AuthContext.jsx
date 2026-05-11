/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [account, setAccount] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const fetchAccount = useCallback(async (userId) => {
    if (!userId) {
      setAccount(null);
      setAccounts([]);
      return;
    }
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
      
    if (!error && data) {
      setAccounts(data);
      if (data.length > 0 && !account) {
        setAccount(data[0]);
      } else if (data.length > 0 && account) {
        // If an account is already selected, try to find and update its latest state
        const updatedActive = data.find(a => a.id === account.id);
        setAccount(updatedActive || data[0]);
      } else {
        setAccount(null);
      }
    }

    // Fetch user profile
    const { data: profileData } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (profileData) {
      setUserProfile(profileData);
      // Determine if we should lock
      const hasPin = localStorage.getItem('has_pin') === 'true' || profileData.pin_hash != null;
      // We start locked if they have a PIN set up, and they haven't explicitly unlocked this session yet.
      // But we shouldn't overwrite if they just unlocked.
      setIsUnlocked(prev => {
        if (prev) return true; // Already unlocked in this JS context
        return !hasPin; // Unlocked if no PIN
      });
    } else {
      setUserProfile(null);
      setIsUnlocked(true);
    }
  }, [account]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) throw error;
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          fetchAccount(currentUser.id).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error("Error getting session:", error);
        setLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await fetchAccount(currentUser.id);
      } else {
        setAccount(null);
        setIsUnlocked(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchAccount]);

  // Real-time balance updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('account-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'accounts',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // Update the specific account in our local state instantly
          const updatedAccount = payload.new;
          setAccounts(prev => prev.map(acc => acc.id === updatedAccount.id ? updatedAccount : acc));
          
          // If this is the active account, update it too
          setAccount(prev => (prev && prev.id === updatedAccount.id) ? updatedAccount : prev);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const refreshAccount = useCallback(() => fetchAccount(user?.id), [fetchAccount, user]);

  const displayName = userProfile?.full_name || user?.user_metadata?.full_name || 'User';

  const value = {
    user,
    userProfile,
    displayName,
    account,
    accounts,
    setAccount,
    refreshAccount,
    loading,
    isUnlocked,
    setIsUnlocked
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="min-h-screen bg-gray-50 dark:bg-background flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
