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
  /** True when the user arrived via a password-recovery link and must set a
   *  new password (renders PasswordRecoveryModal). */
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;

  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUpWithPassword: (email: string, password: string, fullName: string) => Promise<AuthResult>;
  verifyEmailOtp: (email: string, token: string) => Promise<AuthResult>;
  resendEmailOtp: (email: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  sendPhoneOtp: (phone: string) => Promise<AuthResult>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  /** Completes the password-recovery flow for the current session. */
  updatePassword: (newPassword: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_ERROR =
  'Нэвтрэх тохиргоо дутуу байна (Supabase). Демо горимд ажиллаж байна. / Auth is not configured.';

/**
 * Maps Supabase's raw English errors onto the messages the (Mongolian-first)
 * UI actually shows. Anything unrecognized falls through verbatim rather than
 * hiding the real cause.
 */
function toMessage(error: unknown): string {
  const raw =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : '';
  const m = raw.toLowerCase();

  if (m.includes('invalid login credentials')) return 'Имэйл эсвэл нууц үг буруу байна.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Энэ имэйл аль хэдийн бүртгэлтэй байна. Нэвтэрч орно уу.';
  if (m.includes('email not confirmed')) return 'Имэйл хаягаа баталгаажуулна уу.';
  if (m.includes('password should be at least'))
    return 'Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой.';
  if (m.includes('is invalid') && m.includes('email')) return 'Имэйл хаяг буруу байна.';
  if (m.includes('expired') && m.includes('token')) return 'Кодын хугацаа дууссан байна. Дахин илгээнэ үү.';
  if (m.includes('otp')) return 'Баталгаажуулах код буруу байна.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Хэт олон оролдлого хийлээ. Түр хүлээгээд дахин оролдоно уу.';
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('load failed'))
    return 'Сүлжээний алдаа. Интернет холболтоо шалгаад дахин оролдоно уу.';

  return raw || 'Алдаа гарлаа. Дахин оролдоно уу.';
}

function getAuthRedirectUrl(): string {
  const configuredRedirect = import.meta.env.VITE_AUTH_REDIRECT_URL;
  if (configuredRedirect) return configuredRedirect;
  return window.location.origin;
}

function cleanAuthTokensFromUrl(): void {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  const hasAuthPayload =
    hash.includes('access_token=') ||
    hash.includes('refresh_token=') ||
    search.includes('access_token=') ||
    search.includes('refresh_token=');

  if (!hasAuthPayload) return;

  const url = new URL(window.location.href);
  url.hash = '';
  window.history.replaceState({}, document.title, url.toString());
}

function getAuthTokensFromUrl(): {
  access_token: string;
  refresh_token: string;
  /** Supabase's flow type: "recovery" marks a password-reset link. */
  type: string | null;
} | null {
  if (typeof window === 'undefined') return null;

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search);
  const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
  const type = hashParams.get('type') || queryParams.get('type');

  return accessToken && refreshToken
    ? { access_token: accessToken, refresh_token: refreshToken, type }
    : null;
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

/**
 * Makes sure the profiles row exists and fills fields that are still empty.
 * Deliberately never overwrites populated ones — this used to upsert the
 * auth-metadata name on every sign-in, resetting names the user had edited.
 */
async function ensureChefProfile(user: User | null): Promise<void> {
  if (!supabase || !user || user.is_anonymous) return;

  try {
    const { data: existing, error: readError } = await supabase
      .from('profiles')
      .select('id,email,display_name,avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    if (readError) throw readError;

    if (!existing) {
      const { error } = await supabase.from('profiles').insert({
        id: user.id,
        email: user.email ?? null,
        display_name: getUserDisplayName(user),
        avatar_url: getUserAvatarUrl(user),
      });
      if (error) throw error;
      return;
    }

    const patch: Record<string, unknown> = {};
    if (!existing.email && user.email) patch.email = user.email;
    if (!existing.display_name) patch.display_name = getUserDisplayName(user);
    if (!existing.avatar_url) patch.avatar_url = getUserAvatarUrl(user);
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
      if (error) throw error;
    }
  } catch (error) {
    // The auth session is still valid; this warning makes profile/RLS setup
    // issues visible without blocking the user from entering the app.
    // eslint-disable-next-line no-console
    console.warn('[Zity Chef] Profile sync failed:', toMessage(error));
  }
}

// One anonymous sign-in at a time — SIGNED_OUT can fire from an explicit
// logout AND from a failed token refresh, sometimes in quick succession.
let anonSignInFlight: Promise<void> | null = null;

async function ensureAnonymousSession(): Promise<void> {
  if (!supabase) return;
  if (!anonSignInFlight) {
    anonSignInFlight = supabase.auth
      .signInAnonymously()
      .then(({ error }) => {
        if (error) {
          // eslint-disable-next-line no-console
          console.warn('[Zity Chef] Anonymous sign-in failed:', error.message);
        }
      })
      .finally(() => {
        anonSignInFlight = null;
      });
  }
  return anonSignInFlight;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [passwordRecovery, setPasswordRecovery] = useState<boolean>(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    // 1️⃣ Resolve the current session. Some OAuth/recovery returns arrive as
    //    URL fragments; explicitly set the session before falling back to anon.
    (async () => {
      const urlTokens = getAuthTokensFromUrl();
      if (urlTokens) {
        const { data: urlSession, error } = await supabase.auth.setSession({
          access_token: urlTokens.access_token,
          refresh_token: urlTokens.refresh_token,
        });
        if (!active) return;
        cleanAuthTokensFromUrl();
        if (!error && urlSession.session) {
          // A recovery link signs the user in but their password is still the
          // old (forgotten) one — they must be prompted to set a new one now.
          if (urlTokens.type === 'recovery') setPasswordRecovery(true);
          await ensureChefProfile(urlSession.session.user);
          setSession(urlSession.session);
          queryClient.invalidateQueries();
          setLoading(false);
          return;
        }
        // eslint-disable-next-line no-console
        console.warn('[Zity Chef] OAuth URL session failed:', error?.message);
      }

      // If none, sign in anonymously so that every device gets a real, isolated
      // user id (fixes the shared-guest bug).
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        await ensureChefProfile(data.session.user);
        cleanAuthTokensFromUrl();
        setSession(data.session);
        setLoading(false);
      } else {
        await ensureAnonymousSession();
        if (!active) return;
        const { data: after } = await supabase.auth.getSession();
        if (!active) return;
        setSession(after.session ?? null);
        setLoading(false);
      }
    })();

    // 2️⃣ Keep session in sync across tabs, token refreshes, sign-in/out.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }
      // When the identity actually changes, re-fetch all user-scoped data so a
      // login/logout swaps the fridge/orders to the correct account.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        if (event === 'SIGNED_IN') cleanAuthTokensFromUrl();
        void ensureChefProfile(next?.user ?? null);
        queryClient.invalidateQueries();
      }
      // SIGNED_OUT fires on explicit logout AND when a token refresh fails.
      // Without a new anonymous session the app was stranded session-less
      // until a full page reload.
      if (event === 'SIGNED_OUT' && !next) {
        void ensureAnonymousSession();
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
      passwordRecovery,
      clearPasswordRecovery: () => setPasswordRecovery(false),

      async signInWithPassword(email, password) {
        const blocked = await guard();
        if (blocked) return blocked;
        try {
          const { data, error } = await supabase!.auth.signInWithPassword({ email, password });
          if (!error) await ensureChefProfile(data.user);
          return error ? { ok: false, error: toMessage(error) } : { ok: true };
        } catch (err) {
          return { ok: false, error: toMessage(err) };
        }
      },

      async signUpWithPassword(email, password, fullName) {
        const blocked = await guard();
        if (blocked) return blocked;
        try {
          // An anonymous session is converted in place (same user id), so the
          // fridge/orders/community data collected as a guest survives the
          // registration. signUp() would mint a brand-new id and orphan it all.
          if (session?.user?.is_anonymous) {
            const { data, error } = await supabase!.auth.updateUser({
              email,
              password,
              data: { full_name: fullName },
            });
            if (error) return { ok: false, error: toMessage(error) };
            // While the confirmation email is unclicked, new_email is pending.
            const pending = Boolean(data.user?.new_email);
            if (!pending) {
              // Refresh so the token drops its is_anonymous claim.
              await supabase!.auth.refreshSession();
              const { data: fresh } = await supabase!.auth.getUser();
              await ensureChefProfile(fresh.user ?? null);
            }
            return { ok: true, pendingVerification: pending };
          }

          const { data, error } = await supabase!.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } },
          });
          if (error) return { ok: false, error: toMessage(error) };
          // Only sync the profile when a session exists — before verification
          // the client is still whoever it was, and the write can only fail.
          if (data.session) await ensureChefProfile(data.user);
          return { ok: true, pendingVerification: !data.session };
        } catch (err) {
          return { ok: false, error: toMessage(err) };
        }
      },

      async verifyEmailOtp(email, token) {
        const blocked = await guard();
        if (blocked) return blocked;
        try {
          // 'email' covers signup/magic-link codes; anonymous-conversion codes
          // arrive as an email *change* confirmation.
          let { data, error } = await supabase!.auth.verifyOtp({ email, token, type: 'email' });
          if (error) {
            const alt = await supabase!.auth.verifyOtp({ email, token, type: 'email_change' });
            if (!alt.error) ({ data, error } = alt);
          }
          if (!error) {
            await supabase!.auth.refreshSession();
            const { data: fresh } = await supabase!.auth.getUser();
            await ensureChefProfile(fresh.user ?? data.user);
          }
          return error ? { ok: false, error: toMessage(error) } : { ok: true };
        } catch (err) {
          return { ok: false, error: toMessage(err) };
        }
      },

      async resendEmailOtp(email) {
        const blocked = await guard();
        if (blocked) return blocked;
        try {
          // Never create a fresh account from a typo'd resend address.
          const { error } = await supabase!.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: false },
          });
          return error ? { ok: false, error: toMessage(error) } : { ok: true };
        } catch (err) {
          return { ok: false, error: toMessage(err) };
        }
      },

      async signInWithGoogle() {
        const blocked = await guard();
        if (blocked) return blocked;
        try {
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
        } catch (err) {
          return { ok: false, error: toMessage(err) };
        }
      },

      async sendPhoneOtp(phone) {
        const blocked = await guard();
        if (blocked) return blocked;
        try {
          const { error } = await supabase!.auth.signInWithOtp({ phone });
          return error
            ? { ok: false, error: toMessage(error) }
            : { ok: true, pendingVerification: true };
        } catch (err) {
          return { ok: false, error: toMessage(err) };
        }
      },

      async verifyPhoneOtp(phone, token) {
        const blocked = await guard();
        if (blocked) return blocked;
        try {
          const { data, error } = await supabase!.auth.verifyOtp({ phone, token, type: 'sms' });
          if (!error) await ensureChefProfile(data.user);
          return error ? { ok: false, error: toMessage(error) } : { ok: true };
        } catch (err) {
          return { ok: false, error: toMessage(err) };
        }
      },

      async resetPassword(email) {
        const blocked = await guard();
        if (blocked) return blocked;
        try {
          const { error } = await supabase!.auth.resetPasswordForEmail(email, {
            redirectTo: getAuthRedirectUrl(),
          });
          return error ? { ok: false, error: toMessage(error) } : { ok: true };
        } catch (err) {
          return { ok: false, error: toMessage(err) };
        }
      },

      async updatePassword(newPassword) {
        const blocked = await guard();
        if (blocked) return blocked;
        try {
          const { error } = await supabase!.auth.updateUser({ password: newPassword });
          if (!error) setPasswordRecovery(false);
          return error ? { ok: false, error: toMessage(error) } : { ok: true };
        } catch (err) {
          return { ok: false, error: toMessage(err) };
        }
      },

      async signOut() {
        if (!supabase) return;
        try {
          await supabase.auth.signOut();
        } catch {
          // Even if the server-side revoke failed, the local session is gone.
        }
        // The SIGNED_OUT listener re-establishes an anonymous session so the
        // app keeps working post-logout; awaiting here keeps signOut() a
        // complete operation for callers.
        await ensureAnonymousSession();
      },
    };
  }, [session, loading, passwordRecovery]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
