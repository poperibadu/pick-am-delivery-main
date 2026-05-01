/**
 * AuthContext.test.jsx — Smoke tests for authentication context
 *
 * Tests the AuthProvider behaviour:
 * - Initial loading state
 * - Login success / failure
 * - Logout
 * - useAuth() guard
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth, AuthContext } from '../contexts/AuthContext';
import supabase from '../lib/supabase';

// ── Test component that exposes auth state ─────────────────────────
function AuthConsumer() {
  const { user, loading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="user">{user ? user.email : 'none'}</span>
      <button onClick={() => login('a@a.com', 'pass123')}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: null });
    supabase.auth.signUp.mockResolvedValue({ data: { user: null }, error: null });
    supabase.auth.signOut.mockResolvedValue({});
    
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  it('starts in loading state then resolves to unauthenticated', async () => {
    renderAuth();

    expect(screen.getByTestId('loading').textContent).toBe('loading');

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  it('sets user on successful login', async () => {
    const mockUser = { id: 'u1', email: 'sender@test.com' };
    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null,
    });
    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: { id: 'u1', name: 'Test User', role: 'user' },
      error: null,
    });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
    });

    renderAuth();
    await waitFor(() => screen.getByTestId('loading').textContent === 'ready');

    await act(async () => {
      await userEvent.click(screen.getByText('Login'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('sender@test.com');
    });
  });

  it('throws error when login fails', async () => {
    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid credentials' },
    });

    renderAuth();
    await waitFor(() => screen.getByTestId('loading').textContent === 'ready');

    const { login } = (() => {
      let ctxRef;
      function Grab() { ctxRef = useAuth(); return null; }
      render(<AuthProvider><Grab /></AuthProvider>);
      return ctxRef;
    })();

    await expect(login('bad@bad.com', 'wrong')).rejects.toMatchObject({
      message: 'Invalid credentials',
    });
  });

  it('registers new user', async () => {
    const mockUser = { id: 'u2', email: 'new@test.com' };
    supabase.auth.signUp.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null,
    });
    
    const mockProfileSingle = vi.fn().mockResolvedValue({
      data: { id: 'u2', name: 'New User', role: 'user' },
      error: null,
    });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockProfileSingle,
    });

    let contextRef;
    function Grab() { contextRef = useAuth(); return null; }
    render(<AuthProvider><Grab /></AuthProvider>);
    await waitFor(() => expect(contextRef.loading).toBe(false));

    await act(async () => {
      await contextRef.register('new@test.com', 'pass123', 'New User', '123');
    });

    expect(contextRef.user).toMatchObject({
      email: 'new@test.com',
      name: 'New User',
      role: 'user'
    });
  });

  it('refreshes user profile data', async () => {
    const mockUser = { id: 'u1', email: 'sender@test.com', role: 'user' };
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null,
    });
    
    const mockSingle = vi.fn()
      .mockResolvedValueOnce({ data: { id: 'u1', name: 'Test User', role: 'user' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'u1', name: 'Test User', role: 'admin' }, error: null });

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
    });

    let contextRef;
    function Grab() { contextRef = useAuth(); return null; }
    render(<AuthProvider><Grab /></AuthProvider>);
    
    await waitFor(() => expect(contextRef.loading).toBe(false));
    expect(contextRef.user.role).toBe('user');

    await act(async () => {
      await contextRef.refreshUser();
    });

    expect(contextRef.user.role).toBe('admin');
  });

  it('clears user on logout', async () => {
    const mockUser = { id: 'u1', email: 'sender@test.com' };
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: mockUser },
      error: null,
    });
    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: { id: 'u1', name: 'Test User', role: 'user' },
      error: null,
    });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
    });

    renderAuth();
    await waitFor(() => screen.getByTestId('user').textContent === 'sender@test.com');

    await act(async () => {
      await userEvent.click(screen.getByText('Logout'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('none');
    });
  });
});

describe('useAuth() guard', () => {
  it('throws when useAuth is used outside AuthProvider', () => {
    // Suppress the expected console.error from React's error boundary
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function BadComponent() {
      useAuth();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow(
      'useAuth must be inside AuthProvider'
    );

    spy.mockRestore();
  });
});

