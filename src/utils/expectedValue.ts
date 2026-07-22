import { TILE_MAP } from '../data/tiles'
import { getEfficiency, getShanten } from './mahjongEfficiency'
import { scoreWinningHand } from './mahjongScore'

export const EXPECTED_VALUE_TILE_IDS = [
  ...(['man', 'pin', 'sou'] as const).flatMap((suit) => Array.from({ length: 9 }, (_, index) => `${suit}${index + 1}`)),
  'ton', 'nan', 'sha', 'pei', 'haku', 'hatsu', 'chun',
]

export type Wind = 'ton' | 'nan' | 'sha' | 'pei'
export interface ExpectedValueSettings {
  roundWind: Wind
  seatWind: Wind
  turn: number
  doraIndicator: string | null
  visibleCounts: Record<string, number>
  includeRedDora: boolean
  includeUraDora: boolean
  allowShantenBack: boolean
  allowHandChange: boolean
}

export interface ExpectedValueResult {
  discardTileId: string
  shanten: number
  effectiveTileIds: string[]
  effectiveTileCount: number
  tenpaiProbability: number
  winProbability: number
  estimatedWinPoints: number
  expectedPoints: number
}

const RED_IDS: Record<string, string> = { man5: 'aka-man5', pin5: 'aka-pin5', sou5: 'aka-sou5' }
const normalize = (tileId: string) => TILE_MAP.get(tileId)?.baseId ?? tileId
const normalizeHand = (tileIds: string[]) => tileIds.map(normalize)
const removeOne = (tileIds: string[], target: string) => {
  const exactIndex = tileIds.indexOf(target)
  const index = exactIndex >= 0 ? exactIndex : tileIds.findIndex((tileId) => normalize(tileId) === normalize(target))
  return index < 0 ? [...tileIds] : [...tileIds.slice(0, index), ...tileIds.slice(index + 1)]
}

