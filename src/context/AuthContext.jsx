import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { OPENED_FROM_RESET_LINK } from '../lib/resetLink';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(OPENED_FROM_RESET_LINK);
  // Signed in with a password, but two-step login is on: the code is still needed.
  const [needsCode, setNeedsCode] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setNeedsCode(false);
      return;
    }
    supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      .then(({ data }) => setNeedsCode(Boolean(data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2')))
      .catch(() => setNeedsCode(false));
  }, [session]);

  // The 6-digit code from the authenticator app, after the password.
  async function verifyLoginCode(code) {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    const factor = data.totp[0];
    if (!factor) throw new Error('No authenticator app is set up for this account.');
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (verifyError) throw verifyError;
    setNeedsCode(false);
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  // Emails a link that signs the person in and asks for a new password.
  // Supabase answers the same whether or not the email has an account.
  async function sendPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) throw error;
  }

  async function changePassword(password) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }

  return (
    <AuthContext.Provider value={{
      session, user: session?.user ?? null, loading, signIn, signOut,
      recovering, finishRecovery: () => setRecovering(false), sendPasswordReset, changePassword,
      needsCode, verifyLoginCode,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return ctx;
}
