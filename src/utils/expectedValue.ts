/*
 * The hand-transition graph and backward probability recurrence in this file
 * are a TypeScript port of nekobean/mahjong-cpp at revision
 * 453cae05caf0e3c0da13846f82c20685becaea6e (GNU GPL v3.0).
 * mahjong-cpp is based on the algorithm published by tomohxx.
 *
 * Modified 2026-07-23 for mahjong-layout-tool: TypeScript/browser port,
 * known-tile counts, red/ura dora, tenpai probability and score expectation.
 * This file and the combined application are distributed under GNU GPL v3.0.
 */
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

interface DrawOption { tileId: string; count: number }
interface StateValue { expectedPoints: number; wins: number; tenpai: number }
interface DrawEdge { targetId: number; weight: number; winPoints: number }
interface DrawNode { hand: string[]; shanten: number; riichi: boolean; edges: DrawEdge[]; values: StateValue[] }
interface DiscardNode { hand: string[]; shanten: number; sourceIds: number[]; values: StateValue[] }

const MAX_GRAPH_NODES = 12_000
const RED_IDS: Record<string, string> = { man5: 'aka-man5', pin5: 'aka-pin5', sou5: 'aka-sou5' }
const normalize = (tileId: string) => TILE_MAP.get(tileId)?.baseId ?? tileId
const normalizeHand = (tileIds: string[]) => tileIds.map(normalize)
const tileOrder = (tileId: string) => TILE_MAP.get(tileId)?.order ?? 999
const sortHand = (tileIds: string[]) => [...tileIds].sort((left, right) => tileOrder(left) - tileOrder(right) || left.localeCompare(right))
const handKey = (tileIds: string[]) => sortHand(tileIds).join(',')
const removeOne = (tileIds: string[], target: string) => {
  const exactIndex = tileIds.indexOf(target)
  const index = exactIndex >= 0 ? exactIndex : tileIds.findIndex((tileId) => normalize(tileId) === normalize(target))
  return index < 0 ? [...tileIds] : [...tileIds.slice(0, index), ...tileIds.slice(index + 1)]
}
const uniqueTiles = (tileIds: string[]) => [...new Set(tileIds)]
const clampProbability = (value: number) => Math.max(0, Math.min(1, value))

const tileCounts = (tileIds: string[]) => {
  const counts = new Map<string, number>()
  normalizeHand(tileIds).forEach((tileId) => counts.set(tileId, (counts.get(tileId) ?? 0) + 1))
  return counts
}

const replacementDistance = (tileIds: string[], originCounts: Map<string, number>) => {
  const counts = tileCounts(tileIds)
  return [...counts].reduce((sum, [tileId, count]) => sum + Math.max(0, count - (originCounts.get(tileId) ?? 0)), 0)
}

const createDeadCounts = (settings: ExpectedValueSettings) => {
  const counts = new Map<string, number>()
  for (const tileId of EXPECTED_VALUE_TILE_IDS) counts.set(tileId, Math.max(0, Math.min(4, settings.visibleCounts[tileId] ?? 0)))
  if (settings.doraIndicator) counts.set(settings.doraIndicator, Math.min(4, (counts.get(settings.doraIndicator) ?? 0) + 1))
  return counts
}

const createDrawOptions = (hand: string[], deadCounts: Map<string, number>, includeRedDora: boolean): DrawOption[] => {
  const rawCounts = new Map<string, number>()
  hand.forEach((tileId) => rawCounts.set(tileId, (rawCounts.get(tileId) ?? 0) + 1))
  const baseCounts = tileCounts(hand)
  return EXPECTED_VALUE_TILE_IDS.flatMap((baseId) => {
    const dead = deadCounts.get(baseId) ?? 0
    if (!includeRedDora || !RED_IDS[baseId]) {
      const count = Math.max(0, 4 - dead - (baseCounts.get(baseId) ?? 0))
      return count ? [{ tileId: baseId, count }] : []
    }
    const redId = RED_IDS[baseId]
    const normalCount = Math.max(0, 3 - Math.min(3, dead) - (rawCounts.get(baseId) ?? 0))
    const redCount = Math.max(0, 1 - Math.max(0, dead - 3) - (rawCounts.get(redId) ?? 0))
    return [...(normalCount ? [{ tileId: baseId, count: normalCount }] : []), ...(redCount ? [{ tileId: redId, count: redCount }] : [])]
  })
}

