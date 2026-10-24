import Decimal from "decimal.js"
import type { TypeDonneesChamp } from "@/types/champ"

/** A computed field resolves its identifiers against the flat field map (imported + saisissable + calculé). */
export interface CalculationContext {
  fields: Record<string, number | null>
}

type Associativity = "left" | "right"

const OPERATORS: Record<string, { precedence: number; associativity: Associativity }> = {
  "+": { precedence: 1, associativity: "left" },
  "-": { precedence: 1, associativity: "left" },
  "*": { precedence: 2, associativity: "left" },
  "/": { precedence: 2, associativity: "left" },
}

const NUMBER_PATTERN = /^(\d+\.?\d*|\.\d+)$/
const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const TOKEN_PATTERN = /(\d+\.?\d*|\.\d+|[a-zA-Z_][a-zA-Z0-9_]*|[+\-*/()])/

const NUMERIC_TYPES: ReadonlySet<string> = new Set<TypeDonneesChamp>(["DECIMAL", "ENTIER"])

export class RuleSyntaxError extends Error {}

/** Only DECIMAL and ENTIER fields can take part in a calculation. */
export function isNumericTypeDonnees(typeDonnees: TypeDonneesChamp): boolean {
  return NUMERIC_TYPES.has(typeDonnees)
}

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
    } else if (Object.hasOwn(OPERATORS, token)) {
      const operator = OPERATORS[token]
      while (operatorStack.length > 0 && isOperatorOnStack(operatorStack[operatorStack.length - 1])) {
        const top = OPERATORS[operatorStack[operatorStack.length - 1]]
        const shouldPop =
          operator.associativity === "left" ? top.precedence >= operator.precedence : top.precedence > operator.precedence
        if (!shouldPop) break
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
        throw new RuleSyntaxError("Parenthèses déséquilibrées")
      }
      operatorStack.pop()
    } else {
      throw new RuleSyntaxError(`Caractère non autorisé : « ${token.trim()} »`)
    }
  }

  while (operatorStack.length > 0) {
    const operator = operatorStack.pop() as string
    if (operator === "(") {
      throw new RuleSyntaxError("Parenthèses déséquilibrées")
    }
    output.push(operator)
  }

  return output
}

function isOperatorOnStack(token: string): boolean {
  return Object.hasOwn(OPERATORS, token)
}

function resolveIdentifier(identifier: string, context: CalculationContext): number | null {
  if (Object.hasOwn(context.fields, identifier)) {
    return context.fields[identifier]
  }
  return null
}

/** Checks the reverse-Polish sequence is well-formed: every operator consumes two operands and exactly
 *  one operand remains. Catches arity errors (e.g. `a b`, `a +`, `-5`) that a token-level check would miss. */
function validateRpnArity(rpn: string[]): string | null {
  let depth = 0
  for (const token of rpn) {
    if (isOperatorOnStack(token)) {
      if (depth < 2) {
        return "Un opérateur n'a pas deux opérandes (les nombres négatifs ne sont pas acceptés, écrivez 0 - x)"
      }
      depth -= 1
    } else {
      depth += 1
    }
  }
  if (depth !== 1) return "Expression incomplète : un opérande ou un opérateur manque"
  return null
}

/**
 * Evaluates a `regle_calcul` expression (+ - * / and parentheses only) against the flat field map.
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

/** Stored precision follows the field type: an ENTIER rounds to the unit, a DECIMAL keeps 2 decimals. */
export function roundForType(value: number | null, typeDonnees: TypeDonneesChamp): number | null {
  if (value === null) return null
  if (typeDonnees === "ENTIER") return Math.round(value)
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
}

/** Identifiers a rule reads, in order of appearance. Empty for a malformed rule (see validateRuleSyntax). */
export function ruleIdentifiers(rule: string): string[] {
  try {
    return toReversePolishNotation(tokenize(rule)).filter((token) => IDENTIFIER_PATTERN.test(token))
  } catch {
    return []
  }
}

/**
 * Validates a rule's syntax and that every identifier is a numeric field of the given catalogue
 * (code -> typeDonnees), without requiring actual values. Used by the admin CRUD form before saving a champ.
 */
export function validateRuleSyntax(
  rule: string,
  knownFields: ReadonlyMap<string, TypeDonneesChamp>
): { valid: true } | { valid: false; error: string } {
  if (!rule || !rule.trim()) {
    return { valid: false, error: "La règle de calcul est vide" }
  }

  try {
    const rpn = toReversePolishNotation(tokenize(rule))

    for (const token of rpn) {
      if (!IDENTIFIER_PATTERN.test(token)) continue
      const typeDonnees = knownFields.get(token)
      if (!typeDonnees) {
        return { valid: false, error: `Champ inconnu : ${token}` }
      }
      if (!isNumericTypeDonnees(typeDonnees)) {
        return { valid: false, error: `Le champ ${token} n'est pas numérique (décimal ou entier)` }
      }
    }

    const arityError = validateRpnArity(rpn)
    if (arityError) {
      return { valid: false, error: arityError }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Règle invalide" }
  }
}
