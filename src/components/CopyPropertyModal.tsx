import { useState, useEffect, useRef } from 'react';

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

  useEffect(() => {
    inputRef.current?.select();
  }, []);

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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">物件をコピー</h2>
        <p className="text-sm text-gray-500 mb-4">コピー元: {sourceName}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新しい物件名</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <div className="text-sm font-medium text-gray-700">日程もコピーする</div>
              <div className="text-xs text-gray-400">チェックしない場合、工程名のみコピーして日程は空になります</div>
            </div>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50 transition"
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
