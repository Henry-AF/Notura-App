"use client";

import React, { useState } from "react";
import type { Matcher } from "react-day-picker";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  maxDate?: Date;
  className?: string;
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Selecionar data",
  disabled = false,
  maxDate,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const disabledDays: Matcher | Matcher[] | undefined = maxDate
    ? { after: maxDate }
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between rounded-lg border-input bg-background px-3 py-2.5 text-left font-normal text-foreground hover:bg-accent",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span>{value ? formatDateLabel(value) : placeholder}</span>
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date);
            if (date) setOpen(false);
          }}
          disabled={disabledDays}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
