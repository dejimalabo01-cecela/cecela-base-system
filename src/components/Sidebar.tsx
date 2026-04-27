import { useMemo } from 'react';
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
  faBuilding,
  faBullhorn,
  faHandshake,
  faNewspaper,
  faChartLine,
  faComments,
  faFileLines,
  faChartBar,
  faEnvelope,
  faXmark,
  faMoneyBillTrendUp,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { ModuleId, Property } from '../types';
import type { Role } from '../hooks/useRole';

const RECENT_LIMIT = 5;

function lastEditedTime(p: Property): number {
  const times: (string | null)[] = [p.updatedAt, p.createdAt];
  for (const t of p.tasks) times.push(t.updatedAt);
  const ms = times
    .filter((t): t is string => !!t)
    .map(t => new Date(t).getTime())
    .filter(n => !Number.isNaN(n));
  return ms.length > 0 ? Math.max(...ms) : 0;
}

type SubMenuItem = { id: string; label: string; icon: IconDefinition };

const MODULES: {
  id: ModuleId;
  label: string;
  icon: IconDefinition;
  subMenu?: SubMenuItem[];
}[] = [
  {
    id: 'construction',
    label: '工程管理',
    icon: faBuilding,
  },
  {
    id: 'sales-plan',
    label: '販売計画',
    icon: faMoneyBillTrendUp,
  },
  {
    id: 'marketing',
    label: 'マーケ',
    icon: faBullhorn,
    subMenu: [
      { id: 'responses',   label: '反響管理',        icon: faEnvelope  },
      { id: 'advertising', label: '広告・媒体管理',   icon: faNewspaper },
      { id: 'inquiries',   label: 'お問い合わせ',     icon: faComments  },
      { id: 'mkt-report',  label: '集客レポート',     icon: faChartLine },
    ],
  },
  {
    id: 'sales',
    label: '営業',
    icon: faHandshake,
    subMenu: [
      { id: 'customers',    label: '顧客管理',     icon: faUsers    },
      { id: 'deals',        label: '商談管理',     icon: faHandshake},
      { id: 'contracts',    label: '契約管理',     icon: faFileLines},
      { id: 'sales-report', label: '売上レポート', icon: faChartBar },
    ],
  },
];

interface Props {
  activeModule: ModuleId;
  onChangeModule: (id: ModuleId) => void;
  properties: Property[];
  selectedId: string | null;
  showList: boolean;
  onShowList: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  userEmail: string;
  onSignOut: () => void;
  onChangePassword: () => void;
  onEditTemplates: () => void;
  onManageMembers: () => void;
  onManageUsers: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  role: Role;
  onCloseMobile?: () => void;
}

