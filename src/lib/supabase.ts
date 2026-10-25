import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'novatech-grc-auth' },
});

export class RpcError extends Error {
  kind: 'DENIED' | 'VALIDATION' | 'AUTH' | 'NOT_FOUND' | 'ERROR';
  constructor(message: string) {
    const m = message.match(/^(DENIED|VALIDATION|AUTH|NOT_FOUND):\s*(.*)$/s);
    super(m ? m[2] : message);
    this.kind = (m ? m[1] : 'ERROR') as RpcError['kind'];
  }
}

/** Every read and write goes through a permission-checked database function. */
export async function rpc<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new RpcError(error.message);
  return data as T;
}
