/*
 * The app icon, drawn per UI style so the window and taskbar icon match the theme. Every style keeps the d20 at its
 * heart but has its own tile and trimmings. Drawn as SVG, turned into a PNG and handed to the desktop app
 * (and the browser tab's favicon).
 */
import type { SkinId } from './skins'

type Pt = [number, number]

/** the d20: outer hexagon, front face and the edges joining them, centred at (cx, cy), `s` = scale (1 = 512 tile) */
function d20({ cx = 256, cy = 259, s = 1, line, face, width = 16, faceStroke = false, extra = '' }: {
  cx?: number; cy?: number; s?: number; line: string; face: string; width?: number; faceStroke?: boolean; extra?: string
}) {
  const P = (x: number, y: number): Pt => [cx + (x - 256) * s, cy + (y - 259) * s]
  const T = P(256, 78), UR = P(414, 166), LR = P(414, 352), B = P(256, 440), LL = P(98, 352), UL = P(98, 166)
  const fT = P(256, 176), fL = P(158, 334), fR = P(354, 334)
  const p = (a: Pt) => `${a[0].toFixed(1)} ${a[1].toFixed(1)}`
  const edges: Pt[][] = [[T, UR], [UR, LR], [LR, B], [B, LL], [LL, UL], [UL, T], [T, fT], [UL, fT], [UR, fT], [UL, fL], [UR, fR], [LL, fL], [LR, fR], [B, fL], [B, fR], [fL, fR]]
  return {
    face: `<path d="M${p(fT)} L${p(fR)} L${p(fL)} Z" fill="${face}" ${faceStroke ? `stroke="${line}" stroke-width="${width}"` : ''}/>`,
    edges: `<path d="${edges.map(([a, b]) => `M${p(a)} L${p(b)}`).join(' ')}" fill="none" stroke="${line}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`,
    verts: [T, UR, LR, B, LL, UL],
    p,
  }
}

