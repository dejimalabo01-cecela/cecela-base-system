import { useState, useEffect, useCallback } from 'react';
import type { Member } from '../types';
import { supabase } from '../lib/supabase';

export function useMembers(userId: string | undefined) {
  const [members, setMembers] = useState<Member[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('members').select('*').order('created_at');
    if (error) {
      console.error('members load error:', error);
      return;
    }
    if (data) {
      setMembers(data.map(m => ({ id: m.id, name: m.name })));
    }
  }, []);

  useEffect(() => {
    if (userId) load();
    else setMembers([]);
  }, [load, userId]);

  async function addMember(name: string) {
    const id = `m-${Date.now()}`;
    await supabase.from('members').insert({ id, name });
    await load();
  }

  async function deleteMember(id: string) {
    await supabase.from('members').delete().eq('id', id);
    setMembers(prev => prev.filter(m => m.id !== id));
  }

  return { members, addMember, deleteMember };
}
