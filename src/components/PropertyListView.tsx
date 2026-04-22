import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDownload, faFileExcel, faBuilding, faSearch, faXmark, faTrash, faCopy,
} from '@fortawesome/free-solid-svg-icons';
import type { Property, Member } from '../types';
import type { Role } from '../hooks/useRole';
import { exportAllToExcel, exportAllToCSV } from '../utils/exportUtils';

interface Props {
  properties: Property[];
  members: Member[];
  role: Role;
  onSelect: (id: string) => void;
  onDeleteMany: (ids: string[]) => Promise<void>;
  onCopyMany: (ids: string[], copyDates: boolean) => Promise<number>;
}

export function PropertyListView({ properties, members, role, onSelect, onDeleteMany, onCopyMany }: Props) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [copying, setCopying] = useState(false);

  const canEdit = role === 'admin' || role === 'editor';
  const isAdmin = role === 'admin';

  function getAssigneeName(property: Property) {
    return members.find(m => m.id === property.assigneeId)?.name ?? '—';
  }

  function getDateRange(property: Property) {
    const dates = property.tasks.flatMap(t => [t.startDate, t.endDate]).filter(Boolean) as string[];
    if (dates.length === 0) return '—';
    const min = dates.reduce((a, b) => a < b ? a : b);
    const max = dates.reduce((a, b) => a > b ? a : b);
    return `${min} 〜 ${max}`;
  }

  // 日付ベースの進捗率。非表示工程は除外、日付未設定の工程は 0% として含める
  function getProgress(property: Property) {
    const tasks = property.tasks.filter(t => !t.hidden);
    if (tasks.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const totalFraction = tasks.reduce((sum, t) => {
      if (!t.startDate || !t.endDate) return sum;
      const startMs = new Date(t.startDate).setHours(0, 0, 0, 0);
      const endMs = new Date(t.endDate).setHours(23, 59, 59, 999);
      if (todayMs < startMs) return sum;          // 未着手
      if (todayMs > endMs) return sum + 1;        // 完了
      const range = endMs - startMs;
      if (range <= 0) return sum + 1;             // 同日ちょうど
      return sum + (todayMs - startMs) / range;   // 進行中
    }, 0);

    return Math.round((totalFraction / tasks.length) * 100);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(p =>
      p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    );
  }, [properties, search]);

  const selectedList = useMemo(
    () => properties.filter(p => selected.has(p.id)),
    [properties, selected]
  );
  const visibleSelectedCount = filtered.filter(p => selected.has(p.id)).length;
  const allVisibleChecked = filtered.length > 0 && visibleSelectedCount === filtered.length;
  const someVisibleChecked = visibleSelectedCount > 0 && !allVisibleChecked;

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleChecked) {
        filtered.forEach(p => next.delete(p.id));
      } else {
        filtered.forEach(p => next.add(p.id));
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleBulkDelete() {
    if (selectedList.length === 0) return;
    const names = selectedList.slice(0, 3).map(p => `・${p.name}`).join('\n');
    const suffix = selectedList.length > 3 ? `\n他 ${selectedList.length - 3} 件` : '';
    if (!confirm(`選択した ${selectedList.length} 件を削除します。\n${names}${suffix}\n\nこの操作は取り消せません。`)) return;
    setDeleting(true);
    try {
      await onDeleteMany(selectedList.map(p => p.id));
      clearSelection();
    } finally {
      setDeleting(false);
    }
  }

  async function handleBulkCopy() {
    if (selectedList.length === 0) return;
    const names = selectedList.slice(0, 3).map(p => `・${p.name}`).join('\n');
    const suffix = selectedList.length > 3 ? `\n他 ${selectedList.length - 3} 件` : '';
    // OK = 日付ごと複製、キャンセル = 中止。日付なしは個別コピー画面でどうぞ。
    const ok = confirm(
      `選択した ${selectedList.length} 件を複製します。\n${names}${suffix}\n\n` +
      `物件名は「○○_コピー」、工程・担当者・日付・非表示状態すべて引き継ぎます。\n\nよろしいですか？`
    );
    if (!ok) return;
    setCopying(true);
    try {
      const created = await onCopyMany(selectedList.map(p => p.id), true);
      if (created > 0) clearSelection();
    } finally {
      setCopying(false);
    }
  }

  function stripHidden(props: Property[]): Property[] {
    return props.map(p => ({ ...p, tasks: p.tasks.filter(t => !t.hidden) }));
  }

  function handleExportCsv() {
    const target = selectedList.length > 0 ? selectedList : filtered;
    exportAllToCSV(stripHidden(target), members);
  }

  function handleExportExcel() {
    const target = selectedList.length > 0 ? selectedList : filtered;
    exportAllToExcel(stripHidden(target), members);
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 md:px-6 py-3 md:py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100">物件一覧</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              全 {properties.length} 件
              {search && ` / 該当 ${filtered.length} 件`}
              {selected.size > 0 && ` / 選択 ${selected.size} 件`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 text-xs md:text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-400 rounded-lg px-3 md:px-4 py-2 transition disabled:opacity-40"
              title={selected.size > 0 ? '選択した物件をCSV出力' : '全件をCSV出力'}
            >
              <FontAwesomeIcon icon={faDownload} />
              <span>CSV{selected.size > 0 ? `（${selected.size}）` : ''}</span>
            </button>
            <button
              onClick={handleExportExcel}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 text-xs md:text-sm text-white bg-green-600 hover:bg-green-500 rounded-lg px-3 md:px-4 py-2 transition disabled:opacity-40"
              title={selected.size > 0 ? '選択した物件をExcel出力' : '全件をExcel出力'}
            >
              <FontAwesomeIcon icon={faFileExcel} />
              <span>Excel{selected.size > 0 ? `（${selected.size}）` : ''}</span>
            </button>
            {canEdit && (
              <button
                onClick={handleBulkCopy}
                disabled={selected.size === 0 || copying}
                className="flex items-center gap-1.5 text-xs md:text-sm text-blue-600 hover:text-blue-700 border border-blue-300 dark:border-blue-700 hover:border-blue-500 rounded-lg px-3 md:px-4 py-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
                title="選択した物件を複製"
              >
                <FontAwesomeIcon icon={faCopy} />
                <span>{copying ? '複製中…' : `複製${selected.size > 0 ? `（${selected.size}）` : ''}`}</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={handleBulkDelete}
                disabled={selected.size === 0 || deleting}
                className="flex items-center gap-1.5 text-xs md:text-sm text-red-600 hover:text-red-700 border border-red-300 dark:border-red-700 hover:border-red-500 rounded-lg px-3 md:px-4 py-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
                title="選択した物件を削除"
              >
                <FontAwesomeIcon icon={faTrash} />
                <span>{deleting ? '削除中…' : `削除${selected.size > 0 ? `（${selected.size}）` : ''}`}</span>
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="物件名・物件IDで検索"
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              title="クリア"
            >
              <FontAwesomeIcon icon={faXmark} className="text-xs" />
            </button>
          )}
        </div>
      </div>

      {/* List body */}
      <div className="flex-1 overflow-auto p-3 md:p-6">
        {properties.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600">
            <FontAwesomeIcon icon={faBuilding} className="text-6xl mb-4 opacity-30" />
            <p className="text-lg font-medium">物件が登録されていません</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600">
            <FontAwesomeIcon icon={faSearch} className="text-6xl mb-4 opacity-30" />
            <p className="text-lg font-medium">該当する物件がありません</p>
            <p className="text-sm mt-1">検索条件を変更してください</p>
          </div>
        ) : (
          <>
            {/* Mobile: card layout */}
            <div className="md:hidden space-y-2">
              <div className="flex items-center gap-2 px-1 pb-1">
                <input
                  type="checkbox"
                  checked={allVisibleChecked}
                  ref={el => { if (el) el.indeterminate = someVisibleChecked; }}
                  onChange={toggleAllVisible}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  aria-label="全件選択"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">全件選択</span>
              </div>
              {filtered.map(p => {
                const progress = getProgress(p);
                const isChecked = selected.has(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => onSelect(p.id)}
                    className={`rounded-xl border p-3 shadow-sm cursor-pointer transition ${
                      isChecked
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div onClick={e => e.stopPropagation()} className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(p.id)}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          aria-label={`${p.name} を選択`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                            {p.id}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">
                            {new Date(p.createdAt).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                        <div className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate">
                          {p.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <span>{getAssigneeName(p)}</span>
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <span className="font-mono text-[10px] truncate">{getDateRange(p)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 w-8 text-right">{progress}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table layout */}
            <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleChecked}
                      ref={el => { if (el) el.indeterminate = someVisibleChecked; }}
                      onChange={toggleAllVisible}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      aria-label="全件選択"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 w-24">物件ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400">物件名</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 w-28">担当者</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 w-52">期間</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 w-36">進捗</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 w-28">登録日</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => {
                  const progress = getProgress(p);
                  const isChecked = selected.has(p.id);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => onSelect(p.id)}
                      className={`border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition ${
                        isChecked
                          ? 'bg-blue-50/80 dark:bg-blue-900/30'
                          : idx % 2 === 0
                            ? 'bg-white dark:bg-gray-800'
                            : 'bg-gray-50/50 dark:bg-gray-800/50'
                      }`}
                    >
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(p.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          aria-label={`${p.name} を選択`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                          {p.id}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800 dark:text-gray-100">{p.name}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{getAssigneeName(p)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 font-mono">{getDateRange(p)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">
                        {new Date(p.createdAt).toLocaleDateString('ja-JP')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
