import * as XLSX from 'xlsx-js-style';
import type { Property, Member } from '../types';

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

function isTaskInMonth(startDate: string | null, endDate: string | null, month: Date): boolean {
  if (!startDate || !endDate) return false;
  const ms = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
  const me = new Date(month.getFullYear(), month.getMonth() + 1, 0).getTime();
  const ts = new Date(startDate).getTime();
  const te = new Date(endDate).getTime();
  return ts <= me && te >= ms;
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
      // ヘッダー行
      [
        { v: '工程名', s: HEADER_S },
        { v: '開始日', s: HEADER_S },
        { v: '終了日', s: HEADER_S },
        ...months.map(m => ({
          v: `${m.getFullYear()}/${String(m.getMonth() + 1).padStart(2, '0')}`,
          s: HEADER_S,
        })),
      ],
      // タスク行
      ...property.tasks.map(task => [
        { v: task.name,           s: TASK_NAME_S },
        { v: task.startDate ?? '', s: DATE_S },
        { v: task.endDate   ?? '', s: DATE_S },
        ...months.map(m => {
          const active = isTaskInMonth(task.startDate, task.endDate, m);
          return {
            v: '',
            s: active
              ? { fill: { patternType: 'solid', fgColor: { rgb: hexToRgb(task.color) } } }
              : {},
          };
        }),
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // 列幅
    ws['!cols'] = [
      { wch: 22 }, // 工程名
      { wch: 11 }, // 開始日
      { wch: 11 }, // 終了日
      ...months.map(() => ({ wch: 5 })),
    ];

    // 行高さ（ヘッダー行=row5=index4）
    ws['!rows'] = [];
    for (let i = 0; i < 5 + property.tasks.length; i++) {
      (ws['!rows'] as unknown[])[i] = { hpt: i === 4 ? 28 : 18 };
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  XLSX.writeFile(wb, 'cecela_物件一覧.xlsx');
}

// ===== CSV 一括出力（月別ガントチャート付き）=====
export function exportAllToCSV(properties: Property[], members: Member[]) {
  const months = buildMonthList(properties);
  const monthLabels = months.map(m => `${m.getFullYear()}/${String(m.getMonth() + 1).padStart(2, '0')}`);

  const rows: string[][] = [
    ['物件ID', '物件名', '担当者', '工程名', '開始日', '終了日', ...monthLabels],
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
        ...months.map(m => isTaskInMonth(task.startDate, task.endDate, m) ? '●' : ''),
      ]);
    }
  }

  const csv = '\uFEFF' + rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cecela_物件一覧.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ===== 単一物件CSV出力（GanttChartから呼ぶ）=====
export function exportPropertyToCSV(property: Property, members: Member[]) {
  const assignee = getAssigneeName(property, members);
  const months = buildMonthList([property]);
  const monthLabels = months.map(m => `${m.getFullYear()}/${String(m.getMonth() + 1).padStart(2, '0')}`);

  const rows: string[][] = [
    ['物件ID', '物件名', '担当者', '工程名', '開始日', '終了日', ...monthLabels],
    ...property.tasks.map(task => [
      property.id,
      property.name,
      assignee,
      task.name,
      task.startDate ?? '',
      task.endDate   ?? '',
      ...months.map(m => isTaskInMonth(task.startDate, task.endDate, m) ? '●' : ''),
    ]),
  ];

  const csv = '\uFEFF' + rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${property.id}_${property.name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
