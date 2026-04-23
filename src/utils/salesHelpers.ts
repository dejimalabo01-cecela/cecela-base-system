import type { Property, Task } from '../types';

/**
 * 物件の工程から「販売」タスクを探す（名前に "販売" を含む最初の非表示でないタスク）。
 * 見つからなければ null。
 */
export function findSaleTask(property: Property): Task | null {
  return property.tasks.find(t => !t.hidden && t.name.includes('販売')) ?? null;
}

/**
 * 物件の販売開始日を返す。
 *  1. 工程管理の「販売」タスクに startDate があればそれ
 *  2. なければ property.saleStartDate（kintone連携や手入力のフォールバック）
 */
export function getSaleStartDate(property: Property): string | null {
  const saleTask = findSaleTask(property);
  if (saleTask?.startDate) return saleTask.startDate;
  return property.saleStartDate ?? null;
}

/**
 * どのソース（工程管理タスク or 手入力）から販売開始日が取れているかを返す。
 * UI上の表示に使う。
 */
export function getSaleStartSource(property: Property): 'task' | 'fallback' | 'none' {
  const saleTask = findSaleTask(property);
  if (saleTask?.startDate) return 'task';
  if (property.saleStartDate) return 'fallback';
  return 'none';
}
