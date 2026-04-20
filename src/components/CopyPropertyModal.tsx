import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faCopy } from '@fortawesome/free-solid-svg-icons';

interface Props {
  sourceName: string;
  onCopy: (newName: string, copyDates: boolean) => Promise<void>;
  onClose: () => void;
}

export function CopyPropertyModal({ sourceName, onCopy, onClose }: Props) {
  const [name, setName] = useState(`${sourceName}（コピー）`);
  const [copyDates, setCopyDates] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.select(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    await onCopy(trimmed, copyDates);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faCopy} className="text-blue-500" />
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">物件をコピー</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">コピー元: {sourceName}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">新しい物件名</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={copyDates}
              onChange={e => setCopyDates(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">日程もコピーする</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">チェックしない場合、工程名のみコピーして日程は空になります</div>
            </div>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition"
            >
              {loading ? 'コピー中...' : 'コピーする'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
