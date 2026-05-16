import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from './components/ui/sonner';
import { ArrowsClockwise } from '@phosphor-icons/react';

// Lazy load pages for better performance
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CreatePackagePage = lazy(() => import('./pages/CreatePackagePage'));
const TrackingPage = lazy(() => import('./pages/TrackingPage'));
const WalletPage = lazy(() => import('./pages/WalletPage'));
const InboxPage = lazy(() => import('./pages/InboxPage'));
const RiderDashboard = lazy(() => import('./pages/RiderDashboard'));
const RiderActiveDelivery = lazy(() => import('./pages/RiderActiveDelivery'));
const RiderHistory = lazy(() => import('./pages/RiderHistory'));
const RiderWallet = lazy(() => import('./pages/RiderWallet'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const ProfileSettingsPage = lazy(() => import('./pages/ProfileSettingsPage'));

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <ArrowsClockwise size={32} className="animate-spin text-[#52525B]" />
  </div>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
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
            <Route path="/profile" element={<ProtectedRoute><ProfileSettingsPage /></ProtectedRoute>} />
            {/* Rider routes */}
            <Route path="/rider" element={<ProtectedRoute><RiderDashboard /></ProtectedRoute>} />
            <Route path="/rider/delivery/:packageId" element={<ProtectedRoute><RiderActiveDelivery /></ProtectedRoute>} />
            <Route path="/rider/history" element={<ProtectedRoute><RiderHistory /></ProtectedRoute>} />
            <Route path="/rider/wallet" element={<ProtectedRoute><RiderWallet /></ProtectedRoute>} />
            {/* Default */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  );
}

export default App;

