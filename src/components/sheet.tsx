"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { XIcon } from "./icons";

/**
 * iOS-style bottom sheet: glass thick material, grabber, drag-to-dismiss,
 * backdrop fade, system easing. Content scrolls inside the sheet.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  // External systems only: lock body scroll, Escape closes. No state syncing here —
  // the panel below is mounted fresh on every open, so its drag state starts at 0.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Close"
        className="animate-fade absolute inset-0 bg-black/35"
        onClick={onClose}
        tabIndex={-1}
      />
      <SheetPanel onClose={onClose} title={title}>
        {children}
      </SheetPanel>
    </div>
  );
}

function SheetPanel({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const [translateY, setTranslateY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    startY.current = e.clientY;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setTranslateY(Math.max(0, e.clientY - startY.current));
    },
    [dragging],
  );

  const onPointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    const panelHeight = panelRef.current?.offsetHeight ?? 600;
    if (translateY > panelHeight * 0.28) onClose();
    else setTranslateY(0);
  }, [dragging, translateY, onClose]);

  return (
    <div
      ref={panelRef}
      className="material material-thick animate-sheet relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[var(--radius-sheet)]"
      style={{
        transform: `translateY(${translateY}px)`,
        transition: dragging ? "none" : "transform 0.42s var(--ease-ios)",
      }}
      role="dialog"
      aria-modal="true"
    >
      {/* grabber — drag anywhere on the header to dismiss */}
      <div
        className="shrink-0 cursor-grab touch-none px-5 pt-3 pb-2 active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[var(--color-hair)]" />
        {title && (
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-[17px] font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="press grid h-8 w-8 place-items-center rounded-full bg-[var(--color-hair)] text-[var(--color-ink-2)]"
              aria-label="Close sheet"
            >
              <XIcon size={16} />
            </button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-[calc(env(safe-area-inset-bottom) + 24px)]">
        {children}
      </div>
    </div>
  );
}
