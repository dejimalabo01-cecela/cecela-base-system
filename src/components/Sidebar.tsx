import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faTableList,
  faMoon,
  faSun,
  faRightFromBracket,
  faKey,
  faPenRuler,
  faUsers,
  faUser,
  faGear,
  faBuilding,
  faBullhorn,
  faHandshake,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { Property, ModuleId } from '../types';
import type { Role } from '../hooks/useRole';

// モジュール定義（ここに追加していくだけで新メニューが増える）
const MODULES: { id: ModuleId; label: string; shortLabel: string; icon: IconDefinition; available: boolean }[] = [
  { id: 'construction', label: '工程管理',       shortLabel: '工程', icon: faBuilding,  available: true  },
  { id: 'marketing',   label: 'マーケティング',  shortLabel: 'MKT',  icon: faBullhorn,  available: false },
  { id: 'sales',       label: '営業管理',         shortLabel: '営業', icon: faHandshake, available: false },
];

interface Props {
  // モジュール
  activeModule: ModuleId;
  onChangeModule: (id: ModuleId) => void;
  // 物件（工程管理モジュール用）
  properties: Property[];
  selectedId: string | null;
  showList: boolean;
  onSelect: (id: string) => void;
  onShowList: () => void;
  onNew: () => void;
  // ユーザー・設定
  userEmail: string;
  onSignOut: () => void;
  onChangePassword: () => void;
  onEditTemplates: () => void;
  onManageMembers: () => void;
  onManageUsers: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  role: Role;
}

export function Sidebar({
  activeModule, onChangeModule,
  properties, selectedId, showList, onSelect, onShowList, onNew,
  userEmail, onSignOut, onChangePassword,
  onEditTemplates, onManageMembers, onManageUsers,
  isDark, onToggleTheme, role,
}: Props) {
  const canEdit = role === 'admin' || role === 'editor';
  const isAdmin = role === 'admin';

  return (
    <aside className="w-64 min-w-[16rem] h-full bg-gray-900 text-white flex flex-col">

      {/* ── ヘッダー ── */}
      <div className="px-4 py-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-0.5">Cecela</div>
            <div className="text-sm font-bold text-white">物件管理システム</div>
          </div>
          <button
            onClick={onToggleTheme}
            title={isDark ? 'ライトモードに切替' : 'ダークモードに切替'}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition"
          >
            <FontAwesomeIcon icon={isDark ? faSun : faMoon} />
          </button>
        </div>
      </div>

      {/* ── モジュールタブ（上段） ── */}
      <div className="px-3 py-3 border-b border-gray-700">
        <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2 px-1">モジュール</div>
        <div className="space-y-1">
          {MODULES.map(m => (
            <button
              key={m.id}
              onClick={() => m.available && onChangeModule(m.id)}
              title={m.available ? m.label : `${m.label}（準備中）`}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                m.available
                  ? activeModule === m.id
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  : 'text-gray-600 cursor-not-allowed'
              }`}
            >
              <FontAwesomeIcon icon={m.icon} className="w-4 shrink-0" />
              <span className="flex-1 text-left">{m.label}</span>
              {!m.available && (
                <span className="text-[9px] bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                  準備中
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── モジュール別サブメニュー（下段） ── */}
      <div className="flex-1 overflow-y-auto flex flex-col min-h-0">

        {/* 工程管理サブメニュー */}
        {activeModule === 'construction' && (
          <>
            <div className="px-3 py-3 border-b border-gray-700 space-y-2">
              {canEdit && (
                <button
                  onClick={onNew}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg py-2 transition flex items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  新規物件登録
                </button>
              )}
              <button
                onClick={onShowList}
                className={`w-full text-sm font-medium rounded-lg py-2 transition border flex items-center justify-center gap-2 ${
                  showList
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                }`}
              >
                <FontAwesomeIcon icon={faTableList} />
                物件一覧
              </button>
            </div>

            {/* 物件リスト */}
            <nav className="flex-1 overflow-y-auto py-2">
              {properties.length === 0 ? (
                <p className="text-gray-600 text-xs px-4 py-3">物件が登録されていません</p>
              ) : (
                properties.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSelect(p.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-800 transition ${
                      !showList && selectedId === p.id
                        ? 'bg-gray-800 border-l-4 border-blue-500'
                        : 'border-l-4 border-transparent'
                    }`}
                  >
                    <div className="text-xs text-gray-500 font-mono flex items-center gap-1">
                      <FontAwesomeIcon icon={faBuilding} className="text-[10px] opacity-50" />
                      {p.id}
                    </div>
                    <div className="text-sm font-medium truncate mt-0.5">{p.name}</div>
                  </button>
                ))
              )}
            </nav>
          </>
        )}

        {/* 他モジュール（準備中）はサブメニューなし */}
        {activeModule !== 'construction' && (
          <div className="flex-1 flex items-center justify-center px-4">
            <p className="text-xs text-gray-600 text-center">
              このモジュールは準備中です
            </p>
          </div>
        )}
      </div>

      {/* ── 設定（admin/editor） ── */}
      {(isAdmin || canEdit) && (
        <div className="px-4 py-3 border-t border-gray-700 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-600 uppercase tracking-wider mb-2">
            <FontAwesomeIcon icon={faGear} />
            設定
          </div>
          {isAdmin && (
            <>
              <button
                onClick={onEditTemplates}
                className="w-full text-left text-xs text-gray-400 hover:text-white px-2 py-1.5 rounded hover:bg-gray-800 transition flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faPenRuler} className="w-3" />
                工程テンプレート編集
              </button>
              <button
                onClick={onManageUsers}
                className="w-full text-left text-xs text-gray-400 hover:text-white px-2 py-1.5 rounded hover:bg-gray-800 transition flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faUsers} className="w-3" />
                ユーザー管理
              </button>
            </>
          )}
          <button
            onClick={onManageMembers}
            className="w-full text-left text-xs text-gray-400 hover:text-white px-2 py-1.5 rounded hover:bg-gray-800 transition flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faUser} className="w-3" />
            担当者管理
          </button>
        </div>
      )}

      {/* ── ユーザー ── */}
      <div className="px-4 py-3 border-t border-gray-700 space-y-2">
        <div className="text-xs text-gray-500 truncate">{userEmail}</div>
        <button
          onClick={onChangePassword}
          className="w-full text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg py-1.5 transition flex items-center justify-center gap-1.5"
        >
          <FontAwesomeIcon icon={faKey} className="text-[10px]" />
          パスワード変更
        </button>
        <button
          onClick={onSignOut}
          className="w-full text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg py-1.5 transition flex items-center justify-center gap-1.5"
        >
          <FontAwesomeIcon icon={faRightFromBracket} className="text-[10px]" />
          サインアウト
        </button>
      </div>
    </aside>
  );
}
