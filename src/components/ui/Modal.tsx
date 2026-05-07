import { useEffect } from "react";
import Button from "./Button";

const sizeClasses = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "md" | "lg" | "xl";
}

export default function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
      <div
        className={`w-full ${sizeClasses[size]} rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col ${
          size === "xl" ? "max-h-[90vh]" : ""
        }`}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 shrink-0">
            <h2 className="font-semibold text-slate-100">{title}</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
        )}
        <div className={`p-5 ${size === "xl" ? "overflow-y-auto" : ""}`}>{children}</div>
      </div>
    </div>
  );
}
