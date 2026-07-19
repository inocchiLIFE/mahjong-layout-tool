import { TILE_DEFINITIONS, TILE_MAP } from '../data/tiles'
import type {
  CanvasElement,
  CanvasPoint,
  DrawingElement,
  DrawingType,
  ImageElement,
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
export const TILE_GAP = 0
export const DEFAULT_WORKSPACE_WIDTH = 900
export const DEFAULT_WORKSPACE_HEIGHT = 560
export const MIN_WORKSPACE_WIDTH = 520
export const MIN_WORKSPACE_HEIGHT = 320
// 作業領域は配置に合わせて自動拡張する。ブラウザ描画の実用的な安全上限のみ残す。
export const MAX_WORKSPACE_WIDTH = 100000
export const MAX_WORKSPACE_HEIGHT = 100000

export const SYMBOL_LABELS: Record<SymbolType, string> = {
  rectangle: '長方形（牌3枚分）',
  cross: 'バツ（牌1枚分）',
  circle: '丸（牌2枚分）',
  triangle: '三角形（牌2枚分）',
  wave: '波線（牌5枚分）',
}

export const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max))

export const snap = (value: number, enabled: boolean) =>
  enabled ? Math.round(value / GRID_SIZE) * GRID_SIZE : Math.round(value)

/**
 * A curve follows the stroke the user drew. The point furthest from the
 * start/end chord becomes the visible apex, so it can be drawn naturally in
 * any direction instead of relying on a gesture direction convention.
 */
export const getCurveControlPoint = (points: CanvasPoint[]) => {
  const start = points[0]
  const end = points.at(-1) ?? start
  const chordX = end.x - start.x
  const chordY = end.y - start.y
  const chordLength = Math.hypot(chordX, chordY)
  const apex = points.reduce((furthest, point) => {
    const distance = chordLength === 0
      ? Math.hypot(point.x - start.x, point.y - start.y)
      : Math.abs(chordX * (start.y - point.y) - (start.x - point.x) * chordY) / chordLength
    return distance > furthest.distance ? { point, distance } : furthest
  }, { point: points[Math.floor(points.length / 2)] ?? start, distance: -1 })
  // A quadratic Bézier passes through (start + 2 * control + end) / 4 at t = .5.
  return {
    x: 2 * apex.point.x - (start.x + end.x) / 2,
    y: 2 * apex.point.y - (start.y + end.y) / 2,
  }
}

export const getArrowHeadPoints = (points: CanvasPoint[], size = 11): CanvasPoint[] => {
  const start = points[0]
  const end = points.at(-1) ?? start
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  return [
    { x: end.x - size * Math.cos(angle - Math.PI / 6), y: end.y - size * Math.sin(angle - Math.PI / 6) },
    end,
    { x: end.x - size * Math.cos(angle + Math.PI / 6), y: end.y - size * Math.sin(angle + Math.PI / 6) },
  ]
}

const quadraticPoint = (start: CanvasPoint, control: CanvasPoint, end: CanvasPoint, t: number) => ({
  x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
  y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y,
})

/** Returns the visible SVG bounds, including stroke and arrow head, so the
 * selectable element never has a large invisible rectangular hit area. */
export const getDrawingVisualBounds = (points: CanvasPoint[], drawingType: DrawingType, strokeWidth: number) => {
  let visiblePoints = [...points]
  if (drawingType === 'curve') {
    const start = points[0]
    const end = points.at(-1) ?? start
    const control = getCurveControlPoint(points)
    visiblePoints = [start, end]
    ;(['x', 'y'] as const).forEach((axis) => {
      const denominator = start[axis] - 2 * control[axis] + end[axis]
      const t = denominator === 0 ? -1 : (start[axis] - control[axis]) / denominator
      if (t > 0 && t < 1) visiblePoints.push(quadraticPoint(start, control, end, t))
    })
  } else if (drawingType === 'arrow') {
    visiblePoints = [...visiblePoints, ...getArrowHeadPoints(points)]
  }
  const strokeInset = Math.max(1, strokeWidth / 2 + 1)
  return {
    minX: Math.min(...visiblePoints.map((point) => point.x)) - strokeInset,
    maxX: Math.max(...visiblePoints.map((point) => point.x)) + strokeInset,
    minY: Math.min(...visiblePoints.map((point) => point.y)) - strokeInset,
    maxY: Math.max(...visiblePoints.map((point) => point.y)) + strokeInset,
  }
}

const rotateDimensions = (width: number, height: number, rotation: Rotation) =>
  rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height }

export const getSymbolBaseDimensions = (symbolType: SymbolType) => {
  if (symbolType === 'rectangle') return { width: TILE_WIDTH * 3 + TILE_GAP * 2, height: TILE_HEIGHT }
  if (symbolType === 'circle' || symbolType === 'triangle') {
    return { width: TILE_WIDTH * 2 + TILE_GAP, height: TILE_HEIGHT }
  }
  if (symbolType === 'wave') return { width: TILE_WIDTH * 5 + TILE_GAP * 4, height: GRID_SIZE }
  return { width: TILE_WIDTH, height: TILE_HEIGHT }
}

export const getElementDimensions = (element: CanvasElement) => {
  if (element.kind === 'tile') return rotateDimensions(TILE_WIDTH, TILE_HEIGHT, element.rotation)
  if (element.kind === 'image' || element.kind === 'drawing') {
    return rotateDimensions(element.width, element.height, element.rotation)
  }
  if (element.kind === 'symbol') {
    const dimensions = getSymbolBaseDimensions(element.symbolType)
    return rotateDimensions(
      dimensions.width * (element.scaleX ?? element.scale),
      dimensions.height * (element.scaleY ?? element.scale),
      element.rotation,
    )
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
  locked: false,
})

export const makeTile = (tileId: string, x: number, y: number, zIndex: number): TileElement => ({
  ...makeBase('tile', x, y, zIndex),
  kind: 'tile',
  tileId,
  faceDown: false,
  autoX: Math.round(x),
  autoY: Math.round(y),
  autoOrder: zIndex,
})

export const makeText = (text: string, x: number, y: number, zIndex: number): TextElement => ({
  ...makeBase('text', x, y, zIndex),
  kind: 'text',
  text,
  color: '#172c27',
  fontSize: 22,
  fontFamily: 'sans-serif',
})

export const makeDrawing = (
  points: CanvasPoint[],
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
  drawingType: DrawingType = 'freehand',
): DrawingElement => ({
  ...makeBase('drawing', x, y, zIndex),
  kind: 'drawing',
  points,
  width,
  height,
  color: '#244a40',
  strokeWidth: 4,
  drawingType,
})

export const makeImage = (
  src: string,
  name: string,
  width: number,
  height: number,
  x: number,
  y: number,
  zIndex: number,
): ImageElement => ({
  ...makeBase('image', x, y, zIndex),
  kind: 'image',
  src,
  name,
  width,
  height,
  opacity: 1,
})

export const makeSymbol = (symbolType: SymbolType, x: number, y: number, zIndex: number): SymbolElement => ({
  ...makeBase('symbol', x, y, zIndex),
  kind: 'symbol',
  symbolType,
  color: symbolType === 'cross' ? '#b13f34' : '#244a40',
  strokeWidth: 4,
  scale: 1,
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
