import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// TEST-PHASE LOGIN. Pick a role, enter the shared PIN.
// Each role is one fixed test account; the PIN is turned into that account's
// password, so a wrong PIN is refused by the server, not just by this screen.
// Replace this page with real email + password sign-in before real data goes in.
const ROLES = [
  { key: 'admin', label: 'Admin', email: 'admin@test.com' },
  { key: 'cashier', label: 'Cashier', email: 'cashier@test.com' },
  { key: 'coordinator', label: 'Coordinator', email: 'coordinator@test.com' },
];
const PIN_LENGTH = 4;
const passwordFromPin = (pin) => `sitetracker-${pin}`;

export function LoginPage() {
  const { signIn } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const [role, setRole] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const pinRef = useRef(null);

  function chooseRole(next) {
    setRole(next);
    setPin('');
    setError(null);
    // Wait for the PIN box to be on screen before moving the cursor into it.
    setTimeout(() => pinRef.current?.focus(), 0);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!role || pin.length !== PIN_LENGTH) return;
    setError(null);
    setSubmitting(true);
    try {
      await signIn(role.email, passwordFromPin(pin));
    } catch (err) {
      const wrongPin = /invalid login credentials/i.test(err?.message ?? '');
      setError(wrongPin ? 'Wrong PIN. Try again.' : (err?.message ?? 'Could not sign in. Try again.'));
      setPin('');
      pinRef.current?.focus();
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
        <p style={{ color: 'var(--color-aggregate)', marginTop: 0, marginBottom: 'var(--space-5)' }}>
          Test login. Choose who you are, then enter the PIN.
        </p>

        <div role="group" aria-label="Sign in as" style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          {ROLES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={role?.key === r.key ? 'primary' : undefined}
              aria-pressed={role?.key === r.key}
              onClick={() => chooseRole(r)}
              disabled={submitting}
              style={{ width: '100%' }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {role && (
          <form onSubmit={handleSubmit}>
            <label htmlFor="pin" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
              PIN for {role.label}
            </label>
            <input
              id="pin"
              ref={pinRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={PIN_LENGTH}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
              required
              style={{ marginBottom: 'var(--space-5)', letterSpacing: '0.5em', textAlign: 'center' }}
            />

            {error && (
              <p role="alert" style={{ color: 'var(--color-brick)', fontSize: 'var(--text-sm)', marginTop: 0, marginBottom: 'var(--space-4)' }}>
                {error}
              </p>
            )}

            <button type="submit" className="primary" disabled={submitting || pin.length !== PIN_LENGTH} style={{ width: '100%' }}>
              {submitting ? 'Signing in…' : `Sign in as ${role.label}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
