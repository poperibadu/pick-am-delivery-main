import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CreatePackagePage from './pages/CreatePackagePage';
import TrackingPage from './pages/TrackingPage';
import WalletPage from './pages/WalletPage';
import InboxPage from './pages/InboxPage';
import RiderDashboard from './pages/RiderDashboard';
import RiderActiveDelivery from './pages/RiderActiveDelivery';
import RiderHistory from './pages/RiderHistory';
import RiderWallet from './pages/RiderWallet';
import HistoryPage from './pages/HistoryPage';
import { Toaster } from './components/ui/sonner';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* User routes */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/create-package" element={<ProtectedRoute><CreatePackagePage /></ProtectedRoute>} />
          <Route path="/track/:packageId" element={<ProtectedRoute><TrackingPage /></ProtectedRoute>} />
          <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
          <Route path="/inbox" element={<ProtectedRoute><InboxPage /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          {/* Rider routes */}
          <Route path="/rider" element={<ProtectedRoute><RiderDashboard /></ProtectedRoute>} />
          <Route path="/rider/delivery/:packageId" element={<ProtectedRoute><RiderActiveDelivery /></ProtectedRoute>} />
          <Route path="/rider/history" element={<ProtectedRoute><RiderHistory /></ProtectedRoute>} />
          <Route path="/rider/wallet" element={<ProtectedRoute><RiderWallet /></ProtectedRoute>} />
          {/* Default */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  );
}

export default App;

