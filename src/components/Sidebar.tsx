import type { Property } from '../types';

interface Props {
  properties: Property[];
  selectedId: string | null;
  showList: boolean;
  onSelect: (id: string) => void;
  onShowList: () => void;
  onNew: () => void;
  userEmail: string;
  onSignOut: () => void;
  onChangePassword: () => void;
  onEditTemplates: () => void;
  onManageMembers: () => void;
}

export function Sidebar({
  properties, selectedId, showList, onSelect, onShowList, onNew,
  userEmail, onSignOut, onChangePassword,
  onEditTemplates, onManageMembers,
}: Props) {
  return (
    <aside className="w-64 min-w-[16rem] h-full bg-gray-900 text-white flex flex-col">
      <div className="px-4 py-5 border-b border-gray-700">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Cecela</div>
        <div className="text-base font-bold">物件管理システム</div>
      </div>

      <div className="px-4 py-3 border-b border-gray-700 space-y-2">
        <button
          onClick={onNew}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg py-2 transition"
        >
          ＋ 新規物件登録
        </button>
        <button
          onClick={onShowList}
          className={`w-full text-sm font-medium rounded-lg py-2 transition border ${
            showList
              ? 'bg-gray-700 border-gray-600 text-white'
              : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
          }`}
        >
          📋 物件一覧
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {properties.length === 0 ? (
          <p className="text-gray-500 text-xs px-4 py-3">物件が登録されていません</p>
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
              <div className="text-xs text-gray-400 font-mono">{p.id}</div>
              <div className="text-sm font-medium truncate mt-0.5">{p.name}</div>
            </button>
          ))
        )}
      </nav>

      {/* Settings */}
      <div className="px-4 py-3 border-t border-gray-700 space-y-1">
        <div className="text-xs text-gray-600 uppercase tracking-wider mb-2">設定</div>
        <button
          onClick={onEditTemplates}
          className="w-full text-left text-xs text-gray-400 hover:text-white px-2 py-1.5 rounded hover:bg-gray-800 transition"
        >
          工程テンプレート編集
        </button>
        <button
          onClick={onManageMembers}
          className="w-full text-left text-xs text-gray-400 hover:text-white px-2 py-1.5 rounded hover:bg-gray-800 transition"
        >
          担当者管理
        </button>
      </div>

      {/* User */}
      <div className="px-4 py-3 border-t border-gray-700 space-y-2">
        <div className="text-xs text-gray-500 truncate">{userEmail}</div>
        <button
          onClick={onChangePassword}
          className="w-full text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg py-1.5 transition"
        >
          パスワード変更
        </button>
        <button
          onClick={onSignOut}
          className="w-full text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg py-1.5 transition"
        >
          サインアウト
        </button>
      </div>
    </aside>
  );
}
