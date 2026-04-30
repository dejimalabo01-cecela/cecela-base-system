import { useState, useEffect, useCallback } from 'react';
import type { Member } from '../types';
import { supabase } from '../lib/supabase';

/**
 * 「メンバー＝物件担当者」の一覧を返すフック。
 * v8 から、メンバーは独立テーブルではなく user_profiles の role='assignee' のユーザーになる。
 * UI 側のインターフェース（Member { id, name }）は据え置きで、内部だけ差し替え。
 */
export function useMembers(userId: string | undefined) {
  const [members, setMembers] = useState<Member[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, email, display_name, role')
      .eq('role', 'assignee');
    if (error) {
      console.error('members(=assignees) load error:', error);
      return;
    }
    if (data) {
      const mapped: Member[] = data.map(u => ({
        id: u.id as string,
        name: (u.display_name as string | null) || (u.email as string).split('@')[0],
      }));
      mapped.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      setMembers(mapped);
    }
  }, []);

  useEffect(() => {
    if (userId) load();
    else setMembers([]);
  }, [load, userId]);

  // v8 以降は user_profiles 経由になったため、addMember / deleteMember は
  // 「ユーザー管理」モジュール側で行う設計に変更。
  // インターフェース互換のため空実装で残し、UI からは呼ばれないようにしてある。
  async function addMember(_name: string) {
    console.warn('addMember is deprecated — use ユーザー管理 to add an assignee user.');
  }
  async function deleteMember(_id: string) {
    console.warn('deleteMember is deprecated — use ユーザー管理 to remove the assignee user.');
  }

  return { members, addMember, deleteMember, load };
}
