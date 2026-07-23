import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isLoadingRef = useRef(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession }, error }) => {
        if (!mounted) return;
        if (error) {
          console.error('Failed to restore session:', error.message);
        }
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        setIsLoading(false);
        isLoadingRef.current = false;
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, changedSession) => {
      if (!mounted) return;
      setSession(changedSession);
      setUser(changedSession?.user ?? null);
      if (isLoadingRef.current) {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'notura://confirm',
      },
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user && !!session,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { AuthContext };
