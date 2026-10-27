/** UI styles. Each one is a stylesheet in src/styles/skins/ keyed off <html data-skin="...">. */
export type SkinId = 'standard' | 'nier' | 'cyberpunk' | 'skyrim' | 'hollow' | 'honkai' | 'arknights'

/** `modes`: the style has its own light and dark versions (follows the Light / Dark switch). */
export const SKINS: { id: SkinId; name: string; desc: string; swatch: string[]; modes?: boolean }[] = [
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
    desc: 'Inspired by Arknights. Graphite terminal panels, hazard-yellow and cyan accents, mono readouts, clipped corners. Light and dark.',
    swatch: ['#1b1d21', '#f2f2f0', '#ffd23f', '#23b3e6'],
    modes: true,
  },
]
