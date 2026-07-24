import { TILE_MAP } from '../data/tiles'
import type { TileElement } from '../types'
import type { MahjongMeld, MeldKind } from './mahjongMelds'

export interface DetectedMeld extends MahjongMeld {
  elementIds: string[]
}

const isSideways = (tile: TileElement) => tile.rotation === 90 || tile.rotation === 270

const candidateKind = (tileIds: string[]): MeldKind | null => {
  const bases = tileIds.map((tileId) => TILE_MAP.get(tileId)?.baseId ?? tileId)
  if (new Set(bases).size === 1) return bases.length === 4 ? 'open-kan' : 'open-triplet'
  if (bases.length !== 3) return null
  const tiles = bases.map((tileId) => TILE_MAP.get(tileId))
  if (tiles.some((tile) => !tile || tile.suit === 'honor')) return null
  const suit = tiles[0]!.suit
  const ranks = tiles.map((tile) => tile!.rank).sort((left, right) => left - right)
  return tiles.every((tile) => tile!.suit === suit) && ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1
    ? 'open-sequence'
    : null
}

/**
 * Treat a contiguous row containing exactly one sideways tile as an open meld.
 * The sideways tile is the visual call marker; only tiles selected for analysis
 * are inspected, so annotations elsewhere on the workspace are ignored.
 */
export const detectOpenMelds = (tiles: TileElement[]): DetectedMeld[] => {
  const candidates: Array<{ kind: MeldKind; tiles: TileElement[] }> = []
  for (const sideways of tiles.filter((tile) => !tile.faceDown && isSideways(tile))) {
    const row = tiles
      // A sideways tile is normally placed slightly lower than upright tiles.
      // Accept up to one tile width of vertical offset so snapped and manually
      // adjusted open-meld layouts are both recognized.
      .filter((tile) => !tile.faceDown && Math.abs(tile.y - sideways.y) <= 48)
      .sort((left, right) => left.x - right.x || left.zIndex - right.zIndex)
    const anchor = row.findIndex((tile) => tile.id === sideways.id)
    for (const length of [4, 3]) {
      for (let start = Math.max(0, anchor - length + 1); start <= Math.min(anchor, row.length - length); start += 1) {
        const group = row.slice(start, start + length)
        if (group.filter(isSideways).length !== 1) continue
        // A rotated tile is 66px wide (rather than 48px), so an open block
        // legitimately has wider spacing than a concealed hand.
        if (group.at(-1)!.x - group[0].x > (length - 1) * 80 + 16) continue
        if (group.some((tile, index) => index > 0 && tile.x - group[index - 1].x > 80)) continue
        const tileIds = group.map((tile) => tile.tileId)
        const kind = candidateKind(tileIds)
        if (kind) candidates.push({ kind, tiles: group })
      }
    }
  }

  const used = new Set<string>()
  return candidates
    .sort((left, right) => right.tiles.length - left.tiles.length || left.tiles[0].x - right.tiles[0].x)
    .flatMap(({ kind, tiles }) => {
      if (tiles.some((tile) => used.has(tile.id))) return []
      tiles.forEach((tile) => used.add(tile.id))
      return [{ id: `detected-${tiles.map((tile) => tile.id).join('-')}`, kind, tileIds: tiles.map((tile) => tile.tileId), elementIds: tiles.map((tile) => tile.id) }]
    })
}
