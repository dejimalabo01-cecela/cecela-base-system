import * as XLSX from 'xlsx-js-style';
import type { Property, Member } from '../types';
import { getSlotDates, isTaskInSlot } from './dateUtils';

const SLOT_LABELS = ['1週', '2週', '3週', '4週'];

function getAssigneeName(property: Property, members: Member[]): string {
  return members.find(m => m.id === property.assigneeId)?.name ?? '未設定';
}

function hexToRgb(hex: string): string {
  return hex.replace('#', '').toUpperCase().padStart(6, '0');
}

// 全物件の日付範囲から月リストを生成
function buildMonthList(properties: Property[]): Date[] {
  const dates: Date[] = [];
  for (const p of properties) {
    for (const t of p.tasks) {
      if (t.startDate) dates.push(new Date(t.startDate));
      if (t.endDate)   dates.push(new Date(t.endDate));
    }
  }
  const now = new Date();
  const earliest = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : now;
  const latest   = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : now;

  const start = new Date(earliest.getFullYear(), earliest.getMonth() - 1, 1);
  const end   = new Date(latest.getFullYear(),   latest.getMonth()   + 2, 1);

  const months: Date[] = [];
  const cur = new Date(start);
  while (cur < end) {
    months.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  // 最低12ヶ月は表示
  while (months.length < 12) {
    const last = months[months.length - 1];
    const next = new Date(last.getFullYear(), last.getMonth() + 1, 1);
    months.push(next);
  }
  return months;
}

// 1ヶ月を 4 スロットに分けて、各スロットでタスクが入っているかを返す
function isTaskInSlotForMonth(
  taskStart: string | null,
  taskEnd: string | null,
  month: Date,
  slot: number,
): boolean {
  if (!taskStart || !taskEnd) return false;
  const [slotStart, slotEnd] = getSlotDates(month.getFullYear(), month.getMonth(), slot);
  return isTaskInSlot(new Date(taskStart), new Date(taskEnd), slotStart, slotEnd);
}

// ===== Excel 一括出力（ガントチャート付き）=====
export function exportAllToExcel(properties: Property[], members: Member[]) {
  const wb = XLSX.utils.book_new();
  const months = buildMonthList(properties);

  const HEADER_S = {
    font: { bold: true, sz: 9, color: { rgb: '374151' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: { bottom: { style: 'thin', color: { rgb: 'D1D5DB' } } },
  };
  const SUB_HEADER_S = {
    font: { sz: 8, color: { rgb: '6B7280' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F9FAFB' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: { bottom: { style: 'thin', color: { rgb: 'D1D5DB' } } },
  };
  const INFO_LABEL_S = { font: { bold: true, sz: 9 } };
  const INFO_VAL_S   = { font: { sz: 9 } };
  const TASK_NAME_S  = { font: { sz: 9 }, alignment: { vertical: 'center' } };
  const DATE_S       = { font: { sz: 9 }, alignment: { horizontal: 'center', vertical: 'center' } };

  for (const property of properties) {
    const assignee = getAssigneeName(property, members);
    const sheetName = property.name.replace(/[:\\/?*[\]]/g, '').slice(0, 31) || property.id;

    const aoa = [
      // 物件情報
      [{ v: '物件ID', s: INFO_LABEL_S }, { v: property.id,   s: INFO_VAL_S }],
      [{ v: '物件名', s: INFO_LABEL_S }, { v: property.name, s: INFO_VAL_S }],
      [{ v: '担当者', s: INFO_LABEL_S }, { v: assignee,      s: INFO_VAL_S }],
      [],
      // ヘッダー行 1: 月ラベル（各月は 4 列マージ）
      [
        { v: '工程名', s: HEADER_S },
        { v: '開始日', s: HEADER_S },
        { v: '終了日', s: HEADER_S },
        ...months.flatMap(m => [
          {
            v: `${m.getFullYear()}/${String(m.getMonth() + 1).padStart(2, '0')}`,
            s: HEADER_S,
          },
          { v: '', s: HEADER_S },
          { v: '', s: HEADER_S },
          { v: '', s: HEADER_S },
        ]),
      ],
      // ヘッダー行 2: 週ラベル
      [
        { v: '', s: HEADER_S },
        { v: '', s: HEADER_S },
        { v: '', s: HEADER_S },
        ...months.flatMap(() => SLOT_LABELS.map(label => ({ v: label, s: SUB_HEADER_S }))),
      ],
      // タスク行
      ...property.tasks.map(task => [
        { v: task.name,           s: TASK_NAME_S },
        { v: task.startDate ?? '', s: DATE_S },
        { v: task.endDate   ?? '', s: DATE_S },
        ...months.flatMap(m =>
          SLOT_LABELS.map((_, slot) => {
            const active = isTaskInSlotForMonth(task.startDate, task.endDate, m, slot);
            return {
              v: '',
              s: active
                ? { fill: { patternType: 'solid', fgColor: { rgb: hexToRgb(task.color) } } }
                : {},
            };
          })
        ),
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // セルマージ：左 3 列は 2 行ぶち抜き、各月ヘッダーは 4 列ぶち抜き
    ws['!merges'] = [
      { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } },
      { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } },
      { s: { r: 4, c: 2 }, e: { r: 5, c: 2 } },
      ...months.map((_, mi) => {
        const startCol = 3 + mi * 4;
        return { s: { r: 4, c: startCol }, e: { r: 4, c: startCol + 3 } };
      }),
    ];

    // 列幅
    ws['!cols'] = [
      { wch: 22 }, // 工程名
      { wch: 11 }, // 開始日
      { wch: 11 }, // 終了日
      ...months.flatMap(() => Array.from({ length: 4 }, () => ({ wch: 3 }))),
    ];

    // 行高さ
    const totalRows = 6 + property.tasks.length;
    ws['!rows'] = [];
    for (let i = 0; i < totalRows; i++) {
      (ws['!rows'] as unknown[])[i] = { hpt: i === 4 ? 20 : 18 };
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  XLSX.writeFile(wb, 'cecela_物件一覧.xlsx');
}

// ===== CSV 一括出力（週別ガントチャート付き）=====
export function exportAllToCSV(properties: Property[], members: Member[]) {
  const months = buildMonthList(properties);
  const slotLabels = months.flatMap(m => {
    const ym = `${m.getFullYear()}/${String(m.getMonth() + 1).padStart(2, '0')}`;
    return SLOT_LABELS.map(s => `${ym} ${s}`);
  });

  const rows: string[][] = [
    ['物件ID', '物件名', '担当者', '工程名', '開始日', '終了日', ...slotLabels],
  ];

  for (const property of properties) {
    const assignee = getAssigneeName(property, members);
    for (const task of property.tasks) {
      rows.push([
        property.id,
        property.name,
        assignee,
        task.name,
        task.startDate ?? '',
        task.endDate   ?? '',
        ...months.flatMap(m =>
          SLOT_LABELS.map((_, slot) =>
            isTaskInSlotForMonth(task.startDate, task.endDate, m, slot) ? '●' : ''
          )
        ),
      ]);
    }
  }

  downloadCSV(rows, 'cecela_物件一覧.csv');
}

// ===== 単一物件CSV出力（GanttChartから呼ぶ）=====
export function exportPropertyToCSV(property: Property, members: Member[]) {
  const assignee = getAssigneeName(property, members);
  const months = buildMonthList([property]);
  const slotLabels = months.flatMap(m => {
    const ym = `${m.getFullYear()}/${String(m.getMonth() + 1).padStart(2, '0')}`;
    return SLOT_LABELS.map(s => `${ym} ${s}`);
  });

  const rows: string[][] = [
    ['物件ID', '物件名', '担当者', '工程名', '開始日', '終了日', ...slotLabels],
    ...property.tasks.map(task => [
      property.id,
      property.name,
      assignee,
      task.name,
      task.startDate ?? '',
      task.endDate   ?? '',
      ...months.flatMap(m =>
        SLOT_LABELS.map((_, slot) =>
          isTaskInSlotForMonth(task.startDate, task.endDate, m, slot) ? '●' : ''
        )
      ),
    ]),
  ];

  downloadCSV(rows, `${property.id}_${property.name}.csv`);
}

// ===== 販売計画用エクスポート =====
// 物件1行 = 1レコードのフラットな出力。販売計画モジュールで使う項目をまとめる。

const SALES_HEADERS = [
  '物件ID', '物件名', '担当者', '物件種別', '契約ステータス',
  '原価', '借入', '原価×15%', '差額(自己資金)',
  '販売価格', '価格未確定', '販売開始日', '契約日',
  '価格変更日', '登録日',
] as const;

function fmtPrice(n: number | null | undefined): string {
  return n != null ? String(n) : '';
}

function buildSalesRow(p: Property, members: Member[]): string[] {
  const assignee = getAssigneeName(p, members);
  const buffer = p.cost != null ? Math.round(p.cost * 0.15) : null;
  const ownFund = p.cost != null && p.loan != null ? p.cost - p.loan : null;
  const priceUpdated = p.salePriceUpdatedAt ? new Date(p.salePriceUpdatedAt).toLocaleString('ja-JP') : '';
  return [
    p.id,
    p.name,
    assignee,
    p.propertyType ?? '',
    p.status ?? '',
    fmtPrice(p.cost),
    fmtPrice(p.loan),
    fmtPrice(buffer),
    fmtPrice(ownFund),
    fmtPrice(p.salePrice),
    p.pricePending ? '○' : '',
    p.saleStartDate ?? '',
    p.contractDate ?? '',
    priceUpdated,
    new Date(p.createdAt).toLocaleDateString('ja-JP'),
  ];
}

export function exportSalesPlanToCSV(properties: Property[], members: Member[], filename: string) {
  const rows: string[][] = [
    [...SALES_HEADERS],
    ...properties.map(p => buildSalesRow(p, members)),
  ];
  downloadCSV(rows, filename);
}

// 販売計画用：1物件×月のセル（加工期間 = 青、販売開始月 = オレンジ＋価格、未確定 = 黄）
function buildSalesGanttCells(p: Property, months: Date[]): { v: string | number; s?: object }[] {
  const tasks = p.tasks.filter(t => !t.hidden);
  const allTimes: number[] = [];
  for (const t of tasks) {
    if (t.startDate) allTimes.push(new Date(t.startDate).getTime());
    if (t.endDate)   allTimes.push(new Date(t.endDate).getTime());
  }
  const procStart = allTimes.length ? new Date(Math.min(...allTimes)) : null;
  const procEnd   = allTimes.length ? new Date(Math.max(...allTimes)) : null;

  // 販売タスクのstartDate を優先、なければ property.saleStartDate
  const saleTask = tasks.find(t => t.name.includes('販売'));
  const saleStartStr = saleTask?.startDate ?? p.saleStartDate ?? null;
  const saleStart = saleStartStr ? new Date(saleStartStr) : null;

  const PROC_FILL = 'BFDBFE';     // 加工期間（blue-200）
  const SALE_FILL = 'FDBA74';     // 販売開始月（orange-300）
  const PENDING_FILL = 'FDE68A';  // 価格未確定（yellow-200）

  return months.map(m => {
    const ms = new Date(m.getFullYear(), m.getMonth(), 1).getTime();
    const me = new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59).getTime();

    const isSaleMonth = saleStart &&
      saleStart.getFullYear() === m.getFullYear() &&
      saleStart.getMonth() === m.getMonth();

    if (isSaleMonth) {
      const fillColor = p.pricePending ? PENDING_FILL : SALE_FILL;
      if (p.salePrice != null) {
        return {
          v: p.salePrice,
          s: {
            fill: { patternType: 'solid', fgColor: { rgb: fillColor } },
            font: { sz: 9, bold: true, color: { rgb: '111827' } },
            alignment: { horizontal: 'right', vertical: 'center' },
            numFmt: '#,##0',
          },
        };
      }
      return {
        v: '販売',
        s: {
          fill: { patternType: 'solid', fgColor: { rgb: fillColor } },
          font: { sz: 9, bold: true, color: { rgb: '111827' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        },
      };
    }

    const inProc = procStart && procEnd && procStart.getTime() <= me && procEnd.getTime() >= ms;
    if (inProc) {
      return {
        v: '',
        s: { fill: { patternType: 'solid', fgColor: { rgb: PROC_FILL } } },
      };
    }
    return { v: '' };
  });
}

export function exportSalesPlanToExcel(properties: Property[], members: Member[], filename: string) {
  const wb = XLSX.utils.book_new();
  const months = buildMonthList(properties);

  const HEADER_S = {
    font: { bold: true, sz: 10, color: { rgb: '374151' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: { bottom: { style: 'thin', color: { rgb: 'D1D5DB' } } },
  };
  const MONTH_HEADER_S = {
    font: { bold: true, sz: 9, color: { rgb: '374151' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: { bottom: { style: 'thin', color: { rgb: 'D1D5DB' } } },
  };
  const CELL_S = { font: { sz: 10 }, alignment: { vertical: 'center' } };
  const NUM_S  = { font: { sz: 10 }, alignment: { horizontal: 'right', vertical: 'center' }, numFmt: '#,##0' };
  const DATE_S = { font: { sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' } };

  const numericCols = new Set([5, 6, 7, 8, 9]); // 原価〜販売価格
  const dateCols    = new Set([11, 12, 13, 14]); // 販売開始日, 契約日, 価格変更日, 登録日

  const headerRow = [
    ...[...SALES_HEADERS].map(h => ({ v: h, s: HEADER_S })),
    ...months.map(m => ({
      v: `${m.getFullYear()}/${String(m.getMonth() + 1).padStart(2, '0')}`,
      s: MONTH_HEADER_S,
    })),
  ];

  const aoa: { v: string | number; s?: object }[][] = [
    headerRow,
    ...properties.map(p => {
      const fields = buildSalesRow(p, members).map((val, i) => {
        if (numericCols.has(i) && val !== '') return { v: parseInt(val, 10), s: NUM_S };
        if (dateCols.has(i)) return { v: val, s: DATE_S };
        return { v: val, s: CELL_S };
      });
      const gantt = buildSalesGanttCells(p, months);
      return [...fields, ...gantt];
    }),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa as never);
  ws['!cols'] = [
    { wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 10 }, { wch: 13 }, { wch: 13 },
    { wch: 18 }, { wch: 13 },
    ...months.map(() => ({ wch: 11 })),
  ];

  XLSX.utils.book_append_sheet(wb, ws, '販売計画');
  XLSX.writeFile(wb, filename);
}

function downloadCSV(rows: string[][], filename: string) {
  const csv = '\uFEFF' + rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
