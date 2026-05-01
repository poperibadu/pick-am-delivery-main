import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Package } from '@phosphor-icons/react';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <Package size={48} weight="bold" className="text-[#0A0A0A] animate-pulse" />
          <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B]">Loading Pick-Am...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

