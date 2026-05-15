import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import supabase from '../lib/supabase';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = not auth
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          if (error.code === 'PGRST116' && i < retries - 1) {
            // Profile not found yet, likely trigger is still running. Wait and retry.
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
          throw error;
        }
        return data;
      } catch (err) {
        if (i === retries - 1) {
          console.error('Error fetching profile after retries:', err);
          return null;
        }
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    // Supabase v2 natively fires INITIAL_SESSION synchronously here.
    // Relying solely on this prevents React Strict Mode race conditions
    // and eliminates the 5-second 'orphaned lock' hang on app load.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Only proceed if component is still mounted
      if (!isMounted) return;

      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        // Fetch custom profile data matching the session
        const profile = await fetchProfile(session.user.id);
        if (isMounted) {
          setUser({ ...session.user, ...profile });
          setLoading(false);
        }
      } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
        if (isMounted) {
          setUser(false);
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // We rely on onAuthStateChange to set the user state to avoid race conditions
    return data.user;
  };

  const register = async (email, password, name, phone, role = 'user') => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone, role }
      }
    });

    if (error) throw error;
    if (!data.user) throw new Error('Signup failed - no user data returned');
    
    // Again, we rely on onAuthStateChange if a session was created.
    // If no session (email confirmation required), onAuthStateChange won't fire SIGNED_IN.
    if (!data.session) {
      // Manual notification or state for "Check your email" could go here
    }
    
    return data.user;
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(false);
    }
  };

  const refreshUser = async () => {
    if (user?.id) {
      const profile = await fetchProfile(user.id);
      setUser(prev => ({ ...prev, ...profile }));
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