const hashText = (text: string) => {
  let value = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

const createRandom = (seed: number) => () => {
  seed |= 0
  seed = seed + 0x6d2b79f5 | 0
  let value = Math.imul(seed ^ seed >>> 15, 1 | seed)
  value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value
  return ((value ^ value >>> 14) >>> 0) / 4294967296
}

const shuffled = (values: string[], random: () => number) => {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}

const buildWall = (tileIds: string[], settings: ExpectedValueSettings) => {
  const wall = EXPECTED_VALUE_TILE_IDS.flatMap((baseId) => {
    const copies = Array(4).fill(baseId) as string[]
    if (settings.includeRedDora && RED_IDS[baseId]) copies[0] = RED_IDS[baseId]
    return copies
  })
  const removeKnown = (tileId: string) => {
    let index = wall.indexOf(tileId)
    if (index < 0) index = wall.findIndex((candidate) => normalize(candidate) === normalize(tileId))
    if (index >= 0) wall.splice(index, 1)
  }
  tileIds.forEach(removeKnown)
  for (const tileId of EXPECTED_VALUE_TILE_IDS) {
    const count = Math.max(0, Math.min(4, settings.visibleCounts[tileId] ?? 0))
    for (let index = 0; index < count; index += 1) removeKnown(tileId)
  }
  if (settings.doraIndicator) removeKnown(settings.doraIndicator)
  return wall
}

const remainingEffectiveCount = (wall: string[], effectiveTileIds: string[]) => {
  const effective = new Set(effectiveTileIds)
  return wall.filter((tileId) => effective.has(normalize(tileId))).length
}

const nextDora = (indicator: string | null) => {
  if (!indicator) return null
  const numbered = /^(man|pin|sou)(\d)$/.exec(indicator)
  if (numbered) return `${numbered[1]}${Number(numbered[2]) === 9 ? 1 : Number(numbered[2]) + 1}`
  const group = ['ton', 'nan', 'sha', 'pei'].includes(indicator)
    ? ['ton', 'nan', 'sha', 'pei']
    : ['haku', 'hatsu', 'chun'].includes(indicator) ? ['haku', 'hatsu', 'chun'] : []
  return group.length ? group[(group.indexOf(indicator) + 1) % group.length] : null
}

const shapeScore = (tileIds: string[], settings: ExpectedValueSettings) => {
  const counts = new Map<string, number>()
  tileIds.forEach((tileId) => counts.set(tileId, (counts.get(tileId) ?? 0) + 1))
  let score = 0
  for (const [tileId, count] of counts) {
    if (count >= 2) score += count === 2 ? 6 : 10
    const numbered = /^(man|pin|sou)(\d)$/.exec(tileId)
    if (!numbered) {
      if (count === 1) score -= 2
      continue
    }
    const rank = Number(numbered[2])
    const suit = numbered[1]
    if (rank < 9 && counts.has(`${suit}${rank + 1}`)) score += 4
    if (rank < 8 && counts.has(`${suit}${rank + 2}`)) score += 2
    if (rank >= 3 && rank <= 7) score += 0.4
  }
  const dora = nextDora(settings.doraIndicator)
  if (dora) score += (counts.get(dora) ?? 0) * 3
  return score
}

const selectDiscard = (
  hand: string[],
  settings: ExpectedValueSettings,
  previousShanten: number,
  drawnTileId: string,
) => {
  if (!settings.allowHandChange) {
    const drawnRemoved = removeOne(hand, drawnTileId)
    const drawnShanten = getShanten(normalizeHand(drawnRemoved))
    if (drawnShanten !== null && drawnShanten >= previousShanten) return { hand: drawnRemoved, shanten: drawnShanten }
  }
  const normalized = normalizeHand(hand)
  const candidates = [...new Set(normalized)].flatMap((discardTileId) => {
    const remainingHand = removeOne(normalized, discardTileId)
    const shanten = getShanten(remainingHand)
    return shanten === null ? [] : [{ discardTileId, remainingHand, shanten }]
  })
  const bestShanten = Math.min(...candidates.map((candidate) => candidate.shanten))
  const allowed = candidates
    .filter((candidate) => candidate.shanten === bestShanten || (settings.allowShantenBack && candidate.shanten === bestShanten + 1))
    .map((candidate) => ({ ...candidate, shape: shapeScore(candidate.remainingHand, settings) }))
  allowed.sort((left, right) => {
    const leftValue = left.shape - (left.shanten - bestShanten) * 16
    const rightValue = right.shape - (right.shanten - bestShanten) * 16
    return rightValue - leftValue
      || left.shanten - right.shanten
      || (TILE_MAP.get(left.discardTileId)?.order ?? 999) - (TILE_MAP.get(right.discardTileId)?.order ?? 999)
  })
  const selected = allowed[0]
  if (!selected) return null
  const matchingRawTiles = hand.filter((tileId) => normalize(tileId) === selected.discardTileId)
  const rawDiscard = matchingRawTiles.find((tileId) => !TILE_MAP.get(tileId)?.isRed) ?? matchingRawTiles[0] ?? selected.discardTileId
  return { hand: removeOne(hand, rawDiscard), shanten: selected.shanten }
}

const uniqueRawDiscards = (tileIds: string[]) => [...new Set(tileIds)]

export const calculateExpectedValues = (
  tileIds: string[],
  settings: ExpectedValueSettings,
  simulationCount = 48,
): ExpectedValueResult[] => {
  if (tileIds.length !== 14 || !getEfficiency(normalizeHand(tileIds))) return []
  const current = getEfficiency(normalizeHand(tileIds))
  const baseWall = buildWall(tileIds, settings)
  // 指定巡目のツモを終えて打牌する場面なので、次巡以降の自摸回数だけを残す。
  const drawsRemaining = Math.max(0, 18 - settings.turn)
  const stableSettings = JSON.stringify({ ...settings, turn: undefined, visibleCounts: Object.entries(settings.visibleCounts).sort() })

  return uniqueRawDiscards(tileIds).flatMap((discardTileId) => {
    const initialHand = removeOne(tileIds, discardTileId)
    const initialResult = getEfficiency(normalizeHand(initialHand))
    if (!initialResult || (!settings.allowShantenBack && initialResult.shanten > (current?.shanten ?? initialResult.shanten))) return []
    const effectiveTileCount = remainingEffectiveCount(baseWall, initialResult.effectiveTileIds)
    let wins = 0
    let tenpaiTrials = 0
    let totalWinPoints = 0
    const trials = Math.max(1, Math.floor(simulationCount))

    for (let trial = 0; trial < trials; trial += 1) {
      const seed = hashText(`${tileIds.join(',')}|${discardTileId}|${stableSettings}|${trial}`)
      const wall = shuffled(baseWall, createRandom(seed))
      let hand = [...initialHand]
      let state: { shanten: number } = initialResult
      let riichi = state.shanten === 0
      let reachedTenpai = riichi

      for (let drawIndex = 0; drawIndex < drawsRemaining && drawIndex < wall.length; drawIndex += 1) {
        const drawnTileId = wall[drawIndex]
        const drawnHand = [...hand, drawnTileId]
        const drawnShanten = getShanten(normalizeHand(drawnHand))
        if (drawnShanten === -1) {
          const score = scoreWinningHand(drawnHand, drawnTileId, {
            roundWind: settings.roundWind,
            seatWind: settings.seatWind,
            doraIndicator: settings.doraIndicator,
            includeRedDora: settings.includeRedDora,
            includeUraDora: settings.includeUraDora,
            riichi,
          })
          if (score) {
            wins += 1
            totalWinPoints += score.points
            reachedTenpai = true
          }
          break
        }
        if (riichi) continue
        const selected = selectDiscard(drawnHand, settings, state.shanten, drawnTileId)
        if (!selected) break
        hand = selected.hand
        state = { shanten: selected.shanten }
        if (state.shanten === 0) {
          riichi = true
          reachedTenpai = true
        }
      }
      if (reachedTenpai) tenpaiTrials += 1
    }

    const winProbability = wins / trials
    const tenpaiProbability = tenpaiTrials / trials
    const estimatedWinPoints = wins ? Math.round(totalWinPoints / wins) : 0
    return [{
      discardTileId,
      shanten: initialResult.shanten,
      effectiveTileIds: initialResult.effectiveTileIds,
      effectiveTileCount,
      tenpaiProbability,
      winProbability,
      estimatedWinPoints,
      expectedPoints: Math.round(totalWinPoints / trials),
    }]
  }).sort((left, right) => right.expectedPoints - left.expectedPoints
    || right.winProbability - left.winProbability
    || left.shanten - right.shanten
    || right.effectiveTileCount - left.effectiveTileCount)
}

export { scoreWinningHand } from './mahjongScore'
