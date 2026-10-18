import { describe, it, expect } from "vitest"
import { ZodError, z } from "zod"
import { formatZodError } from "@/validators/common"

const schema = z.object({
  codeMachine: z.string().min(1),
  nomAffichage: z.string().min(1),
})

function errorFrom(input: unknown): ZodError {
  const result = schema.safeParse(input)
  if (result.success) throw new Error("expected validation to fail")
  return result.error
}

describe("formatZodError", () => {
  it("ne renvoie que le premier message par défaut", () => {
    const message = formatZodError(errorFrom({ codeMachine: "", nomAffichage: "" }))
    expect(message).toContain("codeMachine")
    expect(message).not.toContain("nomAffichage")
  })

  it("joint tous les messages avec allIssues", () => {
    const message = formatZodError(errorFrom({ codeMachine: "", nomAffichage: "" }), { allIssues: true })
    expect(message).toContain("codeMachine")
    expect(message).toContain("nomAffichage")
    expect(message.match(/obligatoire/g)?.length).toBe(2)
  })

  it("remplace les chemins par leurs libellés", () => {
    const message = formatZodError(errorFrom({ codeMachine: "", nomAffichage: "" }), {
      labels: { codeMachine: "Code machine", nomAffichage: "Nom affiché" },
    })
    expect(message).toBe("« Code machine » est obligatoire.")
  })

  it("renvoie le message du schéma quand preferIssueMessage est actif", () => {
    const custom = z.object({ numero: z.string().min(1, "Format attendu.") })
    const result = custom.safeParse({ numero: "" })
    if (result.success) throw new Error("expected validation to fail")
    expect(formatZodError(result.error, { preferIssueMessage: true })).toBe("Format attendu.")
  })

  it("renvoie le fallback quand l'erreur ne porte aucun issue", () => {
    expect(formatZodError(new ZodError([]), { fallback: "Entrée invalide." })).toBe("Entrée invalide.")
  })
})
