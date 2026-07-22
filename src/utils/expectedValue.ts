/*
 * The hand-transition graph and backward probability recurrence in this file
 * are adapted from tomohxx/mahjong-win-prob at revision
 * 36ac07db113ef9bad146a1e336800e8e79a52916 (GNU GPL v3.0).
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
interface StateValue { expectedPoints: number; pointWins: number; wins: number; tenpai: number }
interface GraphAction { nodeId?: number; winPoints?: number }
interface GraphTransition { weight: number; actions: GraphAction[] }
interface GraphNode { hand: string[]; shanten: number; transitions: GraphTransition[] }

const MAX_GRAPH_NODES = 6_000
const MAX_CHANGE_GRAPH_NODES = 1_500
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
  const nodes: GraphNode[] = []
  const nodeIds = new Map<string, number>()
  const deadCounts = createDeadCounts(settings)
  const originCounts = tileCounts(origin)
  const changeBudget = settings.allowHandChange || settings.allowShantenBack ? 1 : 0

  const getNode = (hand: string[]): number => {
    const sortedHand = sortHand(hand)
    const key = handKey(sortedHand)
    const existing = nodeIds.get(key)
    if (existing !== undefined) return existing
    const nodeLimit = changeBudget > 0 ? MAX_CHANGE_GRAPH_NODES : MAX_GRAPH_NODES
    if (nodes.length >= nodeLimit) throw new Error('手変わり候補が多すぎます。手変わり・向聴戻しをオフにして計算してください。')
    const shanten = getShanten(normalizeHand(sortedHand))
    if (shanten === null) throw new Error('解析できない牌姿が含まれています。')
    const nodeId = nodes.length
    const node: GraphNode = { hand: sortedHand, shanten, transitions: [] }
    nodes.push(node)
    nodeIds.set(key, nodeId)
    const canChangeDraw = changeBudget > 0 && replacementDistance(sortedHand, originCounts) + shanten < originShanten + changeBudget

    for (const draw of createDrawOptions(sortedHand, deadCounts, settings.includeRedDora)) {
      const drawnHand = [...sortedHand, draw.tileId]
      const drawnShanten = getShanten(normalizeHand(drawnHand))
      const actions: GraphAction[] = []
      if (drawnShanten === -1) {
        const score = scoreWinningHand(drawnHand, draw.tileId, {
          roundWind: settings.roundWind,
          seatWind: settings.seatWind,
          doraIndicator: settings.doraIndicator,
          includeRedDora: settings.includeRedDora,
          includeUraDora: settings.includeUraDora,
          riichi: shanten === 0,
        })
        if (score) actions.push({ winPoints: score.points })
      } else if (shanten !== 0 && (canChangeDraw || drawnShanten !== null && drawnShanten < shanten)) {
        const candidates = uniqueTiles(drawnHand).flatMap((discardTileId) => {
          const nextHand = removeOne(drawnHand, discardTileId)
          const nextShanten = getShanten(normalizeHand(nextHand))
          return nextShanten === null ? [] : [{ nextHand, nextShanten }]
        })
        const bestShanten = Math.min(...candidates.map((candidate) => candidate.nextShanten))
        const maintainedShanten = drawnShanten !== null && candidates.some((candidate) => candidate.nextShanten === drawnShanten) ? drawnShanten : bestShanten
        const canChangeDiscard = changeBudget > 0 && replacementDistance(drawnHand, originCounts) + maintainedShanten < originShanten + changeBudget
        const nextKeys = new Set<string>()
        for (const candidate of candidates) {
          if ((!canChangeDiscard || !settings.allowShantenBack) && candidate.nextShanten !== maintainedShanten) continue
          const nextKey = handKey(candidate.nextHand)
          if (nextKeys.has(nextKey)) continue
          nextKeys.add(nextKey)
          actions.push({ nodeId: getNode(candidate.nextHand) })
        }
      }
      if (actions.length) node.transitions.push({ weight: draw.count, actions })
    }
    return nodeId
  }

  return { nodes, nodeIds, deadCounts, getNode }
}

const solveGraph = (nodes: GraphNode[], settings: ExpectedValueSettings, drawsRemaining: number, initialWallSize: number) => {
  let next = nodes.map((node): StateValue => ({ expectedPoints: 0, pointWins: 0, wins: 0, tenpai: node.shanten === 0 ? 1 : 0 }))
  for (let depth = drawsRemaining - 1; depth >= 0; depth -= 1) {
    const denominator = Math.max(1, initialWallSize - settings.turn - depth)
    const current = nodes.map((node, nodeId): StateValue => {
      const baseline = next[nodeId]
      const value = { ...baseline }
      for (const transition of node.transitions) {
        const actions = transition.actions.map((action): StateValue => action.winPoints !== undefined
          ? { expectedPoints: action.winPoints, pointWins: 1, wins: 1, tenpai: 1 }
          : next[action.nodeId ?? nodeId])
        let bestPoint = baseline
        let bestWin = baseline
        let bestTenpai = baseline
        for (const action of actions) {
          if (action.expectedPoints > bestPoint.expectedPoints + 1e-8
            || Math.abs(action.expectedPoints - bestPoint.expectedPoints) <= 1e-8 && action.pointWins > bestPoint.pointWins) bestPoint = action
          if (action.wins > bestWin.wins) bestWin = action
          if (action.tenpai > bestTenpai.tenpai) bestTenpai = action
        }
        const probability = transition.weight / denominator
        if (bestPoint.expectedPoints > baseline.expectedPoints + 1e-8
          || Math.abs(bestPoint.expectedPoints - baseline.expectedPoints) <= 1e-8 && bestPoint.pointWins > baseline.pointWins) {
          value.expectedPoints += probability * (bestPoint.expectedPoints - baseline.expectedPoints)
          value.pointWins += probability * (bestPoint.pointWins - baseline.pointWins)
        }
        if (bestWin.wins > baseline.wins) value.wins += probability * (bestWin.wins - baseline.wins)
        if (bestTenpai.tenpai > baseline.tenpai) value.tenpai += probability * (bestTenpai.tenpai - baseline.tenpai)
      }
      value.pointWins = clampProbability(value.pointWins)
      value.wins = clampProbability(value.wins)
      value.tenpai = clampProbability(value.tenpai)
      return value
    })
    next = current
  }
  return next
}

export const calculateExpectedValues = (tileIds: string[], settings: ExpectedValueSettings): ExpectedValueResult[] => {
  if (tileIds.length !== 14 || !getEfficiency(normalizeHand(tileIds))) return []
  const current = getEfficiency(normalizeHand(tileIds))
  const initialHands = uniqueTiles(tileIds).flatMap((discardTileId) => {
    const hand = removeOne(tileIds, discardTileId)
    const result = getEfficiency(normalizeHand(hand))
    return result && (settings.allowShantenBack || result.shanten <= (current?.shanten ?? result.shanten)) ? [{ discardTileId, hand, result }] : []
  })
  const graph = createHandGraph(tileIds, current?.shanten ?? 8, settings)
  initialHands.forEach(({ hand }) => graph.getNode(hand))
  const deadTotal = [...graph.deadCounts.values()].reduce((sum, count) => sum + count, 0)
  const initialWallSize = Math.max(1, 136 - 13 - deadTotal)
  const values = solveGraph(graph.nodes, settings, Math.max(0, 18 - settings.turn), initialWallSize)

  return initialHands.map(({ discardTileId, hand, result }) => {
    const value = values[graph.nodeIds.get(handKey(hand)) ?? 0]
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
      estimatedWinPoints: value.pointWins > 0 ? Math.round(value.expectedPoints / value.pointWins) : 0,
      expectedPoints: Math.round(value.expectedPoints),
    }
  }).sort((left, right) => right.expectedPoints - left.expectedPoints
    || right.winProbability - left.winProbability
    || left.shanten - right.shanten
    || right.effectiveTileCount - left.effectiveTileCount)
}

export { scoreWinningHand } from './mahjongScore'
