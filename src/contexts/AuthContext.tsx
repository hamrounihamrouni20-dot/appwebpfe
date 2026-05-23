import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Profile, UserRole } from '../lib/database.types';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      const p = data as Profile;
      setProfile(p);
      return p;
    }

    // If no profile exists for this authenticated user, create a default profile row.
    // This ensures profiles are always created after signup (required by requirements).
    try {
      const userResp = await supabase.auth.getUser();
      const user = userResp.data.user;
      const email = user?.email ?? '';
      const full_name = (user?.user_metadata as any)?.full_name ?? '';

      const { data: created, error: createError } = await supabase
        .from('profiles')
        .insert({ id: userId, email, full_name, role: 'user' })
        .select()
        .maybeSingle();

      if (!createError && created) {
        const p = created as Profile;
        setProfile(p);
        return p;
      }
    } catch (err) {
      // ignore and fall through
    }

    setProfile(null);
    return null;
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          await fetchProfile(session.user.id);
        })();
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error as Error | null };

    const session = data?.session ?? null;
    setSession(session);
    setUser(session?.user ?? null);

    if (session?.user) {
      const p = await fetchProfile(session.user.id);
      if (!p) {
        // If profile couldn't be created/read, sign out to avoid inconsistent state
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setProfile(null);
        return { error: new Error('Failed to initialize user profile') };
      }

      // After sign-in, send everyone to /dashboard; the router will render the correct role-specific view.
      navigate('/dashboard');
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const getPasswordResetRedirectUrl = () => {
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    return `${appUrl}/update-password`;
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordResetRedirectUrl(),
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      role: profile?.role ?? null,
      loading,
      signIn,
      signOut,
      resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
