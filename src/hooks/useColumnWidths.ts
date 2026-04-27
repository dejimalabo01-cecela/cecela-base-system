import { useCallback, useEffect, useState } from 'react';

const MIN_WIDTH = 40;
const MAX_WIDTH = 800;

/**
 * 列幅の状態管理＋localStorage 永続化を共通化するフック。
 * - キー名は画面ごとにユニークに（例: 'colw:property-list', 'colw:sales-plan'）
 * - 戻り値の `widths` は px 単位の数値マップ
 * - `setWidth` は最小/最大値でクランプ
 */
export function useColumnWidths<K extends string>(
  storageKey: string,
  initial: Record<K, number>,
): {
  widths: Record<K, number>;
  setWidth: (key: K, width: number) => void;
  reset: () => void;
} {
  const [widths, setWidths] = useState<Record<K, number>>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // 保存値の中で initial に存在するキーだけマージ（古いキーを取り込まない）
        const merged = { ...initial };
        for (const k of Object.keys(initial) as K[]) {
          const v = parsed[k];
          if (typeof v === 'number' && Number.isFinite(v)) merged[k] = v;
        }
        return merged;
      }
    } catch {
      /* ignore */
    }
    return initial;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(widths));
    } catch {
      /* ignore quota errors */
    }
  }, [widths, storageKey]);

  const setWidth = useCallback((key: K, width: number) => {
    setWidths(prev => ({
      ...prev,
      [key]: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(width))),
    }));
  }, []);

  const reset = useCallback(() => {
    setWidths(initial);
  }, [initial]);

  return { widths, setWidth, reset };
}
