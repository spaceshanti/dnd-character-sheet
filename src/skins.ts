/** UI styles. Each one is a stylesheet in src/styles/skins/ keyed off <html data-skin="...">. */
export type SkinId = 'standard' | 'nier' | 'cyberpunk' | 'skyrim'

export const SKINS: { id: SkinId; name: string; desc: string; swatch: string[] }[] = [
  {
    id: 'standard', name: 'Character Sheet',
    desc: 'The classic printed-sheet look. Has its own light and dark mode.',
    swatch: ['#fbfaf7', '#1d1d20', '#8e2b2f'],
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
]
