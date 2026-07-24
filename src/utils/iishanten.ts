import { buildWall, sortTileIds } from './layout'
import { TILE_MAP } from '../data/tiles'
import { getEfficiency } from './mahjongEfficiency'

export type IishantenType = 'surplus' | 'complete' | 'headless1' | 'headless2' | 'kuttsuki'
export type CompleteFollowType = 'vertical' | 'kanchan'
export const IISHANTEN_LABELS: Record<IishantenType, string> = { surplus: '余剰牌型', complete: '完全形', headless1: 'ヘッドレス1型', headless2: 'ヘッドレス2型', kuttsuki: 'くっつき' }
export const IISHANTEN_TYPES: IishantenType[] = ['surplus', 'complete', 'headless1', 'headless2', 'kuttsuki']
const suits = ['man', 'pin', 'sou'] as const
const honor = ['ton', 'nan', 'sha', 'pei', 'haku', 'hatsu', 'chun']
const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]
const seq = () => { const suit = pick(suits); const start = 1 + Math.floor(Math.random() * 7); return [1, 2, 3].map((n) => `${suit}${start + n - 1}`) }
const triplet = () => { const id = Math.random() < .22 ? pick(honor) : `${pick(suits)}${1 + Math.floor(Math.random() * 9)}`; return [id, id, id] }
const taatsu = () => { const suit = pick(suits); const start = 1 + Math.floor(Math.random() * 7); return Math.random() < .6 ? [`${suit}${start}`, `${suit}${start + 1}`] : [`${suit}${start}`, `${suit}${start + 2}`] }
const isolated = () => `${pick(suits)}${1 + Math.floor(Math.random() * 9)}`

/** Creates the three tiles that make the extra acceptance in a complete iishanten shape.
 * Vertical: an existing taatsu tile is duplicated. Kanchan: one of the four
 * supporting tiles is added to a kanchan taatsu, e.g. 35 + 1/3/5/7. */
export const createCompleteFollow = (type: CompleteFollowType = Math.random() < .5 ? 'vertical' : 'kanchan') => {
  if (type === 'vertical') {
    const base = taatsu()
    return [...base, pick(base)]
  }
  const suit = pick(suits)
  // The base kanchan is start / start+2. Its support is outside or vertical:
  // 35 accepts 1, 3, 5, 7 to make 135, 335, 355, or 357.
  const start = 1 + Math.floor(Math.random() * 7)
  const support = [start - 2, start, start + 2, start + 4].filter((rank) => rank >= 1 && rank <= 9)
  return [`${suit}${start}`, `${suit}${start + 2}`, `${suit}${pick(support)}`]
}
export const hasLegalTileCounts = (tiles: string[]) => tiles.length === 13 && tiles.every((tile) => tiles.filter((value) => value === tile).length <= 4)

export interface IishantenDecomposition { melds: number; pairs: number; taatsu: number; isolated: number }
/** Enumerates meld-first decompositions.  Each branch removes every possible
 * triplet/sequence before classifying the remaining tiles. */
export const findMeldFirstDecompositions = (tiles: string[]): IishantenDecomposition[] => {
  const counts = new Map<string, number>(); tiles.forEach((tile) => counts.set(tile, (counts.get(tile) ?? 0) + 1))
  const keys = [...counts.keys()]
  const out: IishantenDecomposition[] = []
  const walk = (melds: number) => {
    const triplet = keys.find((key) => (counts.get(key) ?? 0) >= 3)
    if (triplet) { counts.set(triplet, counts.get(triplet)! - 3); walk(melds + 1); counts.set(triplet, counts.get(triplet)! + 3) }
    let sequenceFound = false
    for (const suit of suits) for (let rank = 1; rank <= 7; rank += 1) { const ids = [rank, rank + 1, rank + 2].map((n) => `${suit}${n}`); if (ids.every((id) => (counts.get(id) ?? 0) > 0)) { sequenceFound = true; ids.forEach((id) => counts.set(id, counts.get(id)! - 1)); walk(melds + 1); ids.forEach((id) => counts.set(id, counts.get(id)! + 1)) } }
    if (triplet || sequenceFound) return
    const rest = keys.flatMap((key) => Array.from({ length: counts.get(key) ?? 0 }, () => key))
    classifyRemainder(rest).forEach((classification) => out.push({ melds, ...classification }))
  }
  walk(0); return out
}

/** Classifies a meld-free remainder into all possible head/taatsu/single choices. */
const classifyRemainder = (tiles: string[]): Omit<IishantenDecomposition, 'melds'>[] => {
  const counts = new Map<string, number>(); tiles.forEach((tile) => counts.set(tile, (counts.get(tile) ?? 0) + 1))
  const keys = [...counts.keys()].sort(); const result: Omit<IishantenDecomposition, 'melds'>[] = []
  const walk = (pairs: number, taatsu: number, isolated: number) => {
    const id = keys.find((key) => (counts.get(key) ?? 0) > 0)
    if (!id) { result.push({ pairs, taatsu, isolated }); return }
    const remove = (ids: string[]) => ids.forEach((key) => counts.set(key, counts.get(key)! - 1)); const restore = (ids: string[]) => ids.forEach((key) => counts.set(key, counts.get(key)! + 1))
    remove([id]); walk(pairs, taatsu, isolated + 1); restore([id])
    if ((counts.get(id) ?? 0) >= 2) { remove([id, id]); walk(pairs + 1, taatsu, isolated); restore([id, id]) }
    const match = /^(man|pin|sou)(\d)$/.exec(id)
    if (match) for (const delta of [1, 2]) { const other = `${match[1]}${Number(match[2]) + delta}`; if (Number(match[2]) + delta <= 9 && (counts.get(other) ?? 0) > 0) { remove([id, other]); walk(pairs, taatsu + 1, isolated); restore([id, other]) } }
  }
  walk(0, 0, 0); return result
}


