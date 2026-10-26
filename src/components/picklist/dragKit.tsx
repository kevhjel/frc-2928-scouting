import type React from "react";
import type { HTMLAttributes } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DraggableAttributes,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/**
 * Drag only starts from the handle, which has `touch-action: none`, so the
 * browser never tries to scroll from it. The drag starts on whichever comes
 * first: a 4px move, or holding still for 100ms. One pointer sensor covers
 * mouse, touch and pen.
 */
export function useDragSensors() {
  return useSensors(
    useSensor(PointerSensor, {
      // Large tolerance so a quick first flick doesn't cancel the hold timer
      activationConstraint: { distance: 4, delay: 100, tolerance: 60 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

/**
 * Highlight the row the instant a finger lands on its handle. This edits the
 * DOM directly instead of going through React, so it paints right away even
 * if the page is busy rendering.
 */
function markPressed(handle: HTMLElement) {
  const row = handle.closest<HTMLElement>("[data-drag-row]");
  if (!row) return;
  row.classList.add("drag-pressed");
  const clear = () => {
    row.classList.remove("drag-pressed");
    window.removeEventListener("pointerup", clear);
    window.removeEventListener("pointercancel", clear);
  };
  window.addEventListener("pointerup", clear);
  window.addEventListener("pointercancel", clear);
}

/** A short buzz on phones that support it, so you can feel the row lift. */
export function dragStartHaptic() {
  try {
    navigator.vibrate?.(10);
  } catch {
    // not supported — ignore
  }
}

/** Extra row classes while a row is being dragged. */
export function draggingRowClass(isDragging: boolean) {
  return isDragging
    ? "relative z-20 bg-slate-800 ring-2 ring-blue-500/70 shadow-md shadow-black/40 rounded-md"
    : "";
}

/** Big, easy-to-grab drag handle (44px wide, full row height). */
export function DragHandle({
  attributes,
  listeners,
  isDragging,
}: {
  attributes: DraggableAttributes;
  listeners: HTMLAttributes<HTMLElement> | undefined;
  isDragging: boolean;
}) {
  const onPointerDown = listeners?.onPointerDown as
    | ((e: React.PointerEvent<HTMLElement>) => void)
    | undefined;
  return (
    <div
      {...attributes}
      {...listeners}
      onPointerDown={(e) => {
        markPressed(e.currentTarget);
        onPointerDown?.(e);
      }}
      // Stop Android's long-press menu / text selection from hijacking the hold
      onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
      aria-label="Drag to reorder"
      className={`-my-2 -ml-3 w-11 shrink-0 self-stretch flex items-center justify-center text-xl leading-none select-none touch-none cursor-grab active:cursor-grabbing rounded-l-md transition-colors ${
        isDragging ? "text-blue-300 bg-blue-500/20" : "text-slate-500 active:text-blue-300 active:bg-blue-500/10"
      }`}
    >
      ⠿
    </div>
  );
}
