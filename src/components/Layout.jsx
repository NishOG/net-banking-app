import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Send, 
  History, 
  Receipt, 
  LogOut, 
  Wallet,
  Sun,
  Moon,
  Handshake,
  Headphones,
  HelpCircle,
  Settings
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import clsx from 'clsx';

const NAVIGATION = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Fund Transfer', href: '/transfer', icon: Send },
  { name: 'Transactions', href: '/transactions', icon: History },
  { name: 'Loans', href: '/loans', icon: Handshake },
  { name: 'Bill Payments', href: '/bills', icon: Receipt },
  { name: 'Help & Support', href: '/support', icon: Headphones },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { displayName } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-background overflow-hidden transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-surface border-r border-gray-200 dark:border-gray-800 hidden md:flex flex-col transition-colors duration-200">
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center">
            <Wallet className="h-8 w-8 text-primary" />
            <span className="ml-3 text-xl font-bold text-gray-900 dark:text-white tracking-wide">Qubix Bank</span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {NAVIGATION.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={clsx(
                  'flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200',
                  isActive 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                )}
              >
                <Icon className={clsx('mr-3 h-5 w-5', isActive ? 'text-primary' : 'text-gray-400')} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between px-4 py-3 mb-4">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Theme</span>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
          <Link to="/settings" className="flex items-center px-4 py-3 mb-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 cursor-pointer group">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold group-hover:bg-primary/30 transition-colors">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="ml-3 truncate">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-primary transition-colors">
                {displayName}
              </p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-500 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="h-16 flex md:hidden items-center justify-between px-4 bg-white dark:bg-surface border-b border-gray-200 dark:border-gray-800 transition-colors duration-200">
          <Link to="/settings" className="flex items-center group">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm mr-2 group-hover:bg-primary/20 transition-colors">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white truncate max-w-[150px] group-hover:text-primary transition-colors">
              {displayName.split(' ')[0]}
            </span>
          </Link>
          <div className="flex items-center space-x-2">
            <button onClick={toggleTheme} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white">
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Mobile Navigation (Bottom) */}
        <nav className="md:hidden fixed bottom-0 w-full bg-white dark:bg-surface border-t border-gray-200 dark:border-gray-800 z-50 px-2 py-2 flex justify-between transition-colors duration-200">
           {NAVIGATION.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={clsx(
                  'flex flex-col items-center justify-center w-full py-2 text-xs font-medium rounded-lg',
                  isActive ? 'text-primary' : 'text-gray-400 dark:text-gray-500'
                )}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="truncate max-w-[60px] text-[10px]">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </div>
        
        {/* Floating Help Button */}
        <Link
          to="/support"
          className="fixed bottom-20 md:bottom-8 right-4 md:right-8 bg-primary text-white p-4 rounded-full shadow-lg hover:bg-primary/90 hover:scale-105 transition-all z-50 flex items-center justify-center group"
          title="Help & Support"
        >
          <HelpCircle className="h-6 w-6" />
        </Link>
      </main>
    </div>
  );
}
