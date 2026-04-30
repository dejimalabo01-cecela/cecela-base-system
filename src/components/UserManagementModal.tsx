import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faUsers, faShield, faPen, faEye, faPaperPlane, faTag } from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../lib/supabase';
import type { UserProfile, UserRole } from '../types';

interface Props {
  currentUserId: string;
  onClose: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理者',
  editor: '編集者',
  viewer: '閲覧のみ',
  assignee: '物件担当者',
};

const ROLE_ICONS: Record<UserRole, typeof faShield> = {
  admin: faShield,
  editor: faPen,
  viewer: faEye,
  assignee: faTag,
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'text-red-500 dark:text-red-400',
  editor: 'text-blue-500 dark:text-blue-400',
  viewer: 'text-gray-500 dark:text-gray-400',
  assignee: 'text-emerald-600 dark:text-emerald-400',
};

const ROLE_OPTIONS: UserRole[] = ['admin', 'editor', 'viewer', 'assignee'];

export function UserManagementModal({ currentUserId, onClose }: Props) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // 招待フォーム
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('assignee');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function loadUsers() {
    setLoading(true);
    const { data } = await supabase
      .from('user_profiles')
      .select('id, email, role, display_name')
      .order('created_at');
    if (data) {
      setUsers(data.map(u => ({
        id: u.id as string,
        email: u.email as string,
        role: u.role as UserRole,
        displayName: (u.display_name as string | null) ?? null,
      })));
    }
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setSaving(userId);
    await supabase.from('user_profiles').update({ role: newRole }).eq('id', userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    setSaving(null);
  }

  async function handleNameSave(userId: string) {
    const trimmed = editName.trim();
    setSaving(userId);
    await supabase.from('user_profiles').update({ display_name: trimmed || null }).eq('id', userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, displayName: trimmed || null } : u));
    setSaving(null);
    setEditingNameId(null);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    setInviteResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email, role: inviteRole, displayName: inviteName.trim() || null },
      });
      if (error || data?.error) {
        let msg = data?.error ?? error?.message ?? 'エラーが発生しました';
        if (!data?.error && error && 'context' in error) {
          try {
            const body = await (error as { context: Response }).context.json();
            if (body?.error) msg = body.error;
          } catch { /* ignore */ }
        }
        setInviteResult({ ok: false, msg });
      } else {
        setInviteResult({ ok: true, msg: `${email} を「${ROLE_LABELS[inviteRole]}」として招待しました` });
        setInviteEmail('');
        setInviteName('');
        setTimeout(loadUsers, 1500);
      }
    } catch (err) {
      setInviteResult({ ok: false, msg: String(err) });
    }
    setInviting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[88vh]">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faUsers} className="text-blue-500" />
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">ユーザー管理</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
          >
            <FontAwesomeIcon icon={faXmark} className="text-lg" />
          </button>
        </div>

        <div className="px-6 pt-4 pb-2">
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <div><span className="font-semibold">管理者</span>：全機能利用可（ユーザー管理・テンプレート編集含む）</div>
            <div><span className="font-semibold">編集者</span>：全物件・工程の作成・編集・削除が可能</div>
            <div><span className="font-semibold">閲覧のみ</span>：全物件の閲覧・エクスポートのみ（編集不可）</div>
            <div><span className="font-semibold">物件担当者</span>：自分が担当の物件のみ閲覧・編集可能</div>
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
          {loading ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">読み込み中...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
              ユーザーが見つかりません
            </p>
          ) : (
            users.map(u => {
              const isMe = u.id === currentUserId;
              const editingName = editingNameId === u.id;
              return (
                <div
                  key={u.id}
                  className="flex items-start gap-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    {/* 表示名（編集可） */}
                    <div className="flex items-center gap-2 mb-0.5">
                      {editingName ? (
                        <input
                          autoFocus
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onBlur={() => handleNameSave(u.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleNameSave(u.id);
                            if (e.key === 'Escape') setEditingNameId(null);
                          }}
                          placeholder="表示名"
                          className="text-sm border border-blue-400 rounded px-2 py-0.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setEditingNameId(u.id); setEditName(u.displayName ?? ''); }}
                          className="text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 truncate"
                          title="クリックで表示名を編集"
                        >
                          {u.displayName || <span className="text-gray-400 italic">表示名 未設定</span>}
                        </button>
                      )}
                      {isMe && (
                        <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded font-medium shrink-0">
                          自分
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{u.email}</div>
                    <div className={`flex items-center gap-1 mt-0.5 text-xs ${ROLE_COLORS[u.role]}`}>
                      <FontAwesomeIcon icon={ROLE_ICONS[u.role]} className="text-[10px]" />
                      <span>{ROLE_LABELS[u.role]}</span>
                    </div>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    {saving === u.id ? (
                      <span className="text-xs text-blue-400">保存中...</span>
                    ) : isMe ? (
                      <span className="text-xs text-gray-400 dark:text-gray-500">変更不可</span>
                    ) : (
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                        className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        {ROLE_OPTIONS.map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 招待フォーム */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-1.5">
            <FontAwesomeIcon icon={faPaperPlane} className="text-blue-500" />
            新しいユーザーを招待
          </p>
          <form onSubmit={handleInvite} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="表示名（例：田中 太郎）"
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as UserRole)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {ROLE_OPTIONS.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="メールアドレス"
                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <button
                type="submit"
                disabled={!inviteEmail.trim() || inviting}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 transition flex items-center gap-1.5 shrink-0"
              >
                <FontAwesomeIcon icon={faPaperPlane} className="text-xs" />
                {inviting ? '送信中...' : '招待'}
              </button>
            </div>
          </form>

          {inviteResult && (
            <p className={`mt-2 text-xs px-3 py-2 rounded-lg border ${
              inviteResult.ok
                ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'
                : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
            }`}>
              {inviteResult.msg}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            招待されたユーザーはメールのリンクからパスワードを設定してログインできます。物件担当者で招待した場合、「工程管理」「販売計画」のうち自分が担当の物件のみが見えます。
          </p>
        </div>
      </div>
    </div>
  );
}
