import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, CheckCircle2, AlertCircle, Loader2, ArrowLeft, CreditCard, Clock, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function PaymentPortal() {
  const [searchParams] = useSearchParams();
  const linkId = searchParams.get('id');
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentLink, setPaymentLink] = useState(null);
  const [recipient, setRecipient] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    senderName: '',
    remarks: ''
  });
  const [referenceId, setReferenceId] = useState('');

  useEffect(() => {
    const fetchLinkDetails = async () => {
      if (!linkId) {
        setError('Missing payment link ID.');
        setLoading(false);
        return;
      }

      try {
        // Fetch link and recipient details
        const { data, error: fetchError } = await supabase
          .from('payment_links')
          .select(`
            *,
            accounts!sender_account (
              nickname,
              account_type,
              account_number
            )
          `)
          .eq('id', linkId)
          .single();

        if (fetchError || !data) {
          setError('Invalid or expired payment link.');
        } else if (data.status !== 'pending') {
          setError(`This payment link has already been ${data.status}.`);
        } else if (new Date(data.expires_at) < new Date()) {
          setError('This payment link has expired.');
          // Optionally update status to expired in DB
          await supabase.from('payment_links').update({ status: 'expired' }).eq('id', linkId);
        } else {
          setPaymentLink(data);
          setRecipient(data.accounts);
          setFormData(prev => ({ ...prev, amount: data.amount || '' }));
        }
      } catch (err) {
        console.error('Error loading link:', err);
        setError('Failed to load payment details.');
      } finally {
        setLoading(false);
      }
    };

    fetchLinkDetails();
  }, [linkId]);

  const handlePayment = async (e) => {
    e.preventDefault();
    setProcessing(true);
    setError(null);

    const amountNum = Number(formData.amount);
    if (amountNum <= 0) {
      setError('Please enter a valid amount.');
      setProcessing(false);
      return;
    }

    try {
      const refId = 'PAY' + Math.floor(100000000 + Math.random() * 900000000);
      setReferenceId(refId);

      // 1. Process the transfer using the guest account
      const { error: rpcError } = await supabase.rpc('transfer_funds', {
        p_sender_account: '0000000000', // System/Guest account
        p_recipient_account: recipient.account_number,
        p_amount: amountNum,
        p_remarks: `Payment Link from ${formData.senderName}`
      });

      if (rpcError) throw rpcError;

      // 2. Update the payment link status
      const { error: updateError } = await supabase
        .from('payment_links')
        .update({ 
          status: 'paid',
          amount: amountNum // In case it was a flexible amount link
        })
        .eq('id', linkId);

      if (updateError) console.error('Error updating link status:', updateError);

      setSuccess(true);
    } catch (err) {
      console.error('Payment error:', err);
      setError('Payment failed. Please try again or check your connection.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-background flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400 font-medium animate-pulse">Initializing secure gateway...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background py-12 px-4 font-inter">
      <div className="max-w-md mx-auto">
        {/* Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/30 mb-4 transform hover:scale-105 transition-transform duration-300">
            <ShieldCheck className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Qubix Pay</h1>
          <div className="flex items-center mt-1">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-widest">Secure Payment Portal</p>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-surface rounded-[2.5rem] border border-gray-200 dark:border-gray-800 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {!success ? (
              <motion.div 
                key="payment-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-8 md:p-10"
              >
                {error && (
                  <div className="mb-8 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm rounded-2xl p-5 flex items-start shadow-sm">
                    <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
                    <div className="font-medium">{error}</div>
                  </div>
                )}

                {!error && recipient && (
                  <form onSubmit={handlePayment} className="space-y-8">
                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-3xl blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                      <div className="relative bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-6 border border-gray-100 dark:border-gray-800">
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black mb-3">Request From</p>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-white dark:bg-surface flex items-center justify-center border border-gray-200 dark:border-gray-700 shadow-sm">
                            <span className="text-xl font-bold text-primary">{recipient.nickname?.[0] || 'Q'}</span>
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                              {recipient.nickname || `${recipient.account_type} Account`}
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                              Qubix Verified Merchant
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">
                          Amount to Pay
                        </label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                            <span className="text-gray-400 dark:text-gray-500 font-bold text-2xl">₹</span>
                          </div>
                          <input
                            type="number"
                            required
                            readOnly={!!paymentLink?.amount}
                            value={formData.amount}
                            onChange={(e) => setFormData({...formData, amount: e.target.value})}
                            className={`block w-full pl-12 pr-6 py-5 bg-gray-50 dark:bg-gray-900 border-2 ${paymentLink?.amount ? 'border-transparent' : 'border-gray-100 dark:border-gray-800 focus:border-primary'} rounded-3xl focus:ring-0 text-gray-900 dark:text-white font-mono text-3xl font-bold transition-all placeholder:text-gray-300 dark:placeholder:text-gray-700 shadow-inner`}
                            placeholder="0.00"
                          />
                          {paymentLink?.amount && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                              <ShieldCheck className="h-6 w-6 text-green-500" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-6">
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">
                            Your Details
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.senderName}
                            onChange={(e) => setFormData({...formData, senderName: e.target.value})}
                            className="block w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-2xl focus:border-primary focus:ring-0 text-gray-900 dark:text-white font-medium transition-all"
                            placeholder="Enter your full name"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={processing}
                        className="group relative w-full overflow-hidden rounded-2xl bg-primary px-8 py-5 text-lg font-bold text-white shadow-xl transition-all hover:bg-primary/90 hover:shadow-primary/25 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
                      >
                        <div className="relative z-10 flex items-center justify-center">
                          {processing ? (
                            <>
                              <Loader2 className="h-6 w-6 mr-3 animate-spin" />
                              Verifying Transaction...
                            </>
                          ) : (
                            <>
                              <CreditCard className="mr-3 h-6 w-6" />
                              Confirm & Pay ₹{Number(formData.amount || 0).toLocaleString('en-IN')}
                            </>
                          )}
                        </div>
                        <div className="absolute inset-0 z-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <div className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        Expires {new Date(paymentLink.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(paymentLink.expires_at).toLocaleDateString()}
                      </div>
                    </div>
                  </form>
                )}

                {error && (
                  <div className="text-center py-4">
                    <Link 
                      to="/" 
                      className="inline-flex items-center text-primary font-bold hover:underline group"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                      Back to Qubix Bank
                    </Link>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="payment-success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-10 text-center"
              >
                <div className="mx-auto relative w-24 h-24 mb-8">
                  <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
                  <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-green-100 dark:bg-green-500/20 border-4 border-white dark:border-surface shadow-lg">
                    <CheckCircle2 className="h-14 w-14 text-green-600 dark:text-green-400" />
                  </div>
                </div>

                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">Payment Sent!</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-10 font-medium">
                  ₹{Number(formData.amount).toLocaleString('en-IN')} successfully transferred to {recipient.nickname}.
                </p>
                
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-[2rem] p-6 mb-10 text-left border border-gray-100 dark:border-gray-800 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Transaction ID</span>
                    <span className="text-gray-900 dark:text-white font-mono text-sm font-bold">{referenceId}</span>
                  </div>
                  <div className="h-px bg-gray-200 dark:bg-gray-800 w-full"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Date & Time</span>
                    <span className="text-gray-900 dark:text-white text-xs font-bold">{new Date().toLocaleString()}</span>
                  </div>
                  <div className="h-px bg-gray-200 dark:bg-gray-800 w-full"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Status</span>
                    <span className="text-green-600 bg-green-50 dark:bg-green-500/10 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">Settled</span>
                  </div>
                </div>

                <Link
                  to="/"
                  className="group inline-flex items-center justify-center w-full px-8 py-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl font-bold transition-all hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <ArrowLeft className="h-5 w-5 mr-2 group-hover:-translate-x-1 transition-transform" />
                  Return to Merchant
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="flex flex-col items-center gap-4 mt-12 opacity-50">
          <div className="flex items-center gap-6">
            <div className="h-8 w-20 bg-gray-300 dark:bg-gray-700 rounded blur-[1px]"></div>
            <div className="h-8 w-16 bg-gray-300 dark:bg-gray-700 rounded blur-[1px]"></div>
            <div className="h-8 w-24 bg-gray-300 dark:bg-gray-700 rounded blur-[1px]"></div>
          </div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] flex items-center">
            <ShieldCheck className="h-3 w-3 mr-2" />
            End-to-End Encrypted Secure Checkout
          </p>
        </div>
      </div>
    </div>
  );
}