const createHandGraph = (origin: string[], originShanten: number, settings: ExpectedValueSettings) => {
  const drawNodes: DrawNode[] = []
  const discardNodes: DiscardNode[] = []
  const drawNodeIds = new Map<string, number>()
  const discardNodeIds = new Map<string, number>()
  const deadCounts = createDeadCounts(settings)
  const originCounts = tileCounts(origin)
  const nodeLimitMessage = '手牌変化が多すぎて計算できませんでした。向聴戻しまたは手変わりをオフにしてください。'
  const stateKey = (hand: string[], riichi: boolean) => `${handKey(hand)}|${riichi ? 1 : 0}`
  const values = () => Array.from({ length: 19 }, (): StateValue => ({ expectedPoints: 0, wins: 0, tenpai: 0 }))
  const withinChangeRange = (hand: string[], shanten: number) => replacementDistance(hand, originCounts) + shanten < originShanten + 1
  const winPoints = (hand: string[], winningTileId: string, riichi: boolean) => scoreWinningHand(hand, winningTileId, {
    roundWind: settings.roundWind,
    seatWind: settings.seatWind,
    doraIndicator: settings.doraIndicator,
    includeRedDora: settings.includeRedDora,
    includeUraDora: settings.includeUraDora,
    riichi,
  })?.points ?? 0

  const addEdge = (sourceId: number, targetId: number, weight: number, points: number) => {
    const edges = drawNodes[sourceId].edges
    if (!edges.some((edge) => edge.targetId === targetId)) edges.push({ targetId, weight, winPoints: points })
  }

  const getDrawNode = (hand: string[], riichi: boolean): number => {
    const sortedHand = sortHand(hand)
    const key = stateKey(sortedHand, riichi)
    const existing = drawNodeIds.get(key)
    if (existing !== undefined) return existing
    if (drawNodes.length + discardNodes.length >= MAX_GRAPH_NODES) throw new Error(nodeLimitMessage)
    const shanten = getShanten(normalizeHand(sortedHand))
    if (shanten === null) throw new Error('解析できない牌姿が含まれています。')
    const nodeId = drawNodes.length
    drawNodes.push({ hand: sortedHand, shanten, riichi, edges: [], values: values() })
    drawNodeIds.set(key, nodeId)
    const allowHandChange = settings.allowHandChange && !riichi && withinChangeRange(sortedHand, shanten)

    for (const draw of createDrawOptions(sortedHand, deadCounts, settings.includeRedDora)) {
      const isEffective = getShanten(normalizeHand([...sortedHand, draw.tileId]))! < shanten
      if (!allowHandChange && !isEffective) continue
      const drawnHand = [...sortedHand, draw.tileId]
      const targetId = getDiscardNode(drawnHand, riichi)
      const points = shanten === 0 && isEffective ? winPoints(drawnHand, draw.tileId, riichi) : 0
      addEdge(nodeId, targetId, draw.count, points)
    }
    return nodeId
  }

  const getDiscardNode = (hand: string[], riichi: boolean): number => {
    const sortedHand = sortHand(hand)
    const key = stateKey(sortedHand, riichi)
    const existing = discardNodeIds.get(key)
    if (existing !== undefined) return existing
    if (drawNodes.length + discardNodes.length >= MAX_GRAPH_NODES) throw new Error(nodeLimitMessage)
    const shanten = getShanten(normalizeHand(sortedHand))
    if (shanten === null) throw new Error('解析できない牌姿が含まれています。')
    const nodeId = discardNodes.length
    discardNodes.push({ hand: sortedHand, shanten, sourceIds: [], values: values() })
    discardNodeIds.set(key, nodeId)
    const allowShantenBack = settings.allowShantenBack && !riichi && withinChangeRange(sortedHand, shanten)

    for (const discardTileId of uniqueTiles(sortedHand)) {
      const nextHand = removeOne(sortedHand, discardTileId)
      const nextShanten = getShanten(normalizeHand(nextHand))
      if (nextShanten === null) continue
      const isUnnecessary = nextShanten === shanten
      if (!allowShantenBack && !isUnnecessary) continue
      const callRiichi = riichi || shanten === 0 && isUnnecessary
      const sourceId = getDrawNode(nextHand, callRiichi)
      if (!discardNodes[nodeId].sourceIds.includes(sourceId)) discardNodes[nodeId].sourceIds.push(sourceId)
      const weight = createDrawOptions(nextHand, deadCounts, settings.includeRedDora).find((draw) => draw.tileId === discardTileId)?.count ?? 0
      if (weight > 0) addEdge(sourceId, nodeId, weight, shanten === -1 ? winPoints(sortedHand, discardTileId, riichi) : 0)
    }
    return nodeId
  }

  getDiscardNode(origin, false)
  return { drawNodes, discardNodes, drawNodeIds, deadCounts, stateKey }
}

