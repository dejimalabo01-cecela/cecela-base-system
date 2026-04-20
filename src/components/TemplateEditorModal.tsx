import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faChevronUp, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import type { TaskTemplate } from '../types';
import { COLORS } from '../constants';

interface Props {
  templates: TaskTemplate[];
  onAdd: (name: string, color: string) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Pick<TaskTemplate, 'name' | 'color'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMove: (id: string, direction: 'up' | 'down') => Promise<void>;
  onClose: () => void;
}

export function TemplateEditorModal({ templates, onAdd, onUpdate, onDelete, onMove, onClose }: Props) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[4]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    await onAdd(trimmed, newColor);
    setNewName('');
  }

  function startEdit(t: TaskTemplate) {
    setEditingId(t.id);
    setEditName(t.name);
  }

  async function commitEdit(t: TaskTemplate) {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== t.name) {
      await onUpdate(t.id, { name: trimmed });
    }
    setEditingId(null);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">工程テンプレート編集</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {templates.map((t, idx) => (
            <div key={t.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2">
              {/* Color picker */}
              <div className="relative group">
                <div
                  className="w-5 h-5 rounded-full cursor-pointer ring-1 ring-gray-300 dark:ring-gray-600 shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                <div className="absolute left-0 top-7 hidden group-hover:flex flex-wrap gap-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-2 shadow-lg z-10 w-40">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      className={`w-5 h-5 rounded-full ring-1 ${t.color === c ? 'ring-blue-500 ring-2' : 'ring-gray-200 dark:ring-gray-600'}`}
                      style={{ backgroundColor: c }}
                      onClick={() => onUpdate(t.id, { color: c })}
                    />
                  ))}
                </div>
              </div>

              {/* Name */}
              {editingId === t.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => commitEdit(t)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitEdit(t);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="flex-1 text-sm border border-blue-400 rounded px-2 py-0.5 focus:outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                />
              ) : (
                <span
                  className="flex-1 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                  onDoubleClick={() => startEdit(t)}
                  title="ダブルクリックで編集"
                >
                  {t.name}
                </span>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onMove(t.id, 'up')}
                  disabled={idx === 0}
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 px-1"
                  title="上に移動"
                >
                  <FontAwesomeIcon icon={faChevronUp} className="text-xs" />
                </button>
                <button
                  onClick={() => onMove(t.id, 'down')}
                  disabled={idx === templates.length - 1}
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 px-1"
                  title="下に移動"
                >
                  <FontAwesomeIcon icon={faChevronDown} className="text-xs" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`「${t.name}」を削除しますか？\n（既存物件の工程には影響しません）`))
                      onDelete(t.id);
                  }}
                  className="text-red-400 hover:text-red-600 px-1 ml-1"
                  title="削除"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-xs" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add new */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">新しい工程を追加</p>
          <form onSubmit={handleAdd} className="flex gap-2">
            <div className="relative group">
              <div
                className="w-8 h-8 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600 shrink-0"
                style={{ backgroundColor: newColor }}
              />
              <div className="absolute left-0 bottom-10 hidden group-hover:flex flex-wrap gap-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-2 shadow-lg z-10 w-40">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`w-5 h-5 rounded-full ring-1 ${newColor === c ? 'ring-blue-500 ring-2' : 'ring-gray-200 dark:ring-gray-600'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewColor(c)}
                  />
                ))}
              </div>
            </div>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="工程名を入力"
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <button
              type="submit"
              disabled={!newName.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 transition"
            >
              追加
            </button>
          </form>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            色のマークをホバーするとカラー選択できます。工程名はダブルクリックで編集。
          </p>
        </div>
      </div>
    </div>
  );
}
