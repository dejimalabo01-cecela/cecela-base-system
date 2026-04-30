import type { ModuleId } from '../types';

/**
 * デプロイメント別の表示制御。
 *
 * 同じコードベースを複数の Vercel プロジェクトにデプロイし、それぞれを部署単位で
 * 違う見た目にしたいときに使う。Vercel ダッシュボードで環境変数を設定するだけで、
 * コードを変えずに表示モジュールを切替えられる。
 *
 * 例：
 *   販売管理部用の Vercel:
 *     VITE_ENABLED_MODULES = construction,sales-plan,sales-management
 *     VITE_APP_TITLE       = Cecela 販売管理
 *
 *   マーケ部用の Vercel:
 *     VITE_ENABLED_MODULES = marketing,construction
 *     VITE_APP_TITLE       = Cecela マーケティング
 *
 *   全部署用（社内ポータル）の Vercel:
 *     VITE_ENABLED_MODULES 未設定（＝全モジュール表示）
 */

const ALL_MODULES: ModuleId[] = ['construction', 'sales-plan', 'sales-management', 'marketing', 'sales'];

/** 各サイドバーで表示する基本順序。最初に該当した有効モジュールが初期表示になる。 */
const DEFAULT_PRIORITY: ModuleId[] = [
  'construction',
  'sales-plan',
  'sales-management',
  'marketing',
  'sales',
];

function parseModuleList(raw: string | undefined): ModuleId[] | null {
  if (!raw) return null;
  const tokens = raw.split(',').map(s => s.trim()).filter(Boolean);
  const valid: ModuleId[] = tokens.filter(
    (t): t is ModuleId => (ALL_MODULES as readonly string[]).includes(t)
  );
  return valid.length > 0 ? valid : null;
}

/** このデプロイメントで表示するモジュールの集合。未設定なら全部 true。 */
export function getEnabledModules(): Set<ModuleId> {
  const list = parseModuleList(import.meta.env.VITE_ENABLED_MODULES);
  return new Set(list ?? ALL_MODULES);
}

/** 初期表示モジュール（VITE_ENABLED_MODULES の先頭、または優先順序で最初に有効なもの）。 */
export function getInitialModule(): ModuleId {
  const list = parseModuleList(import.meta.env.VITE_ENABLED_MODULES);
  if (list && list.length > 0) return list[0];
  return DEFAULT_PRIORITY[0];
}

/** ブラウザタブ・ヘッダー等に表示するアプリ名。 */
export function getAppTitle(): string {
  const t = (import.meta.env.VITE_APP_TITLE ?? '').trim();
  return t || 'Cecela 物件管理システム';
}

/**
 * このデプロイメントのテーマカラー（HEX）。
 * トップの細い色帯と Cecela ロゴの色に反映され、どのシステムにログイン中か
 * 視覚的に区別できるようにする。
 *
 * 例：
 *   工程管理・販売計画用の Vercel: VITE_THEME_COLOR = #1F3A8A （ブルー：default）
 *   販売管理部用の Vercel:        VITE_THEME_COLOR = #B45309 （アンバー）
 *   マーケ用の Vercel:            VITE_THEME_COLOR = #047857 （グリーン）
 */
export function getThemeColor(): string {
  const c = (import.meta.env.VITE_THEME_COLOR ?? '').trim();
  // 簡易バリデーション（# + 3 or 6 hex桁）
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(c)) return c;
  return '#1F3A8A'; // default: blue-900
}

/**
 * このデプロイメントのテーマ識別ラベル（任意）。
 * ロゴ横にバッジ的に小さく表示する用途を想定。VITE_THEME_LABEL 未設定なら null。
 *
 * 例：
 *   販売管理部用の Vercel: VITE_THEME_LABEL = 販売
 */
export function getThemeLabel(): string | null {
  const t = (import.meta.env.VITE_THEME_LABEL ?? '').trim();
  return t || null;
}

/**
 * 招待時の「招待先システム」候補一覧。
 * 招待された人がメールリンクから飛んだあと、どの Vercel デプロイで初回ログイン
 * パスワード設定をするかを admin に選ばせる。新しい部署用デプロイを増やしたら
 * ここに追加する。
 *
 * URL は Supabase Auth の URL Configuration → Redirect URLs に必ず登録すること
 * （未登録 URL は Supabase が無視して Site URL にフォールバックする）。
 */
export interface InviteTarget {
  label: string;
  url: string;
}

export function getInviteTargets(): InviteTarget[] {
  return [
    { label: '工程管理・販売計画システム', url: 'https://cecela-base-system.vercel.app' },
    { label: '販売管理システム',           url: 'https://cecela-sales-mgmt.vercel.app' },
    { label: 'マーケティングシステム',     url: 'https://cecela-marketing.vercel.app' },
  ];
}
