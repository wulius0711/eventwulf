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
  selectedStart?: Date | null;
  selectedEnd?: Date | null;
  onRangeChange?: (start: Date | null, end: Date | null) => void;
  showCapacity?: boolean;
}

interface CalendarDay {
  date: Date;
  inMonth: boolean;
}

function toDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(date: Date): Date {
  const d = toDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function buildGrid(year: number, month: number): CalendarDay[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const start = startOfWeek(firstDay);
  const end = startOfWeek(lastDay);
  end.setDate(end.getDate() + 6);

  const weeks: CalendarDay[][] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: new Date(cur), inMonth: cur.getMonth() === month });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function isBlocked(date: Date, blocked: BlockedDateEntry[]) {
  const t = date.getTime();
  return blocked.some((b) => {
    const s = new Date(b.startDate).setHours(0, 0, 0, 0);
    const e = new Date(b.endDate).setHours(23, 59, 59, 999);
    return t >= s && t <= e;
  });
}

function inRange(date: Date, start: Date | null, end: Date | null, hover: Date | null) {
  if (!start) return false;
  const lo = toDay(start);
  const hi = end ? toDay(end) : hover ? toDay(hover) : null;
  if (!hi) return false;
  const d = toDay(date);
  const [a, b] = lo <= hi ? [lo, hi] : [hi, lo];
  return d > a && d < b;
}

function isRangeEdge(date: Date, start: Date | null, end: Date | null, hover: Date | null) {
  if (!start) return false;
  const d = toDay(date).getTime();
  const s = toDay(start).getTime();
  const e = end ? toDay(end).getTime() : hover ? toDay(hover).getTime() : null;
  return d === s || (e !== null && d === e);
}

function weekBlockedRange(week: CalendarDay[], entries: BlockedDateEntry[]) {
  const blocked = entries.filter((e) => e.type === "blocked");
  let start = -1, end = -1;
  for (let i = 0; i < week.length; i++) {
    if (isBlocked(week[i].date, blocked)) {
      if (start === -1) start = i;
      end = i;
    }
  }
  return start === -1 ? null : { start, end };
}

function weekEvents(week: CalendarDay[], entries: BlockedDateEntry[]) {
  const events = entries.filter((e) => e.type === "event");
  return events.flatMap((ev) => {
    let start = -1, end = -1;
    for (let i = 0; i < week.length; i++) {
      const t = week[i].date.getTime();
      const s = new Date(ev.startDate).setHours(0, 0, 0, 0);
      const e = new Date(ev.endDate).setHours(23, 59, 59, 999);
      if (t >= s && t <= e) {
        if (start === -1) start = i;
        end = i;
      }
    }
    return start === -1 ? [] : [{
      start, end, label: ev.label, color: ev.color || "#16a34a",
      startDate: ev.startDate, endDate: ev.endDate,
      maxCapacity: ev.maxCapacity ?? null, bookedCount: ev.bookedCount ?? 0,
    }];
  });
}

