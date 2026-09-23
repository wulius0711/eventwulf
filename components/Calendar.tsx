"use client";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
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
  roomId?: string;
  // Narrows down which rooms' events show up before a specific room is
  // picked (roomId still wins once set) — mirrors the room picker's own
  // `raeume` filter so a filtered embed's calendar doesn't leak events from
  // rooms it isn't even offering. See app/api/availability/route.ts.
  roomIds?: string[];
  onInvalidSelectionCleared?: () => void;
}

// Exported for direct testing (see calendar-blocked-label.spec.ts) — the
// bug this fixed (Sperrzeit labels never reaching the calendar banner) sits
// entirely in this pure computation, no DOM/browser rendering needed to
// verify it.
export interface CalendarDay {
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

// Only real Sperrzeiten and "intern" Events actually block the calendar —
// "extern" Events are informational only (see weekEvents banners below).
function blocksCalendar(e: BlockedDateEntry) {
  return e.type === "blocked" || e.intern === true;
}

function findBlockedEntry(date: Date, blocked: BlockedDateEntry[]): BlockedDateEntry | undefined {
  const t = date.getTime();
  return blocked.filter(blocksCalendar).find((b) => {
    const s = new Date(b.startDate).setHours(0, 0, 0, 0);
    const e = new Date(b.endDate).setHours(23, 59, 59, 999);
    return t >= s && t <= e;
  });
}

function isBlocked(date: Date, blocked: BlockedDateEntry[]) {
  return findBlockedEntry(date, blocked) !== undefined;
}

function hasBlockedBetween(a: Date, b: Date, blocked: BlockedDateEntry[]) {
  const lo = Math.min(a.getTime(), b.getTime());
  const hi = Math.max(a.getTime(), b.getTime());
  return blocked.filter(blocksCalendar).some((bl) => {
    const s = new Date(bl.startDate).setHours(0, 0, 0, 0);
    const e = new Date(bl.endDate).setHours(23, 59, 59, 999);
    return s <= hi && e >= lo;
  });
}

function isRangeEdge(date: Date, start: Date | null, end: Date | null, hover: Date | null) {
  if (!start) return false;
  const d = toDay(date).getTime();
  const s = toDay(start).getTime();
  const e = end ? toDay(end).getTime() : hover ? toDay(hover).getTime() : null;
  return d === s || (e !== null && d === e);
}

export function weekBlockedRange(week: CalendarDay[], entries: BlockedDateEntry[]) {
  // A "silent" block (e.g. a room's own assigned Event) still disables the days via
  // isBlocked()/blocksCalendar() elsewhere — it just skips this redundant "nicht
  // verfügbar" banner, since the Event's own colored banner already explains why.
  const blocked = entries.filter((e) => e.type === "blocked" && !e.silent);
  let start = -1, end = -1;
  let matched: BlockedDateEntry | undefined;
  for (let i = 0; i < week.length; i++) {
    const entry = findBlockedEntry(week[i].date, blocked);
    if (entry) {
      if (start === -1) { start = i; matched = entry; }
      end = i;
    }
  }
  // Known limitation, not something this fix changes: this still draws one
  // merged bar per week regardless of how many distinct Sperrzeit entries
  // contributed to it (unlike weekEvents() below, which draws one banner
  // per entry) — two separate, non-adjacent blocked ranges in the same week
  // show only the first (earliest) one's label. Splitting this into
  // per-entry banners like events would be a separate, larger change.
  return start === -1 || !matched
    ? null
    : { start, end, label: matched.label, startDate: matched.startDate, endDate: matched.endDate };
}

// Selected-range pill drawn once per row (like weekBlockedRange/weekEvents below),
// instead of per-cell, so the rounded caps never have to line up across cell boundaries.
function weekSelectedRange(week: CalendarDay[], start: Date | null, end: Date | null, hover: Date | null) {
  if (!start) return null;
  const lo = toDay(start);
  const hi = end ? toDay(end) : hover ? toDay(hover) : lo;
  const [a, b] = lo <= hi ? [lo, hi] : [hi, lo];
  let startCol = -1, endCol = -1;
  for (let i = 0; i < week.length; i++) {
    const t = toDay(week[i].date).getTime();
    if (t >= a.getTime() && t <= b.getTime()) {
      if (startCol === -1) startCol = i;
      endCol = i;
    }
  }
  if (startCol === -1) return null;
  return {
    startCol,
    endCol,
    roundLeft: toDay(week[startCol].date).getTime() === a.getTime(),
    roundRight: toDay(week[endCol].date).getTime() === b.getTime(),
  };
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
      showCapacity: ev.showCapacity ?? false, roomName: ev.roomName ?? null,
    }];
  });
}

