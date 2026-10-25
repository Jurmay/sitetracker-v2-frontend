import { useEffect, useState } from 'react';
import { subscribeOutbox, flushOutbox, dismissOutboxItem } from '../lib/outbox';

// Shows what is saved on this phone waiting for signal, and anything the
// server refused after it was sent, so nothing entered on site is lost.
export function OutboxBanner() {
  const [items, setItems] = useState([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [sending, setSending] = useState(false);

  useEffect(() => subscribeOutbox(setItems), []);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  const waiting = items.filter((i) => i.status === 'waiting');
  const failed = items.filter((i) => i.status === 'failed');
  if (!waiting.length && !failed.length && online) return null;

  async function sendNow() {
    setSending(true);
    try { await flushOutbox(); } finally { setSending(false); }
  }

  return (
    <div role="status" style={{ padding: 'var(--space-3) var(--space-5)', background: 'var(--color-paper-sunken)', borderBottom: '1px solid var(--color-aggregate-light)', fontSize: 'var(--text-sm)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {(waiting.length > 0 || !online) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>
              {online ? 'Back online.' : 'No signal.'}{' '}
              {waiting.length > 0
                ? `${waiting.length} item${waiting.length === 1 ? '' : 's'} saved on this phone ${online ? 'to send' : 'will be sent when signal returns'}.`
                : 'Reports and master roll you submit will be saved on this phone and sent automatically.'}
            </span>
            {online && waiting.length > 0 && (
              <button onClick={sendNow} disabled={sending} style={{ padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)' }}>
                {sending ? 'Sending…' : 'Send now'}
              </button>
            )}
          </div>
        )}
        {waiting.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 'var(--space-5)', color: 'var(--color-aggregate)' }}>
            {waiting.map((i) => <li key={i.id}>{i.label}</li>)}
          </ul>
        )}
        {failed.map((i) => (
          <div key={i.id} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', color: 'var(--color-brick)' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong>Not accepted:</strong> {i.label}. {i.error}
            </span>
            <button onClick={() => dismissOutboxItem(i.id)} style={{ padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)' }}>Dismiss</button>
          </div>
        ))}
      </div>
    </div>
  );
}
