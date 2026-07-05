/**
 * Suggest a non-conflicting variant: "foo" → "foo (2)", "foo (2)" → "foo (3)".
 * PDF suffix preserved: "report.pdf" → "report (2).pdf".
 *
 * If `taken` is supplied, keep bumping the counter until the suggestion is
 * genuinely free — otherwise "foo" → "foo (2)" is useless when "foo (2)"
 * already exists (the user just gets the modal again).
 */
export function suggestNextName(current: string, taken?: Iterable<string>): string {
  const pdfSuffix = current.toLowerCase().endsWith('.pdf') ? current.slice(-4) : ''
  const base = pdfSuffix ? current.slice(0, -4) : current
  const match = base.match(/^(.*?) \((\d+)\)$/)
  const stem = match ? match[1] : base
  const startFrom = match ? Number(match[2]) + 1 : 2

  const takenSet = taken ? new Set(taken) : null
  if (!takenSet) return `${stem} (${startFrom})${pdfSuffix}`

  let n = startFrom
  // Hard cap so a poisoned cache can't spin forever.
  for (let i = 0; i < 1000; i++, n++) {
    const candidate = `${stem} (${n})${pdfSuffix}`
    if (!takenSet.has(candidate)) return candidate
  }
  return `${stem} (${n})${pdfSuffix}`
}
