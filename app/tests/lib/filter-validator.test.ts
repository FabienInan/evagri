import { describe, it, expect } from "vitest"
import { filterSearchParamsSchema } from "@/validators/filter.validator"

describe("filterSearchParamsSchema", () => {
  it("applies the defaults when nothing is provided", () => {
    const result = filterSearchParamsSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.pageSize).toBe(25)
      expect(result.data.sortField).toBe("dateVente")
      expect(result.data.sortOrder).toBe("desc")
    }
  })

  it("accepts a sortable source column", () => {
    expect(filterSearchParamsSchema.safeParse({ sortField: "prixVente" }).success).toBe(true)
  })

  it("rejects a sortField that is not a sortable column", () => {
    expect(filterSearchParamsSchema.safeParse({ sortField: "enrichie" }).success).toBe(false)
    expect(filterSearchParamsSchema.safeParse({ sortField: "lotsCadastraux" }).success).toBe(false)
  })

  it("rejects a pageSize above the cap", () => {
    expect(filterSearchParamsSchema.safeParse({ pageSize: "5000" }).success).toBe(false)
  })

  it("rejects a non-positive page", () => {
    expect(filterSearchParamsSchema.safeParse({ page: "0" }).success).toBe(false)
  })
})
