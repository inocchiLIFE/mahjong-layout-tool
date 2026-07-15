import { TILE_DEFINITIONS, TILE_MAP } from '../data/tiles'
import type {
  CanvasElement,
  Rotation,
  Scene,
  SymbolElement,
  SymbolType,
  TextElement,
  TileElement,
} from '../types'

export const GRID_SIZE = 16
export const TILE_WIDTH = 48
export const TILE_HEIGHT = 66
export const TILE_GAP = 3
export const DEFAULT_WORKSPACE_WIDTH = 900
export const DEFAULT_WORKSPACE_HEIGHT = 560
export const MIN_WORKSPACE_WIDTH = 520
export const MIN_WORKSPACE_HEIGHT = 320
export const MAX_WORKSPACE_WIDTH = 2400
export const MAX_WORKSPACE_HEIGHT = 1600

export const SYMBOL_LABELS: Record<SymbolType, string> = {
  rectangle: '長方形（牌3枚分）',
  cross: 'バツ（牌1枚分）',
  circle: '丸（牌2枚分）',
}

export const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max))

export const snap = (value: number, enabled: boolean) =>
  enabled ? Math.round(value / GRID_SIZE) * GRID_SIZE : Math.round(value)

const rotateDimensions = (width: number, height: number, rotation: Rotation) =>
  rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height }

export const getSymbolBaseDimensions = (symbolType: SymbolType) => {
  if (symbolType === 'rectangle') return { width: TILE_WIDTH * 3 + TILE_GAP * 2, height: TILE_HEIGHT }
  if (symbolType === 'circle') return { width: TILE_WIDTH * 2 + TILE_GAP, height: TILE_HEIGHT }
  return { width: TILE_WIDTH, height: TILE_HEIGHT }
}

export const getElementDimensions = (element: CanvasElement) => {
  if (element.kind === 'tile') return rotateDimensions(TILE_WIDTH, TILE_HEIGHT, element.rotation)
  if (element.kind === 'symbol') {
    const dimensions = getSymbolBaseDimensions(element.symbolType)
    return rotateDimensions(dimensions.width, dimensions.height, element.rotation)
  }
  const width = Math.max(44, Math.ceil(element.text.length * element.fontSize * 1.05) + 16)
  const height = Math.ceil(element.fontSize * 1.5) + 8
  return rotateDimensions(width, height, element.rotation)
}

export const sortTileIds = (tileIds: string[]) =>
  [...tileIds].sort((a, b) => (TILE_MAP.get(a)?.order ?? 999) - (TILE_MAP.get(b)?.order ?? 999))

export const buildWall = () => {
  const wall: string[] = []
  TILE_DEFINITIONS.filter((tile) => !tile.isRed).forEach((tile) => {
    const count = tile.rank === 5 && tile.suit !== 'honor' ? 3 : 4
    wall.push(...Array.from({ length: count }, () => tile.id))
  })
  wall.push('aka-man5', 'aka-pin5', 'aka-sou5')
  return wall
}

export const randomHand = (count: 13 | 14) => {
  const wall = buildWall()
  for (let index = wall.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[wall[index], wall[target]] = [wall[target], wall[index]]
  }
  return sortTileIds(wall.slice(0, count))
}

const makeBase = (prefix: string, x: number, y: number, zIndex: number) => ({
  id: createId(prefix),
  x: Math.round(x),
  y: Math.round(y),
  rotation: 0 as Rotation,
  selected: false,
  zIndex,
})

export const makeTile = (tileId: string, x: number, y: number, zIndex: number): TileElement => ({
  ...makeBase('tile', x, y, zIndex),
  kind: 'tile',
  tileId,
})

export const makeText = (text: string, x: number, y: number, zIndex: number): TextElement => ({
  ...makeBase('text', x, y, zIndex),
  kind: 'text',
  text,
  color: '#172c27',
  fontSize: 22,
})

export const makeSymbol = (symbolType: SymbolType, x: number, y: number, zIndex: number): SymbolElement => ({
  ...makeBase('symbol', x, y, zIndex),
  kind: 'symbol',
  symbolType,
})

export const getSceneContentBounds = (scene: Scene) => {
  let right = MIN_WORKSPACE_WIDTH
  let bottom = MIN_WORKSPACE_HEIGHT
  scene.elements.forEach((element) => {
    const dimensions = getElementDimensions(element)
    right = Math.max(right, element.x + dimensions.width + 20)
    bottom = Math.max(bottom, element.y + dimensions.height + 20)
  })
  return { width: right, height: bottom }
}

export const scenesEqual = (a: Scene, b: Scene) => JSON.stringify(a) === JSON.stringify(b)
