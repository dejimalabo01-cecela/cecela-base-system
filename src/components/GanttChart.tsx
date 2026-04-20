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
} from '@fortawesome/free-solid-svg-icons';
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

interface Props {
  property: Property;
  members: Member[];
  role: Role;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onUpdateAssignee: (assigneeId: string | null) => void;
  onUpdatePropertyName: (name: string) => void;
  onDelete: () => void;
  onCopy: () => void;
}

type LocalDates = Record<string, { startDate: string; endDate: string }>;

export function GanttChart({
  property, members, role,
  onUpdateTask, onUpdateAssignee, onUpdatePropertyName,
  onDelete, onCopy,
}: Props) {
  const today = useMemo(() => new Date(), []);
  const canEdit = role === 'admin' || role === 'editor';
  const isAdmin = role === 'admin';

  // Local date state
  const [localDates, setLocalDates] = useState<LocalDates>({});
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
    setLocalDates(prev => ({
      ...prev,
      [taskId]: {
        startDate: prev[taskId]?.startDate ?? (property.tasks.find(t => t.id === taskId)?.startDate ?? ''),
        endDate: prev[taskId]?.endDate ?? (property.tasks.find(t => t.id === taskId)?.endDate ?? ''),
        [field]: value,
      },
    }));
  }

  async function handleDateBlur(taskId: string, field: 'startDate' | 'endDate') {
    const local = localDates[taskId];
    if (!local) return;
    const task = property.tasks.find(t => t.id === taskId);
    if (!task) return;
    const newValue = local[field] || null;
    const oldValue = task[field];
    if (newValue === oldValue) return;
    setSaving(taskId);
    await onUpdateTask(taskId, { [field]: newValue });
    setSaving(null);
    setLocalDates(prev => {
      const next = { ...prev };
      if (next[taskId]) {
        const updated = { ...next[taskId], [field]: newValue ?? '' };
        const t = property.tasks.find(t => t.id === taskId);
        if (updated.startDate === (t?.startDate ?? '') && updated.endDate === (t?.endDate ?? '')) {
          delete next[taskId];
        } else {
          next[taskId] = updated;
        }
      }
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
    for (const t of property.tasks) {
      const s = parseDate(t.startDate);
      const e = parseDate(t.endDate);
      if (s) allDates.push(s);
      if (e) allDates.push(e);
    }
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
  }, [property.tasks, today]);

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

  // Format edit history
  function formatEditInfo(updatedBy: string | null, updatedAt: string | null) {
    if (!updatedBy || !updatedAt) return null;
    const d = new Date(updatedAt);
    const dateStr = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    return `${updatedBy}  ${dateStr}`;
  }

  const lastEdit = formatEditInfo(property.updatedBy, property.updatedAt);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Property header */}
      <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded font-bold shrink-0">
                {property.id}
              </span>

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
                    className="flex-1 text-xl font-bold bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-blue-400 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-0"
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
                  <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 truncate">
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

            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                登録日: {new Date(property.createdAt).toLocaleDateString('ja-JP')}
              </span>
              {lastEdit && (
                <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  <FontAwesomeIcon icon={faClock} className="text-[10px]" />
                  最終更新: {lastEdit}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">担当者:</span>
                <select
                  value={property.assigneeId ?? ''}
                  onChange={e => onUpdateAssignee(e.target.value || null)}
                  disabled={!canEdit}
                  className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-60 disabled:cursor-default"
                >
                  <option value="">未設定</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => exportPropertyToCSV(property, members)}
              className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-400 rounded-lg px-3 py-1.5 transition"
            >
              <FontAwesomeIcon icon={faDownload} />
              CSV
            </button>
            {canEdit && (
              <button
                onClick={onCopy}
                className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-400 rounded-lg px-3 py-1.5 transition"
              >
                <FontAwesomeIcon icon={faCopy} />
                コピー
              </button>
            )}
            {isAdmin && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 dark:border-red-800 hover:border-red-400 rounded-lg px-3 py-1.5 transition"
              >
                <FontAwesomeIcon icon={faTrash} />
                削除
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Gantt table */}
      <div className="flex-1 overflow-auto">
        <div className="inline-flex min-w-full">
          {/* Left: task info (sticky) */}
          <div className="sticky left-0 z-20 bg-white dark:bg-gray-800 shrink-0 shadow-[2px_0_6px_rgba(0,0,0,0.08)]">
            <div className="flex">
              <div className="w-44 border-b border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-end">
                工程
              </div>
              <div className="w-32 border-b border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-2 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-end">
                開始日
              </div>
              <div className="w-32 border-b border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-2 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-end">
                終了日
              </div>
            </div>
            <div className="h-7 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900" />

            {property.tasks.map(task => {
              const isSavingThis = saving === task.id;
              const startVal = getLocalDate(task.id, 'startDate', task.startDate);
              const endVal = getLocalDate(task.id, 'endDate', task.endDate);

              return (
                <div key={task.id} className="flex items-center border-b border-gray-100 dark:border-gray-700 h-11">
                  <div
                    className="w-44 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 truncate border-r border-gray-200 dark:border-gray-700 flex items-center gap-1"
                    title={task.name}
                    style={{ borderLeft: `3px solid ${task.color}` }}
                  >
                    <span className="truncate">{task.name}</span>
                    {isSavingThis && (
                      <span className="text-[10px] text-blue-400 shrink-0">保存中…</span>
                    )}
                  </div>
                  <div className="w-32 px-2 border-r border-gray-200 dark:border-gray-700">
                    <input
                      type="date"
                      value={startVal}
                      disabled={!canEdit}
                      onChange={e => handleDateChange(task.id, 'startDate', e.target.value)}
                      onBlur={() => handleDateBlur(task.id, 'startDate')}
                      className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-60 disabled:cursor-default"
                    />
                  </div>
                  <div className="w-32 px-2 border-r border-gray-200 dark:border-gray-700">
                    <input
                      type="date"
                      value={endVal}
                      min={startVal || undefined}
                      disabled={!canEdit}
                      onChange={e => handleDateChange(task.id, 'endDate', e.target.value)}
                      onBlur={() => handleDateBlur(task.id, 'endDate')}
                      className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-60 disabled:cursor-default"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: timeline grid */}
          <div className="shrink-0">
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

            {property.tasks.map(task => {
              const taskStart = parseDate(task.startDate);
              const taskEnd = parseDate(task.endDate);
              return (
                <div key={task.id} className="flex border-b border-gray-100 dark:border-gray-700 h-11 items-center">
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
      <div className="px-6 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-3 shrink-0">
        {property.tasks.map(t => (
          <div key={t.id} className="flex items-center gap-1.5">
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
