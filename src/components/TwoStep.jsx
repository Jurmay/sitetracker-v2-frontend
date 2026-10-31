import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

// Two-step login with an authenticator app (Google Authenticator,
// Microsoft Authenticator, Authy...): after the password, a 6-digit code
// that changes every 30 seconds. Uses Supabase Auth's TOTP factors.

const codeInput = {
  fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', letterSpacing: '0.3em', textAlign: 'center',
};

function cleanCode(value) {
  return value.replace(/\D/g, '').slice(0, 6);
}

// Shown after the password when the account has two-step login on.
export function TwoStepCodePage() {
  const { user, verifyLoginCode, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setChecking(true);
    try {
      await verifyLoginCode(code);
    } catch (err) {
      setError(err.message ?? 'That code did not work. Try the newest one.');
      setCode('');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-5)' }}>
      <form onSubmit={submit} className="ticket" style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ marginBottom: 'var(--space-1)' }}>Enter your code</h1>
        <p style={{ color: 'var(--color-aggregate)', marginTop: 0, marginBottom: 'var(--space-5)' }}>
          Open your authenticator app and type the 6-digit code for SiteTracker ({user?.email}).
        </p>
        <label htmlFor="login-code" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>Code</label>
        <input id="login-code" value={code} onChange={(e) => setCode(cleanCode(e.target.value))} inputMode="numeric"
          autoComplete="one-time-code" required minLength={6} autoFocus style={{ ...codeInput, marginBottom: 'var(--space-4)' }} />
        {error && <p role="alert" style={{ color: 'var(--color-brick)', fontSize: 'var(--text-sm)', marginTop: 0 }}>{error}</p>}
        <button type="submit" className="primary" disabled={checking || code.length !== 6} style={{ width: '100%' }}>
          {checking ? 'Checking…' : 'Continue'}
        </button>
        <button type="button" onClick={signOut} style={{ width: '100%', marginTop: 'var(--space-3)' }}>Sign out</button>
      </form>
    </div>
  );
}

// On the Password screen: turn two-step login on or off.
export function TwoStepSettings() {
  const [factor, setFactor] = useState(undefined); // undefined = loading, null = off
  const [setup, setSetup] = useState(null); // { id, qr, secret } while turning on
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  async function load() {
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError(listError.message);
      setFactor(null);
      return;
    }
    setFactor(data.totp[0] ?? null);
  }
  useEffect(() => { load(); }, []);

  async function start() {
    setBusy(true); setError(null); setMessage(null);
    try {
      // Clear any half-finished setup from before.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of (existing?.all ?? []).filter((x) => x.status !== 'verified')) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp', friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
      });
      if (enrollError) throw enrollError;
      setSetup({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (err) {
      setError(err.message ?? 'Could not start two-step login.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: setup.id, code });
      if (verifyError) throw verifyError;
      setSetup(null); setCode('');
      setMessage('Two-step login is on. You will be asked for a code each time you sign in.');
      await load();
    } catch (err) {
      setError(err.message ?? 'That code did not work. Try the newest one.');
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (!window.confirm('Turn off two-step login? Your account will be protected by the password only.')) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (unenrollError) throw unenrollError;
      setMessage('Two-step login is off.');
      await load();
    } catch (err) {
      setError(err.message ?? 'Could not turn it off. Sign in again and retry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="two-step-title" style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-5)', borderTop: '1px solid var(--color-aggregate-light)' }}>
      <h2 id="two-step-title" style={{ fontSize: 'var(--text-lg)', marginTop: 0, marginBottom: 'var(--space-1)' }}>Two-step login</h2>
      <p style={{ color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)', marginTop: 0 }}>
        After your password, also type a code from an authenticator app on your phone. Strongly recommended for Owners and Admins, who approve money.
      </p>
      {message && <p role="status" style={{ color: 'var(--color-survey-deep)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>{message}</p>}
      {error && <p role="alert" style={{ color: 'var(--color-brick)', fontSize: 'var(--text-sm)' }}>{error}</p>}

      {factor === undefined && <p style={{ color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>Checking…</p>}
      {factor && !setup && (
        <>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-survey-deep)' }}>On: an authenticator app is set up.</p>
          <button type="button" disabled={busy} onClick={turnOff} style={{ width: '100%' }}>Turn off two-step login</button>
        </>
      )}
      {factor === null && !setup && (
        <button type="button" className="primary" disabled={busy} onClick={start} style={{ width: '100%' }}>Turn on two-step login</button>
      )}
      {setup && (
        <form onSubmit={confirm}>
          <ol style={{ paddingLeft: 'var(--space-5)', fontSize: 'var(--text-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <li>Install an authenticator app (Google Authenticator, Microsoft Authenticator or Authy).</li>
            <li>In the app, add an account and scan this code:</li>
          </ol>
          <img src={setup.qr} alt="QR code to add SiteTracker to your authenticator app"
            style={{ display: 'block', width: 180, height: 180, margin: '0 auto var(--space-3)', background: '#fff', padding: 8, borderRadius: 8 }} />
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-aggregate)', textAlign: 'center', overflowWrap: 'anywhere' }}>
            Can't scan? Type this key instead: <span style={{ fontFamily: 'var(--font-mono)' }}>{setup.secret}</span>
          </p>
          <label htmlFor="setup-code" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, margin: 'var(--space-3) 0 var(--space-1)' }}>
            3. Type the 6-digit code the app shows
          </label>
          <input id="setup-code" value={code} onChange={(e) => setCode(cleanCode(e.target.value))} inputMode="numeric"
            autoComplete="one-time-code" required minLength={6} style={{ ...codeInput, marginBottom: 'var(--space-3)' }} />
          <button type="submit" className="primary" disabled={busy || code.length !== 6} style={{ width: '100%' }}>Turn on</button>
          <button type="button" onClick={() => { setSetup(null); setCode(''); }} style={{ width: '100%', marginTop: 'var(--space-3)' }}>Cancel</button>
        </form>
      )}
    </section>
  );
}
