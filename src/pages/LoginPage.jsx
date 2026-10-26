import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { RESET_LINK_ERROR } from '../lib/resetLink';
import { useTheme } from '../context/ThemeContext';

export function LoginPage() {
  const { signIn, sendPasswordReset } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    RESET_LINK_ERROR ? 'That reset link has expired or was already used. Ask for a new one below.' : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [forgot, setForgot] = useState(Boolean(RESET_LINK_ERROR));
  const [resetSent, setResetSent] = useState(false);

  async function handleReset(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await sendPasswordReset(email.trim());
      setResetSent(true);
    } catch (err) {
      setError(err.message ?? 'Could not send the email. Try again in a few minutes.');
    } finally {
      setSubmitting(false);
    }
  }

  function showForgot(on) {
    setForgot(on);
    setError(null);
    setResetSent(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err.message ?? 'Could not sign in. Check your email and password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-5)', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 'var(--space-5)', right: 'var(--space-5)' }}>
        <div className="theme-picker" role="group" aria-label="Choose color theme">
          {themes.map((t) => (
            <button
              key={t.key}
              className={`theme-swatch ${theme === t.key ? 'theme-swatch--active' : ''}`}
              style={{ background: t.swatchColor }}
              onClick={() => setTheme(t.key)}
              aria-label={`${t.label} theme`}
              aria-pressed={theme === t.key}
              title={t.label}
            />
          ))}
        </div>
      </div>

      <div className="ticket" style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ marginBottom: 'var(--space-1)' }}>SiteTracker</h1>
        <p style={{ color: 'var(--color-aggregate)', marginTop: 0, marginBottom: 'var(--space-6)' }}>
          {forgot ? 'Reset your password.' : 'Sign in to your project.'}
        </p>

        {forgot ? (
          resetSent ? (
            <>
              <p style={{ marginTop: 0 }}>
                If <strong style={{ overflowWrap: 'anywhere' }}>{email.trim()}</strong> has an account, a link to set a new password is on its way.
                Open it on this device. Check the spam folder too.
              </p>
              <button type="button" onClick={() => showForgot(false)} style={{ width: '100%' }}>Back to sign in</button>
            </>
          ) : (
            <form onSubmit={handleReset}>
              <label htmlFor="reset-email" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{ marginBottom: 'var(--space-5)' }}
              />
              {error && (
                <p role="alert" style={{ color: 'var(--color-brick)', fontSize: 'var(--text-sm)', marginTop: 0, marginBottom: 'var(--space-4)' }}>
                  {error}
                </p>
              )}
              <button type="submit" className="primary" disabled={submitting} style={{ width: '100%' }}>
                {submitting ? 'Sending…' : 'Email me a reset link'}
              </button>
              <button type="button" onClick={() => showForgot(false)} style={{ width: '100%', marginTop: 'var(--space-3)' }}>
                Back to sign in
              </button>
            </form>
          )
        ) : (
        <form onSubmit={handleSubmit}>
          <label htmlFor="email" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{ marginBottom: 'var(--space-4)' }}
          />

          <label htmlFor="password" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{ marginBottom: 'var(--space-5)' }}
          />

          {error && (
            <p style={{ color: 'var(--color-brick)', fontSize: 'var(--text-sm)', marginTop: 0, marginBottom: 'var(--space-4)' }}>
              {error}
            </p>
          )}

          <button type="submit" className="primary" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <button type="button" onClick={() => showForgot(true)}
            style={{ width: '100%', marginTop: 'var(--space-3)', background: 'none', border: 'none', boxShadow: 'none', color: 'var(--color-primary-deep)', fontSize: 'var(--text-sm)', textDecoration: 'underline' }}>
            Forgot password?
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
