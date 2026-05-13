
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import InstallPrompt from './components/InstallPrompt';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import FundTransfer from './pages/FundTransfer';
import SetupSecurity from './pages/SetupSecurity';
import TransactionHistory from './pages/TransactionHistory';
import BillPayments from './pages/BillPayments';
import Loans from './pages/Loans';
import AddAccount from './pages/AddAccount';
import Support from './pages/Support';
import Settings from './pages/Settings';
import PaymentPortal from './pages/PaymentPortal';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <InstallPrompt />
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/pay/:accountNumber" element={<PaymentPortal />} />
            <Route path="/pay" element={<PaymentPortal />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/setup-security" element={<SetupSecurity />} />
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/transfer" element={<FundTransfer />} />
                <Route path="/transactions" element={<TransactionHistory />} />
                <Route path="/bills" element={<BillPayments />} />
                <Route path="/loans" element={<Loans />} />
                <Route path="/add-account" element={<AddAccount />} />
                <Route path="/support" element={<Support />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
