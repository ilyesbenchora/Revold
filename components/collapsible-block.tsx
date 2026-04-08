"use client";

import { useState, ReactNode } from "react";

type Props = {
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function CollapsibleBlock({ title, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="group flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex-1">{title}</div>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition group-hover:bg-slate-100 group-hover:text-slate-600">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${open ? "" : "-rotate-90"}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      {open && <div className="space-y-4">{children}</div>}
    </div>
  );
}
