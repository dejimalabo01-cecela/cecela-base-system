import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type Role = 'admin' | 'editor' | 'viewer' | 'assignee';

export function useRole(userId: string | undefined) {
  const [role, setRole] = useState<Role>('admin'); // default until loaded
  const [roleLoading, setRoleLoading] = useState(true);

  const loadRole = useCallback(async () => {
    if (!userId) { setRoleLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (error || !data) {
        // Table might not exist yet or no profile — default to admin
        setRole('admin');
      } else {
        setRole(data.role as Role);
      }
    } catch {
      setRole('admin');
    }
    setRoleLoading(false);
  }, [userId]);

  useEffect(() => { loadRole(); }, [loadRole]);

  return { role, roleLoading, loadRole };
}
