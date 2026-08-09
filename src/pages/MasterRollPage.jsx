import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/apiClient';
import { uploadLabourerPhoto, getLabourerPhotoUrl } from '../lib/photoUpload';

const TODAY = new Date().toISOString().slice(0, 10);

export function MasterRollPage({ projectId }) {
  const [isNoWorkDay, setIsNoWorkDay] = useState(false);
  const [noWorkRemarks, setNoWorkRemarks] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  // Improvement: signed thumbnail URLs for each worker's registered photo,
  // keyed by labourer id. Fetched lazily whenever search results change,
  // since the bucket is private and every view needs a freshly-signed URL.
  const [photoUrls, setPhotoUrls] = useState({});
  const [selectedLabourers, setSelectedLabourers] = useState([]); // [{id, name, present}]

  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [newLabourerName, setNewLabourerName] = useState('');
  const [newLabourerIdNumber, setNewLabourerIdNumber] = useState('');
  const [newLabourerType, setNewLabourerType] = useState('contract');
  const [newLabourerRate, setNewLabourerRate] = useState('');
  const [newLabourerPhoto, setNewLabourerPhoto] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const runSearch = useCallback(async (q) => {
    if (!projectId) return;
    try {
      const results = await apiFetch('/api/master-roll/labourers', {
        params: { project_id: projectId, q },
      });
      setSearchResults(results);

      // Resolve signed thumbnail URLs for any worker we haven't already
      // fetched one for in this session. Skipped for workers with no
      // photo_url (shouldn't happen given registration requires a photo,
      // but handled gracefully either way).
      const toResolve = results.filter((l) => l.photo_url && !photoUrls[l.id]);
      if (toResolve.length > 0) {
        const resolved = await Promise.all(
          toResolve.map(async (l) => [l.id, await getLabourerPhotoUrl(l.photo_url)])
        );
        setPhotoUrls((prev) => {
          const next = { ...prev };
          for (const [id, url] of resolved) next[id] = url;
          return next;
        });
      }
    } catch (err) {
      setError(err.message);
    }
  }, [projectId, photoUrls]);

  useEffect(() => {
    runSearch('');
  }, [runSearch]);

  function toggleSelected(labourer) {
    setSelectedLabourers((prev) => {
      const exists = prev.find((l) => l.id === labourer.id);
      if (exists) return prev.filter((l) => l.id !== labourer.id);
      return [...prev, { id: labourer.id, name: labourer.name, present: true }];
    });
  }

  async function handleRegisterLabourer(e) {
    e.preventDefault();
    setError(null);
    if (!newLabourerPhoto) {
      setError("A photo is required to register a worker (per the project's ID verification policy).");
      return;
    }
    if (!newLabourerIdNumber.trim()) {
      setError('An ID/permit number is required to register a worker.');
      return;
    }

    setSubmitting(true);
    try {
      const photoPath = await uploadLabourerPhoto(projectId, newLabourerPhoto);

      const payload = {
        project_id: projectId,
        name: newLabourerName,
        photo_url: photoPath,
        id_number: newLabourerIdNumber,
        labour_type: newLabourerType,
      };
      if (newLabourerType === 'contract') {
        payload.contracted_rate = parseFloat(newLabourerRate);
      } else {
        // Daily-wage workers need a labour_category_id per the schema,
        // which this simplified form doesn't yet collect - flagged
        // honestly rather than silently sending an invalid payload.
        setError(
          'Daily-wage worker registration needs a labour category, which this ' +
          'form does not yet support. Register this worker as "Contract" for now, ' +
          'or use the Admin console once it exists.'
        );
        setSubmitting(false);
        return;
      }

      const newLabourer = await apiFetch('/api/master-roll/labourers', {
        method: 'POST',
        body: payload,
      });

      setSelectedLabourers((prev) => [...prev, { id: newLabourer.id, name: newLabourer.name, present: true }]);
      setShowRegisterForm(false);
      setNewLabourerName('');
      setNewLabourerIdNumber('');
      setNewLabourerRate('');
      setNewLabourerPhoto(null);
      runSearch(searchQuery);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    setSuccess(false);

    if (isNoWorkDay && !noWorkRemarks.trim()) {
      setError('A remark is required when marking today as a no-work day.');
      return;
    }
    if (!isNoWorkDay && selectedLabourers.length === 0) {
      setError('Select at least one worker, or mark today as a no-work day.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/master-roll/entries', {
        method: 'POST',
        body: {
          project_id: projectId,
          date: TODAY,
          is_no_work_day: isNoWorkDay,
          no_work_remarks: isNoWorkDay ? noWorkRemarks : null,
          attendance: isNoWorkDay
            ? []
            : selectedLabourers.map((l) => ({ labourer_id: l.id, present: l.present })),
        },
      });
      setSuccess(true);
      setSelectedLabourers([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-6) var(--space-5)' }}>
      <h1 style={{ marginBottom: 'var(--space-1)' }}>Master roll &mdash; {TODAY}</h1>
      <p style={{ color: 'var(--color-aggregate)', marginTop: 0, marginBottom: 'var(--space-6)' }}>
        Record today's attendance, or mark no work today.
      </p>

      {success && (
        <div className="ticket" style={{ borderColor: 'var(--color-survey)', marginBottom: 'var(--space-5)' }}>
          <p style={{ color: 'var(--color-survey-deep)', margin: 0, fontWeight: 600 }}>
            Master roll submitted. All the best for today's work.
          </p>
        </div>
      )}

      {error && (
        <div className="ticket" style={{ borderColor: 'var(--color-brick)', marginBottom: 'var(--space-5)' }}>
          <p style={{ color: 'var(--color-brick)', margin: 0 }}>{error}</p>
        </div>
      )}

      <div className="ticket" style={{ marginBottom: 'var(--space-5)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={isNoWorkDay}
            onChange={(e) => setIsNoWorkDay(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ fontWeight: 600 }}>No work today</span>
        </label>

        {isNoWorkDay && (
          <textarea
            placeholder="Reason no work happened today (required)"
            value={noWorkRemarks}
            onChange={(e) => setNoWorkRemarks(e.target.value)}
            rows={3}
            style={{ marginTop: 'var(--space-4)', resize: 'none' }}
          />
        )}
      </div>

      {!isNoWorkDay && (
        <>
          <div className="ticket" style={{ marginBottom: 'var(--space-5)' }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginTop: 0, marginBottom: 'var(--space-3)' }}>
              Search workers by name or ID
            </p>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                runSearch(e.target.value);
              }}
              placeholder="Type a name or ID number..."
              style={{ marginBottom: 'var(--space-4)' }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              {searchResults.map((labourer) => {
                const isSelected = selectedLabourers.some((l) => l.id === labourer.id);
                const thumbUrl = photoUrls[labourer.id];
                return (
                  <label
                    key={labourer.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                      padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'var(--color-aggregate-faint)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(labourer)}
                      style={{ width: 18, height: 18, flexShrink: 0 }}
                    />
                    {/* Improvement: worker photo thumbnail, so a coordinator can
                        visually confirm this is the right person before marking
                        them present - the whole reason the photo was captured
                        at registration in the first place. */}
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={`${labourer.name}'s photo`}
                        style={{
                          width: 36, height: 36, borderRadius: '50%',
                          objectFit: 'cover', flexShrink: 0,
                          border: '1px solid var(--color-aggregate-light)',
                        }}
                      />
                    ) : (
                      <span style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--color-aggregate-faint)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 'var(--text-xs)', color: 'var(--color-aggregate)',
                      }}>
                        {labourer.name?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    )}
                    <span style={{ flex: 1 }}>{labourer.name}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-aggregate)' }} className="numeric">
                      {labourer.id_number}
                    </span>
                  </label>
                );
              })}
              {searchResults.length === 0 && (
                <p style={{ color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>
                  No matching workers. Register a new one below if this is their first day.
                </p>
              )}
            </div>

            <button onClick={() => setShowRegisterForm((v) => !v)}>
              {showRegisterForm ? 'Cancel' : '+ Register a new worker'}
            </button>
          </div>

          {showRegisterForm && (
            <form onSubmit={handleRegisterLabourer} className="ticket" style={{ marginBottom: 'var(--space-5)' }}>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginTop: 0, marginBottom: 'var(--space-4)' }}>
                Register new worker
              </p>

              <label style={{ display: 'block', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>Name</label>
              <input
                value={newLabourerName}
                onChange={(e) => setNewLabourerName(e.target.value)}
                required
                style={{ marginBottom: 'var(--space-3)' }}
              />

              <label style={{ display: 'block', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>
                ID / permit number
              </label>
              <input
                value={newLabourerIdNumber}
                onChange={(e) => setNewLabourerIdNumber(e.target.value)}
                required
                style={{ marginBottom: 'var(--space-3)' }}
              />

              <label style={{ display: 'block', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>
                Worker type
              </label>
              <select
                value={newLabourerType}
                onChange={(e) => setNewLabourerType(e.target.value)}
                style={{ marginBottom: 'var(--space-3)' }}
              >
                <option value="contract">Contract (named, has an agreed rate)</option>
                <option value="daily_wage">Daily wage (not yet supported in this form)</option>
              </select>

              {newLabourerType === 'contract' && (
                <>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>
                    Contracted rate (per day)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newLabourerRate}
                    onChange={(e) => setNewLabourerRate(e.target.value)}
                    required
                    style={{ marginBottom: 'var(--space-3)' }}
                  />
                </>
              )}

              <label style={{ display: 'block', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>
                Photo (required)
              </label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setNewLabourerPhoto(e.target.files[0])}
                style={{ marginBottom: 'var(--space-4)' }}
              />

              <button type="submit" className="primary" disabled={submitting} style={{ width: '100%' }}>
                {submitting ? 'Registering…' : 'Register worker'}
              </button>
            </form>
          )}
        </>
      )}

      <button
        className="primary"
        onClick={handleSubmit}
        disabled={submitting}
        style={{ width: '100%', padding: 'var(--space-4)' }}
      >
        {submitting ? 'Submitting…' : 'Submit master roll'}
      </button>
    </div>
  );
}
