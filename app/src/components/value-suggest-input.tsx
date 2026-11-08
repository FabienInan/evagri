"use client"

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"

const MAX_VISIBLE = 200

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/**
 * Champ texte avec suggestions de valeurs (ex. MRC) : les noms qui commencent par la saisie passent en tête,
 * puis ceux qui la contiennent. Pour un filtre multi-valeurs, la suggestion porte sur le segment après la dernière
 * virgule. Flèches pour naviguer, Enter/Tab pour insérer, Échap pour fermer. La saisie reste libre.
 */
export function ValueSuggestInput({
  value,
  onChange,
  options,
  placeholder,
  multiValue = false,
}: {
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  placeholder?: string
  /** Virgule = séparateur de valeurs (opérateur « in »). */
  multiValue?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [caret, setCaret] = useState(0)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const segmentStart = useMemo(() => {
    if (!multiValue) return 0
    const beforeCaret = value.slice(0, caret)
    return beforeCaret.lastIndexOf(",") + 1
  }, [value, caret, multiValue])

  const segment = value.slice(segmentStart, caret).replace(/^\s+/, "")

  const suggestions = useMemo(() => {
    if (!segment) return []
    const needle = normalize(segment)
    const prefix: string[] = []
    const inside: string[] = []
    for (const option of options) {
      const key = normalize(option)
      if (key.startsWith(needle)) prefix.push(option)
      else if (key.includes(needle)) inside.push(option)
      if (prefix.length + inside.length >= MAX_VISIBLE) break
    }
    return [...prefix, ...inside].slice(0, MAX_VISIBLE)
  }, [options, segment])

  const isOpen = open && suggestions.length > 0
  const current = suggestions[Math.min(activeIndex, suggestions.length - 1)]

  // La liste défile : l'option active reste visible quand on navigue aux flèches.
  useEffect(() => {
    if (!isOpen || !current) return
    document.getElementById(`${listId}-${current}`)?.scrollIntoView({ block: "nearest" })
  }, [isOpen, current, listId])

  function syncCaret() {
    setCaret(inputRef.current?.selectionStart ?? 0)
  }

  function accept(option: string) {
    const start = segmentStart + (value.slice(segmentStart, caret).length - segment.length)
    const next = value.slice(0, start) + option + value.slice(caret)
    const nextCaret = start + option.length
    onChange(next)
    setOpen(false)
    setCaret(nextCaret)
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(nextCaret, nextCaret))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === "Enter" || event.key === "Tab") {
      if (current) {
        event.preventDefault()
        accept(current)
      }
    } else if (event.key === "Escape") {
      event.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      <Input
        ref={inputRef}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 text-sm"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setCaret(e.target.selectionStart ?? e.target.value.length)
          setActiveIndex(0)
          setOpen(true)
        }}
        onSelect={syncCaret}
        onClick={syncCaret}
        onKeyUp={syncCaret}
        onKeyDown={handleKeyDown}
        onBlur={() => setOpen(false)}
        onFocus={() => {
          syncCaret()
          setOpen(true)
        }}
      />
      {isOpen && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-md"
        >
          {suggestions.map((option, index) => (
            <li
              key={option}
              id={`${listId}-${option}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault()
                accept(option)
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`cursor-pointer rounded px-2 py-1.5 text-sm ${index === activeIndex ? "bg-muted" : ""}`}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
