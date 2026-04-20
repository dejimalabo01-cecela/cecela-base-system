import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faUser } from '@fortawesome/free-solid-svg-icons';
import type { Member } from '../types';

interface Props {
  members: Member[];
  onAdd: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

export function MemberManagerModal({ members, onAdd, onDelete, onClose }: Props) {
  const [name, setName] = useState('');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await onAdd(trimmed);
    setName('');
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faUser} className="text-blue-500" />
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">担当者管理</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {members.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">担当者が登録されていません</p>
          ) : (
            members.map(m => (
              <div key={m.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-gray-700 dark:text-gray-200">{m.name}</span>
                <button
                  onClick={() => { if (confirm(`「${m.name}」を削除しますか？`)) onDelete(m.id); }}
                  className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-xs" />
                  削除
                </button>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="担当者名を入力"
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 transition"
            >
              追加
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
