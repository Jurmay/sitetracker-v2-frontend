/**
 * The one signature visual element used throughout the app: every
 * workflow status (pending, verified, approved, disbursed, settled,
 * rejected, locked) renders as a rotated ink-stamp badge. This is the
 * single bold/maximalist gesture per the design plan - everywhere else
 * stays disciplined and quiet, so this carries the app's identity.
 */
const LABELS = {
  pending_verification: 'Pending',
  pending_approval: 'Pending Approval',
  verified: 'Verified',
  approved: 'Approved',
  disbursed: 'Disbursed',
  settled: 'Settled',
  rejected: 'Rejected',
  locked: 'Locked',
  active: 'Active',
  completed: 'Completed',
  exited: 'Exited',
};

const VARIANT_BY_STATUS = {
  pending_verification: 'pending',
  pending_approval: 'pending',
  verified: 'verified',
  approved: 'approved',
  disbursed: 'disbursed',
  settled: 'settled',
  rejected: 'rejected',
  locked: 'locked',
  active: 'verified',
  completed: 'settled',
  exited: 'pending',
};

export function StatusStamp({ status }) {
  const variant = VARIANT_BY_STATUS[status] ?? 'pending';
  const label = LABELS[status] ?? status;
  return <span className={`stamp stamp--${variant}`}>{label}</span>;
}
