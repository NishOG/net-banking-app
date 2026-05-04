import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { motion } from 'framer-motion';
import { 
  User, Mail, Calendar, Settings as SettingsIcon, 
  Bell, Shield, Monitor, Info, Loader2, CheckCircle2,
  Lock, Smartphone, ExternalLink, Moon, Sun, Type, Fingerprint
} from 'lucide-react';

export default function Settings() {
  const { user, account } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [activeTab, setActiveTab] = useState('account');
  const [devices, setDevices] = useState([]);
  
  // Settings State
  const [settings, setSettings] = useState({
    full_name: '',
    auto_salary_enabled: true,
    salary_amount: 15000,
    next_salary_date: null,
    last_salary_date: null,
    email_notifications: true,
    transaction_alerts: true,
    salary_alerts: true,
    two_factor_enabled: false,
    biometric_enabled: false
  });

  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  console.log("Settings rendering. Loading:", loading, "ActiveTab:", activeTab);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    
    try {
      console.log("Fetching settings for user:", user.id);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') {
          // No profile found, meaning table might not exist or row doesn't exist
          // We will attempt to insert a default row if it doesn't exist, though it's better handled via trigger.
          // For now, ignore PGRST116 (No rows found).
          console.log("No settings found for user yet.");
        } else {
          throw error;
        }
      } else if (data) {
        setSettings(data);
      }
      
      // Fetch devices
      const { data: devicesData } = await supabase
        .from('devices')
        .select('*')
        .eq('user_id', user.id);
      
      if (devicesData) setDevices(devicesData);
      
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      console.log("Finished fetching settings");
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveSettings = async (e) => {
    e?.preventDefault();
    if (!user) return;
    
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    
    try {
      const { error } = await supabase
        .from('users')
        .upsert({ 
          id: user.id,
          ...settings
        });
        
      if (error) throw error;
      
      setSuccessMsg('Settings saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setErrorMsg('Failed to save settings. Make sure you have created the public.users table as per the setup guide.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }
    
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });
      if (error) throw error;
      
      setSuccessMsg('Password updated successfully!');
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoutAllDevices = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      setSuccessMsg('Logged out from all other devices.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const TABS = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'salary', label: 'Salary', icon: SettingsIcon },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'biometric', label: 'Biometric Security', icon: Fingerprint },
    { id: 'appearance', label: 'Appearance', icon: Monitor },
    { id: 'about', label: 'About', icon: Info },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your account preferences and configurations.</p>
        </div>
      </div>

      {successMsg && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl flex items-center">
          <CheckCircle2 className="h-5 w-5 mr-2" />
          {successMsg}
        </motion.div>
      )}

      {errorMsg && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl flex items-center">
          <Info className="h-5 w-5 mr-2" />
          {errorMsg}
        </motion.div>
      )}

      <div className="bg-white dark:bg-surface rounded-2xl border border-gray-200 dark:border-gray-800/60 overflow-hidden shadow-sm flex flex-col md:flex-row">
        {/* Settings Sidebar */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20 p-4 space-y-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                  isActive 
                    ? 'bg-primary text-white shadow-md' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className={`h-5 w-5 mr-3 ${isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Settings Content */}
        <div className="flex-1 p-6 md:p-8">
          
          {/* Account Settings */}
          {activeTab === 'account' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">Account Profile</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                    <input 
                      type="text" 
                      value={settings.full_name || ''} 
                      onChange={e => setSettings({...settings, full_name: e.target.value})}
                      className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="John Doe"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                    <div className="flex relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input 
                        type="email" 
                        value={user?.email || ''} 
                        disabled
                        className="w-full bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Contact support to change your email address.</p>
                  </div>

                  {account && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Number</label>
                      <input 
                        type="text" 
                        value={account.account_number || ''} 
                        disabled
                        className="w-full bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-gray-500 dark:text-gray-400 cursor-not-allowed font-mono tracking-widest"
                      />
                    </div>
                  )}
                  
                  <div className="pt-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <Calendar className="h-4 w-4 mr-2" />
                    Account created on {new Date(user?.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              
              <div className="pt-4">
                <button 
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center disabled:opacity-70"
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </motion.div>
          )}

          {/* Salary Settings */}
          {activeTab === 'salary' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">Auto-Salary Configuration</h3>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Enable Auto-Salary</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Automatically credit salary on the 1st of every month</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={settings.auto_salary_enabled}
                        onChange={e => setSettings({...settings, auto_salary_enabled: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  
                  <div className={!settings.auto_salary_enabled ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Salary Amount (₹)</label>
                    <input 
                      type="number" 
                      value={settings.salary_amount} 
                      onChange={e => setSettings({...settings, salary_amount: e.target.value})}
                      className="w-full md:w-1/2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      min="1000"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-800 rounded-xl">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Next Salary Date</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {settings.next_salary_date ? new Date(settings.next_salary_date).toLocaleDateString() : 'Not scheduled'}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-800 rounded-xl">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Last Salary Date</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {settings.last_salary_date ? new Date(settings.last_salary_date).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="pt-4">
                <button 
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center disabled:opacity-70"
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Settings
                </button>
              </div>
            </motion.div>
          )}

          {/* Notifications Settings */}
          {activeTab === 'notifications' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">Notification Preferences</h3>
                
                <div className="space-y-4">
                  {[
                    { id: 'email_notifications', title: 'Email Notifications', desc: 'Receive general updates via email' },
                    { id: 'transaction_alerts', title: 'Transaction Alerts', desc: 'Get notified for every transfer and payment' },
                    { id: 'salary_alerts', title: 'Salary Alerts', desc: 'Get notified when your salary is credited' }
                  ].map(item => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">{item.title}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={settings[item.id]}
                          onChange={e => setSettings({...settings, [item.id]: e.target.checked})}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="pt-4">
                <button 
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center disabled:opacity-70"
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Preferences
                </button>
              </div>
            </motion.div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-4 mb-4 flex items-center">
                  <Lock className="h-5 w-5 mr-2 text-primary" />
                  Change Password
                </h3>
                
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                    <input 
                      type="password" 
                      required
                      value={passwordForm.newPassword}
                      onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                      className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                    <input 
                      type="password" 
                      required
                      value={passwordForm.confirmPassword}
                      onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                      className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors flex items-center disabled:opacity-70"
                  >
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Update Password
                  </button>
                </form>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">Device Management</h3>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
                  <div className="flex items-start">
                    <Smartphone className="h-6 w-6 text-gray-400 mt-0.5 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Sign out everywhere</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">If you lost a device or noticed suspicious activity.</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleLogoutAllDevices}
                    disabled={saving}
                    className="px-4 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 rounded-lg font-medium transition-colors"
                  >
                    Log out other devices
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">Two-Factor Authentication</h3>
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Enable 2FA</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Add an extra layer of security to your account.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={settings.two_factor_enabled}
                      onChange={e => {
                        setSettings({...settings, two_factor_enabled: e.target.checked});
                        handleSaveSettings();
                      }}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>

            </motion.div>
          )}

          {/* Biometric Settings */}
          {activeTab === 'biometric' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">Face ID / Touch ID</h3>
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Enable Biometric Login</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Unlock your app securely using your device's biometrics.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={settings.biometric_enabled}
                      onChange={e => {
                        const enabled = e.target.checked;
                        setSettings({...settings, biometric_enabled: enabled});
                        localStorage.setItem('biometric_enabled', String(enabled));
                      }}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">App PIN</h3>
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Change Access PIN</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Update your 4-6 digit app lock PIN.</p>
                  </div>
                  <button 
                    onClick={() => {
                      alert('To change your PIN, please sign out and register a new security profile, or contact support. (Mocked)');
                    }}
                    className="px-4 py-2 text-sm text-primary bg-primary/10 hover:bg-primary/20 rounded-lg font-medium transition-colors"
                  >
                    Change PIN
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">Registered Devices</h3>
                <div className="space-y-3">
                  {devices.length > 0 ? devices.map(device => (
                    <div key={device.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
                      <div className="flex items-center">
                        <Smartphone className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{device.device_name}</p>
                          <p className="text-xs text-gray-500 mt-1">Last active: {new Date(device.last_active).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {/* Would have a remove device button here in real app */}
                    </div>
                  )) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No registered devices found.</p>
                  )}
                </div>
              </div>
              
              <div className="pt-4">
                <button 
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center disabled:opacity-70"
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Security Settings
                </button>
              </div>
            </motion.div>
          )}

          {/* Appearance Settings */}
          {activeTab === 'appearance' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">Theme Preferences</h3>
                
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <button
                    onClick={() => !isDarkMode && toggleTheme()}
                    className={`flex flex-col items-center p-6 border-2 rounded-2xl transition-all ${
                      !isDarkMode ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center mb-3">
                      <Sun className="h-6 w-6 text-yellow-600" />
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">Light Mode</span>
                  </button>
                  
                  <button
                    onClick={() => isDarkMode && toggleTheme()}
                    className={`flex flex-col items-center p-6 border-2 rounded-2xl transition-all ${
                      isDarkMode ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                      <Moon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">Dark Mode</span>
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">Font Size</h3>
                <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 max-w-md">
                   <Type className="h-4 w-4 text-gray-400" />
                   <input type="range" className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700" min="1" max="3" defaultValue="2" />
                   <Type className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 mt-2">Adjusting font size is currently in beta.</p>
              </div>

            </motion.div>
          )}

          {/* About Settings */}
          {activeTab === 'about' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Qubix Bank</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Version 1.0.0</p>
              </div>
              
              <div className="space-y-2">
                <a href="#" className="flex items-center justify-between p-4 bg-white dark:bg-surface border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                  <span className="font-medium text-gray-900 dark:text-white">Privacy Policy</span>
                  <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                </a>
                <a href="#" className="flex items-center justify-between p-4 bg-white dark:bg-surface border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                  <span className="font-medium text-gray-900 dark:text-white">Terms & Conditions</span>
                  <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                </a>
                <a href="/support" className="flex items-center justify-between p-4 bg-white dark:bg-surface border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                  <span className="font-medium text-gray-900 dark:text-white">Contact Support</span>
                  <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                </a>
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
}
