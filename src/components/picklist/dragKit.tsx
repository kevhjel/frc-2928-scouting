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
 * browser never tries to scroll from it. That means we can start dragging
 * almost immediately instead of waiting for a long-press delay. One pointer
 * sensor covers mouse, touch and pen.
 */
export function useDragSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
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
    ? "relative z-20 bg-slate-800 ring-2 ring-blue-500/70 shadow-xl shadow-black/50 rounded-md"
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
  return (
    <div
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      className={`-my-2 -ml-3 w-11 shrink-0 self-stretch flex items-center justify-center text-xl leading-none select-none touch-none cursor-grab active:cursor-grabbing rounded-l-md transition-colors ${
        isDragging ? "text-blue-300 bg-blue-500/20" : "text-slate-500 active:text-blue-300 active:bg-blue-500/10"
      }`}
    >
      ⠿
    </div>
  );
}
