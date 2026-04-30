import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type Role = 'admin' | 'editor' | 'viewer' | 'assignee';

export function useRole(userId: string | undefined) {
  const [role, setRole] = useState<Role>('admin'); // default until loaded
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const loadRole = useCallback(async () => {
    if (!userId) { setRoleLoading(false); return; }
    try {
      // display_name 列がまだマイグレーションされていない環境でもエラーにならないよう、
      // 先に display_name 込みで取りに行き、失敗したら role だけで再取得する。
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role, display_name')
        .eq('id', userId)
        .single();
      if (error || !data) {
        // display_name 列が無い古いDBへフォールバック
        const { data: data2, error: error2 } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', userId)
          .single();
        if (error2 || !data2) {
          setRole('admin');
          setDisplayName(null);
        } else {
          setRole(data2.role as Role);
          setDisplayName(null);
        }
      } else {
        setRole(data.role as Role);
        setDisplayName((data as { display_name?: string | null }).display_name ?? null);
      }
    } catch {
      setRole('admin');
      setDisplayName(null);
    }
    setRoleLoading(false);
  }, [userId]);

  useEffect(() => { loadRole(); }, [loadRole]);

  return { role, displayName, roleLoading, loadRole };
}
