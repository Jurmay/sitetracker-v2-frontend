import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { TwoStepSettings } from '../components/TwoStep';

const MIN_LENGTH = 8;

// Choose a new password: after opening a reset link from email, or from
// the "Password" button while signed in.
export function SetPasswordPage({ title, intro, onDone, onCancel, showTwoStep = false }) {
  const { user, changePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords are not the same.');
      return;
    }
    setSaving(true);
    try {
      await changePassword(password);
      setDone(true);
    } catch (err) {
      setError(err.message ?? 'Could not change the password. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '70vh', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-5)' }}>
      <div className="ticket" style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ marginBottom: 'var(--space-1)' }}>{title}</h1>
        <p style={{ color: 'var(--color-aggregate)', marginTop: 0, marginBottom: 'var(--space-5)' }}>
          {intro ?? 'For'} <strong style={{ overflowWrap: 'anywhere' }}>{user?.email}</strong>
        </p>

        {done ? (
          <>
            <p style={{ color: 'var(--color-survey-deep)', fontWeight: 600, marginTop: 0 }}>
              Password changed. Use it next time you sign in.
            </p>
            <button className="primary" onClick={onDone} style={{ width: '100%' }}>Continue</button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label htmlFor="new-password" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={MIN_LENGTH}
              autoComplete="new-password"
              style={{ marginBottom: 'var(--space-4)' }}
            />
            <label htmlFor="confirm-password" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
              Type it again
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              style={{ marginBottom: 'var(--space-5)' }}
            />
            {error && (
              <p role="alert" style={{ color: 'var(--color-brick)', fontSize: 'var(--text-sm)', marginTop: 0, marginBottom: 'var(--space-4)' }}>
                {error}
              </p>
            )}
            <button type="submit" className="primary" disabled={saving} style={{ width: '100%' }}>
              {saving ? 'Saving…' : 'Save new password'}
            </button>
            {onCancel && (
              <button type="button" onClick={onCancel} style={{ width: '100%', marginTop: 'var(--space-3)' }}>Cancel</button>
            )}
          </form>
        )}
        {showTwoStep && <TwoStepSettings />}
      </div>
    </div>
  );
}
