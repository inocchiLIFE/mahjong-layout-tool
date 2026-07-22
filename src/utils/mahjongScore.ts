import { TILE_MAP } from '../data/tiles'
import { tileIdToIndex } from './mahjongEfficiency'
import type { Wind } from './expectedValue'
import type { MahjongMeld } from './mahjongMelds'

type Meld = { kind: 'sequence' | 'triplet'; tiles: number[]; open?: boolean; kan?: boolean }
type Decomposition = { pair: number; melds: Meld[] }

export interface ScoreSettings {
  roundWind: Wind
  seatWind: Wind
  doraIndicator: string | null
  includeRedDora: boolean
  includeUraDora: boolean
  riichi: boolean
  melds?: MahjongMeld[]
}

export interface HandScore {
  han: number
  fu: number
  points: number
  yaku: string[]
  yakuman: number
}

const DRAGONS = ['haku', 'hatsu', 'chun']
const ORPHANS = new Set([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33])
const GREEN = new Set([19, 20, 21, 23, 25, 32]) // 2,3,4,6,8索・發
const isHonor = (index: number) => index >= 27
const isTerminal = (index: number) => index < 27 && (index % 9 === 0 || index % 9 === 8)
const isTerminalOrHonor = (index: number) => isHonor(index) || isTerminal(index)
const round100 = (value: number) => Math.ceil(value / 100) * 100

const nextDoraIndex = (indicator: string | null) => {
  if (!indicator) return -1
  const index = tileIdToIndex(indicator)
  if (index < 0) return -1
  if (index < 27) return Math.floor(index / 9) * 9 + ((index % 9 + 1) % 9)
  if (index <= 30) return 27 + ((index - 27 + 1) % 4)
  return 31 + ((index - 31 + 1) % 3)
}

const nextDoraFromIndex = (index: number) => {
  if (index < 27) return Math.floor(index / 9) * 9 + ((index % 9 + 1) % 9)
  if (index <= 30) return 27 + ((index - 27 + 1) % 4)
  return 31 + ((index - 31 + 1) % 3)
}

const totalTsumoPoints = (han: number, fu: number, dealer: boolean, yakuman = 0) => {
  const base = yakuman > 0 ? 8000 * yakuman
    : han >= 13 ? 8000
      : han >= 11 ? 6000
        : han >= 8 ? 4000
          : han >= 6 ? 3000
            : han >= 5 ? 2000
              : Math.min(2000, fu * 2 ** (han + 2))
  return dealer ? round100(base * 2) * 3 : round100(base * 2) + round100(base) * 2
}

const enumerateNormal = (counts: number[], fixedMelds: Meld[] = []): Decomposition[] => {
  const results: Decomposition[] = []
  for (let pair = 0; pair < 34; pair += 1) {
    if (counts[pair] < 2) continue
    counts[pair] -= 2
    const melds: Meld[] = []
    const walk = () => {
      const index = counts.findIndex((count) => count > 0)
      if (index < 0) {
        if (melds.length + fixedMelds.length === 4) results.push({ pair, melds: [...fixedMelds, ...melds].map((meld) => ({ ...meld, tiles: [...meld.tiles] })) })
        return
      }
      if (counts[index] >= 3) {
        counts[index] -= 3; melds.push({ kind: 'triplet', tiles: [index, index, index] }); walk(); melds.pop(); counts[index] += 3
      }
      if (index < 27 && index % 9 <= 6 && counts[index + 1] > 0 && counts[index + 2] > 0) {
        counts[index]--; counts[index + 1]--; counts[index + 2]--; melds.push({ kind: 'sequence', tiles: [index, index + 1, index + 2] }); walk(); melds.pop(); counts[index]++; counts[index + 1]++; counts[index + 2]++
      }
    }
    walk()
    counts[pair] += 2
  }
  return results
}

const baseDoraHan = (tileIds: string[], counts: number[], settings: ScoreSettings) => {
  let han = 0
  const dora = nextDoraIndex(settings.doraIndicator)
  if (dora >= 0) han += counts[dora]
  if (settings.includeRedDora) han += tileIds.filter((id) => TILE_MAP.get(id)?.isRed).length
  return han
}

