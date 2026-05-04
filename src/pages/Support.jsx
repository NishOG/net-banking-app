import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, 
  MessageCircle, 
  Mail, 
  Clock, 
  ChevronDown,
  HelpCircle
} from 'lucide-react';

const FAQS = [
  {
    question: "How to transfer money?",
    answer: "Go to the 'Fund Transfer' page from the sidebar. You can either manually enter the recipient's 10-digit account number and amount, or use the 'Scan & Pay' feature to automatically fill in their details by scanning their account QR code."
  },
  {
    question: "How to pay bills?",
    answer: "Navigate to the 'Bill Payments' section. You can select the type of bill (Electricity, Water, Internet, Mobile), enter your consumer number, and proceed to pay directly from your active account balance."
  },
  {
    question: "How to apply for a loan?",
    answer: "Visit the 'Loans' page and click on 'Request Loan'. Enter the desired amount, specify a due date, and provide a reason. This will send a request through our Smart Lending system to potential lenders."
  },
  {
    question: "How to download statement?",
    answer: "Go to the 'Transactions' page. On the top right, you will see a 'Download PDF' button. Clicking this will automatically generate and download a comprehensive statement of all your transactions."
  }
];

export default function Support() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <HelpCircle className="h-6 w-6 mr-3 text-primary" />
          Help & Support
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">We're here to help! Reach out to us through any of the channels below.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Phone Support */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-surface rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col items-center text-center group hover:border-primary/50 transition-colors"
        >
          <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Phone className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Customer Care</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Toll free, 24/7 Support</p>
          <a href="tel:18005728492" className="text-lg font-bold text-primary">1800-572-8492</a>
        </motion.div>

        {/* WhatsApp Support */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-surface rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col items-center text-center group hover:border-[#25D366]/50 transition-colors"
        >
          <div className="h-12 w-12 bg-[#25D366]/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <MessageCircle className="h-6 w-6 text-[#25D366]" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">WhatsApp</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Chat with our digital assistant</p>
          <a 
            href="https://wa.me/919876543210" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm font-bold text-[#25D366] hover:underline"
          >
            +91 98765 43210
          </a>
        </motion.div>

        {/* Email Support */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-surface rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col items-center text-center group hover:border-secondary/50 transition-colors"
        >
          <div className="h-12 w-12 bg-secondary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Mail className="h-6 w-6 text-secondary" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Email Us</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Get detailed resolutions</p>
          <a href="mailto:support@qubixbank.com" className="text-sm font-bold text-secondary hover:underline break-all">
            support@qubixbank.com
          </a>
        </motion.div>

        {/* Operating Hours */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-surface rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col items-center text-center"
        >
          <div className="h-12 w-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center mb-4">
            <Clock className="h-6 w-6 text-gray-600 dark:text-gray-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Support Hours</h3>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Mon-Sat</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">9:00 AM to 6:00 PM IST</p>
        </motion.div>
      </div>

      {/* FAQ Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white dark:bg-surface rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden"
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Frequently Asked Questions</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {FAQS.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={index} className="bg-white dark:bg-surface">
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{faq.question}</span>
                  <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-4 pt-0 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
