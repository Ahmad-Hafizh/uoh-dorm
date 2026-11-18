"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plane } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AIRPORTS, formatAirportLabel, type Airport } from "@/lib/airports";
import { useI18n } from "@/context/I18nContext";

interface AirportComboboxProps {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function AirportCombobox({
  value,
  onChange,
  disabled = false,
  className,
  id,
}: AirportComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const { t, lang } = useI18n();

  const selectedAirport = React.useMemo(() => {
    if (!value) return null;
    return (
      AIRPORTS.find(
        (a) =>
          a.iata.toLowerCase() === value.toLowerCase() ||
          value.toUpperCase().includes(a.iata)
      ) || null
    );
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between text-start font-normal h-10 px-3",
            !value && "text-muted-foreground",
            className
          )}
          data-testid="airport-combobox-trigger"
        >
          <div className="flex items-center gap-2 truncate">
            <Plane className="h-4 w-4 shrink-0 text-primary opacity-70" />
            <span className="truncate">
              {selectedAirport
                ? `${selectedAirport.iata} · ${selectedAirport.city}, ${selectedAirport.country}`
                : value || t("select_destination")}
            </span>
          </div>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] sm:w-[420px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder={t("search_destination")}
            data-testid="airport-search-input"
          />
          <CommandList>
            <CommandEmpty>{t("no_data")}</CommandEmpty>
            <CommandGroup heading={t("destination")}>
              {AIRPORTS.map((airport) => {
                const label = formatAirportLabel(airport, lang as "ar" | "en");
                const isSelected =
                  selectedAirport?.iata === airport.iata ||
                  value === `${airport.iata} - ${airport.city}, ${airport.country}`;
                return (
                  <CommandItem
                    key={airport.iata}
                    value={`${airport.iata} ${airport.city} ${airport.country} ${airport.country_ar || ""} ${airport.name}`}
                    onSelect={() => {
                      const formatted = `${airport.iata} - ${airport.city}, ${airport.country}`;
                      onChange(formatted);
                      setOpen(false);
                    }}
                    data-testid={`airport-option-${airport.iata}`}
                    className="flex items-center justify-between cursor-pointer py-2 px-3"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 font-medium text-sm">
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono font-bold">
                          {airport.iata}
                        </span>
                        <span className="truncate">
                          {airport.city}, {airport.country}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {airport.name}
                      </span>
                    </div>
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0 text-primary",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
