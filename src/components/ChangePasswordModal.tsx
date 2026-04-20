import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }
    if (password !== confirm) {
      setError('パスワードが一致しません');
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <h2 className="text-white text-lg font-bold mb-6">パスワード変更</h2>

        {success ? (
          <div className="text-center">
            <div className="text-green-400 text-sm bg-green-900/30 border border-green-700 rounded-lg px-4 py-3 mb-6">
              パスワードを変更しました
            </div>
            <button
              onClick={onClose}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg py-2.5 text-sm transition"
            >
              閉じる
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                新しいパスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="6文字以上"
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                新しいパスワード（確認）
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="もう一度入力"
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 rounded-lg py-2.5 transition"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition"
              >
                {loading ? '変更中...' : '変更する'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
