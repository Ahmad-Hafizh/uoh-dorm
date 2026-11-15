"use client";

import * as React from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useI18n } from "@/context/I18nContext";

// Helper: Format Date to YYYY-MM-DD
export function toISODateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper: Parse YYYY-MM-DD into Date object
export function parseISODate(str?: string | null): Date | null {
  if (!str) return null;
  const parts = str.split("-");
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const date = new Date(y, m, d);
  return isNaN(date.getTime()) ? null : date;
}

// Helper: Format Date for Display (e.g. 15 Nov 2026)
export function formatDisplayDate(dateStr?: string | null, lang: string = "en"): string {
  if (!dateStr) return "";
  const d = parseISODate(dateStr);
  if (!d) return dateStr;
  try {
    return d.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ─── Single Date Picker (Shadcn UI) ──────────────────────────────
interface DatePickerProps {
  value?: string | null;
  onChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder,
  disabled = false,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const { t, lang } = useI18n();

  const selectedDate = React.useMemo(() => parseISODate(value), [value]);
  const minDateObj = React.useMemo(() => parseISODate(minDate), [minDate]);
  const maxDateObj = React.useMemo(() => parseISODate(maxDate), [maxDate]);

  // Current view month & year
  const [viewDate, setViewDate] = React.useState<Date>(() => {
    return selectedDate || new Date();
  });

  React.useEffect(() => {
    if (selectedDate) {
      setViewDate(selectedDate);
    }
  }, [selectedDate]);

  const monthNames = React.useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(2026, i, 1);
      return d.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { month: "long" });
    });
  }, [lang]);

  const weekDayNames = React.useMemo(() => {
    return ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  }, []);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  // Calendar grid calculation
  const calendarDays = React.useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isoString: string;
      disabled: boolean;
    }> = [];

    // Prev month overflow
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      const iso = toISODateString(d);
      const isDis = (minDateObj ? d < minDateObj : false) || (maxDateObj ? d > maxDateObj : false);
      days.push({ date: d, isCurrentMonth: false, isoString: iso, disabled: isDis });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const iso = toISODateString(d);
      const isDis = (minDateObj ? d < minDateObj : false) || (maxDateObj ? d > maxDateObj : false);
      days.push({ date: d, isCurrentMonth: true, isoString: iso, disabled: isDis });
    }

    // Next month overflow
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const iso = toISODateString(d);
      const isDis = (minDateObj ? d < minDateObj : false) || (maxDateObj ? d > maxDateObj : false);
      days.push({ date: d, isCurrentMonth: false, isoString: iso, disabled: isDis });
    }

    return days;
  }, [viewDate, minDateObj, maxDateObj]);

  const displayLabel = value
    ? formatDisplayDate(value, lang)
    : placeholder || t("departure_date");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-start font-normal h-10 px-3",
            !value && "text-muted-foreground",
            className
          )}
          data-testid="single-date-picker-trigger"
        >
          <CalendarIcon className="me-2 h-4 w-4 text-primary opacity-70 shrink-0" />
          <span className="truncate">{displayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[300px] p-3 z-[99999] shadow-xl border-slate-200 bg-white"
        align="start"
      >
        <div className="space-y-3">
          {/* Calendar Header */}
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-800">
              {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handlePrevMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleNextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
            {weekDayNames.map((w, idx) => (
              <span key={idx}>{w}</span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((item, idx) => {
              const isSelected = value === item.isoString;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    onChange(item.isoString);
                    setOpen(false);
                  }}
                  className={cn(
                    "h-8 w-8 text-xs font-medium rounded-md flex items-center justify-center transition-colors",
                    !item.isCurrentMonth && "text-slate-300",
                    item.isCurrentMonth && !isSelected && "text-slate-700 hover:bg-slate-100",
                    isSelected && "bg-primary text-primary-foreground font-bold shadow-sm",
                    item.disabled && "cursor-not-allowed opacity-30 hover:bg-transparent"
                  )}
                >
                  {item.date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Date Picker with Range (Shadcn UI) ───────────────────────────
interface DateRangePickerProps {
  from?: string | null;
  to?: string | null;
  onChange: (range: { from: string; to: string }) => void;
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function DateRangePicker({
  from,
  to,
  onChange,
  minDate,
  maxDate,
  placeholder,
  disabled = false,
  className,
  id,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const { t, lang } = useI18n();

  const fromDate = React.useMemo(() => parseISODate(from), [from]);
  const toDate = React.useMemo(() => parseISODate(to), [to]);
  const minDateObj = React.useMemo(() => parseISODate(minDate), [minDate]);
  const maxDateObj = React.useMemo(() => parseISODate(maxDate), [maxDate]);

  // Current view month & year
  const [viewDate, setViewDate] = React.useState<Date>(() => {
    return fromDate || new Date();
  });

  // Local state for selecting range in progress
  const [tempFrom, setTempFrom] = React.useState<string | null>(from || null);
  const [tempTo, setTempTo] = React.useState<string | null>(to || null);
  const [hoverDate, setHoverDate] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTempFrom(from || null);
    setTempTo(to || null);
    if (from) {
      const d = parseISODate(from);
      if (d) setViewDate(d);
    }
  }, [from, to, open]);

  const monthNames = React.useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(2026, i, 1);
      return d.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { month: "long" });
    });
  }, [lang]);

  const weekDayNames = React.useMemo(() => {
    return ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  }, []);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  // Calendar grid calculation
  const calendarDays = React.useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isoString: string;
      disabled: boolean;
    }> = [];

    // Prev month overflow
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      const iso = toISODateString(d);
      const isDis = (minDateObj ? d < minDateObj : false) || (maxDateObj ? d > maxDateObj : false);
      days.push({ date: d, isCurrentMonth: false, isoString: iso, disabled: isDis });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const iso = toISODateString(d);
      const isDis = (minDateObj ? d < minDateObj : false) || (maxDateObj ? d > maxDateObj : false);
      days.push({ date: d, isCurrentMonth: true, isoString: iso, disabled: isDis });
    }

    // Next month overflow
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const iso = toISODateString(d);
      const isDis = (minDateObj ? d < minDateObj : false) || (maxDateObj ? d > maxDateObj : false);
      days.push({ date: d, isCurrentMonth: false, isoString: iso, disabled: isDis });
    }

    return days;
  }, [viewDate, minDateObj, maxDateObj]);

  const handleDayClick = (iso: string) => {
    // If no start date, or both dates are already set, start a new range
    if (!tempFrom || (tempFrom && tempTo)) {
      setTempFrom(iso);
      setTempTo(null);
    } else if (tempFrom && !tempTo) {
      // Second click
      if (iso < tempFrom) {
        // Clicked earlier date, swap or reset from
        setTempFrom(iso);
        setTempTo(null);
      } else {
        setTempTo(iso);
        onChange({ from: tempFrom, to: iso });
        setOpen(false);
      }
    }
  };

  const displayLabel = React.useMemo(() => {
    if (from && to) {
      return `${formatDisplayDate(from, lang)} — ${formatDisplayDate(to, lang)}`;
    }
    if (from) {
      return `${formatDisplayDate(from, lang)} — ...`;
    }
    return placeholder || (lang === "ar" ? "تاريخ المغادرة والعودة" : "Departure & Return Date");
  }, [from, to, lang, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-start font-normal h-10 px-3",
            !from && "text-muted-foreground",
            className
          )}
          data-testid="date-range-picker-trigger"
        >
          <CalendarIcon className="me-2 h-4 w-4 text-primary opacity-70 shrink-0" />
          <span className="truncate">{displayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-3 z-[99999] shadow-xl border-slate-200 bg-white"
        align="start"
      >
        <div className="space-y-3">
          {/* Calendar Header */}
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <div>
              <span className="text-sm font-semibold text-slate-800">
                {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
              </span>
              <span className="text-[10px] text-muted-foreground block -mt-0.5">
                {!tempFrom
                  ? (lang === "ar" ? "اختر تاريخ المغادرة" : "Select departure date")
                  : !tempTo
                  ? (lang === "ar" ? "اختر تاريخ العودة" : "Select return date")
                  : (lang === "ar" ? "فترة الرحلة المحددة" : "Selected trip range")}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handlePrevMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleNextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-muted-foreground">
            {weekDayNames.map((w, idx) => (
              <span key={idx}>{w}</span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-y-1 gap-x-0">
            {calendarDays.map((item, idx) => {
              const isStart = tempFrom === item.isoString;
              const isEnd = tempTo === item.isoString;
              const inSelectedRange =
                tempFrom && tempTo && item.isoString > tempFrom && item.isoString < tempTo;
              const inHoverRange =
                tempFrom &&
                !tempTo &&
                hoverDate &&
                hoverDate > tempFrom &&
                item.isoString > tempFrom &&
                item.isoString <= hoverDate;

              return (
                <div
                  key={idx}
                  className={cn(
                    "h-8 flex items-center justify-center p-0 transition-colors",
                    (inSelectedRange || inHoverRange) && "bg-primary/10",
                    isStart && tempTo && "bg-gradient-to-r from-transparent to-primary/10 rounded-s-md",
                    isEnd && tempFrom && "bg-gradient-to-l from-transparent to-primary/10 rounded-e-md"
                  )}
                  onMouseEnter={() => !tempTo && setHoverDate(item.isoString)}
                >
                  <button
                    type="button"
                    disabled={item.disabled}
                    onClick={() => handleDayClick(item.isoString)}
                    className={cn(
                      "h-8 w-8 text-xs font-medium rounded-md flex items-center justify-center transition-colors",
                      !item.isCurrentMonth && "text-slate-300",
                      item.isCurrentMonth &&
                        !isStart &&
                        !isEnd &&
                        !inSelectedRange &&
                        "text-slate-700 hover:bg-slate-100",
                      (isStart || isEnd) &&
                        "bg-primary text-primary-foreground font-bold shadow-sm rounded-md",
                      item.disabled && "cursor-not-allowed opacity-30 hover:bg-transparent"
                    )}
                  >
                    {item.date.getDate()}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Range summary footer */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-muted-foreground">
            <div>
              {tempFrom && (
                <span>
                  {formatDisplayDate(tempFrom, lang)} {tempTo ? `→ ${formatDisplayDate(tempTo, lang)}` : ""}
                </span>
              )}
            </div>
            {tempFrom && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-1.5 text-muted-foreground hover:text-slate-900"
                onClick={() => {
                  setTempFrom(null);
                  setTempTo(null);
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