export default function Calendar({ slug, selectedStart, selectedEnd, onRangeChange, showCapacity }: Props) {
  const [today, setToday] = useState<Date | null>(null);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [blocked, setBlocked] = useState<BlockedDateEntry[]>([]);
  const [hover, setHover] = useState<Date | null>(null);
  // local selection when used standalone (no onRangeChange)
  const [localStart, setLocalStart] = useState<Date | null>(selectedStart ?? null);
  const [localEnd, setLocalEnd] = useState<Date | null>(selectedEnd ?? null);

  const selStart = onRangeChange ? (selectedStart ?? null) : localStart;
  const selEnd = onRangeChange ? (selectedEnd ?? null) : localEnd;

  const [tooltip, setTooltip] = useState<{ label: string; start: string; end: string; x: number; y: number } | null>(null);

  useEffect(() => { setToday(toDay(new Date())); }, []);

  useEffect(() => {
    fetch(`/api/availability?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then(setBlocked).catch(() => {});
  }, [slug]);

  function handleDayClick(date: Date) {
    if (isBlocked(date, blocked)) return;
    const d = toDay(date);

    let newStart = selStart;
    let newEnd = selEnd;

    if (!selStart || (selStart && selEnd)) {
      // fresh start
      newStart = d;
      newEnd = null;
    } else {
      // second click
      const s = toDay(selStart);
      if (d.getTime() === s.getTime()) {
        newStart = null;
        newEnd = null;
      } else if (d < s) {
        newStart = d;
        newEnd = s;
      } else {
        newEnd = d;
      }
    }

    if (onRangeChange) {
      onRangeChange(newStart, newEnd);
    } else {
      setLocalStart(newStart);
      setLocalEnd(newEnd);
    }
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const weeks = buildGrid(year, month);

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", overflow: "hidden", userSelect: "none" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => { if (today) { setMonth(today.getMonth()); setYear(today.getFullYear()); } }}
          style={{ padding: "0.3rem 0.8rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface)", cursor: "pointer", fontSize: "0.82rem", fontWeight: 500 }}>
          Heute
        </button>
        <button onClick={prevMonth} style={{ padding: "0.3rem 0.6rem", border: "none", background: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1.1rem" }}>‹</button>
        <button onClick={nextMonth} style={{ padding: "0.3rem 0.6rem", border: "none", background: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1.1rem" }}>›</button>
        <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{MONTHS[month]} {year}</span>
        {selStart && (
          <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--primary-text)", fontWeight: 500 }}>
            {selStart.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" })}
            {selEnd ? ` – ${selEnd.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" })}` : " →"}
          </span>
        )}
      </div>

      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "var(--bg2)", borderBottom: "1px solid var(--border)" }}>
        {DAYS.map(d => (
          <div key={d} style={{ padding: "0.4rem 0", textAlign: "center", fontSize: "0.72rem", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em" }}>{d}</div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => {
        const blockedRange = weekBlockedRange(week, blocked);
        const events = weekEvents(week, blocked);
        return (
          <div key={wi} style={{ borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
              {week.map((cell, di) => {
                const isToday = today !== null && cell.date.getTime() === today.getTime();
                const blocked_ = isBlocked(cell.date, blocked);
                const edge = isRangeEdge(cell.date, selStart, selEnd, hover);
                const between = inRange(cell.date, selStart, selEnd, hover);
                const isStart = selStart && toDay(cell.date).getTime() === toDay(selStart).getTime();
                const isEnd = selEnd && toDay(cell.date).getTime() === toDay(selEnd).getTime();


                return (
                  <div
                    key={di}
                    onClick={() => handleDayClick(cell.date)}
                    onMouseEnter={() => selStart && !selEnd && setHover(cell.date)}
                    onMouseLeave={() => setHover(null)}
                    style={{
                      padding: "0.4rem 0.3rem 0.3rem",
                      minHeight: "3rem",
                      cursor: blocked_ ? "not-allowed" : "pointer",
                      opacity: cell.inMonth ? 1 : 0.3,
                      background: between ? "var(--primary-dim)" : "transparent",
                      borderRadius: isStart ? "6px 0 0 6px" : isEnd ? "0 6px 6px 0" : undefined,
                      transition: "background 0.1s",
                    }}
                  >
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "1.7rem",
                      height: "1.7rem",
                      borderRadius: "50%",
                      fontSize: "0.82rem",
                      fontWeight: isToday ? 700 : 400,
                      background: edge ? "var(--primary)" : isToday ? "var(--text)" : "transparent",
                      color: edge ? "var(--btn-text)" : isToday ? "#fff" : blocked_ ? "var(--muted)" : "var(--text)",
                      textDecoration: blocked_ ? "line-through" : "none",
                    }}>
                      {cell.date.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Blocked banner */}
            {(blockedRange || events.length > 0) && (
              <div style={{ padding: "0 0 0.35rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                {blockedRange && (
                  <div style={{ position: "relative", height: "1.2rem" }}>
                    <div style={{
                      position: "absolute",
                      left: `calc(${blockedRange.start} * (100% / 7))`,
                      width: `calc(${blockedRange.end - blockedRange.start + 1} * (100% / 7))`,
                      background: "var(--primary)",
                      color: "var(--btn-text)",
                      fontSize: "0.68rem",
                      fontWeight: 500,
                      padding: "0.15rem 0.5rem",
                      borderRadius: "3px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      nicht verfügbar
                    </div>
                  </div>
                )}
                {events.map((ev, ei) => (
                  <div key={ei} style={{ position: "relative", height: "1.2rem" }}>
                    <div
                      onMouseEnter={(e) => setTooltip({ label: ev.label, start: ev.startDate, end: ev.endDate, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setTooltip(null)}
                      style={{
                        position: "absolute",
                        left: `calc(${ev.start} * (100% / 7))`,
                        width: `calc(${ev.end - ev.start + 1} * (100% / 7))`,
                        background: ev.color,
                        color: "#fff",
                        fontSize: "0.68rem",
                        fontWeight: 500,
                        padding: "0.15rem 0.5rem",
                        borderRadius: "3px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        cursor: "default",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{ev.label}</span>
                      {showCapacity && ev.maxCapacity != null && (
                        <span style={{
                          flexShrink: 0,
                          background: "rgba(0,0,0,0.25)",
                          borderRadius: "3px",
                          padding: "0 0.3rem",
                          fontSize: "0.62rem",
                        }}>
                          {ev.maxCapacity - ev.bookedCount} frei
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Event tooltip */}
      {tooltip && (
        <div style={{
          position: "fixed",
          top: tooltip.y + 14,
          left: tooltip.x + 10,
          background: "#1a1612",
          color: "#fff",
          padding: "0.4rem 0.75rem",
          borderRadius: "6px",
          fontSize: "0.78rem",
          lineHeight: 1.5,
          pointerEvents: "none",
          zIndex: 9999,
          whiteSpace: "nowrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        }}>
          <strong>{tooltip.label}</strong><br />
          {new Date(tooltip.start + "T12:00:00").toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" })}
          {" – "}
          {new Date(tooltip.end + "T12:00:00").toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" })}
        </div>
      )}

      {/* Legend */}
      {onRangeChange && (
        <div style={{ padding: "0.6rem 1rem", borderTop: "1px solid var(--border)", fontSize: "0.75rem", color: "var(--muted)" }}>
          {!selStart ? "Anreisedatum auswählen" : !selEnd ? "Abreisedatum auswählen" : "Zeitraum gewählt — klicke zum Ändern"}
        </div>
      )}
    </div>
  );
}