export default function Calendar({ slug, selectedStart, selectedEnd, onRangeChange, roomId, roomIds, onInvalidSelectionCleared }: Props) {
  const [today, setToday] = useState<Date | null>(null);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [blocked, setBlocked] = useState<BlockedDateEntry[]>([]);
  const [hover, setHover] = useState<Date | null>(null);
  const [localStart, setLocalStart] = useState<Date | null>(selectedStart ?? null);
  const [localEnd, setLocalEnd] = useState<Date | null>(selectedEnd ?? null);
  const [slideClass, setSlideClass] = useState("");
  const gridKey = useRef(0);

  const selStart = onRangeChange ? (selectedStart ?? null) : localStart;
  const selEnd = onRangeChange ? (selectedEnd ?? null) : localEnd;

  const [tooltip, setTooltip] = useState<{ label: string; start: string; end: string; roomName: string | null; x: number; y: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current) return;
    const el = tooltipRef.current;
    const margin = 8;
    const overflowRight = el.getBoundingClientRect().right - (window.innerWidth - margin);
    if (overflowRight > 0) {
      el.style.left = `${el.getBoundingClientRect().left - overflowRight}px`;
    }
  }, [tooltip]);

  useEffect(() => { setToday(toDay(new Date())); }, []);

  useEffect(() => {
    const roomParam = roomId ? `&roomId=${encodeURIComponent(roomId)}` : "";
    const roomsFilterParam = roomIds?.length ? `&raeume=${encodeURIComponent(roomIds.join(","))}` : "";
    fetch(`/api/availability?slug=${encodeURIComponent(slug)}${roomParam}${roomsFilterParam}`)
      .then((r) => r.json())
      .then((data: BlockedDateEntry[]) => {
        setBlocked(data);
        // A date range picked before choosing this room (or while a different room
        // was selected) can conflict with its availability — clear it rather than
        // leave a stale, now-invalid selection standing until the submit-time check.
        if (onRangeChange && selStart) {
          const stillValid = selEnd ? !hasBlockedBetween(selStart, selEnd, data) : !isBlocked(selStart, data);
          if (!stillValid) { onRangeChange(null, null); onInvalidSelectionCleared?.(); }
        }
      })
      .catch(() => {});
    // Only refetch on slug/room change — selStart/selEnd are read for validation at
    // that moment, not tracked as their own trigger (handleDayClick already guards
    // new picks against the current `blocked` state).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, roomId, roomIds]);

  function navigate(dir: "prev" | "next") {
    gridKey.current += 1;
    setSlideClass(dir === "next" ? "cal-slide-next" : "cal-slide-prev");
    if (dir === "next") {
      if (month === 11) { setMonth(0); setYear(y => y + 1); }
      else setMonth(m => m + 1);
    } else {
      if (month === 0) { setMonth(11); setYear(y => y - 1); }
      else setMonth(m => m - 1);
    }
  }

  function handleDayClick(date: Date) {
    if (isBlocked(date, blocked)) return;
    if (today && toDay(date) < today) return;
    const d = toDay(date);
    let newStart = selStart;
    let newEnd = selEnd;

    if (!selStart || (selStart && selEnd)) {
      if (selStart && selEnd && toDay(selStart).getTime() === d.getTime() && toDay(selEnd).getTime() === d.getTime()) {
        newStart = null; newEnd = null;
      } else {
        newStart = d; newEnd = null;
      }
    } else {
      const s = toDay(selStart);
      if (d.getTime() === s.getTime()) { newEnd = s; }
      else if (d < s) {
        if (hasBlockedBetween(d, s, blocked)) return;
        newStart = d; newEnd = s;
      } else {
        if (hasBlockedBetween(s, d, blocked)) return;
        newEnd = d;
      }
    }

    if (onRangeChange) { onRangeChange(newStart, newEnd); }
    else { setLocalStart(newStart); setLocalEnd(newEnd); }
  }

  const weeks = buildGrid(year, month);

  return (
    <div style={{
      borderRadius: "var(--radius-lg)",
      background: "var(--surface)",
      userSelect: "none",
      boxShadow: "var(--shadow-card)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
        <button
          className="ew-cal-today-btn"
          onClick={() => { if (today) { const dir = (today.getFullYear() * 12 + today.getMonth()) < (year * 12 + month) ? "prev" : "next"; navigate(dir); setMonth(today.getMonth()); setYear(today.getFullYear()); } }}>
          Heute
        </button>
        <button className="ew-cal-nav-btn" onClick={() => navigate("prev")} aria-label="Vorheriger Monat">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: "block" }}>
            <path d="M10 3L5.5 8L10 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="ew-cal-nav-btn" onClick={() => navigate("next")} aria-label="Nächster Monat">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: "block" }}>
            <path d="M6 3L10.5 8L6 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{MONTHS[month]} {year}</span>
        {selStart && (
          <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--primary-text)", fontWeight: 500 }}>
            {selStart.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" })}
            {selEnd ? ` – ${selEnd.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" })}` : " →"}
          </span>
        )}
      </div>

      {/* Weekday headers */}
      <div className="ew-cal-weekday-header" style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "var(--primary)" }}>
        {DAYS.map(d => (
          <div key={d} style={{ padding: "0.5rem 0", textAlign: "center", fontSize: "0.72rem", fontWeight: 600, color: "var(--btn-text)", letterSpacing: "0.05em" }}>{d}</div>
        ))}
      </div>

      {/* Weeks */}
      <div key={gridKey.current} className={slideClass} onAnimationEnd={() => setSlideClass("")}>
        {weeks.map((week, wi) => {
          const blockedRange = weekBlockedRange(week, blocked);
          const events = weekEvents(week, blocked);
          const selRange = weekSelectedRange(week, selStart, selEnd, hover);
          return (
            <div key={wi} style={{ position: "relative", borderBottom: "1px solid var(--border)" }}>
              {/* Weekend columns (SA/SO) are always the last two of a Monday-start week.
                  Spans the whole row height — including the blocked/event banner strip
                  below the day numbers — not just the day-number grid, so the tint
                  doesn't visibly cut off above a "nicht verfügbar"/event banner. */}
              <div style={{ position: "absolute", top: 0, bottom: 0, left: "calc(5 * (100% / 7))", width: "calc(2 * (100% / 7))", background: "rgba(0,0,0,0.05)" }} />
              <div className="ew-cal-week-row" style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", position: "relative" }}>
                {selRange && (
                  <div style={{
                    gridColumn: `${selRange.startCol + 1} / ${selRange.endCol + 2}`,
                    gridRow: 1,
                    background: "var(--primary-dim)",
                    borderRadius: `${selRange.roundLeft ? "999px" : "0"} ${selRange.roundRight ? "999px" : "0"} ${selRange.roundRight ? "999px" : "0"} ${selRange.roundLeft ? "999px" : "0"}`,
                  }} />
                )}
                {week.map((cell, di) => {
                  const isToday = today !== null && cell.date.getTime() === today.getTime();
                  const isPast = today !== null && toDay(cell.date) < today;
                  const blocked_ = isBlocked(cell.date, blocked);
                  const disabled_ = blocked_ || isPast;
                  const edge = isRangeEdge(cell.date, selStart, selEnd, hover);
                  const inSelRange = !!selRange && di >= selRange.startCol && di <= selRange.endCol;

                  return (
                    <div
                      key={di}
                      className={!disabled_ ? `ew-cal-day${inSelRange ? " ew-cal-day--pill" : ""}` : undefined}
                      onClick={() => handleDayClick(cell.date)}
                      onMouseEnter={() => {
                        if (selStart && !selEnd && !hasBlockedBetween(toDay(selStart), toDay(cell.date), blocked))
                          setHover(cell.date);
                        else if (selStart && !selEnd)
                          setHover(null);
                      }}
                      onMouseLeave={() => setHover(null)}
                      style={{
                        gridColumn: di + 1,
                        gridRow: 1,
                        position: "relative",
                        padding: "0.4rem 0.3rem 0.3rem",
                        minHeight: "3rem",
                        cursor: disabled_ ? "not-allowed" : "pointer",
                        opacity: !cell.inMonth ? 0.3 : isPast && !blocked_ ? 0.4 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span style={{
                        position: "relative",
                        boxSizing: "border-box",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "1.7rem",
                        height: "1.7rem",
                        borderRadius: "50%",
                        fontSize: "0.82rem",
                        fontWeight: isToday || edge ? 700 : 400,
                        background: edge ? "var(--primary)" : "transparent",
                        border: edge ? "none" : isToday ? "1.5px solid var(--primary)" : "1.5px solid transparent",
                        color: edge ? "var(--btn-text)" : disabled_ ? "var(--muted)" : "var(--text)",
                        textDecoration: blocked_ ? "line-through" : "none",
                      }}>
                        {cell.date.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Blocked / event banners */}
              {(blockedRange || events.length > 0) && (
                <div style={{ position: "relative", padding: "0 0 0.35rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  {blockedRange && (
                    <div style={{ position: "relative", height: "1.2rem" }}>
                      <div
                        onMouseEnter={(e) => setTooltip({ label: blockedRange.label || "nicht verfügbar", start: blockedRange.startDate, end: blockedRange.endDate, roomName: null, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setTooltip(null)}
                        style={{
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
                          cursor: "default",
                        }}>
                        {blockedRange.label || "nicht verfügbar"}
                      </div>
                    </div>
                  )}
                  {events.map((ev, ei) => (
                    <div key={ei} style={{ position: "relative", height: "1.2rem" }}>
                      <div
                        onMouseEnter={(e) => setTooltip({ label: ev.label, start: ev.startDate, end: ev.endDate, roomName: ev.roomName, x: e.clientX, y: e.clientY })}
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
                        {ev.showCapacity && ev.maxCapacity != null && (
                          <span style={{
                            flexShrink: 0,
                            background: "var(--overlay-sm)",
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
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div ref={tooltipRef} style={{
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
          boxShadow: "var(--shadow-tooltip)",
        }}>
          <strong>{tooltip.label}</strong><br />
          {new Date(tooltip.start).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}
          {" – "}
          {new Date(tooltip.end).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}
          {tooltip.roomName && <><br />{tooltip.roomName}</>}
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
