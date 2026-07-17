export interface NormalizationReport {
  sheetTotals: Record<string, number>
  rowsDropped: Record<string, number>
  columnsDropped: Record<string, string[]>
  fieldChanges: Record<string, Record<string, number>>
  rowsFlagged: Record<string, number>
}

export function createReport(): NormalizationReport {
  return {
    sheetTotals: {},
    rowsDropped: {},
    columnsDropped: {},
    fieldChanges: {},
    rowsFlagged: {},
  }
}

export function incrementCounter(
  report: NormalizationReport,
  field: string,
  rule: string,
  count = 1
) {
  report.fieldChanges[field] ??= {}
  report.fieldChanges[field][rule] = (report.fieldChanges[field][rule] ?? 0) + count
}

export function printReport(report: NormalizationReport): string {
  return JSON.stringify(report, null, 2)
}
