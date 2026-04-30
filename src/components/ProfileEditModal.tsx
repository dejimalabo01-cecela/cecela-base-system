import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faUser } from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../lib/supabase';

interface Props {
  userId: string;
  email: string;
  onClose: () => void;
  onSaved?: (newDisplayName: string | null) => void;
}

/**
 * 自分自身の表示名（display_name）だけを編集できる軽量モーダル。
 * 物件担当者(assignee)など、ユーザー管理画面を開けないロール向け。
 */
export function ProfileEditModal({ userId, email, onClose, onSaved }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('id', userId)
        .single();
      if (cancelled) return;
      setDisplayName((data as { display_name?: string | null } | null)?.display_name ?? '');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const trimmed = displayName.trim();
    const { error: upErr } = await supabase
      .from('user_profiles')
      .update({ display_name: trimmed || null })
      .eq('id', userId);
    if (upErr) {
      setError(upErr.message);
      setSaving(false);
      return;
    }
    setSavedFlash(true);
    setSaving(false);
    onSaved?.(trimmed || null);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faUser} className="text-blue-500" />
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">プロフィール編集</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
          >
            <FontAwesomeIcon icon={faXmark} className="text-lg" />
          </button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              メールアドレス
            </label>
            <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
              {email || '（未設定）'}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              表示名
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              disabled={loading}
              placeholder="例：田中 太郎"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
              工程の編集履歴やガントチャートのツールチップに表示されます。
            </p>
          </div>

          {error && (
            <p className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {savedFlash && (
            <p className="text-green-700 dark:text-green-300 text-xs bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
              保存しました
            </p>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              閉じる
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-5 py-2 transition"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
