import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import supabase from '../lib/supabase';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = not auth
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error fetching profile:', err);
      return null;
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const { data: { user: sbUser } } = await supabase.auth.getUser();
      if (sbUser) {
        const profile = await fetchProfile(sbUser.id);
        setUser({ ...sbUser, ...profile });
      } else {
        setUser(false);
      }
    } catch {
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchProfile(session.user.id);
        setUser({ ...session.user, ...profile });
      } else if (event === 'SIGNED_OUT') {
        setUser(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkAuth, fetchProfile]);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const profile = await fetchProfile(data.user.id);
    const fullUser = { ...data.user, ...profile };
    setUser(fullUser);
    return fullUser;
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
    
    // Auth trigger usually creates the profile, but we might need to wait or fetch it
    const profile = await fetchProfile(data.user.id);
    const fullUser = { ...data.user, ...profile };
    setUser(fullUser);
    return fullUser;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(false);
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

