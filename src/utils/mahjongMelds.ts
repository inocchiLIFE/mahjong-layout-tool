import { TILE_MAP } from '../data/tiles'

export type MeldKind = 'open-sequence' | 'open-triplet' | 'open-kan' | 'closed-kan' | 'added-kan'

export interface MahjongMeld {
  id: string
  kind: MeldKind
  tileIds: string[]
}

export const MELD_KIND_LABELS: Record<MeldKind, string> = {
  'open-sequence': '明順子',
  'open-triplet': '明刻子',
  'open-kan': '明槓子',
  'closed-kan': '暗槓子',
  'added-kan': '加槓子',
}

export const meldUsesOpenHand = (meld: MahjongMeld) => meld.kind !== 'closed-kan'
export const concealedTileCountForMelds = (melds: MahjongMeld[]) => 14 - melds.length * 3
export const meldTileIds = (melds: MahjongMeld[]) => melds.flatMap((meld) => meld.tileIds)

const redVariant = (tileId: string) => `aka-${tileId}`
const numberedSuits = ['man', 'pin', 'sou'] as const

export const createMeldChoices = (kind: MeldKind): string[][] => {
  if (kind === 'open-sequence') {
    return numberedSuits.flatMap((suit) => Array.from({ length: 7 }, (_, offset) => {
      const tiles = [`${suit}${offset + 1}`, `${suit}${offset + 2}`, `${suit}${offset + 3}`]
      const redIndex = tiles.findIndex((tileId) => tileId.endsWith('5'))
      return redIndex < 0 ? [tiles] : [tiles, tiles.map((tileId, index) => index === redIndex ? redVariant(tileId) : tileId)]
    }).flat())
  }

  const count = kind === 'open-kan' || kind === 'closed-kan' || kind === 'added-kan' ? 4 : 3
  return [...TILE_MAP.values()]
    .filter((tile) => !tile.isRed && !tile.isPlaceholder)
    .map((tile) => Array.from({ length: count }, () => tile.id))
}

export const isValidMeld = (meld: MahjongMeld) => {
  const expectedCount = meld.kind === 'open-kan' || meld.kind === 'closed-kan' || meld.kind === 'added-kan' ? 4 : 3
  if (meld.tileIds.length !== expectedCount) return false
  const bases = meld.tileIds.map((tileId) => TILE_MAP.get(tileId)?.baseId ?? tileId)
  if (bases.some((tileId) => TILE_MAP.get(tileId)?.isPlaceholder)) return false
  if (meld.kind === 'open-sequence') {
    const first = TILE_MAP.get(bases[0])
    return Boolean(first && first.suit !== 'honor' && bases.every((tileId, index) => tileId === `${first.suit}${first.rank + index}`))
  }
  return new Set(bases).size === 1
}
