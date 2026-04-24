"use client";
import { useState, useEffect } from "react";
import type { BlockedDateEntry } from "@/lib/types";

const DAYS = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"];
const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

interface Props {
  slug: string;
  onDateClick?: (date: Date) => void;
}

interface CalendarDay {
  date: Date;
  inMonth: boolean;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildCalendarGrid(year: number, month: number): CalendarDay[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const start = startOfWeek(firstDay);
  const end = startOfWeek(lastDay);
  // go to end of that last week
  const gridEnd = new Date(end);
  gridEnd.setDate(gridEnd.getDate() + 6);

  const weeks: CalendarDay[][] = [];
  let current = new Date(start);

  while (current <= gridEnd) {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({
        date: new Date(current),
        inMonth: current.getMonth() === month,
      });
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

function isBlocked(date: Date, blocked: BlockedDateEntry[]): boolean {
  const d = date.getTime();
  return blocked.some((b) => {
    const s = new Date(b.startDate).setHours(0, 0, 0, 0);
    const e = new Date(b.endDate).setHours(23, 59, 59, 999);
    return d >= s && d <= e;
  });
}

function weekBlockedRange(week: CalendarDay[], blocked: BlockedDateEntry[]): { start: number; end: number } | null {
  let start = -1;
  let end = -1;
  for (let i = 0; i < week.length; i++) {
    if (isBlocked(week[i].date, blocked)) {
      if (start === -1) start = i;
      end = i;
    }
  }
  if (start === -1) return null;
  return { start, end };
}

export default function Calendar({ slug, onDateClick }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [blocked, setBlocked] = useState<BlockedDateEntry[]>([]);

  useEffect(() => {
    fetch(`/api/availability?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data) => setBlocked(data))
      .catch(() => {});
  }, [slug]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  const weeks = buildCalendarGrid(year, month);

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        background: "var(--surface)",
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.75rem 1rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          onClick={goToday}
          style={{
            padding: "0.35rem 0.9rem",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--surface)",
            color: "var(--text)",
            cursor: "pointer",
            fontSize: "0.85rem",
            fontWeight: 500,
          }}
        >
          Heute
        </button>
        <button
          onClick={prevMonth}
          style={{
            padding: "0.35rem 0.6rem",
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "var(--muted)",
            fontSize: "1rem",
            lineHeight: 1,
          }}
          aria-label="Vorheriger Monat"
        >
          ‹
        </button>
        <button
          onClick={nextMonth}
          style={{
            padding: "0.35rem 0.6rem",
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "var(--muted)",
            fontSize: "1rem",
            lineHeight: 1,
          }}
          aria-label="Nächster Monat"
        >
          ›
        </button>
        <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text)" }}>
          {MONTHS[month]} {year}
        </span>
        <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "var(--muted)" }}>
          Monat
        </span>
      </div>

      {/* Day headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg2)",
        }}
      >
        {DAYS.map((d) => (
          <div
            key={d}
            style={{
              padding: "0.5rem 0",
              textAlign: "center",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--muted)",
              letterSpacing: "0.05em",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => {
        const range = weekBlockedRange(week, blocked);
        return (
          <div key={wi} style={{ borderBottom: "1px solid var(--border)" }}>
            {/* Day number row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {week.map((cell, di) => {
                const isToday = cell.date.getTime() === today.getTime();
                return (
                  <div
                    key={di}
                    onClick={() => onDateClick?.(cell.date)}
                    style={{
                      padding: "0.5rem 0.5rem 0.25rem",
                      minHeight: "3.5rem",
                      cursor: onDateClick ? "pointer" : "default",
                      opacity: cell.inMonth ? 1 : 0.35,
                      position: "relative",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "1.75rem",
                        height: "1.75rem",
                        borderRadius: "50%",
                        fontSize: "0.85rem",
                        fontWeight: isToday ? 700 : 400,
                        background: isToday ? "var(--primary)" : "transparent",
                        color: isToday ? "var(--btn-text)" : "var(--text)",
                      }}
                    >
                      {cell.date.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Blocked banner for this week */}
            {range && (
              <div style={{ padding: "0 0 0.35rem", position: "relative" }}>
                <div
                  style={{
                    marginLeft: `calc(${range.start} * (100% / 7))`,
                    width: `calc(${range.end - range.start + 1} * (100% / 7))`,
                    background: "var(--blocked-bg)",
                    color: "var(--blocked-text)",
                    fontSize: "0.72rem",
                    fontWeight: 500,
                    padding: "0.2rem 0.5rem",
                    borderRadius: "3px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  nicht verfügbar
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
