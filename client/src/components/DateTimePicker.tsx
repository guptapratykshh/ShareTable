import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { inputClass } from "./Form";
import { parseLocalDateTime, sameDay, toDateKey, toLocalDateTime } from "../utils/donationTimes";

const MINUTE_STEPS = [0, 15, 30, 45] as const;
const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function snapUp15(date: Date) {
  const next = new Date(date);
  const leftover = next.getMinutes() % 15;
  if (leftover || next.getSeconds() || next.getMilliseconds()) {
    next.setMinutes(next.getMinutes() + (leftover ? 15 - leftover : 0), 0, 0);
    if (!leftover) next.setMinutes(next.getMinutes() + 15, 0, 0);
  }
  return next;
}

function clampDate(date: Date, min?: Date | null, max?: Date | null) {
  if (min && date.getTime() < min.getTime()) return new Date(min);
  if (max && date.getTime() > max.getTime()) return new Date(max);
  return date;
}

function defaultTimeOnDay(day: Date, min?: Date | null, max?: Date | null) {
  let candidate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0, 0);
  if (min && sameDay(day, min)) candidate = snapUp15(min);
  return clampDate(candidate, min, max);
}

function hour12(hour24: number) {
  const hour = hour24 % 12;
  return hour === 0 ? 12 : hour;
}

function meridiemOf(hour24: number): "AM" | "PM" {
  return hour24 >= 12 ? "PM" : "AM";
}

function hour24(hour: number, meridiem: "AM" | "PM") {
  if (meridiem === "AM") return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
}

