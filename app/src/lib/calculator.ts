import Decimal from "decimal.js"

/** Values are looked up as enrichi first, then source, so a computed field can shadow a raw column with the same name. */
export interface CalculationContext {
  source: Record<string, number | null>
  enrichi: Record<string, number | null>
}

type Associativity = "left" | "right"

const OPERATORS: Record<string, { precedence: number; associativity: Associativity }> = {
  "+": { precedence: 1, associativity: "left" },
  "-": { precedence: 1, associativity: "left" },
  "*": { precedence: 2, associativity: "left" },
  "/": { precedence: 2, associativity: "left" },
}

const NUMBER_PATTERN = /^\d+\.?\d*$/
const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const TOKEN_PATTERN = /(\d+\.?\d*|[a-zA-Z_][a-zA-Z0-9_]*|[+\-*/()])/

export class RuleSyntaxError extends Error {}

/** Splits on the token pattern and drops the whitespace/empty filler between captures. Whitespace is a
 *  separator, never stripped: stripping it would silently concatenate `a b` into the identifier `ab`. */
function tokenize(rule: string): string[] {
  return rule.split(TOKEN_PATTERN).filter((token) => token.trim() !== "")
}

/** Shunting-yard: converts infix tokens to reverse Polish notation so precedence/parens are resolved once, up front. */
function toReversePolishNotation(tokens: string[]): string[] {
  const output: string[] = []
  const operatorStack: string[] = []

  for (const token of tokens) {
    if (NUMBER_PATTERN.test(token) || IDENTIFIER_PATTERN.test(token)) {
      output.push(token)
    } else if (token in OPERATORS) {
      const operator = OPERATORS[token]
      while (
        operatorStack.length > 0 &&
        operatorStack[operatorStack.length - 1] in OPERATORS &&
        ((operator.associativity === "left" &&
          OPERATORS[operatorStack[operatorStack.length - 1]].precedence >= operator.precedence) ||
          (operator.associativity === "right" &&
            OPERATORS[operatorStack[operatorStack.length - 1]].precedence > operator.precedence))
      ) {
        output.push(operatorStack.pop() as string)
      }
      operatorStack.push(token)
    } else if (token === "(") {
      operatorStack.push(token)
    } else if (token === ")") {
      while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== "(") {
        output.push(operatorStack.pop() as string)
      }
      if (operatorStack.length === 0) {
        throw new RuleSyntaxError("Parentheses deseequilibrees")
      }
      operatorStack.pop()
    } else {
      throw new RuleSyntaxError(`Token invalide: ${token}`)
    }
  }

  while (operatorStack.length > 0) {
    const operator = operatorStack.pop() as string
    if (operator === "(") {
      throw new RuleSyntaxError("Parentheses deseequilibrees")
    }
    output.push(operator)
  }

  return output
}

function resolveIdentifier(identifier: string, context: CalculationContext): number | null {
  if (identifier in context.enrichi) {
    return context.enrichi[identifier]
  }
  if (identifier in context.source) {
    return context.source[identifier]
  }
  return null
}

/** Checks the reverse-Polish sequence is well-formed: every operator consumes two operands and exactly
 *  one operand remains. Catches arity errors (e.g. `a b`, `a +`) that a token-level check would miss. */
function validateRpnArity(rpn: string[]): string | null {
  let depth = 0
  for (const token of rpn) {
    if (token in OPERATORS) {
      if (depth < 2) return "Expression invalide"
      depth -= 1
    } else {
      depth += 1
    }
  }
  if (depth !== 1) return "Expression incomplete"
  return null
}

/**
 * Evaluates a `regle_calcul` expression (+ - * / and parentheses only) against source/enrichi field values.
 * Returns null instead of throwing on missing values, division by zero, or malformed syntax, so callers can
 * leave a field blank rather than break the whole fiche.
 */
export function evaluateRule(rule: string, context: CalculationContext): number | null {
  if (!rule || !rule.trim()) return null

  try {
    const rpn = toReversePolishNotation(tokenize(rule))
    const stack: Decimal[] = []

    for (const token of rpn) {
      if (NUMBER_PATTERN.test(token)) {
        stack.push(new Decimal(token))
        continue
      }

      if (IDENTIFIER_PATTERN.test(token)) {
        const value = resolveIdentifier(token, context)
        if (value === null || Number.isNaN(value)) return null
        stack.push(new Decimal(value))
        continue
      }

      if (stack.length < 2) return null
      const right = stack.pop() as Decimal
      const left = stack.pop() as Decimal

      switch (token) {
        case "+":
          stack.push(left.plus(right))
          break
        case "-":
          stack.push(left.minus(right))
          break
        case "*":
          stack.push(left.times(right))
          break
        case "/":
          if (right.isZero()) return null
          stack.push(left.dividedBy(right))
          break
        default:
          return null
      }
    }

    if (stack.length !== 1) return null
    return stack[0].toNumber()
  } catch {
    return null
  }
}

/** Champs calculés are stored rounded to the nearest integer per cahier des charges §7.5.4/§7.8.1. */
export function roundToInteger(value: number | null): number | null {
  if (value === null) return null
  return Math.round(value)
}

/**
 * Validates a rule's syntax and that every identifier resolves against the given field codes,
 * without requiring actual values (used by the admin CRUD form before saving a champ enrichissable).
 */
export function validateRuleSyntax(rule: string, knownFieldCodes: Set<string>): { valid: true } | { valid: false; error: string } {
  if (!rule || !rule.trim()) {
    return { valid: false, error: "La regle de calcul est vide" }
  }

  try {
    const tokens = tokenize(rule)
    const rpn = toReversePolishNotation(tokens)

    for (const token of rpn) {
      if (IDENTIFIER_PATTERN.test(token) && !NUMBER_PATTERN.test(token) && !knownFieldCodes.has(token)) {
        return { valid: false, error: `Champ inconnu: ${token}` }
      }
    }

    const arityError = validateRpnArity(rpn)
    if (arityError) {
      return { valid: false, error: arityError }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Regle invalide" }
  }
}
