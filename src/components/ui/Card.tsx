import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean;
}

export default function Card({ className = "", padding = true, children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl bg-slate-900 border border-slate-800 ${padding ? "p-4" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
