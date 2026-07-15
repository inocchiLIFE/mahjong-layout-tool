import type { Suit, TileDefinition } from '../types'

const tileAsset = (filename: string) => `${import.meta.env.BASE_URL}tiles/${filename}`

const suitNames: Record<Suit, string> = {
  man: '萬子',
  pin: '筒子',
  sou: '索子',
  honor: '字牌',
}

const numberedSuits: Array<{ suit: Exclude<Suit, 'honor'>; suffix: string }> = [
  { suit: 'man', suffix: '萬' },
  { suit: 'pin', suffix: '筒' },
  { suit: 'sou', suffix: '索' },
]

const numberedTiles = numberedSuits.flatMap(({ suit, suffix }, suitIndex) =>
  Array.from({ length: 9 }, (_, index): TileDefinition => {
    const rank = index + 1
    return {
      id: `${suit}${rank}`,
      label: `${rank}${suffix}`,
      shortLabel: `${rank}${suffix}`,
      suit,
      rank,
      asset: tileAsset(`${suit}${rank}.png`),
      baseId: `${suit}${rank}`,
      order: suitIndex * 20 + rank * 2,
    }
  }),
)

const honorInfo = [
  ['ton', '東'],
  ['nan', '南'],
  ['sha', '西'],
  ['pei', '北'],
  ['haku', '白'],
  ['hatsu', '發'],
  ['chun', '中'],
] as const

const honorTiles: TileDefinition[] = honorInfo.map(([id, label], index) => ({
  id,
  label,
  shortLabel: label,
  suit: 'honor',
  rank: index + 1,
  asset: tileAsset(`${id}.png`),
  baseId: id,
  order: 60 + index * 2,
}))

const redTiles: TileDefinition[] = [
  { id: 'aka-man5', label: '赤5萬', shortLabel: '赤五萬', suit: 'man', rank: 5, asset: tileAsset('aka-man5.png'), baseId: 'man5', isRed: true, order: 11 },
  { id: 'aka-pin5', label: '赤5筒', shortLabel: '赤五筒', suit: 'pin', rank: 5, asset: tileAsset('aka-pin5.png'), baseId: 'pin5', isRed: true, order: 31 },
  { id: 'aka-sou5', label: '赤5索', shortLabel: '赤五索', suit: 'sou', rank: 5, asset: tileAsset('aka-sou5.png'), baseId: 'sou5', isRed: true, order: 51 },
]

export const TILE_DEFINITIONS: TileDefinition[] = [
  ...numberedTiles,
  ...honorTiles,
  ...redTiles,
]

export const TILE_MAP = new Map(TILE_DEFINITIONS.map((tile) => [tile.id, tile]))

export const TILE_GROUPS = (['man', 'pin', 'sou', 'honor'] as Suit[]).map((suit) => ({
  suit,
  label: suitNames[suit],
  tiles: [
    ...TILE_DEFINITIONS.filter((tile) => tile.suit === suit && !tile.isRed),
    ...TILE_DEFINITIONS.filter((tile) => tile.suit === suit && tile.isRed),
  ],
}))
