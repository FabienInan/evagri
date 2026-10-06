"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { Popover as PopoverPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * A Select-like dropdown that lets several values be picked at once. The trigger shows the current
 * selections joined by ", " (or the placeholder when empty); the panel is a checklist of options.
 * Used wherever a MULTI_SELECT enrichment value is entered, so it reads as a select everywhere.
 */
export function MultiSelect({
  options,
  selected,
  onChange,
  disabled,
  placeholder = "Sélectionner...",
  invalid,
  describedBy,
  className,
}: {
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  placeholder?: string
  invalid?: boolean
  describedBy?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)

  function toggle(option: string) {
    onChange(selected.includes(option) ? selected.filter((value) => value !== option) : [...selected, option])
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-left text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          className
        )}
      >
        <span className={cn("line-clamp-1 min-w-0", selected.length === 0 && "text-muted-foreground")}>
          {selected.length === 0 ? placeholder : selected.join(", ")}
        </span>
        <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
          <div role="listbox" aria-multiselectable="true">
            {options.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">Aucune option</p>
            ) : (
              options.map((option) => {
                const isSelected = selected.includes(option)
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggle(option)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border",
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                      )}
                    >
                      {isSelected && <CheckIcon className="size-3" />}
                    </span>
                    <span className="min-w-0 truncate">{option}</span>
                  </button>
                )
              })
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
