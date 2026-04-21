import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faGripVertical } from '@fortawesome/free-solid-svg-icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TaskTemplate } from '../types';
import { COLORS } from '../constants';

interface Props {
  templates: TaskTemplate[];
  onAdd: (name: string, color: string) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Pick<TaskTemplate, 'name' | 'color'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (orderedIds: string[]) => Promise<void>;
  onClose: () => void;
}

interface RowProps {
  t: TaskTemplate;
  editingId: string | null;
  editName: string;
  setEditName: (v: string) => void;
  startEdit: (t: TaskTemplate) => void;
  commitEdit: (t: TaskTemplate) => void;
  cancelEdit: () => void;
  onUpdate: Props['onUpdate'];
  onDelete: Props['onDelete'];
}

function SortableRow({
  t, editingId, editName, setEditName, startEdit, commitEdit, cancelEdit, onUpdate, onDelete,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-grab active:cursor-grabbing px-0.5 shrink-0"
        title="ドラッグで並び替え"
        aria-label="ドラッグで並び替え"
      >
        <FontAwesomeIcon icon={faGripVertical} className="text-xs" />
      </button>

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
            if (e.key === 'Escape') cancelEdit();
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

      {/* Delete */}
      <button
        onClick={() => {
          if (confirm(`「${t.name}」を削除しますか？\n（既存物件の工程には影響しません）`))
            onDelete(t.id);
        }}
        className="text-red-400 hover:text-red-600 px-1 shrink-0"
        title="削除"
      >
        <FontAwesomeIcon icon={faXmark} className="text-xs" />
      </button>
    </div>
  );
}

export function TemplateEditorModal({ templates, onAdd, onUpdate, onDelete, onReorder, onClose }: Props) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[4]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = templates.map(t => t.id);
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const newIds = arrayMove(ids, oldIdx, newIdx);
    onReorder(newIds);
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={templates.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {templates.map(t => (
                <SortableRow
                  key={t.id}
                  t={t}
                  editingId={editingId}
                  editName={editName}
                  setEditName={setEditName}
                  startEdit={startEdit}
                  commitEdit={commitEdit}
                  cancelEdit={() => setEditingId(null)}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </SortableContext>
          </DndContext>
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
            左端のハンドルをドラッグで並び替え。追加した工程は既存物件にも末尾に反映されます。
          </p>
        </div>
      </div>
    </div>
  );
}
