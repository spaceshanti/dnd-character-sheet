/*
 * Cantrips that grow with your level, from their "Cantrip Upgrade" / "at higher levels" line:
 *   "The damage increases by 1d10 when you reach levels 5 (2d10), 11 (3d10), and 17 (4d10)."   (2024)
 *   "This spell's damage increases by 1d10 when you reach 5th level (2d10), 11th level (3d10)…"  (2014)
 *   "The damage die changes when you reach levels 5 (d10), 11 (d12), and 17 (2d6)."             (Shillelagh)
 *   "…deals extra Radiant damage when you reach levels 5 (1d6), 11 (2d6), and 17 (3d6)."          (True Strike)
 *   "The spell creates two beams at level 5, three beams at level 11, and four beams at level 17." (Eldritch Blast)
 * → what you roll at your level.
 */

export interface CantripScale {
  /** what you roll now, e.g. "2d10", "3 beams", "+1d6" ('' before it starts, for extra damage) */
  now: string
  /** the dice / count text from the book for your tier, to highlight in the description ('' at the base tier) */
  mark: string
  /** [level, text] steps, base first */
  tiers: [number, string][]
}

const plainText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
const NUM: Record<string, number> = { two: 2, three: 3, four: 4, five: 5 }

export function cantripScale(description: string, level: number): CantripScale | null {
  const t = plainText(description)
  const pick = (tiers: [number, string][], marks: string[]) => {
    let i = 0
    tiers.forEach((x, k) => { if (level >= x[0]) i = k })
    return { now: tiers[i][1], mark: marks[i], tiers }
  }

  // beams (Eldritch Blast)
  const beams = [...t.matchAll(/\b(two|three|four|five) beams at (?:level (\d+)|(\d+)(?:st|nd|rd|th) level)/gi)]
  if (beams.length) {
    const steps = beams.map((b) => [+(b[2] || b[3]), `${NUM[b[1].toLowerCase()]} beams`, b[1]] as [number, string, string])
    return pick([[1, '1 beam'], ...steps.map((s) => [s[0], s[1]] as [number, string])], ['', ...steps.map((s) => s[2])])
  }

  const m = /[^.]*\bwhen you reach\b[^.]*\(\s*\d*d\d+\s*\)[^.]*\./i.exec(t)
  if (!m) return null
  const steps = [...m[0].matchAll(/(\d+)(?:st|nd|rd|th)?(?:\s+level)?\s*\(\s*(\d*d\d+)\s*\)/gi)].map((s) => [+s[1], s[2]] as [number, string]).sort((a, b) => a[0] - b[0])
  if (!steps.length) return null
  const extra = /\bextra\b/i.test(m[0])
  let base: string
  if (extra) base = '' // nothing extra until the first step (True Strike)
  else if (/^\d+d/.test(steps[0][1]) && +steps[0][1].split('d')[0] > 1) base = `${+steps[0][1].split('d')[0] - 1}d${steps[0][1].split('d')[1]}`
  else base = /\b(\d*d\d+)\b/.exec(t.slice(0, m.index))?.[1] ?? '' // "The damage die changes … (d10)": the die before it
  const show = (d: string) => (extra && d ? `+${d}` : d)
  return pick([[1, show(base)], ...steps.map((s) => [s[0], show(s[1])] as [number, string])], ['', ...steps.map((s) => s[1])])
}

/** the description with what you roll at your level highlighted */
export function markCantrip(html: string, s: CantripScale): string {
  if (!s.mark) return html
  const pat = /^\w+$/.test(s.mark) && !/\d/.test(s.mark) ? new RegExp(`\\b${s.mark}\\b(?= beams)`, 'i') : new RegExp(`\\(${s.mark}\\)`)
  return html.replace(pat, (x) => (x.startsWith('(') ? `(<mark>${s.mark}</mark>)` : `<mark>${x}</mark>`))
}
