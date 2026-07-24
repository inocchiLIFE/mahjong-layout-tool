const TILE_IDS = [
  ...(['man', 'pin', 'sou'] as const).flatMap((suit) => Array.from({ length: 9 }, (_, index) => `${suit}${index + 1}`)),
  'ton', 'nan', 'sha', 'pei', 'haku', 'hatsu', 'chun',
]

const TERMINAL_OR_HONOR = new Set([...TILE_IDS.slice(0, 9).filter((_, index) => index === 0 || index === 8), ...TILE_IDS.slice(9, 18).filter((_, index) => index === 0 || index === 8), ...TILE_IDS.slice(18)])

export interface EfficiencyResult {
  shanten: number
  effectiveTileIds: string[]
  effectiveTileCount: number
}

export interface GoodShapeTenpaiTransition {
  drawTileId: string
  tenpaiOptions: Array<{ discardTileId: string; waitTileIds: string[]; waitTileCount: number }>
}

const normalShanten = (counts: number[], fixedMelds: number) => {
  let minimum = 8
  const search = (index: number, melds: number, taatsu: number, pair: number) => {
    while (index < 34 && counts[index] === 0) index += 1
    if (index === 34) {
      const usableTaatsu = Math.min(taatsu, 4 - melds)
      minimum = Math.min(minimum, 8 - melds * 2 - usableTaatsu - pair)
      return
    }
    if (melds > 4) return
    if (counts[index] >= 3) {
      counts[index] -= 3; search(index, melds + 1, taatsu, pair); counts[index] += 3
    }
    if (index < 27 && index % 9 <= 6 && counts[index + 1] > 0 && counts[index + 2] > 0) {
      counts[index]--; counts[index + 1]--; counts[index + 2]--
      search(index, melds + 1, taatsu, pair)
      counts[index]++; counts[index + 1]++; counts[index + 2]++
    }
    if (pair === 0 && counts[index] >= 2) {
      counts[index] -= 2; search(index, melds, taatsu, 1); counts[index] += 2
    }
    if (taatsu < 4) {
      if (counts[index] >= 2) {
        counts[index] -= 2; search(index, melds, taatsu + 1, pair); counts[index] += 2
      }
      if (index < 27 && index % 9 <= 7 && counts[index + 1] > 0) {
        counts[index]--; counts[index + 1]--; search(index, melds, taatsu + 1, pair); counts[index]++; counts[index + 1]++
      }
      if (index < 27 && index % 9 <= 6 && counts[index + 2] > 0) {
        counts[index]--; counts[index + 2]--; search(index, melds, taatsu + 1, pair); counts[index]++; counts[index + 2]++
      }
    }
    counts[index]--; search(index, melds, taatsu, pair); counts[index]++
  }
  search(0, fixedMelds, 0, 0)
  return minimum
}

const SHANTEN_CACHE = new Map<string, number>()

const shanten = (counts: number[], fixedMelds = 0) => {
  const cacheKey = `${fixedMelds}|${counts.join('')}`
  const cached = SHANTEN_CACHE.get(cacheKey)
  if (cached !== undefined) return cached
  const normal = normalShanten([...counts], fixedMelds)
  if (fixedMelds > 0) return normal
  const pairs = counts.filter((count) => count >= 2).length
  const unique = counts.filter((count) => count > 0).length
  const sevenPairs = 6 - pairs + Math.max(0, 7 - unique)
  const orphanIndices = TILE_IDS.map((id, index) => TERMINAL_OR_HONOR.has(id) ? index : -1).filter((index) => index >= 0)
  const uniqueOrphans = orphanIndices.filter((index) => counts[index] > 0).length
  const orphanPair = orphanIndices.some((index) => counts[index] >= 2) ? 1 : 0
  const thirteenOrphans = 13 - uniqueOrphans - orphanPair
  const result = Math.min(normal, sevenPairs, thirteenOrphans)
  if (SHANTEN_CACHE.size > 100_000) SHANTEN_CACHE.clear()
  SHANTEN_CACHE.set(cacheKey, result)
  return result
}

export const tileIdToIndex = (tileId: string) => TILE_IDS.indexOf(tileId)

const tileIdsToCounts = (tileIds: string[]) => {
  if (tileIds.length > 14) return null
  const counts = Array(34).fill(0) as number[]
  for (const tileId of tileIds) {
    const index = tileIdToIndex(tileId)
    if (index < 0 || counts[index] >= 4) return null
    counts[index] += 1
  }
  return counts
}

export const getShanten = (tileIds: string[], fixedMelds = 0) => {
  const counts = tileIdsToCounts(tileIds)
  return counts && fixedMelds >= 0 && fixedMelds <= 4 ? shanten(counts, fixedMelds) : null
}

export const getEfficiency = (tileIds: string[], fixedMelds = 0): EfficiencyResult | null => {
  const counts = tileIdsToCounts(tileIds)
  if (!counts) return null
  const currentShanten = shanten(counts, fixedMelds)
  const effectiveTileIds = TILE_IDS.filter((_, index) => {
    if (counts[index] >= 4) return false
    counts[index] += 1
    const improves = shanten(counts, fixedMelds) < currentShanten
    counts[index] -= 1
    return improves
  })
  return {
    shanten: currentShanten,
    effectiveTileIds,
    effectiveTileCount: effectiveTileIds.reduce((sum, tileId) => sum + 4 - counts[tileIdToIndex(tileId)], 0),
  }
}

export const getDiscardEfficiencies = (tileIds: string[]) => [...new Set(tileIds)].map((discardTileId) => ({
  discardTileId,
  result: getEfficiency(tileIds.filter((tileId, index) => tileId !== discardTileId || index !== tileIds.indexOf(discardTileId))),
}))

/** Finds 1-shanten draws that can become tenpai with six or more waits. */
export const getGoodShapeTenpaiTransitions = (tileIds: string[], fixedMelds = 0): GoodShapeTenpaiTransition[] => {
  const current = getEfficiency(tileIds, fixedMelds)
  if (!current || current.shanten !== 1) return []
  return current.effectiveTileIds.flatMap((drawTileId) => {
    const drawn = [...tileIds, drawTileId]
    const tenpaiOptions = [...new Set(drawn)].flatMap((discardTileId) => {
      const afterDiscard = drawn.filter((tileId, index) => tileId !== discardTileId || index !== drawn.indexOf(discardTileId))
      const tenpai = getEfficiency(afterDiscard, fixedMelds)
      if (!tenpai || tenpai.shanten !== 0 || tenpai.effectiveTileCount < 6) return []
      return [{ discardTileId, waitTileIds: tenpai.effectiveTileIds, waitTileCount: tenpai.effectiveTileCount }]
    })
    return tenpaiOptions.length ? [{ drawTileId, tenpaiOptions }] : []
  })
}
