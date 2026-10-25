export const fmtMoney = (n?: number | string | null, cur = 'EUR') =>
  n === null || n === undefined || n === '' ? '—' :
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(Number(n));

export const fmtDate = (d?: string | null) =>
  d ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d)) : '—';

export const fmtDateTime = (d?: string | null) =>
  d ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d)) : '—';

export const fmtTime = (d?: string | null) =>
  d ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(d)) : '—';

export function ago(d?: string | null) {
  if (!d) return '—';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function due(d?: string | null) {
  if (!d) return '—';
  const days = Math.round((new Date(d).getTime() - Date.now()) / 86400000);
  if (days < 0) return `${-days} d overdue`;
  if (days === 0) return 'due today';
  return `in ${days} d`;
}

export type Tone = 'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'danger' | 'critical' | 'muted';

export const STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'muted' },
  submitted: { label: 'Submitted', tone: 'info' },
  under_review: { label: 'Under review', tone: 'info' },
  awaiting_approval: { label: 'Awaiting approval', tone: 'warning' },
  escalated: { label: 'Escalated', tone: 'warning' },
  approved: { label: 'Approved', tone: 'accent' },
  scheduled: { label: 'Scheduled', tone: 'accent' },
  in_progress: { label: 'In progress', tone: 'accent' },
  awaiting_verification: { label: 'Awaiting verification', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
  blocked: { label: 'Blocked', tone: 'danger' },
  failed: { label: 'Failed', tone: 'danger' },
  reopened: { label: 'Reopened', tone: 'warning' },
  // incidents
  new: { label: 'New', tone: 'danger' },
  investigating: { label: 'Investigating', tone: 'warning' },
  contained: { label: 'Contained', tone: 'accent' },
  resolved: { label: 'Resolved', tone: 'success' },
  closed: { label: 'Closed', tone: 'muted' },
  // approvals
  pending: { label: 'Pending', tone: 'warning' },
  waiting: { label: 'Waiting', tone: 'muted' },
  info_requested: { label: 'Info requested', tone: 'info' },
  superseded: { label: 'Superseded', tone: 'muted' },
  // kri
  normal: { label: 'Normal', tone: 'success' },
  warning: { label: 'Early warning', tone: 'warning' },
  critical: { label: 'Critical', tone: 'critical' },
  recovery: { label: 'Recovery', tone: 'info' },
  open: { label: 'Open', tone: 'warning' },
  acknowledged: { label: 'Acknowledged', tone: 'info' },
  active: { label: 'Active', tone: 'accent' },
  paused: { label: 'Paused', tone: 'warning' },
  reset: { label: 'Reset (archived)', tone: 'muted' },
};

export const statusOf = (s?: string | null) => STATUS[s ?? ''] ?? { label: s ?? '—', tone: 'neutral' as Tone };

export const levelOf = (score?: number | null): { label: string; tone: Tone } => {
  if (score == null) return { label: '—', tone: 'muted' };
  if (score >= 12) return { label: 'Critical', tone: 'critical' };
  if (score >= 8) return { label: 'High', tone: 'danger' };
  if (score >= 4) return { label: 'Moderate', tone: 'warning' };
  return { label: 'Low', tone: 'success' };
};

export const SEVERITY: Record<number, { label: string; tone: Tone }> = {
  1: { label: 'Sev 1 · Low', tone: 'success' },
  2: { label: 'Sev 2 · Moderate', tone: 'warning' },
  3: { label: 'Sev 3 · High', tone: 'danger' },
  4: { label: 'Sev 4 · Critical', tone: 'critical' },
};

export const STAGES = [
  { key: 'detect', label: 'Detect' },
  { key: 'assess', label: 'Assess' },
  { key: 'authorise', label: 'Authorise' },
  { key: 'execute', label: 'Execute' },
  { key: 'verify', label: 'Verify' },
] as const;

export const stageIndex: Record<string, number> = {
  draft: 2, submitted: 2, reopened: 2, under_review: 2, cancelled: 2,
  awaiting_approval: 3, escalated: 3, rejected: 3,
  approved: 4, scheduled: 4, in_progress: 4, failed: 4, blocked: 4,
  awaiting_verification: 5, completed: 6,
};

export const STAGE_LABEL: Record<string, string> = {
  detect: 'Detect', assess: 'Assess', authorise: 'Authorise', execute: 'Execute', verify: 'Verify',
  governance: 'Governance', admin: 'Administration', scenario: 'Scenario', done: 'Done',
};

export const PERMISSION_LABEL: Record<string, string> = {
  'org.admin': 'Administer organisation, roles & policy',
  'risk.manage': 'Manage the risk register',
  'action.propose': 'Propose actions',
  'action.reassign': 'Reassign responsibilities',
  'action.manage_all': 'Submit actions on behalf of others',
  'action.verify': 'Verify completed actions',
  'action.emergency': 'Invoke emergency procedure',
  'scenario.run': 'Run demonstration scenarios',
  'incident.create': 'Report incidents',
  'incident.investigate': 'Investigate incidents',
  'incident.assess.security': 'Security impact assessment',
  'incident.assess.financial': 'Financial impact assessment',
  'incident.close': 'Close incidents',
  'governance.oversight': 'Informed of all actions (oversight)',
  'authority.delegate': 'Delegate own approval authority',
  'kri.record': 'Record KRI measurements',
  'audit.view': 'Read-only audit access',
};

export const initials = (n?: string | null) => (n ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

/** Compact money: €1.2M, €340k, €950 */
export function fmtMoneyShort(n?: number | null, cur = '€') {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return `${cur}${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${cur}${Math.round(n / 1e3)}k`;
  return `${cur}${Math.round(n)}`;
}
export const pct = (n?: number | null, digits = 0) => (n === null || n === undefined || Number.isNaN(n) ? '—' : `${(n * 100).toFixed(digits)}%`);
/** Map a control effectiveness value to label + tone */
export const EFF: Record<string, { label: string; tone: Tone }> = {
  effective: { label: 'Effective', tone: 'success' }, partial: { label: 'Partially effective', tone: 'warning' },
  ineffective: { label: 'Ineffective', tone: 'critical' }, not_assessed: { label: 'Not assessed', tone: 'muted' },
};
export const TEST: Record<string, { label: string; tone: Tone }> = {
  pass: { label: 'Pass', tone: 'success' }, warn: { label: 'Warning', tone: 'warning' }, fail: { label: 'Fail', tone: 'critical' }, partial: { label: 'Partial', tone: 'warning' },
};
export const TIER: Record<string, { label: string; tone: Tone }> = {
  critical: { label: 'Critical', tone: 'critical' }, high: { label: 'High', tone: 'danger' }, medium: { label: 'Medium', tone: 'warning' }, low: { label: 'Low', tone: 'info' },
};