const scoreNormal = (tileIds: string[], counts: number[], winningIndex: number, decomposition: Decomposition, settings: ScoreSettings): HandScore | null => {
  const yaku: string[] = []
  let han = 0
  let yakuman = 0
  const sequences = decomposition.melds.filter((meld) => meld.kind === 'sequence')
  const triplets = decomposition.melds.filter((meld) => meld.kind === 'triplet')
  const closed = !decomposition.melds.some((meld) => meld.open)
  const allIndices = counts.flatMap((count, index) => Array.from({ length: count }, () => index))
  const allSimples = allIndices.every((index) => !isTerminalOrHonor(index))
  const valuePair = DRAGONS.includes(indexToId(decomposition.pair)) || indexToId(decomposition.pair) === settings.roundWind || indexToId(decomposition.pair) === settings.seatWind
  const winningSequences = sequences.filter((meld) => meld.tiles.includes(winningIndex))
  const ryanmen = winningSequences.some((meld) => {
    const start = meld.tiles[0] % 9
    return (winningIndex === meld.tiles[0] && start < 6) || (winningIndex === meld.tiles[2] && start > 0)
  })
  const pairWait = decomposition.pair === winningIndex
  const kanchanOrPenchan = !ryanmen && !pairWait && winningSequences.length > 0
  const pinfu = closed && sequences.length === 4 && !valuePair && ryanmen

  if (settings.riichi && closed) { han += 1; yaku.push('立直') }
  if (closed) { han += 1; yaku.push('門前清自摸和') }
  if (allSimples) { han += 1; yaku.push('断么九') }
  if (pinfu) { han += 1; yaku.push('平和') }

  for (const meld of triplets) {
    const id = indexToId(meld.tiles[0])
    if (DRAGONS.includes(id)) { han += 1; yaku.push(`役牌 ${idLabel(id)}`) }
    if (id === settings.roundWind) { han += 1; yaku.push(`場風 ${idLabel(id)}`) }
    if (id === settings.seatWind) { han += 1; yaku.push(`自風 ${idLabel(id)}`) }
  }

  const sequenceStarts = sequences.map((meld) => meld.tiles[0])
  const duplicateGroups = [...new Set(sequenceStarts)].filter((start) => sequenceStarts.filter((value) => value === start).length >= 2).length
  if (closed && duplicateGroups >= 2) { han += 3; yaku.push('二盃口') }
  else if (closed && duplicateGroups === 1) { han += 1; yaku.push('一盃口') }
  for (let rank = 0; rank <= 6; rank += 1) if ([rank, rank + 9, rank + 18].every((start) => sequenceStarts.includes(start))) { han += closed ? 2 : 1; yaku.push('三色同順'); break }
  for (const suitStart of [0, 9, 18]) if ([suitStart, suitStart + 3, suitStart + 6].every((start) => sequenceStarts.includes(start))) { han += closed ? 2 : 1; yaku.push('一気通貫'); break }
  const tripletIndices = triplets.map((meld) => meld.tiles[0])
  for (let rank = 0; rank < 9; rank += 1) if ([rank, rank + 9, rank + 18].every((index) => tripletIndices.includes(index))) { han += 2; yaku.push('三色同刻'); break }
  if (triplets.length === 4) { han += 2; yaku.push('対々和') }
  const concealedTriplets = triplets.filter((meld) => !meld.open)
  if (concealedTriplets.length >= 3) { han += 2; yaku.push('三暗刻') }
  const kans = triplets.filter((meld) => meld.kan)
  if (kans.length >= 3) { han += 2; yaku.push('三槓子') }

  const everyGroupHasTerminalOrHonor = decomposition.melds.every((meld) => meld.tiles.some(isTerminalOrHonor)) && isTerminalOrHonor(decomposition.pair)
  const hasSequence = sequences.length > 0
  const hasHonor = allIndices.some(isHonor)
  if (everyGroupHasTerminalOrHonor && hasSequence) {
    han += hasHonor ? (closed ? 2 : 1) : (closed ? 3 : 2)
    yaku.push(hasHonor ? '混全帯么九' : '純全帯么九')
  }
  if (allIndices.every(isTerminalOrHonor)) { han += 2; yaku.push('混老頭') }
  const dragonTriplets = triplets.filter((meld) => meld.tiles[0] >= 31).length
  if (dragonTriplets === 2 && decomposition.pair >= 31) { han += 2; yaku.push('小三元') }

  const numberedSuits = new Set(allIndices.filter((index) => index < 27).map((index) => Math.floor(index / 9)))
  if (numberedSuits.size === 1) {
    han += hasHonor ? (closed ? 3 : 2) : (closed ? 6 : 5)
    yaku.push(hasHonor ? '混一色' : '清一色')
  }

  const windTriplets = triplets.filter((meld) => meld.tiles[0] >= 27 && meld.tiles[0] <= 30).length
  if (dragonTriplets === 3) { yakuman += 1; yaku.push('大三元') }
  if (windTriplets === 4) { yakuman += 2; yaku.push('大四喜') }
  else if (windTriplets === 3 && decomposition.pair >= 27 && decomposition.pair <= 30) { yakuman += 1; yaku.push('小四喜') }
  if (allIndices.every(isHonor)) { yakuman += 1; yaku.push('字一色') }
  if (allIndices.every(isTerminal)) { yakuman += 1; yaku.push('清老頭') }
  if (allIndices.every((index) => GREEN.has(index))) { yakuman += 1; yaku.push('緑一色') }
  if (concealedTriplets.length === 4) { yakuman += 1; yaku.push('四暗刻') }
  if (kans.length === 4) { yakuman += 1; yaku.push('四槓子') }
  if (numberedSuits.size === 1 && !hasHonor) {
    const suit = Math.floor(allIndices[0] / 9)
    const suitCounts = Array(9).fill(0) as number[]
    allIndices.forEach((index) => { suitCounts[index - suit * 9] += 1 })
    if (suitCounts[0] >= 3 && suitCounts[8] >= 3 && suitCounts.slice(1, 8).every((count) => count >= 1)) { yakuman += 1; yaku.push('九蓮宝燈') }
  }

  if (han === 0 && yakuman === 0) return null
  let fu = pinfu ? 20 : 22 // 副底20 + ツモ2
  if (!pinfu) {
    if (DRAGONS.includes(indexToId(decomposition.pair))) fu += 2
    if (indexToId(decomposition.pair) === settings.roundWind) fu += 2
    if (indexToId(decomposition.pair) === settings.seatWind) fu += 2
    for (const meld of triplets) {
      const base = meld.kan ? (meld.open ? 8 : 16) : (meld.open ? 2 : 4)
      fu += isTerminalOrHonor(meld.tiles[0]) ? base * 2 : base
    }
    if (pairWait || kanchanOrPenchan) fu += 2
    fu = Math.ceil(fu / 10) * 10
  }
  const dora = baseDoraHan(tileIds, counts, settings)
  if (dora) { han += dora; yaku.push(`ドラ${dora}`) }
  const points = totalTsumoPoints(han, fu, settings.seatWind === 'ton', yakuman)
  return { han, fu, points, yaku, yakuman }
}