const solveGraph = (drawNodes: DrawNode[], discardNodes: DiscardNode[], initialWallSize: number) => {
  for (let turn = 18; turn >= 0; turn -= 1) {
    for (const node of drawNodes) {
      const value = node.values[turn]
      if (turn === 18) {
        if (node.shanten === 0) value.tenpai = 1
        continue
      }
      const baseline = node.values[turn + 1]
      let tenpaiDelta = 0
      let winDelta = 0
      let pointDelta = 0
      for (const edge of node.edges) {
        const target = discardNodes[edge.targetId].values[turn + 1]
        const tenpai = edge.winPoints > 0 ? 1 : target.tenpai
        const wins = edge.winPoints > 0 ? 1 : target.wins
        const points = edge.winPoints > 0 ? Math.max(edge.winPoints, target.expectedPoints) : target.expectedPoints
        tenpaiDelta += edge.weight * (tenpai - baseline.tenpai)
        winDelta += edge.weight * (wins - baseline.wins)
        pointDelta += edge.weight * (points - baseline.expectedPoints)
      }
      const denominator = Math.max(1, initialWallSize - turn)
      value.tenpai = node.shanten === 0 ? 1 : clampProbability(baseline.tenpai + tenpaiDelta / denominator)
      value.wins = clampProbability(baseline.wins + winDelta / denominator)
      value.expectedPoints = Math.max(0, baseline.expectedPoints + pointDelta / denominator)
    }

    for (const node of discardNodes) {
      const value = node.values[turn]
      for (const sourceId of node.sourceIds) {
        const source = drawNodes[sourceId].values[turn]
        value.tenpai = Math.max(value.tenpai, source.tenpai)
        value.wins = Math.max(value.wins, source.wins)
        value.expectedPoints = Math.max(value.expectedPoints, source.expectedPoints)
      }
    }
  }
}

export const calculateExpectedValues = (tileIds: string[], settings: ExpectedValueSettings): ExpectedValueResult[] => {
  if (tileIds.length !== 14 || !getEfficiency(normalizeHand(tileIds))) return []
  const current = getEfficiency(normalizeHand(tileIds))
  const graph = createHandGraph(tileIds, current?.shanten ?? 8, settings)
  const deadTotal = [...graph.deadCounts.values()].reduce((sum, count) => sum + count, 0)
  // mahjong-cpp fixes the probability denominator from the wall that is
  // visible at calculation start: 136 tiles minus the 14-tile hand and
  // dora/other known tiles. Discarded tiles are returned to this virtual
  // wall, while the denominator advances only by the turn number.
  const initialWallSize = Math.max(1, 136 - tileIds.length - deadTotal)
  solveGraph(graph.drawNodes, graph.discardNodes, initialWallSize)
  const turn = Math.max(0, Math.min(18, settings.turn))

  const initialHands = uniqueTiles(tileIds).flatMap((discardTileId) => {
    const hand = removeOne(tileIds, discardTileId)
    const result = getEfficiency(normalizeHand(hand))
    if (!result) return []
    const isUnnecessary = result.shanten === (current?.shanten ?? result.shanten)
    const callRiichi = (current?.shanten ?? 8) === 0 && isUnnecessary
    const nodeId = graph.drawNodeIds.get(graph.stateKey(hand, callRiichi))
    return nodeId === undefined ? [] : [{ discardTileId, hand, result, nodeId }]
  })

  return initialHands.map(({ discardTileId, hand, result, nodeId }) => {
    const value = graph.drawNodes[nodeId].values[turn]
    const effective = new Set(result.effectiveTileIds)
    const effectiveTileCount = createDrawOptions(hand, graph.deadCounts, settings.includeRedDora)
      .filter((draw) => effective.has(normalize(draw.tileId)))
      .reduce((sum, draw) => sum + draw.count, 0)
    return {
      discardTileId,
      shanten: result.shanten,
      effectiveTileIds: result.effectiveTileIds,
      effectiveTileCount,
      tenpaiProbability: value.tenpai,
      winProbability: value.wins,
      estimatedWinPoints: value.wins > 0 ? Math.round(value.expectedPoints / value.wins) : 0,
      expectedPoints: Math.round(value.expectedPoints),
    }
  }).sort((left, right) => right.expectedPoints - left.expectedPoints
    || right.winProbability - left.winProbability
    || left.shanten - right.shanten
    || right.effectiveTileCount - left.effectiveTileCount)
}

export { scoreWinningHand } from './mahjongScore'
