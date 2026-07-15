export type Suit = 'man' | 'pin' | 'sou' | 'honor'

export type Rotation = 0 | 90 | 180 | 270

export type SymbolType = 'rectangle' | 'cross' | 'circle'

export type PlacementMode = 'select' | 'text' | SymbolType

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
}

export interface TileElement extends CanvasElementBase {
  kind: 'tile'
  tileId: string
}

export interface TextElement extends CanvasElementBase {
  kind: 'text'
  text: string
  color: string
  fontSize: number
}

export interface SymbolElement extends CanvasElementBase {
  kind: 'symbol'
  symbolType: SymbolType
}

export type CanvasElement = TileElement | TextElement | SymbolElement

export interface Scene {
  elements: CanvasElement[]
  width: number
  height: number
}

export interface SavedLayout {
  version: 2
  savedAt: string
  scene: Scene
  settings: {
    showGrid: boolean
    snapToGrid: boolean
  }
}

export interface ElementPosition {
  id: string
  x: number
  y: number
}

