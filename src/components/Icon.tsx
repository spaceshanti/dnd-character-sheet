import type { Item } from '../types'

/** Line icons drawn on a 24×24 grid. They use currentColor and --icon-stroke so each UI style can tint them. */

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`

export const ICONS: Record<string, { name: string; d: string }> = {
  sword: { name: 'Sword', d: 'M19 3h2v2L10.5 15.5l-2-2zM6.5 11.5l6 6M7.8 16.2L4 20' + circle(3.4, 20.6, 1) },
  axe: { name: 'Axe', d: 'M7 21L17 5M13.5 4.5c3 0 5.5 2.5 5.5 5.5c-2 0-4-.6-5.4-2' },
  bow: { name: 'Bow', d: 'M6 3c7 2 13 8 15 15M6 3l15 15M6 3L4 5M21 18l-2 2M10 9l-6 6' },
  shield: { name: 'Shield', d: 'M12 3l7 3v5c0 5-3.5 8.5-7 10c-3.5-1.5-7-5-7-10V6zM12 7v10M8.5 11h7' },
  armor: { name: 'Armor', d: 'M8 4h8l4 3l-2 4v9H6v-9L4 7zM9 4c0 2.5 6 2.5 6 0M12 8v12M6 14h12' },
  helmet: { name: 'Helmet', d: 'M5 16a7 7 0 0 1 14 0v3h-4v-5H9v5H5zM12 9V5' },
  glasses: { name: 'Glasses', d: circle(7, 14, 3.4) + circle(17, 14, 3.4) + 'M10.4 14h3.2M3.6 13L2.2 9.5M20.4 13l1.4-3.5' },
  amulet: { name: 'Amulet', d: 'M6 3c0 6 12 6 12 0M12 10l3.2 4.5L12 20l-3.2-5.5z' },
  cloak: { name: 'Cloak', d: 'M9 4h6l5 16H4zM12 4v4M9 4c1 2 5 2 6 0' },
  gloves: { name: 'Gloves', d: 'M7 21v-8L5 10.5a1.5 1.5 0 0 1 2.2-2L8 9.5V6a1.6 1.6 0 0 1 3.2 0V5a1.6 1.6 0 0 1 3.2 0v1.5a1.6 1.6 0 0 1 3.2 .5V15c0 3.5-2.4 6-6 6zM7 17h10.6' },
  belt: { name: 'Belt', d: 'M3 10h18v4H3zM10 8.5h4v7h-4zM12 12h2' },
  boots: { name: 'Boots', d: 'M8 3h5v10l6 3v4H7zM7 17.5h12M8 7h5' },
  ring: { name: 'Ring', d: circle(12, 14.5, 5.5) + 'M9.6 6.5L12 3.5l2.4 3L12 9z' },
  potion: { name: 'Potion', d: 'M10 3h4M11 3v5l-4.6 7.2A4 4 0 0 0 9.8 21h4.4a4 4 0 0 0 3.4-5.8L13 8V3M7.6 14h8.8' },
  scroll: { name: 'Scroll', d: 'M8 4h10a2 2 0 0 1 0 4h-1v10a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h2zM8 16v-8M11 9h3M11 12h3' },
  book: { name: 'Book', d: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M10 8h5' },
  wand: { name: 'Wand', d: 'M4 20L15 9M17 3v3M15.5 4.5h3M20.5 8v2.4M19.3 9.2h2.4M13 3.5v1.6' },
  sparkle: { name: 'Magic', d: 'M12 3l1.8 7.2L21 12l-7.2 1.8L12 21l-1.8-7.2L3 12l7.2-1.8z' },
  orb: { name: 'Orb / focus', d: circle(12, 10, 6) + 'M8 19h8M9.5 16l-1 3M14.5 16l1 3M10 8a2.5 2.5 0 0 1 2.5-2' },
  tool: { name: 'Tool', d: 'M14 4l6 6l-3 3l-6-6zM12.5 10.5L4 19l1 1l8.5-8.5' },
  pack: { name: 'Backpack', d: 'M7 9a5 5 0 0 1 10 0v11H7zM10 5.2a2 2 0 0 1 4 0M7 12.5h10M10 15h4v3h-4z' },
  arrow: { name: 'Ammo', d: 'M4 20L17.5 6.5M20.5 3.5l-6 1.5l4.5 4.5zM4 20v-4M4 20h4M6.6 17.4v-3M6.6 17.4h3' },
  food: { name: 'Food', d: 'M4 14c0-5 16-5 16 0v4H4zM8.5 10.5l1 3M12 10l1 3.5M15.5 10.5l1 3' },
  shirt: { name: 'Clothing', d: 'M8 4L4 7l2 3l2-1v11h8V9l2 1l2-3l-4-3c-1 2-7 2-8 0z' },
  gem: { name: 'Treasure', d: 'M6 4h12l3 5l-9 11L3 9zM3 9h18M9 4l3 5l3-5M8 9l4 11l4-11' },
  coins: { name: 'Coins', d: circle(9, 9, 5) + circle(15, 15, 5) + 'M9 7v4M15 13v4' },
  key: { name: 'Key', d: circle(8, 8, 4) + 'M11 11l9 9M16.5 16.5l2-2M14.5 14.5l2-2' },
  torch: { name: 'Torch', d: 'M10 21l1-10h2l1 10zM12 3c2 2 3 3.5 3 5a3 3 0 0 1-6 0c0-1.5 1-3 3-5z' },
  rope: { name: 'Rope', d: circle(12, 12, 7) + circle(12, 12, 3.5) + 'M19 12c0 4 1 7 2 9' },
  box: { name: 'Misc', d: 'M4 8l8-4l8 4v8l-8 4l-8-4zM4 8l8 4l8-4M12 12v8' },
  dagger: { name: 'Dagger', d: 'M20 4l-1 4.5-7.5 7.5-3-3L16 5.5zM6.5 12.5l5 5M8.5 15.5L4 20' },
  spear: { name: 'Spear', d: 'M20.5 3.5l-1.6 5.6-3.9-3.9zM17 7L4 20M14 8.5l1.5 1.5' },
  mace: { name: 'Mace', d: circle(16, 8, 3.5) + 'M13.5 10.5L4 20M16 2.5V4M21.5 8H20M16 13.5V12M10.5 8H12' },
  hammer: { name: 'Hammer', d: 'M6 4h11v5H6zM11.5 9v12M9.5 21h4' },
  staff: { name: 'Staff', d: 'M5 21L16.5 7.5' + circle(18, 5.5, 2.5) + 'M15 11l2 2' },
  crossbow: { name: 'Crossbow', d: 'M5 19L19 5M7 6c4 1 10 7 11 11M13 13l4 4M16 3l5 5M8 14l2 2' },
  lute: { name: 'Lute / string instrument', d: circle(9, 15, 5) + 'M12.5 11.5L20 4M18 2.5l3.5 3.5M7 13l4 4' + circle(9, 15, 1) },
  flute: { name: 'Flute / pipes', d: 'M3 17L17 3l4 4L7 21zM9.5 13.5h.01M12.5 10.5h.01M15.5 7.5h.01' },
  drum: { name: 'Drum', d: 'M5 8c0-2.5 14-2.5 14 0v8c0 2.5-14 2.5-14 0zM5 8c0 2.5 14 2.5 14 0M8 3l3 4M16 3l-3 4M5 12l14 4' },
  horn: { name: 'Horn', d: 'M4 10h3l10-6v16l-10-6H4zM7 10v4M20 9c1 1 1 5 0 6' },
  map: { name: 'Map', d: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15' },
  lantern: { name: 'Lantern', d: 'M9 3h6M12 3v2M7 7l2-2h6l2 2v10a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3zM7 7h10M12 10c1.2 1.2 1.2 2.8 0 4c-1.2-1.2-1.2-2.8 0-4z' },
  kit: { name: 'Kit / satchel', d: 'M4 8h16v12H4zM9 8V5h6v3M12 11v6M9 14h6' },
  dice: { name: 'Dice', d: 'M4 4h16v16H4z' + circle(8.5, 8.5, 1) + circle(15.5, 15.5, 1) + circle(12, 12, 1) },
  cards: { name: 'Cards', d: 'M5 5h9v14H5zM14 7l4.5 1.2-3.3 12.6-4.2-1.1M9.5 9.5l1 2-1 2-1-2z' },
  holy: { name: 'Holy symbol', d: circle(12, 8, 4) + 'M12 12v9M9 17h6M12 6v4M10 8h4' },
  quill: { name: 'Quill / ink', d: 'M20 4C12 4 6.5 9.5 5 18M20 4c-1 7.5-6.5 12.5-14 13M12.5 9.5L5 18M4 21h7' },
  herb: { name: 'Herb', d: 'M5 19C5 10 11 5 20 4c0 9-6 15-15 15zM5 19l9-9M10 14H7M14 10V7' },
  tent: { name: 'Tent / bedroll', d: 'M3 20L12 4l9 16zM12 4v16M9 20l3-5 3 5' },
  shovel: { name: 'Shovel / pick', d: 'M15 3l6 6M18 6L8.5 15.5M4.5 13.5l6 6-2.5 2.5-6-6z' },
  poison: { name: 'Poison', d: circle(12, 10, 6) + 'M9 21v-3.5h6V21M9.5 10h.01M14.5 10h.01M12 12.5v1' },
  chest: { name: 'Chest', d: 'M3 10h18v10H3zM3 10a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5M11 13h2v3h-2z' },
  compass: { name: 'Compass', d: circle(12, 12, 8.5) + 'M15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8z' },
  hourglass: { name: 'Hourglass', d: 'M7 3h10M7 21h10M8 3c0 6 8 6 8 9s-8 3-8 9M16 3c0 6-8 6-8 9s8 3 8 9' },
  bottle: { name: 'Flask / waterskin', d: 'M10 3h4M10.5 3v3.5C7.5 7.5 6 10 6 13v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6c0-3-1.5-5.5-4.5-6.5V3M6 14h12' },
  quiver: { name: 'Quiver', d: 'M8 9l2.5 12h3L16 9zM9 9L7 3M12 9V2M15 9l2-6M8 9h8' },
  crown: { name: 'Crown / circlet', d: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5zM5 16h14' },
  mask: { name: 'Mask', d: 'M3 8c3-2 15-2 18 0 0 6.5-3.5 10.5-9 10.5S3 14.5 3 8zM7.5 11.5h3M13.5 11.5h3' },
}

/** Old emoji icons from earlier saves → icon names. */
export const EMOJI_TO_ICON: Record<string, string> = {
  '⚔️': 'sword', '🛡️': 'shield', '✨': 'sparkle', '🧪': 'potion', '📜': 'scroll', '🪄': 'wand', '💍': 'ring',
  '🛠️': 'tool', '🎒': 'pack', '🏹': 'arrow', '🍖': 'food', '👕': 'shirt', '💎': 'gem', '📦': 'box', '👓': 'glasses',
  '🪖': 'helmet', '📿': 'amulet', '🧣': 'cloak', '🥋': 'armor', '🧤': 'gloves', '🪢': 'belt', '🥾': 'boots',
}

export function Icon({ name, className = '' }: { name: string; className?: string }) {
  // your own picture for an item (a data URL)
  if (name.startsWith('data:')) return <img className={`ico ico-img ${className}`} src={name} alt="" draggable={false} />
  const icon = ICONS[name]
  if (!icon) return <span className={`ico-text ${className}`}>{name}</span>
  return (
    <svg className={`ico ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={icon.d} />
    </svg>
  )
}