export function Sidebar({
  activeModule, onChangeModule,
  properties, selectedId, showList, onShowList, onSelect, onNew,
  onSignOut, onChangePassword,
  onEditTemplates, onManageMembers, onManageUsers,
  isDark, onToggleTheme, role,
  onCloseMobile,
}: Props) {
  const canEdit = role === 'admin' || role === 'editor';
  const isAdmin = role === 'admin';
  const activeModuleDef = MODULES.find(m => m.id === activeModule)!;

  // properties が変わらなければ毎回ソートし直さない（タスク日付保存などで
  // App が再描画される度に走るのを防ぐ）。
  const recentProperties = useMemo(
    () => [...properties].sort((a, b) => lastEditedTime(b) - lastEditedTime(a)).slice(0, RECENT_LIMIT),
    [properties],
  );

  return (
    <aside className="relative h-full bg-gray-900 text-white flex" style={{ width: '268px' }}>

      {/* モバイル用：閉じるボタン */}
      {onCloseMobile && (
        <button
          onClick={onCloseMobile}
          className="md:hidden absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 rounded transition"
          aria-label="メニューを閉じる"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      )}

      {/* ═══════════════════════════════
          左パネル：モジュールリスト
      ═══════════════════════════════ */}
      <div className="flex flex-col border-r border-gray-700 shrink-0" style={{ width: '108px' }}>

        {/* ロゴ＋テーマ切替 */}
        <div className="px-3 py-4 border-b border-gray-700 flex items-center justify-between">
          <span className="text-xs font-black text-blue-400 tracking-tight">Cecela</span>
          <button
            onClick={onToggleTheme}
            title={isDark ? 'ライトモード' : 'ダークモード'}
            className="text-gray-500 hover:text-gray-200 transition"
          >
            <FontAwesomeIcon icon={isDark ? faSun : faMoon} className="text-xs" />
          </button>
        </div>

        {/* モジュールリスト */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {MODULES.map(m => {
            const isActive = activeModule === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onChangeModule(m.id)}
                className={`w-full flex items-center gap-1.5 px-3 py-2.5 text-left transition ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                {/* アクティブ矢印 */}
                <span className="text-blue-400 text-[10px] w-2 shrink-0">
                  {isActive ? '▶' : ''}
                </span>
                <span className="text-xs truncate">{m.label}</span>
              </button>
            );
          })}
        </nav>

        {/* 設定・ユーザー */}
        <div className="border-t border-gray-700 px-2 py-2 space-y-0.5">
          <div className="text-[9px] text-gray-600 uppercase tracking-wider px-2 pb-1">設定</div>
          {isAdmin && (
            <button
              onClick={onManageUsers}
              className="w-full text-left text-[11px] text-gray-500 hover:text-white px-2 py-1.5 rounded hover:bg-gray-800 transition flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faUsers} className="w-3 opacity-60" />
              ユーザー管理
            </button>
          )}
          <button
            onClick={onChangePassword}
            className="w-full text-left text-[11px] text-gray-500 hover:text-white px-2 py-1.5 rounded hover:bg-gray-800 transition flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faKey} className="w-3 opacity-60" />
            PW変更
          </button>
          <button
            onClick={onSignOut}
            className="w-full text-left text-[11px] text-gray-500 hover:text-red-400 px-2 py-1.5 rounded hover:bg-gray-800 transition flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="w-3 opacity-60" />
            ログアウト
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════
          右パネル：サブメニュー
      ═══════════════════════════════ */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">

        {/* ── 工程管理 ── */}
        {activeModule === 'construction' && (
          <>
            <div className="px-3 py-3 border-b border-gray-700 space-y-2">
              <button
                onClick={onShowList}
                className={`w-full text-xs font-medium rounded-lg py-2 transition border flex items-center justify-center gap-1.5 ${
                  showList
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                }`}
              >
                <FontAwesomeIcon icon={faTableList} className="text-[10px]" />
                物件一覧
              </button>
              {canEdit && (
                <button
                  onClick={onNew}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg py-2 transition flex items-center justify-center gap-1.5"
                >
                  <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                  新規物件登録
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* 直近の編集物件 */}
              {recentProperties.length > 0 && (
                <div className="py-2 px-2 border-b border-gray-700">
                  <div className="text-[9px] text-gray-600 uppercase tracking-wider px-2 pb-1">
                    直近の編集物件
                  </div>
                  <div className="space-y-0.5">
                    {recentProperties.map(p => {
                      const isActive = !showList && selectedId === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => onSelect(p.id)}
                          className={`w-full text-left px-2 py-1.5 rounded transition ${
                            isActive
                              ? 'bg-gray-800 border-l-2 border-blue-500'
                              : 'border-l-2 border-transparent hover:bg-gray-800'
                          }`}
                          title={p.name}
                        >
                          <div className="text-[9px] text-gray-500 font-mono">{p.id}</div>
                          <div className="text-[11px] font-medium text-gray-200 truncate">{p.name}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 工程管理の設定メニュー */}
              <nav className="py-2 px-2 space-y-0.5">
                <div className="text-[9px] text-gray-600 uppercase tracking-wider px-2 pb-1">設定</div>
                {isAdmin && (
                  <button
                    onClick={onEditTemplates}
                    className="w-full text-left text-[11px] text-gray-400 hover:text-white px-2 py-1.5 rounded hover:bg-gray-800 transition flex items-center gap-2"
                  >
                    <FontAwesomeIcon icon={faPenRuler} className="w-3 opacity-60" />
                    テンプレート
                  </button>
                )}
                {(isAdmin || canEdit) && (
                  <button
                    onClick={onManageMembers}
                    className="w-full text-left text-[11px] text-gray-400 hover:text-white px-2 py-1.5 rounded hover:bg-gray-800 transition flex items-center gap-2"
                  >
                    <FontAwesomeIcon icon={faUser} className="w-3 opacity-60" />
                    担当者管理
                  </button>
                )}
              </nav>
            </div>
          </>
        )}

        {/* ── 他モジュール（準備中） ── */}
        {activeModule !== 'construction' && activeModuleDef.subMenu && (
          <nav className="flex-1 overflow-y-auto py-2">
            {activeModuleDef.subMenu.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-3 py-2.5 text-gray-600 cursor-not-allowed"
              >
                <FontAwesomeIcon icon={item.icon} className="text-[11px] w-3 shrink-0 opacity-40" />
                <span className="text-xs flex-1">{item.label}</span>
                <span className="text-[9px] bg-gray-800 text-gray-600 px-1 py-0.5 rounded">準備中</span>
              </div>
            ))}
          </nav>
        )}

      </div>
    </aside>
  );
}
