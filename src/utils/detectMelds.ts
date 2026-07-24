import { TILE_MAP } from '../data/tiles'
import type { TileElement } from '../types'
import { isValidMeld, type MahjongMeld, type MeldKind } from './mahjongMelds'

export interface DetectedMeld extends MahjongMeld {
  elementIds: string[]
}

const isSideways = (tile: TileElement) => tile.rotation === 90 || tile.rotation === 270

const candidateKind = (tileIds: string[]): MeldKind | null => {
  const bases = tileIds.map((tileId) => TILE_MAP.get(tileId)?.baseId ?? tileId)
  if (new Set(bases).size === 1) return bases.length === 4 ? 'open-kan' : 'open-triplet'
  return bases.length === 3 ? 'open-sequence' : null
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
      .filter((tile) => !tile.faceDown && Math.abs(tile.y - sideways.y) <= 20)
      .sort((left, right) => left.x - right.x || left.zIndex - right.zIndex)
    const anchor = row.findIndex((tile) => tile.id === sideways.id)
    for (const length of [4, 3]) {
      for (let start = Math.max(0, anchor - length + 1); start <= Math.min(anchor, row.length - length); start += 1) {
        const group = row.slice(start, start + length)
        if (group.filter(isSideways).length !== 1) continue
        if (group.at(-1)!.x - group[0].x > (length - 1) * 48 + 16) continue
        const tileIds = group.map((tile) => tile.tileId)
        const kind = candidateKind(tileIds)
        if (kind && isValidMeld({ id: 'candidate', kind, tileIds })) candidates.push({ kind, tiles: group })
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
