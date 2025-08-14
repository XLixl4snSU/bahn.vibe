import * as React from "react"
import { addDays } from "date-fns"
import { de } from "date-fns/locale"
import { DateRange } from "react-day-picker"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Button } from "./button"

interface DatePickerWithRangeProps {
  value: { from?: Date; to?: Date }
  onChange: (range: { from?: Date; to?: Date }) => void
  maxDays?: number
}

export function DatePickerWithRange({ value, onChange, maxDays = 30 }: DatePickerWithRangeProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal"
        >
          {value.from && value.to
            ? `${value.from.toLocaleDateString('de-DE')} – ${value.to.toLocaleDateString('de-DE')}`
            : "Zeitraum wählen"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          initialFocus
          mode="range"
          selected={{ from: value.from, to: value.to } as DateRange}
          onSelect={range => {
            if (range && range.from && range.to) {
              const diff = (range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24) + 1
              if (diff > maxDays) return // Maximal 30 Tage
            }
            onChange(range || {})
          }}
          numberOfMonths={2}
          locale={de}
          weekStartsOn={1}
        />
      </PopoverContent>
    </Popover>
  )
}
