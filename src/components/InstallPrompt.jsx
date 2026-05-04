import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    const installedHandler = () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      console.log('PWA was installed');
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-96 bg-white dark:bg-surface border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-4 z-50 flex items-start space-x-4"
        >
          <div className="flex-shrink-0 bg-primary/10 p-3 rounded-xl">
            <Download className="h-6 w-6 text-primary" />
          </div>
          
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Install Qubix Bank</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Add our app to your home screen for quick, offline access.
            </p>
            
            <div className="mt-3 flex space-x-3">
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-primary text-white text-sm font-medium py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Install
              </button>
              <button
                onClick={() => setShowPrompt(false)}
                className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
          
          <button 
            onClick={() => setShowPrompt(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 absolute top-2 right-2"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