const indexToId = (index: number) => index < 9 ? `man${index + 1}` : index < 18 ? `pin${index - 8}` : index < 27 ? `sou${index - 17}` : ['ton', 'nan', 'sha', 'pei', 'haku', 'hatsu', 'chun'][index - 27]
const idLabel = (id: string) => ({ ton: '東', nan: '南', sha: '西', pei: '北', haku: '白', hatsu: '發', chun: '中' } as Record<string, string>)[id] ?? id

export const scoreWinningHand = (tileIds: string[], winningTileId: string, settings: ScoreSettings): HandScore | null => {
  const fixed = settings.melds ?? []
  const expectedConcealedCount = 14 - fixed.length * 3
  if (tileIds.length !== expectedConcealedCount) return null
  const baseIds = tileIds.map((id) => TILE_MAP.get(id)?.baseId ?? id)
  const fixedTileIds = fixed.flatMap((meld) => meld.tileIds)
  const allTileIds = [...tileIds, ...fixedTileIds]
  const counts = Array(34).fill(0) as number[]
  for (const id of [...baseIds, ...fixedTileIds.map((tileId) => TILE_MAP.get(tileId)?.baseId ?? tileId)]) { const index = tileIdToIndex(id); if (index < 0 || ++counts[index] > 4) return null }
  const winningIndex = tileIdToIndex(TILE_MAP.get(winningTileId)?.baseId ?? winningTileId)
  if (fixed.length > 0) {
    const fixedMelds = fixed.map((meld): Meld => ({
      kind: meld.kind === 'open-sequence' ? 'sequence' : 'triplet',
      tiles: meld.tileIds.map((tileId) => tileIdToIndex(TILE_MAP.get(tileId)?.baseId ?? tileId)),
      open: meld.kind !== 'closed-kan',
      kan: meld.tileIds.length === 4,
    }))
    const concealedCounts = Array(34).fill(0) as number[]
    for (const id of baseIds) concealedCounts[tileIdToIndex(id)] += 1
    const scores = enumerateNormal(concealedCounts, fixedMelds)
      .map((decomposition) => scoreNormal(allTileIds, counts, winningIndex, decomposition, settings))
      .filter((score): score is HandScore => score !== null)
    if (!scores.length) return null
    return scores.reduce((best, score) => score.points > best.points ? score : best)
  }
  const uniqueOrphans = [...ORPHANS].filter((index) => counts[index] > 0).length
  if (uniqueOrphans === 13 && [...ORPHANS].some((index) => counts[index] >= 2)) return { han: 0, fu: 0, points: totalTsumoPoints(0, 0, settings.seatWind === 'ton', 1), yaku: ['国士無双'], yakuman: 1 }
  const pairs = counts.filter((count) => count === 2).length
  const scores: HandScore[] = []
  if (pairs === 7) {
    let han = 2 + (settings.riichi ? 1 : 0) + 1
    const yaku = ['七対子', ...(settings.riichi ? ['立直'] : []), '門前清自摸和']
    const allIndices = counts.flatMap((count, index) => Array.from({ length: count }, () => index))
    if (allIndices.every((index) => !isTerminalOrHonor(index))) { han++; yaku.push('断么九') }
    const suits = new Set(allIndices.filter((index) => index < 27).map((index) => Math.floor(index / 9)))
    const hasHonor = allIndices.some(isHonor)
    if (suits.size === 1) { han += hasHonor ? 3 : 6; yaku.push(hasHonor ? '混一色' : '清一色') }
    if (allIndices.every(isTerminalOrHonor)) { han += 2; yaku.push('混老頭') }
    const dora = baseDoraHan(tileIds, counts, settings); han += dora; if (dora) yaku.push(`ドラ${dora}`)
    scores.push({ han, fu: 25, points: totalTsumoPoints(han, 25, settings.seatWind === 'ton'), yaku, yakuman: 0 })
  }
  for (const decomposition of enumerateNormal([...counts])) {
    const score = scoreNormal(tileIds, counts, winningIndex, decomposition, settings)
    if (score) scores.push(score)
  }
  if (!scores.length) return null
  const best = scores.sort((left, right) => right.points - left.points)[0]
  if (!settings.includeUraDora || !settings.riichi || best.yakuman) return best
  const visibleIndicator = settings.doraIndicator ? tileIdToIndex(settings.doraIndicator) : -1
  let weightedPoints = 0
  let indicatorCopies = 0
  for (let indicator = 0; indicator < 34; indicator += 1) {
    const available = Math.max(0, 4 - counts[indicator] - (visibleIndicator === indicator ? 1 : 0))
    if (!available) continue
    const uraHan = counts[nextDoraFromIndex(indicator)]
    weightedPoints += totalTsumoPoints(best.han + uraHan, best.fu, settings.seatWind === 'ton') * available
    indicatorCopies += available
  }
  return indicatorCopies > 0
    ? { ...best, points: Math.round(weightedPoints / indicatorCopies), yaku: [...best.yaku, '裏ドラ期待値'] }
    : best
}
