import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, FileText, CheckCircle2, ScanLine, X, Loader2, QrCode, Share2, Copy, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { processAutoRepayment } from '../utils/loanHelpers';

export default function FundTransfer() {
  const { user, account, accounts, refreshAccount, loading: authLoading } = useAuth();
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
  const [recipientInfo, setRecipientInfo] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [recentRecipients, setRecentRecipients] = useState([]);
  const [activeTab, setActiveTab] = useState('send'); // 'send' or 'receive'
  const [copySuccess, setCopySuccess] = useState(false);
  const [payLinkAmount, setPayLinkAmount] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);

  // Optimized Account Lookup
  useEffect(() => {
    const verifyAccount = async () => {
      const accNum = formData.recipientAccount.trim();
      if (accNum.length === 10) {
        setIsVerifying(true);
        setError(null);
        try {
          const { data, error: fetchError } = await supabase
            .from('accounts')
            .select('*')
            .eq('account_number', accNum)
            .single();
          if (!fetchError && data) {
            setRecipientInfo(data);
          } else {
            setRecipientInfo(null);
          }
        } catch {
          setRecipientInfo(null);
        } finally {
          setIsVerifying(false);
        }
      } else {
        setRecipientInfo(null);
      }
    };
    const timer = setTimeout(verifyAccount, 500);
    return () => clearTimeout(timer);
  }, [formData.recipientAccount]);

  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner("qr-reader", { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      }, false);
      scanner.render((decodedText) => {
        if (decodedText.startsWith('qubix:')) {
          const [, account, amount] = decodedText.split(':');
          setFormData(prev => ({ ...prev, recipientAccount: account || '', amount: amount || prev.amount }));
        } else {
          setFormData(prev => ({ ...prev, recipientAccount: decodedText }));
        }
        setShowScanner(false);
        scanner.clear();
      }, () => {});
      return () => { scanner.clear().catch(console.error); };
    }
  }, [showScanner]);

  const handleTransfer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const amountNum = Number(formData.amount);
    const recipientAccNum = formData.recipientAccount.trim();

    if (amountNum <= 0) { setError('Invalid amount'); setLoading(false); return; }
    if (recipientAccNum.length !== 10) { setError('Invalid account number'); setLoading(false); return; }
    if (!account) { setError('Sender account not found'); setLoading(false); return; }
    if (amountNum > Number(account.balance)) { setError('Insufficient balance'); setLoading(false); return; }

    // TIMEOUT WRAPPER (5 SECONDS)
    const transferPromise = supabase.rpc('transfer_funds_fast', {
      p_sender_account: account.account_number,
      p_recipient_account: recipientAccNum,
      p_amount: amountNum,
      p_remarks: formData.remarks || 'P2P Transfer'
    });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), 5000)
    );

    try {
      // Race the transfer against the 5s timeout
      const result = await Promise.race([transferPromise, timeoutPromise]);
      const { data, error: rpcError } = result;

      if (rpcError) throw rpcError;
      if (data?.status === 'error') throw new Error(data.message);

      const refId = 'TRX' + Math.floor(100000000 + Math.random() * 900000000);
      setReferenceId(refId);
      
      // Refresh balance in background
      refreshAccount();
      
      // Auto-repay trigger
      processAutoRepayment(recipientAccNum, '');
      
      setStep(2);
    } catch (err) {
      if (err.message === 'TIMEOUT') {
        setError('Transfer is taking longer than expected. Please check your transaction history in a moment.');
      } else {
        setError(err.message || 'Transfer failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const generatePaymentLink = async () => {
    if (!account) return;
    setIsGenerating(true);
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      const { data, error } = await supabase.from('payment_links').insert({
        sender_account: account.account_number,
        amount: payLinkAmount ? Number(payLinkAmount) : null,
        expires_at: expiresAt.toISOString(),
        status: 'pending'
      }).select().single();
      if (error) throw error;
      setGeneratedLink({ ...data, url: `${window.location.origin}/pay?id=${data.id}` });
    } catch (err) { setError('Failed to generate link'); } finally { setIsGenerating(false); }
  };

  const handleReset = () => {
    setFormData({ recipientAccount: '', amount: '', remarks: '' });
    setError(null);
    setStep(1);
    setGeneratedLink(null);
  };

  if (authLoading && !account) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-2xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fund Transfer</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Send or receive money securely.</p>
        {account && (
          <p className="text-gray-700 dark:text-gray-300 text-sm mt-2 font-medium">
            Available Balance: ₹{Number(account.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>

      <div className="flex p-1 bg-gray-100 dark:bg-gray-900/50 rounded-2xl mb-6 max-w-sm">
        <button onClick={() => setActiveTab('send')} className={`flex-1 flex items-center justify-center py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'send' ? 'bg-white dark:bg-surface text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Send className="h-4 w-4 mr-2" /> Send Money
        </button>
        <button onClick={() => setActiveTab('receive')} className={`flex-1 flex items-center justify-center py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'receive' ? 'bg-white dark:bg-surface text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <QrCode className="h-4 w-4 mr-2" /> Receive Money
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'send' ? (
          <motion.div key="send" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white dark:bg-surface rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gray-100 dark:bg-gray-800">
              <motion.div className="h-full bg-primary" initial={{ width: '50%' }} animate={{ width: step === 1 ? '50%' : '100%' }} />
            </div>

            {step === 1 ? (
              <div className="p-8">
                <form onSubmit={handleTransfer} className="space-y-6">
                  {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm rounded-xl p-4 font-medium">{error}</div>}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex justify-between">
                      <span>Recipient Account Number</span>
                      <button type="button" onClick={() => setShowScanner(true)} className="text-primary text-xs font-bold flex items-center"><ScanLine className="h-4 w-4 mr-1" /> Scan</button>
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={formData.recipientAccount}
                        onChange={(e) => setFormData({...formData, recipientAccount: e.target.value})}
                        className="block w-full pl-11 pr-12 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary text-gray-900 dark:text-white"
                        placeholder="10-digit Account Number"
                      />
                      {isVerifying && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
                    </div>
                    {recipientInfo && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center text-xs font-bold text-green-600 bg-green-50 dark:bg-green-500/10 p-3 rounded-xl border border-green-100">
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Recipient: {recipientInfo.nickname} ({recipientInfo.account_type})
                      </motion.div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amount (₹)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                      <input
                        type="number"
                        required
                        value={formData.amount}
                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                        className="block w-full pl-8 pr-4 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary text-gray-900 dark:text-white font-mono text-lg"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <FileText className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
                    <textarea
                      value={formData.remarks}
                      onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                      className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary text-gray-900 dark:text-white resize-none"
                      placeholder="Remarks (Optional)"
                      rows={2}
                    />
                  </div>

                  <button disabled={loading} type="submit" className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50">
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="animate-spin h-5 w-5 mr-3" />
                        Processing...
                      </div>
                    ) : "Transfer Funds"}
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 dark:bg-green-500/20 mb-6 shadow-inner">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Transfer Successful</h2>
                <p className="text-gray-500 mb-8 font-medium">₹{parseFloat(formData.amount).toLocaleString('en-IN')} sent to {formData.recipientAccount}</p>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-6 mb-8 text-left text-sm space-y-3 border border-gray-100 dark:border-gray-800">
                  <div className="flex justify-between items-center"><span className="text-gray-400 font-bold uppercase text-[10px]">Reference ID</span><span className="font-mono font-bold">{referenceId}</span></div>
                  <div className="h-px bg-gray-100 dark:bg-gray-800 w-full" />
                  <div className="flex justify-between items-center"><span className="text-gray-400 font-bold uppercase text-[10px]">Date</span><span className="font-bold">{new Date().toLocaleString()}</span></div>
                </div>
                <button onClick={handleReset} className="w-full py-4 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Done</button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="receive" className="bg-white dark:bg-surface rounded-3xl border border-gray-200 dark:border-gray-800 p-8 text-center shadow-sm">
            {!generatedLink ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                    <QrCode className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Receive Money</h3>
                  <p className="text-sm text-gray-500">Generate a payment link to get paid instantly.</p>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                  <input type="number" value={payLinkAmount} onChange={e => setPayLinkAmount(e.target.value)} className="block w-full pl-8 p-3.5 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200" placeholder="Amount (Optional)" />
                </div>
                <button onClick={generatePaymentLink} disabled={isGenerating} className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20">{isGenerating ? "Generating..." : "Get Payment Link"}</button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-6 bg-white rounded-3xl inline-block shadow-inner border border-gray-50">
                  <QRCodeSVG value={generatedLink.url} size={200} />
                </div>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                  <p className="text-xs truncate flex-1 text-left font-medium opacity-60">{generatedLink.url}</p>
                  <button onClick={() => { navigator.clipboard.writeText(generatedLink.url); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }} className="p-2 text-primary hover:bg-primary/5 rounded-lg">{copySuccess ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setGeneratedLink(null)} className="py-4 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold">Back</button>
                  <button onClick={() => { if(navigator.share) navigator.share({title: 'Qubix Bank Pay', url: generatedLink.url}); }} className="py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center"><Share2 className="h-4 w-4 mr-2" /> Share</button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-surface rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold flex items-center"><ScanLine className="h-5 w-5 mr-2 text-primary" /> Scan QR Code</h3>
              <button onClick={() => setShowScanner(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 bg-gray-50">
              <div id="qr-reader" className="w-full rounded-2xl overflow-hidden bg-white shadow-sm border-2 border-dashed border-gray-200"></div>
              <p className="text-center text-xs text-gray-500 mt-4">Place the QR code within the frame</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
