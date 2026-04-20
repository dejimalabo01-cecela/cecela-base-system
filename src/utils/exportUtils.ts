import * as XLSX from 'xlsx';
import type { Property, Member } from '../types';

function getAssigneeName(property: Property, members: Member[]): string {
  return members.find(m => m.id === property.assigneeId)?.name ?? '';
}

// 複数物件を1つのExcelファイル（物件ごとにシート）にエクスポート
export function exportAllToExcel(properties: Property[], members: Member[]) {
  const wb = XLSX.utils.book_new();

  for (const property of properties) {
    const assignee = getAssigneeName(property, members);
    const data = [
      ['物件ID', property.id],
      ['物件名', property.name],
      ['担当者', assignee],
      ['登録日', new Date(property.createdAt).toLocaleDateString('ja-JP')],
      [],
      ['工程名', '開始日', '終了日'],
      ...property.tasks.map(t => [t.name, t.startDate ?? '', t.endDate ?? '']),
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);

    // 列幅設定
    ws['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 14 }];

    // シート名はExcelの制限で31文字まで・使用不可文字を除去
    const sheetName = property.name
      .replace(/[:\\/?*[\]]/g, '')
      .slice(0, 31) || property.id;

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  XLSX.writeFile(wb, 'cecela_物件一覧.xlsx');
}

// 複数物件を1つのCSVにエクスポート（全物件まとめて）
export function exportAllToCSV(properties: Property[], members: Member[]) {
  const rows: string[][] = [
    ['物件ID', '物件名', '担当者', '工程名', '開始日', '終了日'],
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
        task.endDate ?? '',
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
