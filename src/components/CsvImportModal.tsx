import { useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faUpload, faTriangleExclamation, faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import type { Property } from '../types';
import type { ImportPropertyRow } from '../hooks/useProperties';

interface Props {
  existingProperties: Property[];
  onImport: (rows: ImportPropertyRow[], overwrite: boolean) =>
    Promise<{ added: number; updated: number; skipped: number; errors: string[] }>;
  onClose: () => void;
}

interface ParsedRow {
  raw: Record<string, string>;
  parsed: ImportPropertyRow;
  existing: boolean;
  warnings: string[];
}

// 単純なCSVパーサ。BOM除去・改行・クォート対応。
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const stripped = text.replace(/^\uFEFF/, '');
  const lines = stripped.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuote) {
        if (c === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else { inQuote = false; }
        } else cur += c;
      } else {
        if (c === '"') inQuote = true;
        else if (c === ',') { result.push(cur); cur = ''; }
        else cur += c;
      }
    }
    result.push(cur);
    return result.map(s => s.trim());
  };

  return {
    headers: parseLine(lines[0]),
    rows: lines.slice(1).map(parseLine),
  };
}

// 「2025/04/01」「2025-4-1」など緩めに受けて YYYY-MM-DD に正規化
function normalizeDate(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (!m) return null;
  const y = m[1];
  const mo = m[2].padStart(2, '0');
  const d = m[3].padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

function normalizePrice(v: string): number | null {
  const s = v.trim().replace(/[,\s¥円]/g, '');
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

const HEADER_ALIASES: Record<keyof Pick<ImportPropertyRow, 'id' | 'name' | 'salePrice' | 'saleStartDate' | 'contractDate'>, string[]> = {
  id:            ['物件ID', 'ID', 'id', 'property_id'],
  name:          ['物件名', '名前', 'name'],
  salePrice:     ['販売価格', '価格', '販売金額', 'salePrice', 'price'],
  saleStartDate: ['販売開始日', '販売開始', 'saleStartDate', 'sale_start_date'],
  contractDate:  ['契約日', 'contractDate', 'contract_date'],
};

function findColumn(headers: string[], aliases: string[]): number {
  for (const a of aliases) {
    const idx = headers.findIndex(h => h === a);
    if (idx >= 0) return idx;
  }
  return -1;
}

export function CsvImportModal({ existingProperties, onImport, onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<null | { added: number; updated: number; skipped: number; errors: string[] }>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const existingIds = useMemo(
    () => new Set(existingProperties.map(p => p.id)),
    [existingProperties],
  );

  const conflictCount = parsedRows.filter(r => r.existing).length;
  const newCount = parsedRows.filter(r => !r.existing).length;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0) {
        setParseError('CSVが空、または読み取れませんでした。');
        setParsedRows([]);
        return;
      }

      const idCol    = findColumn(headers, HEADER_ALIASES.id);
      const nameCol  = findColumn(headers, HEADER_ALIASES.name);
      const priceCol = findColumn(headers, HEADER_ALIASES.salePrice);
      const startCol = findColumn(headers, HEADER_ALIASES.saleStartDate);
      const contCol  = findColumn(headers, HEADER_ALIASES.contractDate);

      if (idCol < 0) {
        setParseError(`「物件ID」列が見つかりません。ヘッダー: ${headers.join(', ')}`);
        setParsedRows([]);
        return;
      }

      const parsed: ParsedRow[] = rows.map(row => {
        const raw: Record<string, string> = {};
        headers.forEach((h, i) => { raw[h] = row[i] ?? ''; });

        const id = (row[idCol] ?? '').trim();
        const warnings: string[] = [];

        const nameRaw = nameCol >= 0 ? row[nameCol] : '';
        const priceRaw = priceCol >= 0 ? row[priceCol] : '';
        const startRaw = startCol >= 0 ? row[startCol] : '';
        const contRaw = contCol >= 0 ? row[contCol] : '';

        const salePrice = priceRaw?.trim() ? normalizePrice(priceRaw) : undefined;
        const saleStart = startRaw?.trim() ? normalizeDate(startRaw) : undefined;
        const contract  = contRaw?.trim()  ? normalizeDate(contRaw)  : undefined;

        if (priceRaw?.trim() && salePrice == null) warnings.push(`価格 "${priceRaw}" を数値に変換できませんでした`);
        if (startRaw?.trim() && saleStart == null) warnings.push(`販売開始日 "${startRaw}" を日付に変換できませんでした`);
        if (contRaw?.trim()  && contract  == null) warnings.push(`契約日 "${contRaw}" を日付に変換できませんでした`);

        const out: ImportPropertyRow = {
          id,
          ...(nameRaw?.trim() ? { name: nameRaw.trim() } : {}),
          ...(priceRaw?.trim() ? { salePrice } : {}),
          ...(startRaw?.trim() ? { saleStartDate: saleStart } : {}),
          ...(contRaw?.trim()  ? { contractDate:  contract  } : {}),
        };

        return {
          raw,
          parsed: out,
          existing: existingIds.has(id),
          warnings,
        };
      }).filter(r => r.parsed.id !== '');

      setParsedRows(parsed);
    };
    reader.readAsText(file, 'utf-8');
  }

  async function handleApply() {
    if (parsedRows.length === 0) return;
    if (conflictCount > 0 && !overwrite) {
      alert(`${conflictCount} 件の物件IDが既に登録されています。\n上書きする場合は「既存の物件を上書きする」にチェックしてください。`);
      return;
    }
    setImporting(true);
    try {
      const r = await onImport(parsedRows.map(p => p.parsed), overwrite);
      setResult(r);
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setFileName('');
    setParsedRows([]);
    setOverwrite(false);
    setResult(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">CSVインポート</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* インポート結果 */}
          {result ? (
            <div className="space-y-3">
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-4 text-sm text-green-800 dark:text-green-200">
                <div className="flex items-center gap-2 font-semibold mb-2">
                  <FontAwesomeIcon icon={faCircleCheck} />
                  インポート完了
                </div>
                <ul className="text-xs space-y-0.5 ml-5">
                  <li>新規追加: {result.added} 件</li>
                  <li>上書き: {result.updated} 件</li>
                  <li>スキップ: {result.skipped} 件</li>
                </ul>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-4 text-sm text-red-800 dark:text-red-200">
                  <div className="flex items-center gap-2 font-semibold mb-2">
                    <FontAwesomeIcon icon={faTriangleExclamation} />
                    エラー
                  </div>
                  <ul className="text-xs space-y-0.5 ml-5 max-h-32 overflow-y-auto">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* ファイル選択 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">CSVファイル</label>
                <div className="flex gap-2 items-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-sm border border-gray-300 dark:border-gray-600 hover:border-gray-400 rounded-lg px-3 py-2 transition text-gray-700 dark:text-gray-200"
                  >
                    <FontAwesomeIcon icon={faUpload} />
                    ファイルを選択
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{fileName || '未選択'}</span>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                  必要列: 物件ID（必須）/ 物件名 / 販売価格 / 販売開始日 / 契約日（空欄OK）
                </p>
              </div>

              {parseError && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-3 text-xs text-red-800 dark:text-red-200">
                  <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2" />
                  {parseError}
                </div>
              )}

              {/* プレビュー */}
              {parsedRows.length > 0 && (
                <>
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    認識: <span className="font-semibold">{parsedRows.length} 件</span>
                    （新規 <span className="text-blue-600 dark:text-blue-400 font-semibold">{newCount}</span> /
                    既存 <span className="text-yellow-700 dark:text-yellow-400 font-semibold">{conflictCount}</span>）
                  </div>

                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto max-h-64">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400">状態</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400">物件ID</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400">物件名</th>
                          <th className="px-2 py-1.5 text-right font-semibold text-gray-600 dark:text-gray-400">販売価格</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400">販売開始日</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400">契約日</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.map((r, i) => (
                          <tr
                            key={i}
                            className={`border-t border-gray-100 dark:border-gray-700 ${
                              r.existing ? 'bg-yellow-50/60 dark:bg-yellow-900/20' : ''
                            }`}
                          >
                            <td className="px-2 py-1">
                              {r.existing ? (
                                <span className="text-[10px] bg-yellow-200 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100 px-1.5 py-0.5 rounded">既存</span>
                              ) : (
                                <span className="text-[10px] bg-blue-200 dark:bg-blue-700 text-blue-900 dark:text-blue-100 px-1.5 py-0.5 rounded">新規</span>
                              )}
                            </td>
                            <td className="px-2 py-1 font-mono">{r.parsed.id}</td>
                            <td className="px-2 py-1 truncate max-w-[160px]" title={r.parsed.name}>{r.parsed.name ?? '―'}</td>
                            <td className="px-2 py-1 text-right font-mono">
                              {r.parsed.salePrice != null ? r.parsed.salePrice.toLocaleString('ja-JP') : '―'}
                            </td>
                            <td className="px-2 py-1 font-mono">{r.parsed.saleStartDate ?? '―'}</td>
                            <td className="px-2 py-1 font-mono">{r.parsed.contractDate ?? '―'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 警告 */}
                  {parsedRows.some(r => r.warnings.length > 0) && (
                    <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-lg p-3 text-xs text-orange-800 dark:text-orange-200">
                      <div className="font-semibold mb-1">変換できなかった項目があります（該当行はスキップではなく、その項目だけ空として処理されます）</div>
                      <ul className="ml-5 list-disc space-y-0.5 max-h-24 overflow-y-auto">
                        {parsedRows.flatMap((r, i) => r.warnings.map((w, j) => (
                          <li key={`${i}-${j}`}>行{i + 2}（{r.parsed.id}）: {w}</li>
                        )))}
                      </ul>
                    </div>
                  )}

                  {/* 上書きチェックボックス */}
                  <label className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer ${
                    conflictCount > 0
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
                      : 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700 opacity-60'
                  }`}>
                    <input
                      type="checkbox"
                      checked={overwrite}
                      onChange={e => setOverwrite(e.target.checked)}
                      disabled={conflictCount === 0}
                      className="w-4 h-4 mt-0.5 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500 disabled:opacity-50"
                    />
                    <div className="text-xs text-gray-700 dark:text-gray-200">
                      <div className="font-semibold flex items-center gap-1">
                        <FontAwesomeIcon icon={faTriangleExclamation} className="text-yellow-600" />
                        既存の物件を上書きする
                      </div>
                      <div className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                        {conflictCount > 0
                          ? `同じ物件IDが ${conflictCount} 件あります。チェックを入れると CSV の値で上書きされます（空欄列は変更されません）。`
                          : '同じ物件IDの既存データはありません。'}
                      </div>
                    </div>
                  </label>
                </>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          {result ? (
            <>
              <button
                onClick={reset}
                className="text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 transition hover:border-gray-400"
              >
                もう1件インポート
              </button>
              <button
                onClick={onClose}
                className="text-sm text-white bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2 transition"
              >
                閉じる
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 transition hover:border-gray-400"
              >
                キャンセル
              </button>
              <button
                onClick={handleApply}
                disabled={importing || parsedRows.length === 0}
                className="text-sm text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg px-4 py-2 transition"
              >
                {importing ? 'インポート中…' : `${parsedRows.length}件をインポート`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
