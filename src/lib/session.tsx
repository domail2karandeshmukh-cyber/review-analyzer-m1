import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, rpc, RpcError } from './supabase';

export type Membership = {
  org_id: string; org_name: string; industry: string; kind: 'primary' | 'template'; currency: string;
  employee_id: string; full_name: string; role_id: string; role: string; authority_level: number;
  department: string; is_student: boolean; permissions: string[];
  delegated_roles: { role: string; from: string; until: string }[];
};

type Ctx = {
  session: Session | null;
  loading: boolean;
  memberships: Membership[];
  current: Membership | null;
  orgId: string;
  setOrg: (id: string) => void;
  can: (perm: string) => boolean;
  refreshKey: number;
  bump: () => void;
  signOut: () => Promise<void>;
  reloadSession: () => Promise<void>;
};

const SessionCtx = createContext<Ctx | null>(null);

function safeGet(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [orgId, setOrgId] = useState<string>(safeGet('grc-org') ?? 'NT');
  const [refreshKey, setRefreshKey] = useState(0);

  const reloadSession = useCallback(async () => {
    try {
      const s = await rpc<{ memberships: Membership[] }>('grc_session');
      setMemberships(s.memberships ?? []);
    } catch {
      setMemberships([]);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await reloadSession();
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      if (s) await reloadSession(); else setMemberships([]);
    });
    return () => sub.subscription.unsubscribe();
  }, [reloadSession]);

  const current = useMemo(
    () => memberships.find(m => m.org_id === orgId) ?? memberships[0] ?? null,
    [memberships, orgId]);

  const setOrg = useCallback((id: string) => { setOrgId(id); safeSet('grc-org', id); setRefreshKey(k => k + 1); }, []);
  const can = useCallback((p: string) => !!current?.permissions.includes(p), [current]);
  const bump = useCallback(() => setRefreshKey(k => k + 1), []);
  const signOut = useCallback(async () => { await supabase.auth.signOut(); setMemberships([]); }, []);

  return (
    <SessionCtx.Provider value={{ session, loading, memberships, current, orgId: current?.org_id ?? orgId, setOrg, can, refreshKey, bump, signOut, reloadSession }}>
      {children}
    </SessionCtx.Provider>
  );
}

export const useSession = () => {
  const c = useContext(SessionCtx);
  if (!c) throw new Error('SessionProvider missing');
  return c;
};

/** Load data from an RPC; reloads when the global refresh key changes and on a gentle interval. */
export function useRpc<T>(fn: string | null, args: Record<string, unknown> = {}, opts: { poll?: number } = {}) {
  const { refreshKey } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<RpcError | null>(null);
  const [loading, setLoading] = useState(true);
  const argKey = JSON.stringify(args);
  const mounted = useRef(true);

  const load = useCallback(async (quiet = false) => {
    if (!fn) return;
    if (!quiet) setLoading(true);
    try {
      const d = await rpc<T>(fn, JSON.parse(argKey));
      if (mounted.current) { setData(d); setError(null); }
    } catch (e) {
      if (mounted.current) setError(e as RpcError);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [fn, argKey]);

  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; }; }, [load, refreshKey]);
  useEffect(() => {
    if (!opts.poll) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(true); }, opts.poll);
    return () => clearInterval(t);
  }, [load, opts.poll]);

  return { data, error, loading, reload: () => load(true) };
}
