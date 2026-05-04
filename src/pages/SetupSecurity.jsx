import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Smartphone, Loader2, Lock, Fingerprint, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SetupSecurity() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: PIN setup, 2: Face ID / Touch ID setup
  
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Simple hashing function for PIN (for demonstration purposes)
  const hashPIN = async (pin) => {
    const msgUint8 = new TextEncoder().encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleSavePin = async (e) => {
    e.preventDefault();
    if (pin.length < 4 || pin.length > 6) {
      setError("PIN must be 4-6 digits");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const hashedPin = await hashPIN(pin);
      
      const { error: dbError } = await supabase
        .from('users')
        .upsert({ 
          id: user.id, 
          email: user.email,
          full_name: user.user_metadata?.full_name || '',
          pin_hash: hashedPin,
          biometric_enabled: false // default false until set up
        });

      if (dbError) throw dbError;
      
      // Save device
      const { error: deviceError } = await supabase.from('devices').insert({
        user_id: user.id,
        device_name: navigator.userAgent.split(') ')[0].split('(')[1] || 'Web Browser',
        last_active: new Date().toISOString()
      });
      if (deviceError) {
        console.log('Device insert failed, table might not exist yet', deviceError);
      }

      localStorage.setItem('has_pin', 'true');
      setStep(2); // Move to Face ID setup
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupBiometric = async () => {
    setLoading(true);
    setError(null);
    try {
      // Mock / Client-side only WebAuthn setup
      if (!window.PublicKeyCredential) {
        throw new Error("Biometric authentication is not supported on this device/browser.");
      }

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      // We call the native WebAuthn API
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: {
            name: "Qubix Bank",
            id: window.location.hostname
          },
          user: {
            id: userId,
            name: user.email,
            displayName: user.email
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 }, // ES256
            { type: "public-key", alg: -257 } // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required"
          },
          timeout: 60000,
        }
      });

      if (credential) {
        // Success
        await supabase
          .from('users')
          .update({ biometric_enabled: true })
          .eq('id', user.id);
          
        localStorage.setItem('biometric_enabled', 'true');
        finishSetup();
      }
    } catch (err) {
      console.error(err);
      if (err.name === 'NotAllowedError') {
        setError("Biometric registration was cancelled or denied.");
      } else {
        setError(err.message || "Failed to set up Face ID / Touch ID.");
      }
    } finally {
      setLoading(false);
    }
  };

  const finishSetup = () => {
    // Proceed to app
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-200">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-50" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-white dark:bg-surface border border-gray-200 dark:border-gray-800 rounded-2xl flex items-center justify-center shadow-xl">
            <Shield className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Secure Your Account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
          Step {step} of 2
        </p>
      </motion.div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white dark:bg-surface py-8 px-4 shadow-xl dark:shadow-2xl sm:rounded-2xl sm:px-10 border border-gray-200 dark:border-gray-800/60 backdrop-blur-xl overflow-hidden">
          
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-danger/10 border border-danger/20 text-danger text-sm rounded-xl p-4 mb-6 flex items-start">
              <span className="block sm:inline">{error}</span>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="text-center mb-6">
                  <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                    <Lock className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create a PIN</h3>
                  <p className="text-sm text-gray-500 mt-1">Set a 4 to 6 digit PIN for quick access to your account.</p>
                </div>

                <form onSubmit={handleSavePin} className="space-y-6">
                  <div>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength="6"
                      required
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="block w-full text-center tracking-[1em] text-2xl font-bold py-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 dark:text-white transition-all"
                      placeholder="••••"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">Confirm PIN</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength="6"
                      required
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      className="block w-full text-center tracking-[1em] text-2xl font-bold py-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 dark:text-white transition-all"
                      placeholder="••••"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || pin.length < 4}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70 group"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continue'}
                  </button>
                </form>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="text-center"
              >
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Fingerprint className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Enable Face ID / Touch ID</h3>
                <p className="text-sm text-gray-500 mt-2 mb-8 px-4">
                  Log in faster and more securely using your device's biometric authentication.
                </p>

                <div className="space-y-4">
                  <button
                    onClick={handleSetupBiometric}
                    disabled={loading}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-all disabled:opacity-70"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enable Biometrics'}
                  </button>
                  <button
                    onClick={finishSetup}
                    disabled={loading}
                    className="w-full flex justify-center items-center py-3 px-4 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                  >
                    Skip for now
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}
