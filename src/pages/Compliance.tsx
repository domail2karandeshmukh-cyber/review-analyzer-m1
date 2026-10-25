import { Fragment, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Layers, Radio, AlertTriangle } from 'lucide-react';
import { useRpc, useSession } from '../lib/session';
import { ago } from '../lib/format';
import { Card, CaseTag, Drawer, Empty, Loading, Meter, PageHead, Sev, Stat } from '../components/ui';
import '../styles/compliance.css';

const STATUS: Record<string, { level: string; label: string }> = {
  met: { level: 'pass', label: 'Met' }, partial: { level: 'medium', label: 'Partial' }, gap: { level: 'critical', label: 'Gap' },
};
const FW_ORDER = ['ISO 27001', 'NIS2', 'GDPR', 'DORA'];
const MARK: Record<string, string> = { 'ISO 27001': 'ISO', NIS2: 'NIS2', GDPR: 'GDPR', DORA: 'DORA' };

export const coverage = (f: any) => (f.total ? (f.met + f.partial * 0.5) / f.total : 0);
const pctTxt = (v: number) => `${Math.round(v * 100)}%`;

export default function Compliance() {
  const { orgId } = useSession();
  const [sp, setSp] = useSearchParams();
  const comp = useRpc<any>('grc_compliance', { p_org: orgId }, { poll: 30000 });
  const ctl = useRpc<any[]>('grc_controls', { p_org: orgId }, { poll: 60000 });
  const fws: any[] = comp.data?.frameworks ?? [];
  const sel = sp.get('f');
  const selFw = fws.find(f => f.id === sel);

  const tot = fws.reduce((a, f) => ({ total: a.total + f.total, met: a.met + f.met, partial: a.partial + f.partial, gap: a.gap + f.gap }), { total: 0, met: 0, partial: 0, gap: 0 });
  const overall = tot.total ? (tot.met + tot.partial * 0.5) / tot.total : 0;
  const c = comp.data?.controls;

  return (
    <>
      <PageHead title="Compliance frameworks"
        desc="Every requirement is traced to the controls that satisfy it. Coverage counts a requirement as met when at least one implemented control operates effectively, and as half when controls are only partially effective."
        actions={<div className="cx-head-actions"><Link className="btn" to="/controls">Controls library <ArrowRight size={14} /></Link></div>} />

      {comp.loading && !comp.data ? <Card><Loading rows={5} /></Card> : fws.length === 0 ? (
        <Card><Empty title="No frameworks configured for this organisation">Frameworks are set up per organisation by the compliance team.</Empty></Card>
      ) : (
        <>
          <div className="stats">
            <Stat k="Overall coverage" icon={<Layers size={13} />} v={<>{pctTxt(overall)}</>} d={`${tot.met} met · ${tot.partial} partial · ${tot.gap} ${tot.gap === 1 ? 'gap' : 'gaps'} · ${tot.total} requirements`} bar={overall * 100} />
            <Stat k="Controls operating effectively" icon={<ShieldCheck size={13} />} v={<>{c?.effective ?? 0}<small>/ {c?.total ?? 0}</small></>} d={`${c?.partial ?? 0} partial · ${c?.not_assessed ?? 0} not assessed`} bar={c?.total ? (c.effective / c.total) * 100 : 0} to="/controls" />
            <Stat k="Continuously monitored" icon={<Radio size={13} />} v={<>{c?.monitored ?? 0}<small>controls</small></>} d={comp.data?.last_monitor_run ? `Last run ${ago(comp.data.last_monitor_run)}` : 'Not run yet'} to="/controls?run=1" />
            <Stat k="Failing or warning" icon={<AlertTriangle size={13} />} v={<>{comp.data?.failing?.length ?? 0}</>} d={(comp.data?.failing ?? []).slice(0, 3).map((x: any) => x.code).join(' · ') || 'All monitored controls passing'} to="/controls?r=issues" tone={(comp.data?.failing?.length ?? 0) > 0 ? 'down' : 'up'} />
          </div>

          <div className="cx-honest">
            <CaseTag>Control ratings and mappings: case-study inputs</CaseTag>
            <span className="live"><i />Monitoring results: computed from live platform data</span>
          </div>

          <div className="cx-section" style={{ marginTop: 0 }}>
            <div><h2>Frameworks in scope</h2><p>Select a framework to see each requirement, its status and the controls behind it.</p></div>
            <div className="cx-legend"><span><i style={{ background: 'var(--pass)' }} />Met</span><span><i style={{ background: 'var(--medium)' }} />Partial</span><span><i style={{ background: 'var(--crit)' }} />Gap</span></div>
          </div>
          <div className="cx-fw-grid">
            {[...fws].sort((a, b) => FW_ORDER.indexOf(a.code) - FW_ORDER.indexOf(b.code)).map(f => (
              <button key={f.id} className={`cx-fw ${sel === f.id ? 'on' : ''}`} onClick={() => setSp({ f: f.id })}>
                <div className="cx-fw-top">
                  <span className="cx-fw-code"><span className="cx-fw-mark">{MARK[f.code] ?? f.code.slice(0, 4)}</span>{f.code}</span>
                  <span className="xs muted">{f.version}</span>
                </div>
                <div className="cx-fw-name">{f.name}</div>
                <div className="cx-fw-pct">{pctTxt(coverage(f))}<small>coverage</small></div>
                <Meter parts={[{ value: f.met, color: 'var(--pass)', title: `${f.met} met` }, { value: f.partial, color: 'var(--medium)', title: `${f.partial} partial` }, { value: f.gap, color: 'var(--crit)', title: `${f.gap} gaps` }]} />
                <div className="cx-fw-counts"><span><b>{f.met}</b> met</span><span><b>{f.partial}</b> partial</span><span><b>{f.gap}</b> gap</span><span><b>{f.controls}</b> controls</span></div>
                <div className="cx-fw-app" title={f.applicability}>{f.applicability}</div>
              </button>
            ))}
          </div>

          <Crosswalk controls={ctl.data} frameworks={fws} loading={ctl.loading && !ctl.data} />
        </>
      )}

      {selFw && <FrameworkDrawer fw={selFw} onClose={() => setSp({})} />}
    </>
  );
}

