import type { Property, Member } from '../types';
import { exportAllToExcel, exportAllToCSV } from '../utils/exportUtils';

interface Props {
  properties: Property[];
  members: Member[];
  onSelect: (id: string) => void;
}

export function PropertyListView({ properties, members, onSelect }: Props) {
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

  function getProgress(property: Property) {
    if (property.tasks.length === 0) return 0;
    const done = property.tasks.filter(t => t.startDate && t.endDate).length;
    return Math.round((done / property.tasks.length) * 100);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">物件一覧</h1>
            <p className="text-xs text-gray-400 mt-0.5">全 {properties.length} 件</p>
          </div>
          {/* Export buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => exportAllToCSV(properties, members)}
              disabled={properties.length === 0}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400 rounded-lg px-4 py-2 transition disabled:opacity-40"
            >
              ↓ CSV一括出力
            </button>
            <button
              onClick={() => exportAllToExcel(properties, members)}
              disabled={properties.length === 0}
              className="flex items-center gap-1.5 text-sm text-white bg-green-600 hover:bg-green-500 rounded-lg px-4 py-2 transition disabled:opacity-40"
            >
              ↓ Excel一括出力
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        {properties.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="text-5xl mb-4">🏗️</div>
            <p className="text-lg font-medium">物件が登録されていません</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-24">物件ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">物件名</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-28">担当者</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-52">期間</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-36">進捗</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-28">登録日</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p, idx) => {
                  const progress = getProgress(p);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => onSelect(p.id)}
                      className={`border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {p.id}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800">{p.name}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{getAssigneeName(p)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{getDateRange(p)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(p.createdAt).toLocaleDateString('ja-JP')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
