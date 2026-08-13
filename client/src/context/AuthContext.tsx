import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';

interface AuthResult {
  ok: boolean;
  error?: string;
  /** true when the action needs a follow-up step (e.g. verify an OTP code). */
  pendingVerification?: boolean;
}

interface AuthContextType {
  /** Supabase session, or null in demo mode / before bootstrap completes. */
  session: Session | null;
  /** Supabase user (may be an anonymous user), or null. */
  user: User | null;
  /** True while the initial session is being resolved. */
  loading: boolean;
  /** True when the user has not upgraded past the anonymous session. */
  isAnonymous: boolean;
  /** True when Supabase env is present. When false, auth is a no-op demo. */
  configured: boolean;

  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUpWithPassword: (email: string, password: string, fullName: string) => Promise<AuthResult>;
  verifyEmailOtp: (email: string, token: string) => Promise<AuthResult>;
  resendEmailOtp: (email: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  sendPhoneOtp: (phone: string) => Promise<AuthResult>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_ERROR =
  'Нэвтрэх тохиргоо дутуу байна (Supabase). Демо горимд ажиллаж байна. / Auth is not configured.';

function toMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Алдаа гарлаа. Дахин оролдоно уу.';
}

function getAuthRedirectUrl(): string {
  const configuredRedirect = import.meta.env.VITE_AUTH_REDIRECT_URL;
  if (configuredRedirect) return configuredRedirect;
  return window.location.origin;
}

function getUserDisplayName(user: User): string | null {
  const meta = user.user_metadata ?? {};
  return (
    (meta.full_name as string | undefined) ||
    (meta.name as string | undefined) ||
    user.email?.split('@')[0] ||
    user.phone ||
    null
  );
}

function getUserAvatarUrl(user: User): string | null {
  const meta = user.user_metadata ?? {};
  return (
    (meta.avatar_url as string | undefined) ||
    (meta.picture as string | undefined) ||
    null
  );
}

async function ensureChefProfile(user: User | null): Promise<void> {
  if (!supabase || !user || user.is_anonymous) return;

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? null,
      display_name: getUserDisplayName(user),
      avatar_url: getUserAvatarUrl(user),
    },
    { onConflict: 'id' }
  );

  if (error) {
    // The auth session is still valid; this warning makes profile/RLS setup
    // issues visible without blocking the user from entering the app.
    // eslint-disable-next-line no-console
    console.warn('[Zity Chef] Profile sync failed:', error.message);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    // 1️⃣ Resolve the current session; if none, sign in anonymously so that
    //    every device gets a real, isolated user id (fixes the shared-guest bug).
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (data.session) {
        await ensureChefProfile(data.session.user);
        setSession(data.session);
        setLoading(false);
      } else {
        const { data: anon, error } = await supabase.auth.signInAnonymously();
        if (!active) return;
        if (error) {
          // Anonymous sign-in may be disabled on the project — degrade to no session.
          // eslint-disable-next-line no-console
          console.warn('[Zity Chef] Anonymous sign-in failed:', error.message);
        }
        setSession(anon?.session ?? null);
        setLoading(false);
      }
    });

    // 2️⃣ Keep session in sync across tabs, token refreshes, sign-in/out.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      // When the identity actually changes, re-fetch all user-scoped data so a
      // login/logout swaps the fridge/orders to the correct account.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        void ensureChefProfile(next?.user ?? null);
        queryClient.invalidateQueries();
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextType>(() => {
    const guard = async (): Promise<AuthResult | null> =>
      supabase ? null : { ok: false, error: DEMO_ERROR };

    return {
      session,
      user: session?.user ?? null,
      loading,
      isAnonymous: Boolean(session?.user?.is_anonymous),
      configured: isSupabaseConfigured,

      async signInWithPassword(email, password) {
        const blocked = await guard();
        if (blocked) return blocked;
        const { data, error } = await supabase!.auth.signInWithPassword({ email, password });
        if (!error) await ensureChefProfile(data.user);
        return error ? { ok: false, error: toMessage(error) } : { ok: true };
      },

      async signUpWithPassword(email, password, fullName) {
        const blocked = await guard();
        if (blocked) return blocked;
        const { data, error } = await supabase!.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) return { ok: false, error: toMessage(error) };
        await ensureChefProfile(data.user);
        // If email confirmation is required, there is no session yet.
        return { ok: true, pendingVerification: !data.session };
      },

      async verifyEmailOtp(email, token) {
        const blocked = await guard();
        if (blocked) return blocked;
        const { data, error } = await supabase!.auth.verifyOtp({ email, token, type: 'email' });
        if (!error) await ensureChefProfile(data.user);
        return error ? { ok: false, error: toMessage(error) } : { ok: true };
      },

      async resendEmailOtp(email) {
        const blocked = await guard();
        if (blocked) return blocked;
        const { error } = await supabase!.auth.signInWithOtp({ email });
        return error ? { ok: false, error: toMessage(error) } : { ok: true };
      },

      async signInWithGoogle() {
        const blocked = await guard();
        if (blocked) return blocked;
        const { error } = await supabase!.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: getAuthRedirectUrl(),
            queryParams: { access_type: 'offline', prompt: 'consent' },
          },
        });
        // signInWithOAuth redirects the browser — error only if the call itself failed.
        return error
          ? { ok: false, error: 'Google нэвтрэх тохиргоо хийгдээгүй байна. .env-д credentials нэмнэ үү.' }
          : { ok: true };
      },

      async sendPhoneOtp(phone) {
        const blocked = await guard();
        if (blocked) return blocked;
        const { error } = await supabase!.auth.signInWithOtp({ phone });
        return error ? { ok: false, error: toMessage(error) } : { ok: true, pendingVerification: true };
      },

      async verifyPhoneOtp(phone, token) {
        const blocked = await guard();
        if (blocked) return blocked;
        const { data, error } = await supabase!.auth.verifyOtp({ phone, token, type: 'sms' });
        if (!error) await ensureChefProfile(data.user);
        return error ? { ok: false, error: toMessage(error) } : { ok: true };
      },

      async resetPassword(email) {
        const blocked = await guard();
        if (blocked) return blocked;
        const { error } = await supabase!.auth.resetPasswordForEmail(email, {
          redirectTo: getAuthRedirectUrl(),
        });
        return error ? { ok: false, error: toMessage(error) } : { ok: true };
      },

      async signOut() {
        if (!supabase) return;
        await supabase.auth.signOut();
        // Re-establish an anonymous session so the app keeps working post-logout.
        const { data } = await supabase.auth.signInAnonymously();
        setSession(data?.session ?? null);
      },
    };
  }, [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
