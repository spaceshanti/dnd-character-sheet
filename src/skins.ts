/** UI styles. Each one is a stylesheet in src/styles/skins/ keyed off <html data-skin="...">. */
export type SkinId = 'standard' | 'nier' | 'cyberpunk' | 'skyrim' | 'hollow' | 'honkai' | 'arknights' | 'pda' | 'scp'

/** `modes`: the style has its own light and dark versions (follows the Light / Dark switch). */
/** a style's alternative looks (the first is the default) */
export interface SkinVariant { id: string; name: string; desc: string }

/** `variants`: the style comes in more than one look, picked under its card. */
export const SKINS: { id: SkinId; name: string; desc: string; swatch: string[]; modes?: boolean; variants?: SkinVariant[] }[] = [
  {
    id: 'standard', name: 'Character Sheet',
    desc: 'The classic printed-sheet look. Has its own light and dark mode.',
    swatch: ['#fbfaf7', '#1d1d20', '#8e2b2f'],
    modes: true,
  },
  {
    id: 'nier', name: 'Android',
    desc: 'Inspired by NieR: Automata. Calm beige monochrome, flat panels, square bullets.',
    swatch: ['#d9d4bd', '#4a4740', '#a0473a'],
  },
  {
    id: 'cyberpunk', name: 'Neon City',
    desc: 'Inspired by Cyberpunk 2077. Black glass, red lines, yellow highlights, angled cuts.',
    swatch: ['#0e1117', '#ff4655', '#fcee0a'],
  },
  {
    id: 'skyrim', name: 'Northern',
    desc: 'Inspired by Skyrim. Smoky panels, thin fading lines, quiet elegant type.',
    swatch: ['#1a1a18', '#ece8df', '#c4503f'],
  },
  {
    id: 'hollow', name: 'Hallownest',
    desc: 'Inspired by Hollow Knight. Ink-black depths, chalk-white frames with curling flourishes, mask pips.',
    swatch: ['#07090d', '#e9ecf3', '#5c78b8'],
  },
  {
    id: 'honkai', name: 'Valkyrie',
    desc: 'Inspired by Honkai Impact 3rd. Cyan-to-blue gradients with pink, slanted labels and tabs. Light and dark.',
    swatch: ['#172f58', '#22b8f2', '#ff6aa8'],
    modes: true,
  },
  {
    id: 'arknights', name: 'Rhodes Island',
    desc: 'Inspired by Arknights. Two looks: Endfield (hazard yellow, clipped corners) or Classic (charcoal, white and Rhodes Island blue). Light and dark.',
    swatch: ['#1b1d21', '#f2f2f0', '#ffd23f', '#23b3e6'],
    modes: true,
    variants: [
      { id: 'endfield', name: 'Endfield', desc: 'Industrial terminal: hazard yellow, warning stripes, clipped corners.' },
      { id: 'classic', name: 'Classic', desc: "The original game's menus: charcoal and white, Rhodes Island blue, corner triangles, wide headings." },
    ],
  },
  {
    id: 'pda', name: 'Survival PDA',
    desc: 'Inspired by Subnautica. Deep-ocean blue with light from the surface, frosted glass panels, glowing cyan readouts.',
    swatch: ['#041622', '#0c3a4e', '#4fe3ff', '#ffb547'],
  },
  {
    id: 'scp', name: 'Foundation',
    desc: 'Inspired by the SCP Foundation. A typed containment file: black title strips, mono type, red marks. Light (paper) and dark (terminal).',
    swatch: ['#e9e7e1', '#111111', '#9c1414'],
    modes: true,
  },
]

/** the look in use for a style (its first variant unless you picked another) */
/** styles with a sci-fi interface: the Appearance box becomes a digital profile card */
export const SCIFI_SKINS: SkinId[] = ['arknights', 'cyberpunk', 'pda', 'honkai', 'scp', 'nier']

export function variantOf(skin: SkinId, picked: Partial<Record<SkinId, string>>): string | undefined {
  const v = SKINS.find((k) => k.id === skin)?.variants
  if (!v) return undefined
  return v.find((x) => x.id === picked[skin])?.id ?? v[0].id
}