/** First match wins, so more specific words come first (crossbow before sword, holy water before water). */
const GUESSES: [RegExp, string][] = [
  [/quiver/i, 'quiver'],
  [/arrow|bolt|bullet|ammunition|needle|dart/i, 'arrow'],
  [/lute|lyre|harp|viol|fiddle|mandolin|guitar|banjo/i, 'lute'],
  [/flute|pan ?pipes|recorder|shawm|ocarina|whistle|bagpipe/i, 'flute'],
  [/drum|tambourine|cymbal/i, 'drum'],
  [/horn|trumpet|gemshorn|bugle/i, 'horn'],
  [/crossbow/i, 'crossbow'],
  [/bow|sling/i, 'bow'],
  [/dagger|knife|kukri|stiletto|dirk/i, 'dagger'],
  [/spear|javelin|trident|pike|lance|halberd|glaive/i, 'spear'],
  [/mace|morningstar|flail|club/i, 'mace'],
  [/hammer|maul/i, 'hammer'],
  [/staff|stave|cane/i, 'staff'],
  [/holy symbol|reliquary|amulet of the|emblem/i, 'holy'],
  [/poison|venom|toxin/i, 'poison'],
  [/waterskin|canteen|bottle|jug|flask of water/i, 'bottle'],
  [/map|chart|atlas/i, 'map'],
  [/lantern|lamp/i, 'lantern'],
  [/healer|herbalism|kit/i, 'kit'],
  [/dice|\bdie\b/i, 'dice'],
  [/playing card|card set|deck|\bcards?\b/i, 'cards'],
  [/quill|ink|feather|calligraph/i, 'quill'],
  [/herb|leaf|flower|root|mushroom/i, 'herb'],
  [/tent|bedroll|blanket/i, 'tent'],
  [/shovel|spade|pickaxe|miner/i, 'shovel'],
  [/chest|coffer|strongbox/i, 'chest'],
  [/compass/i, 'compass'],
  [/hourglass/i, 'hourglass'],
  [/crown|tiara/i, 'crown'],
  [/\bmask\b/i, 'mask'],
  [/axe|hatchet/i, 'axe'],
  [/shield/i, 'shield'],
  [/potion|elixir|philter|vial|flask|oil|acid|alchemist|antitoxin|poison|holy water/i, 'potion'],
  [/glasses|goggles|lens|spectacle|monocle/i, 'glasses'],
  [/amulet|necklace|pendant|periapt|medallion|talisman/i, 'amulet'],
  [/ring|signet/i, 'ring'],
  [/helm|hat\b|hood|cap\b|circlet|crown/i, 'helmet'],
  [/cloak|cape|mantle|robe/i, 'cloak'],
  [/glove|gauntlet|bracer/i, 'gloves'],
  [/belt|girdle|sash/i, 'belt'],
  [/boot|shoe|sandal|slipper/i, 'boots'],
  [/armou?r|mail|plate|breastplate|padded|hide\b/i, 'armor'],
  [/sword|dagger|blade|rapier|scimitar|knife|spear|glaive|halberd|pike|trident|javelin|lance|club|mace|flail|morningstar|sickle|whip|quarterstaff/i, 'sword'],
  [/wand|rod\b/i, 'wand'],
  [/orb|crystal|focus|prism/i, 'orb'],
  [/book|tome|journal|grimoire|manual/i, 'book'],
  [/scroll|map|letter|note|parchment|paper|deed/i, 'scroll'],
  [/gem|jewel|diamond|ruby|emerald|sapphire|pearl|tooth|teeth/i, 'gem'],
  [/coin|purse/i, 'coins'],
  [/key|lockpick|thieves/i, 'key'],
  [/torch|lantern|candle|lamp|tinderbox/i, 'torch'],
  [/rope|chain|twine|cord/i, 'rope'],
  [/ration|food|bread|meat|cheese|waterskin|wine|ale\b|water/i, 'food'],
  [/cloth|garment|outfit|shirt|costume|vestment/i, 'shirt'],
  [/backpack|bag|sack|case|chest|quiver|pouch|satchel/i, 'pack'],
  [/tool|kit|crowbar|hammer|pick|shovel|piton|instrument|lute|flute|drum|horn|card|dice|caltrop|set\b/i, 'tool'],
]

export function guessIcon(name: string): string {
  return GUESSES.find(([re]) => re.test(name))?.[1] ?? 'box'
}

/** The icon to show for an item: a chosen icon wins, otherwise it's guessed from the name. */
export function itemIcon(i: Pick<Item, 'icon' | 'name'>): string {
  if (i.icon && i.icon !== 'box') return i.icon
  return guessIcon(i.name)
}
