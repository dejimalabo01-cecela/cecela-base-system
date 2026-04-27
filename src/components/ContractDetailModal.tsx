import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faPen } from '@fortawesome/free-solid-svg-icons';
import type { Property } from '../types';

interface Props {
  title: string;
  subtitle?: string;
  properties: Property[];
  total: number;
  onSelect?: (id: string) => void;
  onClose: () => void;
}

function formatYen(n: number | null | undefined): string {
  if (n == null) return '―';
  return n.toLocaleString('ja-JP') + ' 円';
}

function statusColor(s: string | null | undefined): string {
  switch (s) {
    case '契約済':       return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case '契約予定':     return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
    case '期中完成販売': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
}

export function ContractDetailModal({ title, subtitle, properties, total, onSelect, onClose }: Props) {
  // 契約日の昇順で並べる
  const sorted = [...properties].sort((a, b) =>
    (a.contractDate ?? '').localeCompare(b.contractDate ?? '')
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{title}</h2>
            {subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
            )}
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
              対象 <span className="font-semibold">{sorted.length} 件</span>
              <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
              契約金額合計 <span className="font-mono font-semibold text-blue-700 dark:text-blue-300">{formatYen(total)}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition shrink-0">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {sorted.length === 0 ? (
            <div className="text-center text-gray-400 dark:text-gray-500 py-12 text-sm">
              該当する契約物件はありません
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 w-20">契約日</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 w-20">物件ID</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">物件名</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 w-24">種別</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 w-28">ステータス</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-600 dark:text-gray-400 w-32">契約金額</th>
                    {onSelect && <th className="w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(p => (
                    <tr
                      key={p.id}
                      className={`border-t border-gray-100 dark:border-gray-700 ${
                        onSelect ? 'hover:bg-blue-50/60 dark:hover:bg-blue-900/20 cursor-pointer' : ''
                      }`}
                      onClick={onSelect ? () => { onSelect(p.id); onClose(); } : undefined}
                    >
                      <td className="px-2 py-1.5 font-mono text-gray-700 dark:text-gray-200">
                        {p.contractDate ?? '―'}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-gray-500 dark:text-gray-400">
                        {p.id}
                      </td>
                      <td className="px-2 py-1.5 truncate text-gray-800 dark:text-gray-100" title={p.name}>
                        {p.name}
                      </td>
                      <td className="px-2 py-1.5 text-gray-600 dark:text-gray-300">
                        {p.propertyType ?? '―'}
                      </td>
                      <td className="px-2 py-1.5">
                        {p.status ? (
                          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${statusColor(p.status)}`}>
                            {p.status}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">―</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-gray-800 dark:text-gray-100">
                        {formatYen(p.salePrice)}
                      </td>
                      {onSelect && (
                        <td className="px-1 py-1.5 text-gray-400 text-right">
                          <FontAwesomeIcon icon={faPen} className="text-[10px]" />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 transition hover:border-gray-400"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
