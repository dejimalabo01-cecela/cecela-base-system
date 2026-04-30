import { useState } from 'react';
import { getAppTitle, getThemeColor } from '../config/deployment';

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>;
}

export function LoginPage({ onSignIn }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // VITE_APP_TITLE / VITE_THEME_COLOR を反映してデプロイごとに見た目を変える
  const appTitle = getAppTitle();
  const themeColor = getThemeColor();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSignIn(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* デプロイ別テーマカラー帯（メイン画面と統一） */}
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
          </div>

          <form onSubmit={handleSubmit} className="bg-gray-800 rounded-2xl p-8 space-y-5 shadow-2xl">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 placeholder-gray-500"
                style={{ outlineColor: themeColor }}
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={{ outlineColor: themeColor }}
                placeholder="••••••••"
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
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          <p className="text-center text-gray-600 text-xs mt-6">
            アカウントはシステム管理者が発行します
          </p>
        </div>
      </div>
    </div>
  );
}