const rounded = (r: number, i = 24) => `M${i + r} ${i} H${512 - i - r} Q${512 - i} ${i} ${512 - i} ${i + r} V${512 - i - r} Q${512 - i} ${512 - i} ${512 - i - r} ${512 - i} H${i + r} Q${i} ${512 - i} ${i} ${512 - i - r} V${i + r} Q${i} ${i} ${i + r} ${i} Z`
const grad = (id: string, a: string, b: string, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`

const ICONS: Record<string, () => string> = {
  // the printed sheet: gold die on navy, red face (the installer's icon)
  standard: () => {
    const d = d20({ line: '#ecd9a6', face: '#8e3a3c' })
    return `<defs>${grad('g', '#22263a', '#12131c')}</defs>
<path d="${rounded(84)}" fill="url(#g)" stroke="#7a6a45" stroke-width="10"/>${d.face}${d.edges}`
  },

  // NieR: flat beige card, hairline die with square markers on its corners, ruled lines, one red square
  nier: () => {
    const d = d20({ line: '#4a4740', face: '#4a4740', width: 9, s: 0.86, cy: 262 })
    const marks = d.verts.map(([x, y]) => `<rect x="${x - 13}" y="${y - 13}" width="26" height="26" fill="#d9d4bd" stroke="#4a4740" stroke-width="7"/>`).join('')
    return `<rect x="20" y="20" width="472" height="472" fill="#d9d4bd" stroke="#4a4740" stroke-width="10"/>
<path d="M50 62 H462 M50 450 H462" stroke="#4a4740" stroke-width="5"/>
<path d="M50 74 H150 M362 438 H462" stroke="#4a4740" stroke-width="3" opacity=".6"/>
${d.face}${d.edges}${marks}<rect x="440" y="38" width="22" height="22" fill="#a0473a"/>`
  },

  // Cyberpunk: black glass, cut corners, a red ghost behind the yellow die (glitch), scanlines
  cyberpunk: () => {
    const ghost = d20({ line: '#ff4655', face: 'none', width: 14, cx: 244, cy: 263 })
    const d = d20({ line: '#fcee0a', face: '#ff4655', width: 14, cx: 262, cy: 255 })
    const scan = Array.from({ length: 24 }, (_, i) => `M24 ${40 + i * 19} H488`).join(' ')
    return `<path d="M24 24 H420 L488 92 V488 H92 L24 420 Z" fill="#0e1117" stroke="#ff4655" stroke-width="10"/>
<path d="${scan}" stroke="#ffffff" stroke-opacity=".035" stroke-width="6"/>
${ghost.edges.replace('stroke-linecap', 'opacity=".8" stroke-linecap')}${d.face}${d.edges}
<rect x="380" y="430" width="80" height="22" fill="#fcee0a"/><rect x="52" y="60" width="44" height="10" fill="#ff4655"/>`
  },

  // Skyrim: smoky stone disc, a thin fading ring, pale die with a dark red face
  skyrim: () => {
    const d = d20({ line: '#ece8df', face: '#7d2a20', width: 10, s: 0.78 })
    return `<defs><radialGradient id="g" cx=".5" cy=".42" r=".7"><stop offset="0" stop-color="#3a3935"/><stop offset="1" stop-color="#0f0f0e"/></radialGradient>
${grad('r', '#ece8df', 'rgba(236,232,223,0.05)')}</defs>
<path d="${rounded(110)}" fill="url(#g)"/>
<circle cx="256" cy="259" r="212" fill="none" stroke="url(#r)" stroke-width="4"/>
<circle cx="256" cy="259" r="196" fill="none" stroke="url(#r)" stroke-width="2" opacity=".6"/>
<path d="M256 30 L268 52 L256 74 L244 52 Z M256 444 L266 462 L256 480 L246 462 Z" fill="#c4503f"/>
${d.face}${d.edges}`
  },

  // Hollow Knight: ink-black, chalk-white frame with curling corner flourishes, die with a pale blue soul face
  hollow: () => {
    const d = d20({ line: '#e9ecf3', face: '#5c78b8', width: 12, s: 0.8, cy: 262 })
    const curl = 'M0 0 C 40 0 70 30 70 70 C 70 100 45 118 22 108 C 4 100 6 76 26 74 C 40 73 46 86 38 94'
    const corner = (tx: number, ty: number, sx: number, sy: number) => `<path d="${curl}" transform="translate(${tx} ${ty}) scale(${sx} ${sy})" fill="none" stroke="#e9ecf3" stroke-width="8" stroke-linecap="round"/>`
    return `<defs><radialGradient id="g" cx=".5" cy=".55" r=".7"><stop offset="0" stop-color="#1a2233"/><stop offset="1" stop-color="#04060a"/></radialGradient></defs>
<path d="${rounded(60)}" fill="url(#g)" stroke="#e9ecf3" stroke-width="8"/>
${corner(40, 40, 1, 1)}${corner(472, 40, -1, 1)}${corner(40, 472, 1, -1)}${corner(472, 472, -1, -1)}
<circle cx="256" cy="262" r="64" fill="#5c78b8" opacity=".35"/>${d.face}${d.edges}`
  },

  // Honkai: slanted cyan-to-blue card, a pink slash across it, white die with a pink face
  honkai: () => {
    const d = d20({ line: '#ffffff', face: '#ff6aa8', width: 15, s: 0.84 })
    return `<defs>${grad('g', '#3fd0ff', '#172f58', 0.4, 1)}</defs>
<path d="M78 24 H492 L434 488 H20 Z" fill="url(#g)" stroke="#8fe0ff" stroke-width="8"/>
<path d="M60 360 L470 150 L476 186 L66 396 Z" fill="#ff6aa8" opacity=".55"/>
<path d="M330 452 H420 L414 470 H324 Z M100 42 H190 L184 60 H94 Z" fill="#ffffff"/>
${d.face}${d.edges}`
  },

  // Arknights Endfield: graphite terminal tile, clipped corner, hazard stripe along the bottom, yellow face
  'arknights/endfield': () => {
    const d = d20({ line: '#f0f0ee', face: '#ffd23f', width: 14, s: 0.8, cy: 238 })
    return `<defs>${grad('g', '#24262b', '#0e0f11')}
<pattern id="hz" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="20" height="40" fill="#ffd23f"/></pattern>
<clipPath id="c"><path d="M24 24 H488 V410 L410 488 H24 Z"/></clipPath></defs>
<path d="M24 24 H488 V410 L410 488 H24 Z" fill="url(#g)"/>
<rect x="24" y="420" width="472" height="68" fill="url(#hz)" clip-path="url(#c)"/>
<path d="M24 24 H488 V410 L410 488 H24 Z" fill="none" stroke="#3b3f46" stroke-width="8"/>
<rect x="24" y="24" width="96" height="14" fill="#ffd23f"/><rect x="452" y="60" width="10" height="70" fill="#23b3e6"/>
${d.face}${d.edges}`
  },

  // Arknights classic: charcoal menu tile, white corner triangle, white die with a Rhodes Island blue face
  'arknights/classic': () => {
    const d = d20({ line: '#ffffff', face: '#0098dc', width: 12, s: 0.82, cy: 252 })
    return `<defs>${grad('g', '#363636', '#141414')}</defs>
<rect x="24" y="24" width="464" height="464" fill="url(#g)" stroke="#5a5a5a" stroke-width="6"/>
<path d="M392 24 H488 V120 Z" fill="#ffffff"/>
<path d="M56 458 H300" stroke="#ffffff" stroke-width="5"/><rect x="300" y="450" width="16" height="16" fill="#0098dc"/>
<rect x="56" y="56" width="14" height="60" fill="#0098dc"/>
${d.face}${d.edges}`
  },
}

export function iconSvg(skin: SkinId, variant?: string): string {
  const make = ICONS[variant ? `${skin}/${variant}` : skin] ?? ICONS[skin] ?? ICONS.standard
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${make()}</svg>`
}

/** PNG of a style's icon, as a data URL */
export function iconPng(skin: SkinId, variant?: string, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const cv = document.createElement('canvas')
      cv.width = cv.height = size
      cv.getContext('2d')!.drawImage(img, 0, 0, size, size)
      resolve(cv.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg(skin, variant))}`
  })
}

/** set the window / taskbar icon (desktop app) and the favicon to the style's own icon */
export async function applyAppIcon(skin: SkinId, variant?: string) {
  try {
    const url = await iconPng(skin, variant)
    window.sheetApi?.setIcon?.(url)
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
    link.href = url
  } catch { /* keep the icon it has */ }
}
