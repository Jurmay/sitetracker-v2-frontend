import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiClient';

const NEEDS_DATE_RANGE = new Set([
  'daily_progress_report', 'weekly_progress_report', 'monthly_progress_report',
  'master_roll_report', 'labour_productivity_report',
]);

const IMPLEMENTED_KEYS = new Set([
  'daily_progress_report', 'weekly_progress_report', 'monthly_progress_report',
  'boq_completion', 'master_roll_report', 'advance_register',
  'settlement_register', 'cashbook_report', 'labour_advance_ledger',
  'labour_productivity_report', 'ledger_report', 'project_financial_report',
]);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ReportsPage({ projectId }) {
  const [permissions, setPermissions] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [reportData, setReportData] = useState(null);

  const [loadingPerms, setLoadingPerms] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    apiFetch('/api/dashboard/permissions', { params: { project_id: projectId } })
      .then((perms) => setPermissions(perms.filter((p) => p.granted)))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingPerms(false));
  }, [projectId]);

  async function handleGenerate() {
    setError(null);
    setReportData(null);
    if (!selectedKey) {
      setError('Select a report first.');
      return;
    }
    const params = { project_id: projectId };
    if (NEEDS_DATE_RANGE.has(selectedKey)) {
      params.date_from = dateFrom;
      params.date_to = dateTo;
    }
    setLoadingReport(true);
    try {
      const data = await apiFetch(`/api/reports/${selectedKey}/data`, { params });
      setReportData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingReport(false);
    }
  }

  async function handleDownload(format) {
    setError(null);
    try {
      const params = { project_id: projectId };
      if (NEEDS_DATE_RANGE.has(selectedKey)) {
        params.date_from = dateFrom;
        params.date_to = dateTo;
      }
      const blob = await apiFetch(`/api/reports/${selectedKey}/${format}`, { params, raw: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedKey}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-6) var(--space-5)' }}>
      <h1 style={{ marginBottom: 'var(--space-6)' }}>Reports</h1>

      {error && (
        <div className="ticket" style={{ borderColor: 'var(--color-brick)', marginBottom: 'var(--space-5)' }}>
          <p style={{ color: 'var(--color-brick)', margin: 0 }}>{error}</p>
        </div>
      )}

      {loadingPerms ? (
        <p style={{ color: 'var(--color-aggregate)' }}>Loading…</p>
      ) : (
        <>
          <div className="ticket" style={{ marginBottom: 'var(--space-5)' }}>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
              Report
            </label>
            <select
              value={selectedKey}
              onChange={(e) => { setSelectedKey(e.target.value); setReportData(null); }}
              style={{ marginBottom: 'var(--space-4)' }}
            >
              <option value="">Select a report…</option>
              {permissions.map((p) => (
                <option key={p.report_key} value={p.report_key} disabled={!IMPLEMENTED_KEYS.has(p.report_key)}>
                  {p.report_name}{!IMPLEMENTED_KEYS.has(p.report_key) ? ' (not yet available)' : ''}
                </option>
              ))}
            </select>

            {selectedKey && NEEDS_DATE_RANGE.has(selectedKey) && (
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                    From
                  </label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                    To
                  </label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </div>
            )}

            <button className="primary" onClick={handleGenerate} disabled={!selectedKey || loadingReport} style={{ width: '100%' }}>
              {loadingReport ? 'Generating…' : 'Generate'}
            </button>
          </div>

          {reportData && (
            <div className="ticket">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h3 style={{ margin: 0 }}>{reportData.title}</h3>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button onClick={() => handleDownload('csv')}>Download CSV</button>
                  <button onClick={() => handleDownload('pdf')}>Download PDF</button>
                </div>
              </div>

              {reportData.rows.length === 0 ? (
                <p style={{ color: 'var(--color-aggregate)' }}>No data for this report/date range.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                    <thead>
                      <tr>
                        {reportData.columns.map((col) => (
                          <th
                            key={col}
                            style={{
                              textAlign: 'left', padding: 'var(--space-2) var(--space-3)',
                              borderBottom: '2px solid var(--color-ink)', whiteSpace: 'nowrap',
                            }}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.rows.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j} style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-aggregate-faint)' }}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