/** Returns the strongest named iishanten type, following the lecture's order:
 * surplus < complete < headless < kuttsuki. */
export const classifyIishantenCandidate = (tiles: string[]): IishantenType | null => {
  if (!hasLegalTileCounts(tiles)) return null
  const efficiency = getEfficiency(tiles)
  if (!efficiency || efficiency.shanten !== 1) return null
  const decompositions = findMeldFirstDecompositions(tiles)
  const maxMelds = Math.max(...decompositions.map((item) => item.melds))
  const matches = (melds: number, pairs: number, taatsu: number, isolated: number) => maxMelds === melds && decompositions.some((item) => item.melds === melds && item.pairs === pairs && item.taatsu === taatsu && item.isolated === isolated)
  const candidates: IishantenType[] = []

  if (matches(2, 1, 2, 1)) {
    const isolateComparisons = [...new Set(tiles)].flatMap((tile) => {
      const index = tiles.indexOf(tile); const hand = [...tiles.slice(0, index), ...tiles.slice(index + 1)]
      const remainsBaseShape = findMeldFirstDecompositions(hand).some((item) => item.melds === 2 && item.pairs === 1 && item.taatsu === 2 && item.isolated === 0)
      const without = getEfficiency(hand)
      return remainsBaseShape && without ? [efficiency.effectiveTileIds.length > without.effectiveTileIds.length || efficiency.effectiveTileCount > without.effectiveTileCount] : []
    })
    // In a complete shape the single tile supports a taatsu (vertical or
    // ryan-kan) and increases acceptance. Otherwise it is surplus.
    if (isolateComparisons.some(Boolean)) candidates.push('complete')
    else if (isolateComparisons.some((value) => !value)) candidates.push('surplus')
  }

  if (maxMelds === 3) {
    const maxMeldDecompositions = decompositions.filter((item) => item.melds === maxMelds)
    const maxTaatsu = Math.max(...maxMeldDecompositions.map((item) => item.taatsu))
    const hasHead = maxMeldDecompositions.some((item) => item.pairs > 0)
    // A possible head makes the hand kuttsuki. It wins over headless even if
    // another, weaker decomposition can turn that pair into taatsu/singles.
    if (matches(3, 1, 0, 2)) candidates.push('kuttsuki')
    if (!hasHead && maxTaatsu === 1 && matches(3, 0, 1, 2)) candidates.push('headless1')
    if (!hasHead && maxTaatsu === 2 && matches(3, 0, 2, 0)) candidates.push('headless2')
  }

  return (['kuttsuki', 'headless2', 'headless1', 'complete', 'surplus'] as IishantenType[]).find((type) => candidates.includes(type)) ?? null
}

/** Verify a generated candidate against the lecture's strongest-type rule. */
export const verifyIishantenCandidate = (type: IishantenType, tiles: string[]) => classifyIishantenCandidate(tiles) === type

/** Candidate creation is separate from validation so callers can retry safely. */
export const createIishantenCandidate = (type: IishantenType) => {
  const melds = (count: number) => Array.from({ length: count }, () => Math.random() < .5 ? seq() : triplet()).flat()
  if (type === 'surplus') { const head = isolated(); return [...melds(2), ...taatsu(), ...taatsu(), head, head, isolated()] }
  if (type === 'complete') { const head = isolated(); return [...melds(2), ...createCompleteFollow(), ...taatsu(), head, head] }
  if (type === 'headless1') return [...melds(3), ...taatsu(), isolated(), isolated()]
  if (type === 'headless2') return [...melds(3), ...taatsu(), ...taatsu()]
  const pair = [isolated(), isolated()]; return [...melds(3), ...pair, isolated(), isolated()].slice(0, 13)
}

/** Bounded retry and physical four-copy check. Detailed decomposition validation is added by callers. */
export const generateIishanten = (type: IishantenType, maxAttempts = 500) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) { const tiles = createIishantenCandidate(type); if (verifyIishantenCandidate(type, tiles)) { console.debug('[iishanten]', type, { attempt, tiles }); return sortTileIds(tiles) } }
  throw new Error(`${IISHANTEN_LABELS[type]}を生成できませんでした。もう一度お試しください。`)
}

export const generateRandomIishanten = () => {
  const type = pick(IISHANTEN_TYPES)
  return { type, tileIds: generateIishanten(type) }
}

/** Generates a 14-tile what-to-discard question. The drawn tile deliberately
 * stays at the far right so the original 13-tile iishanten shape is visible. */
export const generateIishantenQuestion = () => {
  const { type, tileIds } = generateRandomIishanten()
  const wall = buildWall()
  for (const tileId of tileIds) {
    const baseId = TILE_MAP.get(tileId)?.baseId ?? tileId
    const index = wall.findIndex((candidate) => (TILE_MAP.get(candidate)?.baseId ?? candidate) === baseId)
    if (index >= 0) wall.splice(index, 1)
  }
  const drawnTileId = pick(wall)
  return { type, tileIds: [...tileIds, drawnTileId], drawnTileId }
}

/** Lightweight test hook used by the development test runner. */
export const runIishantenGenerationChecks = (iterations = 20) => {
  for (const type of IISHANTEN_TYPES) for (let index = 0; index < iterations; index += 1) {
    const tiles = generateIishanten(type)
    if (!verifyIishantenCandidate(type, tiles)) throw new Error(`${type} validation failed`)
  }
}
