"use client"

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"

/** Un champ utilisable dans une règle de calcul : son code machine (ce qu'on écrit) et son libellé (ce qu'on lit). */
export interface RuleFieldOption {
  code: string
  label: string
}

/** Identifiant en cours de frappe, juste avant le curseur (ex. « prix_v » dans « prix_vente / prix_v »). */
const TRAILING_TOKEN = /[a-zA-Z_][a-zA-Z0-9_]*$/

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/**
 * Champ « Règle de calcul » avec suggestions : en tapant les premières lettres d'un code, la liste propose les
 * champs décimaux ou entiers correspondants, pour éviter les fautes de frappe. Enter/Tab insèrent, flèches
 * naviguent, Échap ferme. La saisie reste libre : un code inconnu est refusé à l'enregistrement, comme avant.
 */
export function RegleCalculInput({
  value,
  onChange,
  options,
  excludeCode,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  options: RuleFieldOption[]
  /** Code du champ en cours d'édition : un champ ne peut pas se référencer lui-même. */
  excludeCode?: string
  placeholder?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [caret, setCaret] = useState(0)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const token = useMemo(() => {
    const match = value.slice(0, caret).match(TRAILING_TOKEN)
    return match ? match[0] : ""
  }, [value, caret])

  const suggestions = useMemo(() => {
    if (!token) return []
    const needle = normalize(token)
    return options
      .filter((o) => o.code !== excludeCode)
      .filter((o) => normalize(o.code).startsWith(needle) || normalize(o.label).includes(needle))
      .sort((a, b) => {
        // Les codes qui commencent par la saisie passent avant ceux qui la contiennent seulement.
        const aPrefix = normalize(a.code).startsWith(needle) ? 0 : 1
        const bPrefix = normalize(b.code).startsWith(needle) ? 0 : 1
        return aPrefix - bPrefix || a.code.localeCompare(b.code)
      })
  }, [options, token, excludeCode])

  const isOpen = open && suggestions.length > 0
  const current = suggestions[Math.min(activeIndex, suggestions.length - 1)]

  // La liste défile : l'option active doit rester visible quand on navigue aux flèches.
  useEffect(() => {
    if (!isOpen || !current) return
    document.getElementById(`${listId}-${current.code}`)?.scrollIntoView({ block: "nearest" })
  }, [isOpen, current, listId])

  function syncCaret() {
    setCaret(inputRef.current?.selectionStart ?? 0)
  }

  function accept(option: RuleFieldOption) {
    const start = caret - token.length
    const next = value.slice(0, start) + option.code + value.slice(caret)
    const nextCaret = start + option.code.length
    onChange(next)
    setOpen(false)
    setCaret(nextCaret)
    // Le curseur doit suivre l'insertion une fois le rendu fait.
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
    <div className="relative">
      <Input
        ref={inputRef}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={isOpen && current ? `${listId}-${current.code}` : undefined}
        autoComplete="off"
        spellCheck={false}
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
        onFocus={syncCaret}
      />
      {isOpen && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-md"
        >
          {suggestions.map((option, index) => (
            <li
              key={option.code}
              id={`${listId}-${option.code}`}
              role="option"
              aria-selected={index === activeIndex}
              // mousedown plutôt que click : évite que le champ perde le focus avant l'insertion.
              onMouseDown={(e) => {
                e.preventDefault()
                accept(option)
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-1.5 text-sm ${
                index === activeIndex ? "bg-muted" : ""
              }`}
            >
              <span className="font-mono text-foreground">{option.code}</span>
              <span className="truncate text-xs text-muted-foreground">{option.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
