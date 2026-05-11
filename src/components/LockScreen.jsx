import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Fingerprint, Loader2, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LockScreen({ children }) {
  const { user, userProfile, displayName, isUnlocked, setIsUnlocked } = useAuth();
  const navigate = useNavigate();
  
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Simple hashing function for PIN (must match SetupSecurity.jsx)
  const hashPIN = async (pinStr) => {
    const msgUint8 = new TextEncoder().encode(pinStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleBiometricAuth = useCallback(async () => {
    if (!userProfile?.biometric_enabled || !window.PublicKeyCredential) return;
    
    try {
      setError(null);
      
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          timeout: 60000,
          userVerification: "required"
        }
      });

      if (assertion) {
        setIsUnlocked(true);
      }
    } catch (err) {
      console.error(err);
      if (err.name !== 'NotAllowedError') {
        setError("Biometric authentication failed. Please use your PIN.");
      }
    }
  }, [userProfile, setIsUnlocked]);

  // Attempt biometric automatically on mount if enabled
  useEffect(() => {
    if (userProfile?.biometric_enabled && !isUnlocked && user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleBiometricAuth();
    }
  }, [handleBiometricAuth, userProfile?.biometric_enabled, isUnlocked, user]);

  // If no user, or unlocked, just render children
  if (!user || isUnlocked) {
    return <>{children}</>;
  }

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const hashedAttempt = await hashPIN(pin);
      if (hashedAttempt === userProfile?.pin_hash) {
        setIsUnlocked(true);
      } else {
        setError("Incorrect PIN. Please try again.");
        setPin('');
      }
    } catch {
      setError("An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleFallbackLogin = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 overflow-hidden transition-colors duration-200">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-50" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 bg-white dark:bg-surface border border-gray-200 dark:border-gray-800 rounded-3xl flex items-center justify-center shadow-2xl">
            {displayName !== 'User' ? (
              <span className="text-3xl font-bold text-primary">
                {displayName.charAt(0).toUpperCase()}
              </span>
            ) : (
              <Shield className="h-10 w-10 text-primary" />
            )}
          </div>
        </div>
        <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {displayName.split(' ')[0]}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
          App is locked for your security
        </p>

        <div className="mt-8 bg-white dark:bg-surface py-8 px-6 shadow-2xl sm:rounded-3xl sm:px-10 border border-gray-200 dark:border-gray-800/60 backdrop-blur-xl">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-sm rounded-xl p-4 mb-6 text-center">
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handlePinSubmit} className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Enter PIN</label>
              </div>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="6"
                autoFocus
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="block w-full text-center tracking-[1em] text-2xl font-bold py-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 dark:text-white transition-all"
                placeholder="••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70 group"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Unlock App'}
            </button>
          </form>

          {userProfile?.biometric_enabled && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-surface text-gray-500">Or use biometric</span>
                </div>
              </div>

              <button
                onClick={handleBiometricAuth}
                className="mt-6 w-full flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm text-sm font-medium text-gray-700 dark:text-white bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
              >
                <Fingerprint className="h-5 w-5 mr-2 text-primary" />
                Face ID / Touch ID
              </button>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 flex flex-col space-y-3">
            <button
              onClick={handleFallbackLogin}
              className="flex items-center justify-center text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Fallback to Email/Password
            </button>
            <button
              onClick={() => {
                 alert('To reset your PIN, please log in with your email and password, then go to Settings.');
                 handleFallbackLogin();
              }}
              className="text-xs text-center text-primary hover:text-primary/80 transition-colors"
            >
              Forgot PIN?
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
