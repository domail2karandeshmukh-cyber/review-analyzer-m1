import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rpc } from '../lib/supabase';
import { useRpc, useSession } from '../lib/session';
import { Field, Modal, Notice, useToast } from './ui';
import { PolicyPreview } from './Policy';

export function NewActionModal({ onClose, incident, riskId }: { onClose: () => void; incident?: any; riskId?: string }) {
  const { orgId, bump } = useSession();
  const org = useRpc<any>('grc_org', { p_org: orgId });
  const risks = useRpc<any[]>('grc_risks', { p_org: orgId });
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState<any>({
    action_type: '', title: '', proposed_action: '', justification: '', business_impact: '', business_process: '',
    severity: incident?.severity ?? 2, amount: incident?.financial_exposure ?? '', budget: '', risk_id: riskId ?? incident?.risk?.id ?? '',
    asset_id: incident?.asset?.id ?? '', priority: 'P2', deadline: new Date(Date.now() + 2 * 86400e3).toISOString().slice(0, 10), treatment_strategy: 'Reduce', resources: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const type = useMemo(() => org.data?.action_types?.find((t: any) => t.code === f.action_type), [org.data, f.action_type]);
  const isFinance = type && ['finance', 'banking'].includes(type.domain);
  const isTreatment = f.action_type === 'treatment_task';

  async function save(submit: boolean) {
    setBusy(true); setErr(null);
    try {
      const payload: any = { ...f, incident_id: incident?.id ?? null, severity: +f.severity };
      if (!isFinance) payload.amount = '';
      if (isTreatment) payload.amount = f.budget;
      payload.deadline = f.deadline ? new Date(f.deadline + 'T17:00:00').toISOString() : '';
      const id = await rpc<string>('grc_propose_action', { p_org: orgId, p: payload });
      if (submit) await rpc('grc_submit_action', { p_id: id });
      toast('ok', submit ? 'Action created and submitted' : 'Draft created');
      bump(); onClose(); nav(`/actions/${id}`);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <Modal title={incident ? `Propose a response to ${incident.ref}` : 'New action plan'} sub="The approval route is calculated by policy — you do not choose the approver." onClose={onClose} wide
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={busy || !f.action_type || !f.title} onClick={() => save(false)}>Save draft</button>
        <button className="btn primary" disabled={busy || !f.action_type || !f.title} onClick={() => save(true)}>Create & submit</button>
      </>}>
      <div className="stack">
        <div className="grid g2">
          <Field label="Action type">
            <select className="select" value={f.action_type} onChange={set('action_type')}>
              <option value="">Select…</option>
              {(org.data?.action_types ?? []).map((t: any) => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Title"><input className="input" value={f.title} onChange={set('title')} placeholder="e.g. Disable compromised account fin.user07" /></Field>
        </div>
        <div className="grid g3">
          <Field label="Severity (1–4)"><select className="select" value={f.severity} onChange={set('severity')}>{[1, 2, 3, 4].map(n => <option key={n}>{n}</option>)}</select></Field>
          <Field label="Priority"><select className="select" value={f.priority} onChange={set('priority')}>{['P1', 'P2', 'P3', 'P4'].map(n => <option key={n}>{n}</option>)}</select></Field>
          <Field label="Deadline"><input className="input" type="date" value={f.deadline} onChange={set('deadline')} /></Field>
        </div>
        <div className="grid g2">
          <Field label="Related risk"><select className="select" value={f.risk_id} onChange={set('risk_id')}><option value="">—</option>{(risks.data ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.code} · {r.title}</option>)}</select></Field>
          <Field label="Affected asset"><select className="select" value={f.asset_id} onChange={set('asset_id')}><option value="">—</option>{(org.data?.assets ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name} (crit. {s.criticality})</option>)}</select></Field>
        </div>
        {isFinance && <Field label="Amount concerned (€)" help="Used by the financial-authority thresholds."><input className="input" type="number" value={f.amount} onChange={set('amount')} /></Field>}
        {isTreatment && <div className="grid g2">
          <Field label="Estimated budget (€)" help="≥ €10,000 requires Finance approval."><input className="input" type="number" value={f.budget} onChange={set('budget')} /></Field>
          <Field label="Treatment strategy"><select className="select" value={f.treatment_strategy} onChange={set('treatment_strategy')}>{['Reduce', 'Transfer', 'Reduce / Transfer', 'Avoid', 'Accept'].map(s => <option key={s}>{s}</option>)}</select></Field>
        </div>}
        <Field label="Proposed action"><textarea className="textarea" value={f.proposed_action} onChange={set('proposed_action')} /></Field>
        <div className="grid g2">
          <Field label="Justification"><textarea className="textarea" value={f.justification} onChange={set('justification')} /></Field>
          <Field label="Business impact"><textarea className="textarea" value={f.business_impact} onChange={set('business_impact')} /></Field>
        </div>
        {f.action_type && (
          <div className="card" style={{ padding: 14, background: 'var(--surface-2)', boxShadow: 'none' }}>
            <div className="section-title">Policy route for this request</div>
            <PolicyPreview org={orgId} actionType={f.action_type} severity={+f.severity} asset={f.asset_id} amount={isFinance ? (f.amount ? +f.amount : null) : isTreatment ? (f.budget ? +f.budget : null) : null} />
          </div>
        )}
        {err && <Notice kind="danger">{err}</Notice>}
      </div>
    </Modal>
  );
}
