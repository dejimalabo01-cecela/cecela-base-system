import { useMemo, useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDownload,
  faCopy,
  faTrash,
  faPen,
  faCheck,
  faXmark,
  faClock,
  faGripVertical,
  faEye,
  faEyeSlash,
  faTags,
} from '@fortawesome/free-solid-svg-icons';
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
import type { Property, Task, Member } from '../types';
import type { Role } from '../hooks/useRole';
import { exportPropertyToCSV } from '../utils/exportUtils';
import {
  parseDate,
  formatDisplayDate,
  getSlotDates,
  isTaskInSlot,
  getMonthRange,
  addMonths,
} from '../utils/dateUtils';

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const WEEK_LABELS = ['1週', '2週', '3週', '4週'];
const CELL_W = 36;

type UpdateIdResult = { ok: true } | { ok: false; reason: 'invalid' | 'duplicate' | 'notfound' | 'db' };

interface Props {
  property: Property;
  members: Member[];
  role: Role;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onUpdateAssignee: (assigneeId: string | null) => void;
  onUpdatePropertyName: (name: string) => void;
  onUpdatePropertyId: (newId: string) => Promise<UpdateIdResult>;
  onDelete: () => void;
  onCopy: () => void;
  onReorderTasks: (orderedTaskIds: string[]) => void;
  onSetTaskHidden: (taskId: string, hidden: boolean) => void;
  onShowAllTasks: () => void;
}

// 販売管理で管理する工程かどうか（名前に「販売」を含む工程は読み取り専用）
function isSalesManagedTask(task: Task): boolean {
  return task.name.includes('販売');
}

