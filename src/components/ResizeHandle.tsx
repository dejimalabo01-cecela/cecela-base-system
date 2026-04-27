import { useEffect, useRef } from 'react';

interface Props {
  /** 現在の幅(px)を取得する関数。リサイズ開始時に呼ばれる。 */
  getCurrent: () => number;
  /** ドラッグ中・終了時に新しい幅(px)で呼ばれる。 */
  onResize: (newWidth: number) => void;
  /** ホバー/操作中の見た目を調整したいときに（オプション）。 */
  className?: string;
}

/**
 * 列見出しの右端に置く、ドラッグで列幅を変えるための小さなハンドル。
 * 親要素には `position: relative` を付けてください。
 */
export function ResizeHandle({ getCurrent, onResize, className }: Props) {
  const draggingRef = useRef(false);

  // クリーンアップ用にハンドラを保持（マウントされている間は再生成しない）
  useEffect(() => {
    return () => {
      // 念のためクリーンアップ
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    const startX = e.clientX;
    const startWidth = getCurrent();

    function onMove(ev: PointerEvent) {
      if (!draggingRef.current) return;
      const newWidth = startWidth + (ev.clientX - startX);
      onResize(newWidth);
    }
    function onUp() {
      draggingRef.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      role="separator"
      aria-orientation="vertical"
      className={
        'absolute top-0 bottom-0 w-1.5 cursor-col-resize select-none ' +
        'hover:bg-blue-400/60 active:bg-blue-500/80 z-20 ' +
        (className ?? '')
      }
      style={{ right: '-3px' }}
    />
  );
}
