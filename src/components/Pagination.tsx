import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAngleLeft, faAngleRight, faAnglesLeft, faAnglesRight,
  faSort, faSortUp, faSortDown,
} from '@fortawesome/free-solid-svg-icons';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200, 500] as const;

interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onChangePage: (page: number) => void;
  onChangePageSize: (size: number) => void;
}

export function Pagination({ total, page, pageSize, onChangePage, onChangePageSize }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(safePage * pageSize, total);

  const goto = (n: number) => onChangePage(Math.min(Math.max(1, n), totalPages));

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-gray-600 dark:text-gray-300 px-1 py-2">
      <div className="flex items-center gap-2">
        <span>表示件数</span>
        <select
          value={pageSize}
          onChange={e => {
            onChangePageSize(parseInt(e.target.value, 10));
            onChangePage(1);
          }}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-gray-400 dark:text-gray-500">
          {total === 0 ? '0件' : `${startIdx}–${endIdx} / ${total} 件`}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => goto(1)}
          disabled={safePage === 1}
          className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title="最初のページ"
        >
          <FontAwesomeIcon icon={faAnglesLeft} className="text-[11px]" />
        </button>
        <button
          onClick={() => goto(safePage - 1)}
          disabled={safePage === 1}
          className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title="前のページ"
        >
          <FontAwesomeIcon icon={faAngleLeft} className="text-[11px]" />
        </button>
        <span className="px-2 font-mono">{safePage} / {totalPages}</span>
        <button
          onClick={() => goto(safePage + 1)}
          disabled={safePage === totalPages}
          className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title="次のページ"
        >
          <FontAwesomeIcon icon={faAngleRight} className="text-[11px]" />
        </button>
        <button
          onClick={() => goto(totalPages)}
          disabled={safePage === totalPages}
          className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title="最後のページ"
        >
          <FontAwesomeIcon icon={faAnglesRight} className="text-[11px]" />
        </button>
      </div>
    </div>
  );
}

// 並び替えヘッダーボタン
interface SortHeaderProps {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
  className?: string;
}

export function SortHeader({ label, active, dir, onClick, className }: SortHeaderProps) {
  const icon = !active ? faSort : dir === 'asc' ? faSortUp : faSortDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition ${className ?? ''}`}
    >
      <span>{label}</span>
      <FontAwesomeIcon
        icon={icon}
        className={`text-[10px] ${active ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}`}
      />
    </button>
  );
}
