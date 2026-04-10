"use client";

import * as React from "react";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={ptBR}
      className={cn("p-1", className)}
      classNames={{
        root: "rdp",
        months: "flex flex-col gap-4 sm:flex-row",
        month: "space-y-3",
        month_caption: "relative flex items-start justify-center pb-1 pt-1",
        caption_label: "text-sm font-semibold text-foreground",
        nav: "flex items-center gap-1",
        button_previous: cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "absolute left-1 top-1 h-7 w-7 p-0 text-foreground"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "absolute right-1 top-1 h-7 w-7 p-0 text-foreground"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 text-center text-[0.75rem] font-medium uppercase tracking-[0.08em] text-muted-foreground",
        week: "mt-1 flex w-full",
        day: "h-9 w-9 p-0 text-center text-sm [&:has([aria-selected])]:rounded-md",
        day_button: cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "h-9 w-9 p-0 font-normal text-foreground"
        ),
        selected: "rounded-md bg-primary text-primary-foreground hover:bg-primary/90",
        today: "",
        outside: "text-muted-foreground/50",
        disabled: "text-muted-foreground/40 opacity-60",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ className: iconClassName, orientation, ...iconProps }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("h-4 w-4", iconClassName)} {...iconProps} />;
          }
          return <ChevronRight className={cn("h-4 w-4", iconClassName)} {...iconProps} />;
        },
      }}
      {...props}
    />
  );
}
