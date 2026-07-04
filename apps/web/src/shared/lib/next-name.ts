/**
 * Suggest a non-conflicting variant: "foo" → "foo (2)", "foo (2)" → "foo (3)".
 * PDF suffix preserved: "report.pdf" → "report (2).pdf".
 */
export function suggestNextName(current: string): string {
  const pdfSuffix = current.toLowerCase().endsWith('.pdf') ? current.slice(-4) : ''
  const base = pdfSuffix ? current.slice(0, -4) : current
  const match = base.match(/^(.*?) \((\d+)\)$/)
  if (match) {
    const stem = match[1]
    const n = Number(match[2]) + 1
    return `${stem} (${n})${pdfSuffix}`
  }
  return `${base} (2)${pdfSuffix}`
}
