"use client";

import { useEffect, useState } from "react";

type LocalDayDividerProps = {
  date: string;
  previousDate?: string;
  colSpan: number;
};

const localDayKey = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return [date.getFullYear(), date.getMonth(), date.getDate()].join("-");
};

/** Inserts a date divider using the viewer's browser timezone, not the server timezone. */
export function LocalDayDivider({
  date,
  previousDate,
  colSpan,
}: LocalDayDividerProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  if (!ready || localDayKey(date) === localDayKey(previousDate ?? "")) {
    return null;
  }

  const localDate = new Date(date);
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 pt-5 pb-2">
        <div className="flex items-center gap-3 text-xs text-amber-100/70">
          <span className="h-px flex-1 bg-amber-200/20" />
          <span className="rounded-full border border-amber-200/20 bg-amber-200/[0.06] px-3 py-1">
            {localDate.toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "short",
            })}
          </span>
          <span className="h-px flex-1 bg-amber-200/20" />
        </div>
      </td>
    </tr>
  );
}
