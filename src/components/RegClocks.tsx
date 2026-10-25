import { useEffect, useState } from 'react';
import { Clock, CheckCircle2, Scale } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useRpc, useSession } from '../lib/session';
import { fmtDateTime } from '../lib/format';
import { Badge, Card, Field, Modal, Notice, useToast } from './ui';

const REGIMES = [
  { k: 'NIS2', t: 'NIS2 significant incident', d: 'Early warning 24 h, notification 72 h, final report one month after the notification (Art. 23).' },
  { k: 'GDPR', t: 'GDPR personal-data breach', d: 'Notify the CNIL within 72 h of awareness where feasible (Art. 33); inform people if high risk (Art. 34).' },
  { k: 'DORA', t: 'DORA major ICT incident (client obligation)', d: 'Initial 4 h after classification and within 24 h of awareness, intermediate 72 h, final one month (RTS 2025/301).' },
];

function useNow(ms = 30000) { const [n, setN] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t); }, [ms]); return n; }

function left(due: string, now: number) {
  const h = (new Date(due).getTime() - now) / 3600000;
  if (h < 0) return { t: `${Math.ceil(-h)} h overdue`, tone: 'critical' as const };
  if (h < 24) return { t: `${Math.floor(h)} h ${Math.floor((h % 1) * 60)} min left`, tone: h < 6 ? 'critical' as const : 'warning' as const };
  return { t: `${Math.floor(h / 24)} d ${Math.floor(h % 24)} h left`, tone: 'neutral' as const };
}

/** NIS2 / GDPR / DORA reporting clocks for one incident. Recording a submission is audit-logged; the platform does not transmit anything itself. */
export function RegClocks({ incidentId, archived }: { incidentId: string; archived?: boolean }) {
  const { orgId, bump } = useSession();
  const { data, reload } = useRpc<any>('grc_incident_regulatory', { p_org: orgId, p_incident: incidentId }, { poll: 30000 });
  const toast = useToast();
  const now = useNow();
  const [edit, setEdit] = useState(false);
  const [mark, setMark] = useState<any>(null);
  const [ref, setRef] = useState('');
  const [form, setForm] = useState<any>(null);
  if (!data) return null;
  const n = data.notifications ?? [];
  const open = () => { setForm({ regimes: data.regimes ?? [], personal_data: data.personal_data, significant: data.significant, aware_at: (data.aware_at ?? new Date().toISOString()).slice(0, 16) }); setEdit(true); };

  return (
    <Card title={<span className="row" style={{ gap: 6 }}><Scale size={14} />Regulatory reporting</span>}
      sub={data.aware_at ? `Clock started ${fmtDateTime(data.aware_at)} (awareness)` : 'Not yet classified'}
      actions={data.can_manage && !archived && <button className="btn sm" onClick={open}>{data.regimes?.length ? 'Reclassify' : 'Classify'}</button>}>
      {!data.regimes?.length ? (
        <div className="small muted">Decide whether NIS2, GDPR or a client's DORA obligation applies. Deadlines then count from the moment of awareness.</div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {n.map((x: any) => {
            const c = x.due_at && !x.sent_at ? left(x.due_at, now) : null;
            return (
              <div key={x.id} className="row top" style={{ gap: 10, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: x.sent_at ? 'var(--pass-wash)' : 'var(--raised)' }}>
                {x.sent_at ? <CheckCircle2 size={15} color="var(--pass)" style={{ marginTop: 2 }} /> : <Clock size={15} color={c?.tone === 'critical' ? 'var(--crit)' : 'var(--text-3)'} style={{ marginTop: 2 }} />}
                <div className="grow">
                  <div className="small" style={{ fontWeight: 550 }}><span className="mono xs muted">{x.regime}</span> {x.stage.replace(/^\d · /, '')}</div>
                  <div className="xs muted">{x.authority}{x.due_at ? ` · due ${fmtDateTime(x.due_at)}` : ' · due date set by the previous step'}</div>
                  {x.sent_at && <div className="xs" style={{ color: 'var(--pass-2)' }}>Recorded as submitted {fmtDateTime(x.sent_at)} by {x.sent_by}{x.reference ? ` · ref ${x.reference}` : ''}</div>}
                </div>
                {c && <Badge tone={c.tone}>{c.t}</Badge>}
                {!x.sent_at && data.can_manage && !archived && <button className="btn sm" onClick={() => { setMark(x); setRef(''); }}>Record</button>}
              </div>
            );
          })}
          <div className="xs muted">The platform records submissions and their timing; it does not send anything to the authorities itself.</div>
        </div>
      )}

      {edit && form && (
        <Modal title="Classify for regulatory reporting" onClose={() => setEdit(false)}
          footer={<><button className="btn" onClick={() => setEdit(false)}>Cancel</button><button className="btn primary" onClick={async () => {
            try { await rpc('grc_incident_regulatory_set', { p_org: orgId, p_incident: incidentId, p: { ...form, aware_at: new Date(form.aware_at).toISOString() } }); toast('ok', 'Classification recorded; clocks started'); setEdit(false); reload(); bump(); }
            catch (e: any) { toast('err', e.message); }
          }}>Save classification</button></>}>
          <div className="stack">
            <Field label="Moment of awareness" help="Deadlines count from when the organisation became aware of the incident, not from detection by a tool.">
              <input className="input" type="datetime-local" value={form.aware_at} onChange={e => setForm({ ...form, aware_at: e.target.value })} />
            </Field>
            {REGIMES.map(r => (
              <label key={r.k} className="check">
                <input type="checkbox" checked={form.regimes.includes(r.k)} onChange={e => setForm({ ...form, regimes: e.target.checked ? [...form.regimes, r.k] : form.regimes.filter((x: string) => x !== r.k) })} />
                <div><div className="small" style={{ fontWeight: 550 }}>{r.t}</div><div className="xs muted">{r.d}</div></div>
              </label>
            ))}
            <label className="check"><input type="checkbox" checked={!!form.personal_data} onChange={e => setForm({ ...form, personal_data: e.target.checked })} /><div className="small">Personal data is affected</div></label>
            <Notice>France has not yet transposed NIS2 (bill still in Parliament in 2026); the clocks follow the directive's Article 23 so the team is ready.</Notice>
          </div>
        </Modal>
      )}
      {mark && (
        <Modal title={`Record submission: ${mark.regime} ${mark.stage.replace(/^\d · /, '')}`} onClose={() => setMark(null)}
          footer={<><button className="btn" onClick={() => setMark(null)}>Cancel</button><button className="btn primary" onClick={async () => {
            try { await rpc('grc_reg_mark_sent', { p_org: orgId, p_id: mark.id, p_reference: ref }); toast('ok', 'Submission recorded in the ledger'); setMark(null); reload(); bump(); }
            catch (e: any) { toast('err', e.message); }
          }}>Record as submitted now</button></>}>
          <div className="stack">
            <Notice kind="warn">Only record this once the report has actually been submitted to {mark.authority}. The time is sealed in the audit ledger, and a late submission is marked late.</Notice>
            <Field label="Authority reference (optional)"><input className="input" value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. CERT-FR ticket number" /></Field>
          </div>
        </Modal>
      )}
    </Card>
  );
}
