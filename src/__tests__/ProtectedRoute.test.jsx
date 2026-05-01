/**
 * ProtectedRoute.test.jsx — Smoke tests for the auth gate
 *
 * Tests the critical routing logic that prevents unauthenticated
 * users from accessing protected pages.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';

// Helper: render ProtectedRoute with a mock auth context
function renderWithAuth(authValue, ui = <div>Protected Content</div>) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <ProtectedRoute>{ui}</ProtectedRoute>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('ProtectedRoute', () => {
  it('shows a loading spinner while auth state is being checked', () => {
    renderWithAuth({ user: null, loading: true });

    // Should show the Pick-Am loading screen
    expect(screen.getByText(/loading pick-am/i)).toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    const mockUser = { id: 'user-123', email: 'test@test.com', role: 'user' };
    renderWithAuth({ user: mockUser, loading: false });

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /login when user is not authenticated (user = false)', () => {
    renderWithAuth({ user: false, loading: false });

    // Children should NOT be rendered
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to /login when user is null and not loading', () => {
    renderWithAuth({ user: null, loading: false });

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('passes rider users through to protected content', () => {
    const riderUser = { id: 'rider-456', email: 'rider@test.com', role: 'rider' };
    renderWithAuth({ user: riderUser, loading: false });

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});