function formatTrigger(date: Date) {
  const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
  return `${day} · ${time}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

function calendarStart(view: Date) {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  return new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function chipClass(active: boolean) {
  return `rounded-full border px-3 py-2 text-[11px] font-bold transition-colors ${
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-transparent text-muted hover:border-primary hover:bg-primary hover:text-primary-foreground"
  }`;
}

export function DateTimePicker({
  value,
  onChange,
  min,
  max,
  dateLocked = false,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  dateLocked?: boolean;
}) {
  const selected = parseLocalDateTime(value);
  const minDate = min ? parseLocalDateTime(min) : null;
  const maxDate = max ? parseLocalDateTime(max) : null;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => startOfDay(selected ?? new Date()));
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320 });
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  useEffect(() => {
    const next = parseLocalDateTime(value);
    if (next) setView(startOfDay(next));
  }, [value]);

  function placePanel() {
    const trigger = rootRef.current?.getBoundingClientRect();
    if (!trigger) return;
    const width = Math.min(Math.max(trigger.width, 304), 360);
    const left = Math.min(Math.max(12, trigger.left), window.innerWidth - width - 12);
    const below = trigger.bottom + 8;
    const height = panelRef.current?.offsetHeight ?? 0;
    const roomBelow = window.innerHeight - 12 - below;
    const top = height > 0 && height > roomBelow && trigger.top - height - 8 >= 12 ? trigger.top - height - 8 : below;
    setPos({ top, left, width });
  }

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setView(startOfDay(selected ?? minDate ?? new Date()));
    placePanel();
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open) return;
    placePanel();
    const frame = requestAnimationFrame(() => placePanel());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("scroll", placePanel, true);
    };
  }, [open]);

  const days = useMemo(() => {
    const start = calendarStart(view);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [view]);

  function commit(next: Date) {
    onChange(toLocalDateTime(clampDate(next, minDate, maxDate)));
  }

  function pickDay(day: Date) {
    const next = selected
      ? new Date(day.getFullYear(), day.getMonth(), day.getDate(), selected.getHours(), selected.getMinutes())
      : defaultTimeOnDay(day, minDate, maxDate);
    commit(next);
  }

  function pickClock(nextHour24: number, minute: number) {
    const base = selected ?? defaultTimeOnDay(view, minDate, maxDate);
    commit(new Date(base.getFullYear(), base.getMonth(), base.getDate(), nextHour24, minute));
  }

  function dayDisabled(day: Date) {
    if (dateLocked && !sameDay(day, new Date())) return true;
    const start = startOfDay(day).getTime();
    if (minDate && start < startOfDay(minDate).getTime()) return true;
    if (maxDate && start > startOfDay(maxDate).getTime()) return true;
    return false;
  }

  function timeDisabled(hour: number, minute: number) {
    const base = selected ?? defaultTimeOnDay(view, minDate, maxDate);
    const candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute).getTime();
    if (minDate && candidate < minDate.getTime()) return true;
    if (maxDate && candidate > maxDate.getTime()) return true;
    return false;
  }

  const baseTime = selected ?? defaultTimeOnDay(view, minDate, maxDate);
  const hourValue24 = baseTime.getHours();
  const hourValue12 = hour12(hourValue24);
  const meridiem = meridiemOf(hourValue24);
  const minuteValue = selected
    ? MINUTE_STEPS.reduce((best, step) => (Math.abs(step - selected.getMinutes()) < Math.abs(best - selected.getMinutes()) ? step : best))
    : 0;

  function hour12Disabled(nextHour12: number) {
    const next24 = hour24(nextHour12, meridiem);
    return MINUTE_STEPS.every((minute) => timeDisabled(next24, minute));
  }

  function meridiemDisabled(next: "AM" | "PM") {
    return HOURS_12.every((hour) => MINUTE_STEPS.every((minute) => timeDisabled(hour24(hour, next), minute)));
  }

  const canPrevMonth = !dateLocked && !(minDate && new Date(view.getFullYear(), view.getMonth(), 1) <= startOfDay(minDate));
  const canNextMonth = !dateLocked && (!maxDate || new Date(view.getFullYear(), view.getMonth() + 1, 1) <= startOfDay(maxDate));

  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-labelledby={labelId}
          className="fixed z-[80] rounded-2xl border border-border bg-card p-3 shadow-[0_16px_40px_rgba(15,23,42,0.18)]"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {dateLocked ? (
            <div className="mb-3 rounded-xl bg-secondary px-3 py-2.5">
              <p id={labelId} className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
                Today
              </p>
              <p className="mt-1 text-sm font-extrabold">
                {new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-label="Previous month"
                  disabled={!canPrevMonth}
                  onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
                  className="grid size-8 place-items-center rounded-full text-muted hover:bg-secondary disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <p id={labelId} className="text-xs font-extrabold">
                  {monthLabel(view)}
                </p>
                <button
                  type="button"
                  aria-label="Next month"
                  disabled={!canNextMonth}
                  onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
                  className="grid size-8 place-items-center rounded-full text-muted hover:bg-secondary disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
                {WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="mb-3 grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const outside = day.getMonth() !== view.getMonth();
                  const disabled = dayDisabled(day);
                  const isSelected = selected ? sameDay(day, selected) : false;
                  const isToday = sameDay(day, new Date());
                  return (
                    <button
                      key={toDateKey(day)}
                      type="button"
                      disabled={disabled}
                      onClick={() => pickDay(day)}
                      className={`h-8 rounded-lg text-[12px] font-bold transition ${
                        isSelected
                          ? "bg-accent text-accent-foreground"
                          : isToday
                            ? "text-accent"
                            : outside
                              ? "text-muted/50"
                              : "text-foreground hover:bg-secondary"
                      } disabled:pointer-events-none disabled:opacity-25`}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {dateLocked && (
            <button
              type="button"
              onClick={() => pickDay(new Date())}
              className={`mb-3 h-9 w-full rounded-xl text-[12px] font-extrabold ${
                selected && sameDay(selected, new Date()) ? "bg-accent text-accent-foreground" : "bg-secondary text-foreground"
              }`}
            >
              Use today
            </button>
          )}

          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <label className="grid gap-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
              Hour
              <select
                className={`${inputClass} py-2.5`}
                value={hourValue12}
                onChange={(e) => pickClock(hour24(Number(e.target.value), meridiem), minuteValue)}
              >
                {HOURS_12.map((hour) => (
                  <option key={hour} value={hour} disabled={hour12Disabled(hour)}>
                    {hour}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
              Minute
              <select
                className={`${inputClass} py-2.5`}
                value={minuteValue}
                onChange={(e) => pickClock(hourValue24, Number(e.target.value))}
              >
                {MINUTE_STEPS.map((minute) => (
                  <option key={minute} value={minute} disabled={timeDisabled(hourValue24, minute)}>
                    {pad(minute)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">AM / PM</p>
              <div className="flex gap-1">
                {(["AM", "PM"] as const).map((period) => (
                  <button
                    key={period}
                    type="button"
                    disabled={meridiemDisabled(period)}
                    aria-pressed={meridiem === period}
                    className={`${chipClass(meridiem === period)} disabled:pointer-events-none disabled:opacity-30`}
                    onClick={() => pickClock(hour24(hourValue12, period), minuteValue)}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          toggle();
        }}
        className={`${inputClass} flex items-center justify-between gap-3 text-left font-normal`}
      >
        <span className={selected ? "text-foreground" : "text-muted"}>{selected ? formatTrigger(selected) : "Select date and time"}</span>
        <CalendarDays size={16} className="shrink-0 text-muted" aria-hidden />
      </button>
      {panel}
    </div>
  );
}
