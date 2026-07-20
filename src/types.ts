export type Suit = 'man' | 'pin' | 'sou' | 'honor'

export type Rotation = 0 | 90 | 180 | 270

export type SymbolType = 'rectangle' | 'cross' | 'circle' | 'triangle' | 'wave'

export type DrawingType = 'freehand' | 'line' | 'curve' | 'arrow'

export type PlacementMode = 'select' | 'text' | 'draw' | 'line' | 'curve' | 'arrow' | 'eraser' | SymbolType

export interface CanvasPoint {
  x: number
  y: number
}

export interface TileDefinition {
  id: string
  label: string
  shortLabel: string
  suit: Suit
  rank: number
  asset: string
  baseId: string
  isRed?: boolean
  order: number
}

export interface CanvasElementBase {
  id: string
  x: number
  y: number
  rotation: Rotation
  selected: boolean
  zIndex: number
  locked: boolean
}

export interface TileElement extends CanvasElementBase {
  kind: 'tile'
  tileId: string
  faceDown: boolean
  autoX?: number
  autoY?: number
  autoOrder?: number
}

export interface TextElement extends CanvasElementBase {
  kind: 'text'
  text: string
  color: string
  fontSize: number
  fontFamily: string
}

export interface SymbolElement extends CanvasElementBase {
  kind: 'symbol'
  symbolType: SymbolType
  color: string
  strokeWidth: number
  scale: number
  scaleX?: number
  scaleY?: number
}

export interface DrawingElement extends CanvasElementBase {
  kind: 'drawing'
  points: CanvasPoint[]
  width: number
  height: number
  color: string
  strokeWidth: number
  drawingType?: DrawingType
  arrowHeadSize?: number
}

export interface ImageElement extends CanvasElementBase {
  kind: 'image'
  src: string
  name: string
  width: number
  height: number
  opacity: number
}

export type CanvasElement = TileElement | TextElement | SymbolElement | DrawingElement | ImageElement

export interface Scene {
  elements: CanvasElement[]
  width: number
  height: number
}

export interface SavedLayout {
  version: 3
  savedAt: string
  scene: Scene
  settings: {
    showGrid: boolean
    snapToGrid: boolean
  }
}

export interface NamedSavedLayout {
  id: string
  name: string
  savedAt: string
  categoryId?: string
  layout: SavedLayout
  pages?: SavedLayout[]
  pageNames?: string[]
}

export interface ElementPosition {
  id: string
  x: number
  y: number
}

export interface ContextMenuState {
  elementId: string | null
  clientX: number
  clientY: number
  canvasX: number
  canvasY: number
}