function Crosswalk({ controls, frameworks, loading }: { controls: any[] | null; frameworks: any[]; loading: boolean }) {
  const cols = [...frameworks].sort((a, b) => FW_ORDER.indexOf(a.code) - FW_ORDER.indexOf(b.code));
  const rows = useMemo(() => (controls ?? []).map(c => {
    const by: Record<string, any[]> = {};
    for (const r of c.requirements ?? []) (by[r.framework] ??= []).push(r);
    return { c, by, n: Object.keys(by).length, reqs: (c.requirements ?? []).length };
  }).filter(r => r.reqs > 0).sort((a, b) => b.n - a.n || b.reqs - a.reqs || a.c.code.localeCompare(b.c.code)), [controls]);
  const totalReq = frameworks.reduce((s, f) => s + f.total, 0);
  const multi = rows.filter(r => r.n >= 3).length;
  const links = rows.reduce((s, r) => s + r.reqs, 0);
  return (
    <>
      <div className="cx-section">
        <div><h2>Crosswalk · test once, comply many</h2><p>One control, one test, evidence reused across every framework it satisfies. Sorted by reach.</p></div>
        <Link className="btn sm" to="/controls">Open controls <ArrowRight size={13} /></Link>
      </div>
      <Card flush>
        {loading ? <Loading rows={6} /> : (
          <>
            <div className="cx-xw-wrap">
              <table className="cx-xw">
                <thead><tr>
                  <th>Control</th>
                  {cols.map(f => <th key={f.id} className="fw">{f.code}<span>{f.total} requirements</span></th>)}
                  <th style={{ width: 120 }}>Reach</th>
                  <th style={{ width: 150 }}>Operating</th>
                </tr></thead>
                <tbody>
                  {rows.map(({ c, by, n }) => (
                    <tr key={c.id}>
                      <td><Link to={`/controls?c=${c.id}`} className="cx-ctl" style={{ textDecoration: 'none' }}><span className="code">{c.code}</span><span className="t" title={c.title}>{c.title}</span></Link></td>
                      {cols.map(f => {
                        const list = by[f.code] ?? [];
                        return <td key={f.id} className="fw">{list.length === 0 ? <span className="cx-empty" aria-label="not mapped" /> :
                          <span className={`cx-cell ${list.length >= 3 ? 'l3' : list.length === 2 ? 'l2' : ''}`} title={list.map((r: any) => `${r.ref} ${r.title}`).join('\n')}>
                            {list.length === 1 ? list[0].ref : `${list[0].ref} +${list.length - 1}`}
                          </span>}</td>;
                      })}
                      <td><span className="row" style={{ gap: 8 }}><span className="cx-span">{cols.map((f, i) => <i key={i} className={by[f.code] ? 'on' : ''} />)}</span><span className="xs muted">{n}/{cols.length}</span></span></td>
                      <td><EffSev v={c.operating_eff} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="cx-xw-foot">
              <span><b>{rows.length}</b>controls mapped</span>
              <span><b>{links}</b>control-to-requirement links covering {totalReq} requirements</span>
              <span><b>{multi}</b>controls serve three or more frameworks</span>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

export function EffSev({ v }: { v?: string }) {
  const m: Record<string, [string, string]> = { effective: ['pass', 'Effective'], partial: ['medium', 'Partial'], ineffective: ['critical', 'Ineffective'], not_assessed: ['none', 'Not assessed'] };
  const [l, t] = m[v ?? 'not_assessed'] ?? m.not_assessed;
  return <Sev level={l}>{t}</Sev>;
}

function FrameworkDrawer({ fw, onClose }: { fw: any; onClose: () => void }) {
  const { orgId } = useSession();
  const { data, loading } = useRpc<any>('grc_framework', { p_org: orgId, p_id: fw.id });
  const groups = useMemo(() => {
    const g: [string, any[]][] = [];
    for (const r of data?.requirements ?? []) {
      const last = g[g.length - 1];
      if (last && last[0] === (r.domain ?? 'Other')) last[1].push(r); else g.push([r.domain ?? 'Other', [r]]);
    }
    return g;
  }, [data]);
  return (
    <Drawer wide onClose={onClose} title={fw.name} sub={`${fw.authority}${fw.version ? ` · ${fw.version}` : ''}`}>
      <div className="cx-dhead">
        <div className="big"><b>{pctTxt(coverage(fw))}</b><span className="small muted">coverage · {fw.met} met, {fw.partial} partial, {fw.gap} gap of {fw.total}</span></div>
        <Meter parts={[{ value: fw.met, color: 'var(--pass)' }, { value: fw.partial, color: 'var(--medium)' }, { value: fw.gap, color: 'var(--crit)' }]} />
        {fw.description && <div className="small" style={{ color: 'var(--text-2)' }}>{fw.description}</div>}
        <div className="xs muted"><b style={{ color: 'var(--text-3)' }}>Applicability for NOVATECH.</b> {fw.applicability}</div>
      </div>
      {loading && !data ? <Loading rows={8} /> : groups.map(([dom, reqs]) => (
        <Fragment key={dom}>
          <div className="cx-domain"><span>{dom}</span><span>{reqs.filter(r => r.status === 'met').length}/{reqs.length} met</span></div>
          {reqs.map(r => (
            <div key={r.id} className="cx-req">
              <span className="ref">{r.ref}</span>
              <div style={{ minWidth: 0 }}>
                <div className="tt">{r.title}</div>
                {r.controls.length > 0 ? (
                  <div className="chips">{r.controls.map((c: any) => (
                    <Link key={c.id} to={`/controls?c=${c.id}`} className="cx-chip" title={`${c.title} · operating ${c.operating_eff.replace('_', ' ')}`}><span className={`d ${c.operating_eff}`} /><b>{c.code}</b>{c.title}</Link>
                  ))}</div>
                ) : <div className="cx-gap-note">No control mapped yet: a gap to treat in the action plan.</div>}
              </div>
              <span className="st"><Sev level={STATUS[r.status].level}>{STATUS[r.status].label}</Sev></span>
            </div>
          ))}
        </Fragment>
      ))}
    </Drawer>
  );
}
