import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { getAppTitle, getThemeColor } from '../config/deployment';

interface Props {
  onComplete: () => void;
}

/**
 * 招待メールのリンクから飛んできたユーザー（または「パスワードリセット」を行ったユーザー）に
 * パスワードを設定させるための画面。
 *
 * Supabase Auth は invite / recovery のリンクを踏むと URL hash に
 *   #access_token=xxx&refresh_token=yyy&type=invite
 * を付けてリダイレクトしてくる。supabase-js の detectSessionInUrl=true（デフォルト）
 * によりセッションは自動で復元されるので、この画面ではパスワードだけを setUser する。
 */
export function AcceptInvitePage({ onComplete }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const appTitle = getAppTitle();
  const themeColor = getThemeColor();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('パスワードは6文字以上で設定してください');
      return;
    }
    if (password !== confirm) {
      setError('パスワードが一致しません');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'パスワード設定に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: themeColor }} aria-hidden="true" />

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div
              className="text-xs font-semibold uppercase tracking-widest mb-1"
              style={{ color: themeColor }}
            >
              Cecela
            </div>
            <h1 className="text-white text-2xl font-bold">{appTitle}</h1>
            <p className="text-gray-400 text-xs mt-3">
              初回ログインのため、新しいパスワードを設定してください。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-gray-800 rounded-2xl p-8 space-y-5 shadow-2xl">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">新しいパスワード</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={{ outlineColor: themeColor }}
                placeholder="6文字以上"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">確認用</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                minLength={6}
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={{ outlineColor: themeColor }}
                placeholder="同じパスワードをもう一度"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition hover:brightness-110"
              style={{ backgroundColor: themeColor }}
            >
              {loading ? '設定中...' : 'パスワードを設定してログイン'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