// 編集者ラベル + 日時を「田中太郎  2025/04/15 14:30」形式に整形。
// 物件ヘッダーの最終編集表示と、タスク行の hover tooltip 双方で使う。
function formatEditInfo(updatedBy: string | null, updatedAt: string | null): string | null {
  if (!updatedBy || !updatedAt) return null;
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return null;
  const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${updatedBy}  ${dateStr}`;
}

interface TaskLabelRowProps {
  task: Task;
  canEdit: boolean;
  isSaving: boolean;
  startVal: string;
  endVal: string;
  onChangeDate: (field: 'startDate' | 'endDate', value: string) => void;
  onBlurDate: (field: 'startDate' | 'endDate') => void;
  onToggleHidden: () => void;
}

function SortableTaskLabelRow({
  task, canEdit, isSaving, startVal, endVal, onChangeDate, onBlurDate, onToggleHidden,
}: TaskLabelRowProps) {
  const salesManaged = isSalesManagedTask(task);
  const dateInputDisabled = !canEdit || task.hidden || salesManaged;
  // タスク単位の最終編集ラベル（hover tooltip 用）。未編集なら null。
  const taskEditInfo = formatEditInfo(task.updatedBy, task.updatedAt);
  const baseTitle = salesManaged ? `${task.name}（販売管理で編集）` : task.name;
  const taskTitle = taskEditInfo ? `${baseTitle}\n最終更新: ${taskEditInfo}` : baseTitle;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !canEdit || task.hidden,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : task.hidden ? 0.45 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center border-b border-gray-100 dark:border-gray-700 h-11 bg-white dark:bg-gray-800"
    >
      <div
        className="w-32 md:w-44 px-2 md:px-3 py-2 text-[11px] md:text-xs font-medium text-gray-700 dark:text-gray-200 border-r border-gray-200 dark:border-gray-700 flex items-center gap-1"
        title={taskTitle}
        style={{ borderLeft: `3px solid ${task.color}` }}
      >
        {canEdit && !task.hidden && (
          <button
            {...attributes}
            {...listeners}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-grab active:cursor-grabbing shrink-0"
            title="ドラッグで並び替え"
            aria-label="ドラッグで並び替え"
          >
            <FontAwesomeIcon icon={faGripVertical} className="text-[10px]" />
          </button>
        )}
        {canEdit && (
          <button
            onClick={onToggleHidden}
            className={`shrink-0 ${task.hidden ? 'text-gray-400 hover:text-blue-500' : 'text-gray-300 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-300'}`}
            title={task.hidden ? 'この工程を再表示' : 'この工程を非表示にする'}
            aria-label={task.hidden ? 'この工程を再表示' : 'この工程を非表示にする'}
          >
            <FontAwesomeIcon icon={task.hidden ? faEyeSlash : faEye} className="text-[10px]" />
          </button>
        )}
        <span className="truncate flex-1">{task.name}</span>
        {salesManaged && (
          <FontAwesomeIcon
            icon={faTags}
            className="text-[10px] text-blue-500 shrink-0"
            title="この工程は「販売管理」で編集します"
          />
        )}
        {isSaving && (
          <span className="text-[10px] text-blue-400 shrink-0">保存中…</span>
        )}
      </div>
      <div className="w-24 md:w-32 px-1.5 md:px-2 border-r border-gray-200 dark:border-gray-700">
        <input
          type="date"
          value={startVal}
          disabled={dateInputDisabled}
          onChange={e => !salesManaged && onChangeDate('startDate', e.target.value)}
          onBlur={() => !salesManaged && onBlurDate('startDate')}
          title={salesManaged ? '販売管理で編集してください' : undefined}
          className={`w-full text-[10px] md:text-xs border border-gray-200 dark:border-gray-600 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-60 disabled:cursor-default ${
            salesManaged ? 'bg-blue-50 dark:bg-blue-900/20' : ''
          }`}
        />
      </div>
      <div className="w-24 md:w-32 px-1.5 md:px-2 border-r border-gray-200 dark:border-gray-700">
        <input
          type="date"
          value={endVal}
          min={startVal || undefined}
          disabled={dateInputDisabled}
          onChange={e => !salesManaged && onChangeDate('endDate', e.target.value)}
          onBlur={() => !salesManaged && onBlurDate('endDate')}
          title={salesManaged ? '販売管理で編集してください' : undefined}
          className={`w-full text-[10px] md:text-xs border border-gray-200 dark:border-gray-600 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-60 disabled:cursor-default ${
            salesManaged ? 'bg-blue-50 dark:bg-blue-900/20' : ''
          }`}
        />
      </div>
    </div>
  );
}

export function GanttChart({
  property, members, role,
  onUpdateTask, onUpdateAssignee, onUpdatePropertyName, onUpdatePropertyId,
  onDelete, onCopy, onReorderTasks, onSetTaskHidden, onShowAllTasks,
}: Props) {
  const today = useMemo(() => new Date(), []);
  // 自分が見ている物件の編集（日付・名前・並び替え等）は viewer 以外なら可能。
  // assignee も含む（彼らが見えている物件は自分の担当物件だけなので問題ない）。
  const canEdit = role !== 'viewer';
  // 物件の複製・担当者の付け替え・削除など「管理操作」は admin / editor のみ。
  const canManage = role === 'admin' || role === 'editor';
  const isAdmin = role === 'admin';

  // 物件ID編集（adminのみ）
  const [editingId, setEditingId] = useState(false);
  const [idInput, setIdInput] = useState(property.id);
  const idInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setIdInput(property.id); setEditingId(false); }, [property.id]);
  useEffect(() => { if (editingId) idInputRef.current?.focus(); }, [editingId]);

  async function commitIdEdit() {
    const trimmed = idInput.trim();
    if (!trimmed || trimmed === property.id) {
      setIdInput(property.id);
      setEditingId(false);
      return;
    }
    const result = await onUpdatePropertyId(trimmed);
    if (!result.ok) {
      const messages: Record<typeof result.reason, string> = {
        invalid:   '使用できない文字が含まれています。英数字 / . / - / _ のみ使えます。',
        duplicate: `物件ID「${trimmed}」は既に他の物件で使われています。`,
        notfound:  '対象の物件が見つかりません。',
        db:        '保存に失敗しました。マイグレーション (schema_update_v5.sql) が実行済みかご確認ください。',
      };
      alert(messages[result.reason]);
      setIdInput(property.id);
      setEditingId(false);
      return;
    }
    setEditingId(false);
  }
  function cancelIdEdit() {
    setIdInput(property.id);
    setEditingId(false);
  }

  const [showHidden, setShowHidden] = useState(false);
  const hiddenCount = property.tasks.filter(t => t.hidden).length;
  const visibleTasks = showHidden ? property.tasks : property.tasks.filter(t => !t.hidden);

  useEffect(() => { setShowHidden(false); }, [property.id]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = property.tasks.map(t => t.id);
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    onReorderTasks(arrayMove(ids, oldIdx, newIdx));
  }

  // 日付編集のローカルバッファ。onChange でこっちを更新、onBlur で DB 保存。
  // setProperties 経由のグローバル再描画を毎キーストロークで起こさないので軽い。
  const [localDates, setLocalDates] = useState<Record<string, { startDate: string; endDate: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Inline property name editing
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(property.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalDates({}); }, [property.id]);
  useEffect(() => { setNameInput(property.name); }, [property.name]);
  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  function getLocalDate(taskId: string, field: 'startDate' | 'endDate', fallback: string | null): string {
    return localDates[taskId]?.[field] ?? fallback ?? '';
  }

  function handleDateChange(taskId: string, field: 'startDate' | 'endDate', value: string) {
    setLocalDates(prev => {
      const cur = prev[taskId] ?? {
        startDate: property.tasks.find(t => t.id === taskId)?.startDate ?? '',
        endDate:   property.tasks.find(t => t.id === taskId)?.endDate ?? '',
      };
      return { ...prev, [taskId]: { ...cur, [field]: value } };
    });
  }

  async function handleDateBlur(taskId: string, field: 'startDate' | 'endDate') {
    const local = localDates[taskId];
    if (!local) return;
    const task = property.tasks.find(t => t.id === taskId);
    if (!task) return;
    const newValue = (local[field] || null) as string | null;
    if (newValue === task[field]) return;
    setSaving(taskId);
    try {
      await onUpdateTask(taskId, { [field]: newValue });
    } finally {
      setSaving(null);
    }
    // 保存完了後、ローカルバッファから当該フィールドを除去（次回 task から読む）
    setLocalDates(prev => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }

  function commitNameEdit() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== property.name) {
      onUpdatePropertyName(trimmed);
    } else {
      setNameInput(property.name);
    }
    setEditingName(false);
  }

  function cancelNameEdit() {
    setNameInput(property.name);
    setEditingName(false);
  }

  const months = useMemo(() => {
    const allDates: Date[] = [];
    for (const t of visibleTasks) {
      const s = parseDate(t.startDate);
      const e = parseDate(t.endDate);
      if (s) allDates.push(s);
      if (e) allDates.push(e);
    }
    // 販売管理由来の日付もタイムラインに含める
    const sale = parseDate(property.saleStartDate ?? null);
    const contract = parseDate(property.contractDate ?? null);
    const settle = parseDate(property.settlementDate ?? null);
    if (sale) allDates.push(sale);
    if (contract) allDates.push(contract);
    if (settle) allDates.push(settle);
    let from: Date;
    let to: Date;
    if (allDates.length === 0) {
      from = addMonths(today, -1);
      to = addMonths(today, 17);
    } else {
      const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
      from = addMonths(minDate, -1);
      to = addMonths(maxDate, 2);
      if (getMonthRange(from, to).length < 12) {
        to = addMonths(from, 11);
      }
    }
    return getMonthRange(from, to);
  }, [visibleTasks, today, property.saleStartDate, property.contractDate, property.settlementDate]);

  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  function getTodaySlot(): { monthIdx: number; slot: number } | null {
    const idx = months.findIndex(m => m.year === todayYear && m.month === todayMonth);
    if (idx === -1) return null;
    const slot = todayDate < 8 ? 0 : todayDate < 15 ? 1 : todayDate < 22 ? 2 : 3;
    return { monthIdx: idx, slot };
  }
  const todaySlot = getTodaySlot();

  function isTodayCell(monthIdx: number, slot: number): boolean {
    return todaySlot?.monthIdx === monthIdx && todaySlot?.slot === slot;
  }

  function handleDelete() {
    if (confirm(`「${property.name}」を削除しますか？\nこの操作は取り消せません。`)) {
      onDelete();
    }
  }

  const lastEdit = formatEditInfo(property.updatedBy, property.updatedAt);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Property header */}
      <div className="px-4 md:px-6 py-3 md:py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 md:gap-3 mb-1">
              {/* Inline property ID editing (admin only) */}
              {editingId ? (
                <input
                  ref={idInputRef}
                  type="text"
                  value={idInput}
                  onChange={e => setIdInput(e.target.value)}
                  onBlur={commitIdEdit}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitIdEdit();
                    if (e.key === 'Escape') cancelIdEdit();
                  }}
                  className="text-[10px] md:text-xs font-mono bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-blue-400 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 font-bold shrink-0 w-24"
                  placeholder="例: 003.1"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => isAdmin && setEditingId(true)}
                  disabled={!isAdmin}
                  className={`text-[10px] md:text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 md:px-2 py-0.5 md:py-1 rounded font-bold shrink-0 ${
                    isAdmin
                      ? 'hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-800 dark:hover:text-gray-100 cursor-pointer transition'
                      : 'cursor-default'
                  }`}
                  title={isAdmin ? 'クリックで物件IDを編集' : undefined}
                >
                  {property.id}
                </button>
              )}

              {/* Inline property name editing */}
              {editingName ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onBlur={commitNameEdit}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitNameEdit();
                      if (e.key === 'Escape') cancelNameEdit();
                    }}
                    className="flex-1 text-base md:text-xl font-bold bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-blue-400 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-0"
                  />
                  <button
                    onMouseDown={e => { e.preventDefault(); commitNameEdit(); }}
                    className="text-green-500 hover:text-green-600 transition"
                    title="保存"
                  >
                    <FontAwesomeIcon icon={faCheck} />
                  </button>
                  <button
                    onMouseDown={e => { e.preventDefault(); cancelNameEdit(); }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                    title="キャンセル"
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-base md:text-xl font-bold text-gray-800 dark:text-gray-100 truncate">
                    {property.name}
                  </h1>
                  {canEdit && (
                    <button
                      onClick={() => setEditingName(true)}
                      className="text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition shrink-0"
                      title="物件名を編集"
                    >
                      <FontAwesomeIcon icon={faPen} className="text-sm" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 md:gap-4 flex-wrap">
              <span className="text-[10px] md:text-xs text-gray-400 dark:text-gray-500">
                登録日: {new Date(property.createdAt).toLocaleDateString('ja-JP')}
              </span>
              {lastEdit && (
                <span className="hidden sm:flex text-xs text-gray-400 dark:text-gray-500 items-center gap-1">
                  <FontAwesomeIcon icon={faClock} className="text-[10px]" />
                  最終更新: {lastEdit}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">担当者:</span>
                <select
                  value={property.assigneeId ?? ''}
                  onChange={e => onUpdateAssignee(e.target.value || null)}
                  disabled={!canManage}
                  className="text-[11px] md:text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-60 disabled:cursor-default max-w-[140px]"
                  title={!canManage ? '担当者の付け替えは管理者・編集者のみ可能です' : undefined}
                >
                  <option value="">未設定</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 販売管理から取得する情報（読み取り専用） */}
            <div className="flex items-center gap-2 md:gap-3 flex-wrap mt-1.5 text-[11px] text-gray-600 dark:text-gray-300 bg-blue-50/40 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-800/40 rounded px-2.5 py-1">
              <FontAwesomeIcon icon={faTags} className="text-blue-500 text-[10px] shrink-0" />
              <span className="text-[10px] text-gray-500 dark:text-gray-400">販売管理:</span>
              <span>
                <span className="text-[10px] text-gray-500">販売開始日</span>
                <span className="ml-1 font-mono">{property.saleStartDate ?? '―'}</span>
              </span>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span>
                <span className="text-[10px] text-gray-500">販売価格</span>
                <span className={`ml-1 font-mono ${property.pricePending ? 'text-yellow-700 dark:text-yellow-300' : ''}`}>
                  {property.salePrice != null ? property.salePrice.toLocaleString('ja-JP') : '―'}
                  {property.pricePending && <span className="ml-0.5 text-[9px]">（未確定）</span>}
                </span>
              </span>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span>
                <span className="text-[10px] text-gray-500">ステータス</span>
                <span className="ml-1">{property.status ?? '―'}</span>
              </span>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span>
                <span className="text-[10px] text-gray-500">契約日</span>
                <span className="ml-1 font-mono">{property.contractDate ?? '―'}</span>
              </span>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span>
                <span className="text-[10px] text-gray-500">決済日</span>
                <span className="ml-1 font-mono">{property.settlementDate ?? '―'}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 shrink-0 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            {hiddenCount > 0 && (
              <button
                onClick={() => setShowHidden(v => !v)}
                className={`flex items-center gap-1.5 text-xs rounded-lg px-2.5 md:px-3 py-1.5 transition border shrink-0 ${
                  showHidden
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
                title={showHidden ? '非表示項目を隠す' : '非表示項目を表示'}
              >
                <FontAwesomeIcon icon={showHidden ? faEye : faEyeSlash} />
                <span className="hidden sm:inline">
                  {showHidden ? `非表示 ${hiddenCount} 件を隠す` : `非表示 ${hiddenCount} 件を表示`}
                </span>
                <span className="sm:hidden">{hiddenCount}</span>
              </button>
            )}
            {canEdit && hiddenCount > 0 && showHidden && (
              <button
                onClick={() => {
                  if (confirm(`非表示の ${hiddenCount} 件をすべて表示に戻しますか？`)) onShowAllTasks();
                }}
                className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-800 border border-green-300 dark:border-green-800 hover:border-green-500 rounded-lg px-2.5 md:px-3 py-1.5 transition shrink-0"
                title="非表示の工程をすべて再表示にする"
              >
                <FontAwesomeIcon icon={faEye} />
                <span className="hidden sm:inline">すべて再表示</span>
              </button>
            )}
            <button
              onClick={() => exportPropertyToCSV({ ...property, tasks: property.tasks.filter(t => !t.hidden) }, members)}
              className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-400 rounded-lg px-2.5 md:px-3 py-1.5 transition shrink-0"
              title="CSV出力"
            >
              <FontAwesomeIcon icon={faDownload} />
              <span>CSV</span>
            </button>
            {canManage && (
              <button
                onClick={onCopy}
                className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-400 rounded-lg px-2.5 md:px-3 py-1.5 transition shrink-0"
                title="物件をコピー"
              >
                <FontAwesomeIcon icon={faCopy} />
                <span>コピー</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 dark:border-red-800 hover:border-red-400 rounded-lg px-2.5 md:px-3 py-1.5 transition shrink-0"
                title="物件を削除"
              >
                <FontAwesomeIcon icon={faTrash} />
                <span>削除</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Gantt table */}
      <div className="flex-1 overflow-auto">
        <div className="inline-flex min-w-full">
          {/* Left: task info (sticky horizontally) */}
          <div className="sticky left-0 z-20 bg-white dark:bg-gray-800 shrink-0 shadow-[2px_0_6px_rgba(0,0,0,0.08)]">
            {/* Header rows (also sticky to top) */}
            <div className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-900">
              <div className="flex">
                <div className="w-32 md:w-44 border-b border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-2 md:px-3 py-2 text-[11px] md:text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-end">
                  工程
                </div>
                <div className="w-24 md:w-32 border-b border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-1.5 md:px-2 py-2 text-[11px] md:text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-end">
                  開始日
                </div>
                <div className="w-24 md:w-32 border-b border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-1.5 md:px-2 py-2 text-[11px] md:text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-end">
                  終了日
                </div>
              </div>
              <div className="h-7 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900" />
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={visibleTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                {visibleTasks.map(task => {
                  // 販売タスクの開始日は販売管理で管理。空ならフォールバックとして property.saleStartDate を表示
                  const salesManaged = isSalesManagedTask(task);
                  const startVal = salesManaged
                    ? (property.saleStartDate ?? task.startDate ?? '')
                    : getLocalDate(task.id, 'startDate', task.startDate);
                  const endVal = salesManaged
                    ? (task.endDate ?? '')
                    : getLocalDate(task.id, 'endDate', task.endDate);
                  return (
                    <SortableTaskLabelRow
                      key={task.id}
                      task={task}
                      canEdit={canEdit}
                      isSaving={saving === task.id}
                      startVal={startVal}
                      endVal={endVal}
                      onChangeDate={(field, value) => handleDateChange(task.id, field, value)}
                      onBlurDate={field => handleDateBlur(task.id, field)}
                      onToggleHidden={() => onSetTaskHidden(task.id, !task.hidden)}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>

          {/* Right: timeline grid */}
          <div className="shrink-0">
            {/* Header rows (sticky to top) */}
            <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
              <div className="flex bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                {months.map(({ year, month }, mi) => (
                  <div
                    key={`${year}-${month}`}
                    style={{ width: CELL_W * 4 }}
                    className={`text-center text-xs font-semibold py-1 border-r border-gray-200 dark:border-gray-700 ${
                      year === todayYear && month === todayMonth
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {year !== months[mi - 1]?.year && (
                      <span className="text-gray-400 dark:text-gray-600 mr-0.5">{year}/</span>
                    )}
                    {MONTH_NAMES[month]}
                  </div>
                ))}
              </div>

              <div className="flex bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 h-7">
                {months.map(({ year, month }) =>
                  WEEK_LABELS.map((label, wi) => (
                    <div
                      key={`${year}-${month}-${wi}`}
                      style={{ width: CELL_W }}
                      className={`text-center text-[10px] text-gray-400 dark:text-gray-600 border-r border-gray-100 dark:border-gray-700 flex items-center justify-center ${
                        isTodayCell(months.findIndex(m => m.year === year && m.month === month), wi)
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-500 font-semibold'
                          : ''
                      }`}
                    >
                      {label}
                    </div>
                  ))
                )}
              </div>
            </div>

            {visibleTasks.map(task => {
              // 販売タスクは販売管理の saleStartDate を優先表示
              const salesManaged = isSalesManagedTask(task);
              const taskStart = parseDate(salesManaged ? (property.saleStartDate ?? task.startDate) : task.startDate);
              const taskEnd = parseDate(salesManaged ? (property.saleStartDate ?? task.endDate) : task.endDate);
              const rowOpacity = task.hidden ? 0.45 : 1;
              return (
                <div
                  key={task.id}
                  className="flex border-b border-gray-100 dark:border-gray-700 h-11 items-center"
                  style={{ opacity: rowOpacity }}
                >
                  {months.map(({ year, month }, mi) =>
                    [0, 1, 2, 3].map(slot => {
                      const [slotStart, slotEnd] = getSlotDates(year, month, slot);
                      const filled = isTaskInSlot(taskStart, taskEnd, slotStart, slotEnd);
                      const isToday = isTodayCell(mi, slot);
                      return (
                        <div
                          key={`${year}-${month}-${slot}`}
                          style={{
                            width: CELL_W,
                            backgroundColor: filled ? task.color : isToday ? '#EFF6FF' : undefined,
                            opacity: filled ? 0.85 : 1,
                          }}
                          className={`h-6 mx-px rounded-sm border-r border-gray-100 dark:border-gray-700 ${
                            !filled && isToday ? 'border-blue-200 dark:!bg-blue-900/30' : ''
                          }`}
                          title={
                            filled
                              ? `${task.name}: ${formatDisplayDate(task.startDate)} 〜 ${formatDisplayDate(task.endDate)}`
                              : undefined
                          }
                        />
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 md:px-6 py-2 md:py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2 md:gap-3 shrink-0 overflow-x-auto">
        {visibleTasks.map(t => (
          <div key={t.id} className="flex items-center gap-1.5" style={{ opacity: t.hidden ? 0.5 : 1 }}>
            <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: t.color }} />
            <span className="text-xs text-gray-500 dark:text-gray-400">{t.name}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-4">
          <div className="w-4 h-3 rounded-sm bg-blue-100 border border-blue-200" />
          <span className="text-xs text-gray-500 dark:text-gray-400">今日</span>
        </div>
      </div>
    </div>
  );
}
