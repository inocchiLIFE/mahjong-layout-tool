import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import './App.css'
import { ContextMenu } from './components/ContextMenu'
import { CONTEXT_MENU_ITEMS, DEFAULT_CONTEXT_MENU_ITEMS, type ContextMenuItemId } from './components/contextMenuItems'
import { HelpModal } from './components/HelpModal'
import { ReferencesModal } from './components/ReferencesModal'
import { AnnouncementsModal } from './components/AnnouncementsModal'
import { PropertyEditor } from './components/PropertyEditor'
import { SavedLayoutsDialog } from './components/SavedLayoutsDialog'
import { SettingsDialog, type AppPreferences } from './components/SettingsDialog'
import { SymbolPresetDialog, type SymbolPreset } from './components/SymbolPresetDialog'
import { CustomShapeDialog } from './components/CustomShapeDialog'
import { DEFAULT_MARKER_COLOR, DEFAULT_MARKER_OPACITY, DEFAULT_MARKER_STROKE_WIDTH, DrawingPresetDialog, type DrawingPreset, type DrawingTool } from './components/DrawingPresetDialog'
import { TilePalette } from './components/TilePalette'
import { Toolbar } from './components/Toolbar'
import { Workspace } from './components/Workspace'
import { WorkspaceSizeDialog } from './components/WorkspaceSizeDialog'
import { EfficiencyPanel } from './components/EfficiencyPanel'
import { TILE_MAP } from './data/tiles'
import { useSceneHistory } from './hooks/useSceneHistory'
import type {
  CanvasElement,
  CanvasPoint,
  CustomShapeElement,
  CustomShapeTemplate,
  ContextMenuState,
  DrawingElement,
  DrawingType,
  ElementPosition,
  ImageElement,
  NamedSavedLayout,
  PlacementMode,
  Rotation,
  SavedLayout,
  Scene,
  SymbolElement,
  SymbolType,
  StrokePattern,
  TextElement,
  TextRun,
  TileElement,
} from './types'
import {
  DEFAULT_WORKSPACE_HEIGHT,
  DEFAULT_WORKSPACE_WIDTH,
  MAX_WORKSPACE_HEIGHT,
  MAX_WORKSPACE_WIDTH,
  MIN_WORKSPACE_HEIGHT,
  MIN_WORKSPACE_WIDTH,
  TILE_GAP,
  TILE_HEIGHT,
  TILE_WIDTH,
  clamp,
  createId,
  getElementDimensions,
  getSymbolBaseDimensions,
  getDrawingVisualBounds,
  getSceneContentBounds,
  makeSymbol,
  makeDrawing,
  makeImage,
  makeText,
  makeTile,
  randomHand,
  randomShapeHand,
  randomContinuousHand,
  randomSingleSuitHand,
  snap,
} from './utils/layout'
import { readLargeValue, writeLargeValue } from './utils/largeStorage'
import { generateIishanten, generateIishantenQuestion, generateRandomIishanten, IISHANTEN_LABELS, type IishantenType } from './utils/iishanten'
import { detectOpenMelds } from './utils/detectMelds'
import { DEFAULT_STROKE_PATTERN, isStrokePattern } from './utils/stroke'
import { applyTextRunStyle, normalizeTextRuns, type TextRunStyle } from './utils/textRuns'

const AUTO_SAVE_KEY = 'mahjong-layout-tool:auto-v1'
const PAGE_DECK_KEY = 'mahjong-layout-tool:page-deck-v1'
const TAB_AUTO_SAVE_SESSION_KEY = 'mahjong-layout-tool:auto-save-tab-id-v1'
const SAVED_LAYOUTS_KEY = 'mahjong-layout-tool:saved-pages-v1'
const SAVED_LAYOUT_CATEGORIES_KEY = 'mahjong-layout-tool:saved-page-categories-v1'
const HELP_KEY = 'mahjong-layout-tool:help-seen'
const PREFERENCES_KEY = 'mahjong-layout-tool:preferences-v1'
const SYMBOL_PRESETS_KEY = 'mahjong-layout-tool:symbol-presets-v1'
const DRAWING_PRESETS_KEY = 'mahjong-layout-tool:drawing-presets-v1'
const HAND_SUITS_KEY = 'mahjong-layout-tool:hand-suits-v1'
const IISHANTEN_QUESTION_TYPES_KEY = 'mahjong-layout-tool:iishanten-question-types-v1'
const CUSTOM_SHAPES_KEY = 'mahjong-layout-tool:custom-shapes-v1'
const DEFAULT_DRAWING_PRESET: DrawingPreset = { color: null, strokeWidth: 4, strokePattern: DEFAULT_STROKE_PATTERN, eraserSize: 24, arrowHeadSize: 30 }
const DEFAULT_MARKER_PRESET: DrawingPreset = { color: DEFAULT_MARKER_COLOR, strokeWidth: DEFAULT_MARKER_STROKE_WIDTH, strokePattern: DEFAULT_STROKE_PATTERN, opacity: DEFAULT_MARKER_OPACITY, eraserSize: 24 }
const EFFICIENCY_PANEL_VISIBLE_KEY = 'mahjong-layout-tool:efficiency-panel-visible-v1'
const EFFICIENCY_PANEL_WIDTH_KEY = 'mahjong-layout-tool:efficiency-panel-width-v1'
const CONTEXT_MENU_WAVE_MIGRATION_KEY = 'mahjong-layout-tool:context-wave-migration-v1'
const CONTEXT_MENU_SPOILER_MIGRATION_KEY = 'mahjong-layout-tool:context-spoiler-migration-v1'
const DEFAULT_PREFERENCES: AppPreferences = {
  showGrid: true,
  allowTileOverlap: true,
  defaultFontFamily: 'sans-serif',
  defaultTextFontSize: 35,
  defaultTextFontWeight: 400,
  defaultTextColor: '#172c27',
  defaultTextDecoration: 'none',
  defaultTextBackgroundColor: null,
  defaultShapeColor: '#244a40',
  defaultShapeStrokeWidth: 4,
  defaultShapeStrokePattern: DEFAULT_STROKE_PATTERN,
  uiScale: 1.1,
  popupFontScale: 1.2,
  contextMenuItems: DEFAULT_CONTEXT_MENU_ITEMS,
  defaultWorkspaceWidth: DEFAULT_WORKSPACE_WIDTH,
  defaultWorkspaceHeight: DEFAULT_WORKSPACE_HEIGHT,
  headerColor: '#0d3a31',
  appIconSrc: null,
}
const SYNC_CHANNEL = 'mahjong-layout-tool:tab-sync-v1'
const EMPTY_SCENE: Scene = {
  elements: [],
  width: DEFAULT_WORKSPACE_WIDTH,
  height: DEFAULT_WORKSPACE_HEIGHT,
}

const isRotation = (value: unknown): value is Rotation =>
  value === 0 || value === 90 || value === 180 || value === 270

const isSymbolType = (value: unknown): value is SymbolType =>
  value === 'rectangle' || value === 'cross' || value === 'circle' || value === 'triangle' || value === 'wave'

const isDrawingType = (value: unknown): value is DrawingType =>
  value === 'freehand' || value === 'line' || value === 'curve' || value === 'arrow' || value === 'marker'

const normalizeTextColor = (value: unknown) => {
  if (typeof value !== 'string') return '#172c27'
  const normalized = value.toLowerCase().replace(/\s/g, '')
  if (normalized === '#fff' || normalized === '#ffffff' || normalized === '#f4f0df') return '#172c27'
  return value
}

const normalizeFontWeight = (value: unknown): 400 | 700 => value === 700 ? 700 : 400

const normalizeTextDecoration = (value: unknown): 'none' | 'underline' => value === 'underline' ? 'underline' : 'none'

const normalizeTextBackgroundColor = (value: unknown): string | null => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : null

const parseTextRuns = (value: unknown, text: string, fallback: TextRunStyle) => {
  if (!Array.isArray(value)) return undefined
  const runs = value.flatMap((run) => {
    if (!run || typeof run !== 'object') return []
    const candidate = run as Record<string, unknown>
    if (typeof candidate.text !== 'string') return []
    return [{
      text: candidate.text,
      color: typeof candidate.color === 'string' ? candidate.color : fallback.color,
      fontSize: typeof candidate.fontSize === 'number' ? clamp(candidate.fontSize, 12, 72) : fallback.fontSize,
      fontFamily: typeof candidate.fontFamily === 'string' ? candidate.fontFamily : fallback.fontFamily,
      fontWeight: candidate.fontWeight === 700 ? 700 : candidate.fontWeight === 400 ? 400 : fallback.fontWeight,
      textDecoration: normalizeTextDecoration(candidate.textDecoration ?? fallback.textDecoration),
      backgroundColor: candidate.backgroundColor === null ? null : normalizeTextBackgroundColor(candidate.backgroundColor) ?? fallback.backgroundColor,
      spoiler: Boolean(candidate.spoiler),
    }]
  })
  return normalizeTextRuns(text, runs, fallback)
}

const distanceToSegment = (point: CanvasPoint, start: CanvasPoint, end: CanvasPoint) => {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const lengthSquared = deltaX * deltaX + deltaY * deltaY
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const ratio = clamp(((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared, 0, 1)
  return Math.hypot(point.x - (start.x + deltaX * ratio), point.y - (start.y + deltaY * ratio))
}

const splitFreehandDrawing = (drawing: DrawingElement, point: CanvasPoint, radius: number): CanvasPoint[][] => {
  const localPoint = { x: point.x - drawing.x, y: point.y - drawing.y }
  const samples = drawing.points.flatMap((start, index) => {
    if (index === drawing.points.length - 1) return [start]
    const end = drawing.points[index + 1]
    const count = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 2))
    return Array.from({ length: count }, (_, step) => ({ x: start.x + (end.x - start.x) * step / count, y: start.y + (end.y - start.y) * step / count }))
  })
  const chunks: CanvasPoint[][] = []
  let chunk: CanvasPoint[] = []
  for (const sample of samples) {
    if (Math.hypot(sample.x - localPoint.x, sample.y - localPoint.y) > radius + drawing.strokeWidth / 2) {
      chunk.push(sample)
    } else if (chunk.length >= 2) {
      chunks.push(chunk)
      chunk = []
    } else {
      chunk = []
    }
  }
  if (chunk.length >= 2) chunks.push(chunk)
  return chunks
}

const parseElement = (value: unknown): CanvasElement | null => {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || typeof item.x !== 'number' || typeof item.y !== 'number') return null
  const base = {
    id: item.id,
    x: Math.round(item.x),
    y: Math.round(item.y),
    rotation: isRotation(item.rotation) ? item.rotation : 0 as Rotation,
    selected: Boolean(item.selected),
    zIndex: typeof item.zIndex === 'number' ? item.zIndex : 1,
    locked: Boolean(item.locked),
    spoiler: Boolean(item.spoiler),
  }
  if (item.kind === 'tile' && typeof item.tileId === 'string' && TILE_MAP.has(item.tileId)) {
    return {
      ...base,
      kind: 'tile',
      tileId: item.tileId,
      faceDown: Boolean(item.faceDown),
      autoX: typeof item.autoX === 'number' ? Math.round(item.autoX) : base.x,
      autoY: typeof item.autoY === 'number' ? Math.round(item.autoY) : base.y,
      autoOrder: typeof item.autoOrder === 'number' ? item.autoOrder : base.zIndex,
    }
  }
  if (item.kind === 'text' && typeof item.text === 'string') {
    const fontSize = typeof item.fontSize === 'number' ? clamp(item.fontSize, 12, 72) : 22
    const fontFamily = typeof item.fontFamily === 'string' ? item.fontFamily : 'sans-serif'
    const fontWeight = normalizeFontWeight(item.fontWeight)
    const color = normalizeTextColor(item.color)
    const textDecoration = normalizeTextDecoration(item.textDecoration)
    const backgroundColor = normalizeTextBackgroundColor(item.backgroundColor)
    return {
      ...base,
      kind: 'text',
      text: item.text,
      color,
      fontSize,
      fontFamily,
      fontWeight,
      textDecoration,
      backgroundColor,
      textRuns: parseTextRuns(item.textRuns, item.text, { color, fontSize, fontFamily, fontWeight, textDecoration, backgroundColor }),
    }
  }
  if (item.kind === 'symbol' && isSymbolType(item.symbolType)) {
    return {
      ...base,
      kind: 'symbol',
      symbolType: item.symbolType,
      color: typeof item.color === 'string' ? item.color : item.symbolType === 'cross' ? '#b13f34' : '#244a40',
      strokeWidth: typeof item.strokeWidth === 'number' ? clamp(item.strokeWidth, 1, 12) : 4,
      strokePattern: isStrokePattern(item.strokePattern) ? item.strokePattern : DEFAULT_STROKE_PATTERN,
      scale: typeof item.scale === 'number' ? clamp(item.scale, 0.5, 3) : 1,
      scaleX: typeof item.scaleX === 'number' ? clamp(item.scaleX, 0.25, 12) : undefined,
      scaleY: typeof item.scaleY === 'number' ? clamp(item.scaleY, 0.25, 12) : undefined,
    }
  }
  if (item.kind === 'drawing' && Array.isArray(item.points)) {
    const points = item.points.flatMap((point) => {
      if (!point || typeof point !== 'object') return []
      const value = point as Record<string, unknown>
      return typeof value.x === 'number' && typeof value.y === 'number'
        ? [{ x: value.x, y: value.y }]
        : []
    })
    if (points.length < 2) return null
    const strokeWidth = clamp(typeof item.strokeWidth === 'number' ? item.strokeWidth : 4, 1, 20)
    const drawingType = isDrawingType(item.drawingType) ? item.drawingType : 'freehand'
    const arrowHeadSize = clamp(typeof item.arrowHeadSize === 'number' ? item.arrowHeadSize : 30, 12, 64)
    const visualBounds = getDrawingVisualBounds(points, drawingType, strokeWidth, arrowHeadSize)
    const x = Math.floor(base.x + visualBounds.minX)
    const y = Math.floor(base.y + visualBounds.minY)
    return {
      ...base,
      x,
      y,
      kind: 'drawing',
      points: points.map((point) => ({ x: point.x - visualBounds.minX, y: point.y - visualBounds.minY })),
      width: clamp(Math.max(8, Math.ceil(visualBounds.maxX - visualBounds.minX)), 8, MAX_WORKSPACE_WIDTH),
      height: clamp(Math.max(8, Math.ceil(visualBounds.maxY - visualBounds.minY)), 8, MAX_WORKSPACE_HEIGHT),
      color: typeof item.color === 'string' ? item.color : '#244a40',
      strokeWidth,
      strokePattern: isStrokePattern(item.strokePattern) ? item.strokePattern : DEFAULT_STROKE_PATTERN,
      opacity: typeof item.opacity === 'number' ? clamp(item.opacity, 0.15, 1) : drawingType === 'marker' ? DEFAULT_MARKER_OPACITY : undefined,
      drawingType,
      arrowHeadSize,
    }
  }
  if (item.kind === 'image' && typeof item.src === 'string') {
    return {
      ...base,
      kind: 'image',
      src: item.src,
      name: typeof item.name === 'string' ? item.name : '貼り付け画像',
      width: clamp(typeof item.width === 'number' ? item.width : 240, 32, MAX_WORKSPACE_WIDTH),
      height: clamp(typeof item.height === 'number' ? item.height : 180, 32, MAX_WORKSPACE_HEIGHT),
      opacity: clamp(typeof item.opacity === 'number' ? item.opacity : 1, 0.1, 1),
    }
  }
  if (item.kind === 'customShape' && typeof item.name === 'string' && Array.isArray(item.elements)) {
    const elements = item.elements.map(parseElement).filter((element): element is Exclude<CanvasElement, TileElement | CustomShapeElement> => element !== null && element.kind !== 'tile' && element.kind !== 'customShape')
    if (!elements.length) return null
    return {
      ...base,
      kind: 'customShape',
      name: item.name.slice(0, 30),
      elements,
      width: clamp(typeof item.width === 'number' ? item.width : Math.max(...elements.map((element) => element.x + getElementDimensions(element).width)), 24, MAX_WORKSPACE_WIDTH),
      height: clamp(typeof item.height === 'number' ? item.height : Math.max(...elements.map((element) => element.y + getElementDimensions(element).height)), 24, MAX_WORKSPACE_HEIGHT),
      color: typeof item.color === 'string' ? item.color : null,
    }
  }
  return null
}

const migrateVersionOne = (data: Record<string, unknown>): SavedLayout | null => {
  const oldScene = data.scene as Record<string, unknown> | undefined
  if (!oldScene || !Array.isArray(oldScene.tiles) || !Array.isArray(oldScene.texts)) return null
  const tiles = oldScene.tiles.map((value) => {
    if (!value || typeof value !== 'object') return null
    return parseElement({ ...(value as Record<string, unknown>), kind: 'tile' })
  }).filter((item): item is CanvasElement => item !== null)
  const texts = oldScene.texts.map((value) => {
    if (!value || typeof value !== 'object') return null
    return parseElement({ ...(value as Record<string, unknown>), kind: 'text' })
  }).filter((item): item is CanvasElement => item !== null)
  const settings = data.settings as Record<string, unknown> | undefined
  return {
    version: 3,
    savedAt: typeof data.savedAt === 'string' ? data.savedAt : new Date().toISOString(),
    scene: { elements: [...tiles, ...texts], width: DEFAULT_WORKSPACE_WIDTH, height: DEFAULT_WORKSPACE_HEIGHT },
    settings: {
      showGrid: settings?.showGrid !== false,
      snapToGrid: true,
    },
  }
}

const parseSavedLayout = (raw: string | null): SavedLayout | null => {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    if (data.version === 1) return migrateVersionOne(data)
    const scene = data.scene as Record<string, unknown> | undefined
    if ((data.version !== 2 && data.version !== 3) || !scene || !Array.isArray(scene.elements)) return null
    const elements = scene.elements.map(parseElement).filter((item): item is CanvasElement => item !== null)
    const settings = data.settings as Record<string, unknown> | undefined
    const initialScene: Scene = {
      elements,
      width: clamp(typeof scene.width === 'number' ? scene.width : DEFAULT_WORKSPACE_WIDTH, MIN_WORKSPACE_WIDTH, MAX_WORKSPACE_WIDTH),
      height: clamp(typeof scene.height === 'number' ? scene.height : DEFAULT_WORKSPACE_HEIGHT, MIN_WORKSPACE_HEIGHT, MAX_WORKSPACE_HEIGHT),
    }
    const bounds = getSceneContentBounds(initialScene)
    return {
      version: 3,
      savedAt: typeof data.savedAt === 'string' ? data.savedAt : new Date().toISOString(),
      scene: {
        ...initialScene,
        width: Math.max(initialScene.width, bounds.width),
        height: Math.max(initialScene.height, bounds.height),
      },
      settings: {
        showGrid: settings?.showGrid !== false,
        snapToGrid: true,
      },
    }
  } catch {
    return null
  }
}

const parseNamedSavedLayouts = (data: unknown): NamedSavedLayout[] => {
  if (!Array.isArray(data)) return []
  return data.flatMap((value) => {
      if (!value || typeof value !== 'object') return []
      const item = value as Record<string, unknown>
      const layout = parseSavedLayout(JSON.stringify(item.layout))
      if (typeof item.id !== 'string' || typeof item.name !== 'string' || !layout) return []
      return [{
        id: item.id,
        name: item.name,
        savedAt: typeof item.savedAt === 'string' ? item.savedAt : layout.savedAt,
        categoryId: typeof item.categoryId === 'string' ? item.categoryId : 'default',
        pages: Array.isArray(item.pages) ? item.pages.flatMap((page) => {
          const parsed = parseSavedLayout(JSON.stringify(page))
          return parsed ? [parsed] : []
        }) : undefined,
        pageNames: Array.isArray(item.pageNames) ? item.pageNames.filter((name): name is string => typeof name === 'string') : undefined,
        layout,
      }]
  })
}

const readNamedSavedLayouts = (): NamedSavedLayout[] => {
  try {
    return parseNamedSavedLayouts(JSON.parse(localStorage.getItem(SAVED_LAYOUTS_KEY) ?? '[]') as unknown)
  } catch {
    return []
  }
}

type SavedLayoutCategory = { id: string; name: string }
const DEFAULT_SAVED_LAYOUT_CATEGORIES: SavedLayoutCategory[] = [{ id: 'default', name: 'すべて' }]
const readSavedLayoutCategories = (): SavedLayoutCategory[] => {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED_LAYOUT_CATEGORIES_KEY) ?? '[]') as unknown
    if (!Array.isArray(value)) return DEFAULT_SAVED_LAYOUT_CATEGORIES
    const categories = value.flatMap((item) => item && typeof item === 'object' && typeof (item as Record<string, unknown>).id === 'string' && typeof (item as Record<string, unknown>).name === 'string' ? [{ id: (item as Record<string, string>).id, name: (item as Record<string, string>).name }] : [])
    return categories.some((item) => item.id === 'default') ? categories : DEFAULT_SAVED_LAYOUT_CATEGORIES
  } catch { return DEFAULT_SAVED_LAYOUT_CATEGORIES }
}

const readSharedLayout = (): SavedLayout | null => {
  try {
    const encoded = new URLSearchParams(window.location.hash.slice(1)).get('layout')
    if (!encoded) return null
    return parseSavedLayout(decodeURIComponent(escape(atob(encoded))))
  } catch {
    return null
  }
}

const readPreferences = (): AppPreferences => {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}') as Partial<AppPreferences>
    const savedContextMenuItems = Array.isArray(saved.contextMenuItems)
      ? saved.contextMenuItems.filter((item): item is ContextMenuItemId => typeof item === 'string' && CONTEXT_MENU_ITEMS.some(([id]) => id === item))
      : DEFAULT_PREFERENCES.contextMenuItems
    const addWaveToExistingMenu = localStorage.getItem(CONTEXT_MENU_WAVE_MIGRATION_KEY) !== 'done'
    if (addWaveToExistingMenu) localStorage.setItem(CONTEXT_MENU_WAVE_MIGRATION_KEY, 'done')
    const addSpoilerToExistingMenu = localStorage.getItem(CONTEXT_MENU_SPOILER_MIGRATION_KEY) !== 'done'
    if (addSpoilerToExistingMenu) localStorage.setItem(CONTEXT_MENU_SPOILER_MIGRATION_KEY, 'done')
    const migratedContextMenuItems = [...savedContextMenuItems]
    if (addWaveToExistingMenu && !migratedContextMenuItems.includes('wave')) migratedContextMenuItems.push('wave')
    if (addSpoilerToExistingMenu && !migratedContextMenuItems.includes('spoiler')) migratedContextMenuItems.push('spoiler')
    return {
      showGrid: typeof saved.showGrid === 'boolean' ? saved.showGrid : DEFAULT_PREFERENCES.showGrid,
      allowTileOverlap: typeof saved.allowTileOverlap === 'boolean' ? saved.allowTileOverlap : DEFAULT_PREFERENCES.allowTileOverlap,
      defaultFontFamily: typeof saved.defaultFontFamily === 'string' ? saved.defaultFontFamily : DEFAULT_PREFERENCES.defaultFontFamily,
      defaultTextFontSize: typeof saved.defaultTextFontSize === 'number' ? clamp(saved.defaultTextFontSize, 12, 72) : DEFAULT_PREFERENCES.defaultTextFontSize,
      defaultTextFontWeight: normalizeFontWeight(saved.defaultTextFontWeight),
      defaultTextColor: typeof saved.defaultTextColor === 'string' ? saved.defaultTextColor : DEFAULT_PREFERENCES.defaultTextColor,
      defaultTextDecoration: normalizeTextDecoration(saved.defaultTextDecoration),
      defaultTextBackgroundColor: saved.defaultTextBackgroundColor === null ? null : normalizeTextBackgroundColor(saved.defaultTextBackgroundColor) ?? DEFAULT_PREFERENCES.defaultTextBackgroundColor,
      defaultShapeColor: typeof saved.defaultShapeColor === 'string' ? saved.defaultShapeColor : DEFAULT_PREFERENCES.defaultShapeColor,
      defaultShapeStrokeWidth: typeof saved.defaultShapeStrokeWidth === 'number' ? clamp(saved.defaultShapeStrokeWidth, 1, 12) : DEFAULT_PREFERENCES.defaultShapeStrokeWidth,
      defaultShapeStrokePattern: isStrokePattern(saved.defaultShapeStrokePattern) ? saved.defaultShapeStrokePattern : DEFAULT_PREFERENCES.defaultShapeStrokePattern,
      uiScale: typeof saved.uiScale === 'number' ? clamp(saved.uiScale, 0.9, 1.3) : DEFAULT_PREFERENCES.uiScale,
      popupFontScale: typeof saved.popupFontScale === 'number' ? clamp(saved.popupFontScale, 1, 1.5) : DEFAULT_PREFERENCES.popupFontScale,
      contextMenuItems: migratedContextMenuItems,
      defaultWorkspaceWidth: typeof saved.defaultWorkspaceWidth === 'number' ? clamp(saved.defaultWorkspaceWidth, MIN_WORKSPACE_WIDTH, MAX_WORKSPACE_WIDTH) : DEFAULT_PREFERENCES.defaultWorkspaceWidth,
      defaultWorkspaceHeight: typeof saved.defaultWorkspaceHeight === 'number' ? clamp(saved.defaultWorkspaceHeight, MIN_WORKSPACE_HEIGHT, MAX_WORKSPACE_HEIGHT) : DEFAULT_PREFERENCES.defaultWorkspaceHeight,
      headerColor: typeof saved.headerColor === 'string' && /^#[0-9a-f]{6}$/i.test(saved.headerColor) ? saved.headerColor : DEFAULT_PREFERENCES.headerColor,
      appIconSrc: typeof saved.appIconSrc === 'string' && saved.appIconSrc.startsWith('data:image/') ? saved.appIconSrc : null,
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

const createSymbolPresets = (): Record<SymbolType, SymbolPreset> => Object.fromEntries(
  (['rectangle', 'triangle', 'cross', 'circle', 'wave'] as SymbolType[]).map((symbolType) => {
    const dimensions = getSymbolBaseDimensions(symbolType)
    return [symbolType, { color: null, strokeWidth: 4, strokePattern: DEFAULT_STROKE_PATTERN, width: dimensions.width, height: dimensions.height }]
  }),
) as Record<SymbolType, SymbolPreset>

const readSymbolPresets = () => {
  const defaults = createSymbolPresets()
  try {
    const saved = JSON.parse(localStorage.getItem(SYMBOL_PRESETS_KEY) ?? '{}') as Partial<Record<SymbolType, Partial<SymbolPreset>>>
    return (Object.keys(defaults) as SymbolType[]).reduce((presets, symbolType) => {
      const value = saved[symbolType]
      if (!value) return presets
      presets[symbolType] = {
        color: typeof value.color === 'string' ? value.color : presets[symbolType].color,
        strokeWidth: typeof value.strokeWidth === 'number' ? clamp(value.strokeWidth, 1, 12) : presets[symbolType].strokeWidth,
        strokePattern: isStrokePattern(value.strokePattern) ? value.strokePattern : presets[symbolType].strokePattern,
        width: typeof value.width === 'number' ? clamp(value.width, 24, MAX_WORKSPACE_WIDTH) : presets[symbolType].width,
        height: typeof value.height === 'number' ? clamp(value.height, 16, MAX_WORKSPACE_HEIGHT) : presets[symbolType].height,
      }
      return presets
    }, defaults)
  } catch { return defaults }
}

const createDrawingPresets = (): Record<DrawingTool, DrawingPreset> => Object.fromEntries(
  (['draw', 'line', 'curve', 'arrow', 'marker', 'eraser'] as DrawingTool[]).map((tool) => [tool, { ...(tool === 'marker' ? DEFAULT_MARKER_PRESET : DEFAULT_DRAWING_PRESET) }]),
) as Record<DrawingTool, DrawingPreset>
const readDrawingPresets = (): Record<DrawingTool, DrawingPreset> => {
  const defaults = createDrawingPresets()
  try {
    const saved = JSON.parse(localStorage.getItem(DRAWING_PRESETS_KEY) ?? '{}') as Partial<Record<DrawingTool, Partial<DrawingPreset>>>
    return (Object.keys(defaults) as DrawingTool[]).reduce((result, tool) => ({
      ...result,
      [tool]: { ...defaults[tool], ...saved[tool], color: tool === 'marker' ? saved[tool]?.color ?? defaults[tool].color : saved[tool]?.color === '#244a40' ? null : saved[tool]?.color ?? null, strokePattern: isStrokePattern(saved[tool]?.strokePattern) ? saved[tool]!.strokePattern : defaults[tool].strokePattern, opacity: tool === 'marker' && typeof saved[tool]?.opacity === 'number' ? clamp(saved[tool]!.opacity!, 0.15, 1) : defaults[tool].opacity, arrowHeadSize: typeof saved[tool]?.arrowHeadSize === 'number' ? clamp(saved[tool]!.arrowHeadSize!, 12, 64) : defaults[tool].arrowHeadSize },
    }), {} as Record<DrawingTool, DrawingPreset>)
  } catch { return defaults }
}

const readHandSuits = (): Array<'man' | 'pin' | 'sou'> => {
  try {
    const saved = JSON.parse(localStorage.getItem(HAND_SUITS_KEY) ?? '[]') as unknown
    return Array.isArray(saved) ? saved.filter((suit): suit is 'man' | 'pin' | 'sou' => suit === 'man' || suit === 'pin' || suit === 'sou') : []
  } catch { return [] }
}

const readIishantenQuestionTypes = (): IishantenType[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(IISHANTEN_QUESTION_TYPES_KEY) ?? '[]') as unknown
    const allowed: IishantenType[] = ['surplus', 'complete', 'headless1', 'headless2', 'kuttsuki']
    return Array.isArray(saved) ? saved.filter((type): type is IishantenType => allowed.includes(type as IishantenType)) : []
  } catch { return [] }
}

const readCustomShapes = (): CustomShapeTemplate[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_SHAPES_KEY) ?? '[]') as unknown
    if (!Array.isArray(saved)) return []
    return saved.flatMap((value): CustomShapeTemplate[] => {
      if (!value || typeof value !== 'object') return []
      const item = value as Partial<CustomShapeTemplate>
      return typeof item.id === 'string' && typeof item.name === 'string' && Array.isArray(item.elements)
        ? [{ id: item.id, name: item.name.slice(0, 30), elements: item.elements.filter((element): element is CanvasElement => Boolean(element) && typeof element === 'object' && (element as CanvasElement).kind !== 'tile') }]
        : []
    }).filter((item) => item.elements.length > 0)
  } catch { return [] }
}

const loadImageFile = (file: File) => new Promise<{ src: string; width: number; height: number }>((resolve, reject) => {
  if (!file.type.startsWith('image/')) {
    reject(new Error('not-image'))
    return
  }
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => {
    URL.revokeObjectURL(url)
    const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      reject(new Error('canvas'))
      return
    }
    context.drawImage(image, 0, 0, width, height)
    const format = file.type === 'image/png' ? 'image/png' : 'image/webp'
    resolve({ src: canvas.toDataURL(format, 0.88), width, height })
  }
  image.onerror = () => {
    URL.revokeObjectURL(url)
    reject(new Error('load'))
  }
  image.src = url
})

const App = () => {
  const [preferences, setPreferences] = useState(readPreferences)
  const [sharedLayout] = useState(readSharedLayout)
  const [tabAutoSaveKey] = useState(() => {
    let tabId = sessionStorage.getItem(TAB_AUTO_SAVE_SESSION_KEY)
    if (!tabId) {
      tabId = createId('workspace')
      sessionStorage.setItem(TAB_AUTO_SAVE_SESSION_KEY, tabId)
    }
    return `${AUTO_SAVE_KEY}:${tabId}`
  })
  const [initialLayout] = useState(() => sharedLayout)
  const defaultScene = { ...EMPTY_SCENE, width: preferences.defaultWorkspaceWidth, height: preferences.defaultWorkspaceHeight }
  const history = useSceneHistory(initialLayout?.scene ?? defaultScene)
  const scene = history.scene
  const [rulerCount, setRulerCount] = useState(() => initialLayout?.scene.elements.filter((element) => element.kind === 'tile').length ?? 0)
  const [showGrid, setShowGrid] = useState(initialLayout?.settings.showGrid ?? preferences.showGrid)
  const snapToGrid = true
  const [defaultTextStyle, setDefaultTextStyle] = useState({ fontFamily: preferences.defaultFontFamily, fontSize: preferences.defaultTextFontSize, fontWeight: preferences.defaultTextFontWeight, color: preferences.defaultTextColor, textDecoration: preferences.defaultTextDecoration, backgroundColor: preferences.defaultTextBackgroundColor })
  const [defaultShapeColor, setDefaultShapeColor] = useState(preferences.defaultShapeColor)
  const [defaultShapeStrokeWidth, setDefaultShapeStrokeWidth] = useState(preferences.defaultShapeStrokeWidth)
  const [defaultShapeStrokePattern, setDefaultShapeStrokePattern] = useState<StrokePattern>(preferences.defaultShapeStrokePattern)
  const [eraserSize, setEraserSize] = useState(() => readDrawingPresets().eraser.eraserSize)
  const [symbolPresets, setSymbolPresets] = useState(readSymbolPresets)
  const [symbolPresetTarget, setSymbolPresetTarget] = useState<SymbolType | null>(null)
  const [drawingPresets, setDrawingPresets] = useState(readDrawingPresets)
  const [drawingPresetTarget, setDrawingPresetTarget] = useState<DrawingTool | null>(null)
  const [handSuits, setHandSuits] = useState(readHandSuits)
  const [iishantenQuestionTypes, setIishantenQuestionTypes] = useState(readIishantenQuestionTypes)
  const [customShapes, setCustomShapes] = useState(readCustomShapes)
  const [customShapeSaveOpen, setCustomShapeSaveOpen] = useState(false)
  const [customShapeEditId, setCustomShapeEditId] = useState<string | null>(null)
  const [draggedCustomShapeId, setDraggedCustomShapeId] = useState<string | null>(null)
  const [efficiencyPanelVisible, setEfficiencyPanelVisible] = useState(() => localStorage.getItem(EFFICIENCY_PANEL_VISIBLE_KEY) !== 'false')
  const [efficiencyPanelWidth, setEfficiencyPanelWidth] = useState(() => {
    const value = Number(localStorage.getItem(EFFICIENCY_PANEL_WIDTH_KEY))
    return Number.isFinite(value) ? clamp(value, 190, 5000) : 260
  })
  const symbolColors = (Object.keys(symbolPresets) as SymbolType[]).reduce((colors, symbolType) => {
    colors[symbolType] = symbolPresets[symbolType].color ?? defaultShapeColor
    return colors
  }, {} as Record<SymbolType, string>)
  const symbolSizes = (Object.keys(symbolPresets) as SymbolType[]).reduce((sizes, symbolType) => {
    sizes[symbolType] = { width: symbolPresets[symbolType].width, height: symbolPresets[symbolType].height }
    return sizes
  }, {} as Record<SymbolType, { width: number; height: number }>)
  const symbolStrokeWidths = (Object.keys(symbolPresets) as SymbolType[]).reduce((widths, symbolType) => {
    widths[symbolType] = symbolPresets[symbolType].strokeWidth
    return widths
  }, {} as Record<SymbolType, number>)
  const symbolStrokePatterns = (Object.keys(symbolPresets) as SymbolType[]).reduce((patterns, symbolType) => {
    patterns[symbolType] = symbolPresets[symbolType].strokePattern ?? defaultShapeStrokePattern
    return patterns
  }, {} as Record<SymbolType, StrokePattern>)
  const [placementMode, setPlacementMode] = useState<PlacementMode>('select')
  const [editTextRequest, setEditTextRequest] = useState<{ id: string; token: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [propertyElementId, setPropertyElementId] = useState<string | null>(null)
  const [clipboard, setClipboard] = useState<CanvasElement[]>([])
  const [trashActive, setTrashActive] = useState(false)
  const [savedLayouts, setSavedLayouts] = useState<NamedSavedLayout[]>(readNamedSavedLayouts)
  const [savedLayoutCategories, setSavedLayoutCategories] = useState<SavedLayoutCategory[]>(readSavedLayoutCategories)
  const [storageReady, setStorageReady] = useState(false)
  const [savedLayoutsOpen, setSavedLayoutsOpen] = useState(false)
  const [pages, setPages] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PAGE_DECK_KEY) ?? '[]') as Array<{ id?: string; name?: string; scene?: Scene }>
      if (saved.length && saved.every((page) => page.scene)) return saved.map((page, index) => ({ id: page.id ?? createId('page'), name: page.name?.slice(0, 40) || String(index + 1), scene: page.scene! }))
    } catch { /* use a new deck */ }
    return [{ id: createId('page'), name: '1', scene: initialLayout?.scene ?? defaultScene }]
  })
  const [activePageIndex, setActivePageIndex] = useState(0)
  const [helpOpen, setHelpOpen] = useState(() => localStorage.getItem(HELP_KEY) !== '1')
  const [referencesOpen, setReferencesOpen] = useState(false)
  const [announcementsOpen, setAnnouncementsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [showWorkspaceBoundary, setShowWorkspaceBoundary] = useState(false)
  const [pngTransparent, setPngTransparent] = useState(false)
  const [exportingTransparent, setExportingTransparent] = useState(false)
  const [workspaceSizeOpen, setWorkspaceSizeOpen] = useState(false)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef(pages)
  const switchPageRef = useRef<(index: number) => void>(() => {})
  pagesRef.current = pages
  const imageInputRef = useRef<HTMLInputElement>(null)
  const shareInputRef = useRef<HTMLInputElement>(null)
  const imageAnchorRef = useRef<{ x: number; y: number } | null>(null)
  const pasteAnchorRef = useRef<CanvasPoint | null>(null)
  const autoSaveWarningShownRef = useRef(false)
  const hasInteractedBeforeRestoreRef = useRef(false)
  const toastTimerRef = useRef<number | null>(null)
  const restoreHistoryLoadRef = useRef(history.load)
  const sharedLayoutRef = useRef(sharedLayout)
  const syncChannelRef = useRef<BroadcastChannel | null>(null)
  const tabIdRef = useRef(createId('tab'))
  restoreHistoryLoadRef.current = history.load

  const notify = (message: string) => {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2400)
  }

  const makeSavedLayout = (): SavedLayout => ({
    version: 3,
    savedAt: new Date().toISOString(),
    scene,
    settings: { showGrid, snapToGrid },
  })

  const notifySavedLayoutsChanged = () => {
    syncChannelRef.current?.postMessage({ type: 'layouts', sender: tabIdRef.current })
  }

  const applySharedPreferences = (next: AppPreferences) => {
    setPreferences(next)
    setShowGrid(next.showGrid)
    setDefaultTextStyle((current) => ({ ...current, fontFamily: next.defaultFontFamily, fontSize: next.defaultTextFontSize, fontWeight: next.defaultTextFontWeight, color: next.defaultTextColor, textDecoration: next.defaultTextDecoration, backgroundColor: next.defaultTextBackgroundColor }))
    setDefaultShapeColor(next.defaultShapeColor)
    setDefaultShapeStrokeWidth(next.defaultShapeStrokeWidth)
    setDefaultShapeStrokePattern(next.defaultShapeStrokePattern)
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next))
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (icon) icon.href = next.appIconSrc || `${import.meta.env.BASE_URL}favicon.svg`
  }

  const savePreferences = (next: AppPreferences) => {
    applySharedPreferences(next)
    setSettingsOpen(false)
    notify('設定を保存しました')
  }

  useEffect(() => {
    let cancelled = false
    const restoreLargeStorage = async () => {
      try {
        let storedLayouts = await readLargeValue<unknown>(SAVED_LAYOUTS_KEY)
        if (storedLayouts === null) {
          const legacyLayouts = readNamedSavedLayouts()
          storedLayouts = legacyLayouts
          if (legacyLayouts.length) await writeLargeValue(SAVED_LAYOUTS_KEY, legacyLayouts)
        }
        if (!cancelled) setSavedLayouts(parseNamedSavedLayouts(storedLayouts))

        const storedAutoSave = await readLargeValue<unknown>(tabAutoSaveKey)
        const restored = storedAutoSave ? parseSavedLayout(JSON.stringify(storedAutoSave)) : null
        if (!cancelled && !sharedLayoutRef.current && restored && !hasInteractedBeforeRestoreRef.current) {
          restoreHistoryLoadRef.current(restored.scene)
          setRulerCount(restored.scene.elements.filter((element) => element.kind === 'tile').length)
          setShowGrid(restored.settings.showGrid)
        }
        localStorage.removeItem(SAVED_LAYOUTS_KEY)
      } catch {
        if (!cancelled) notify('大容量保存の初期化に失敗しました')
      } finally {
        if (!cancelled) setStorageReady(true)
      }
    }
    void restoreLargeStorage()
    return () => { cancelled = true }
  }, [tabAutoSaveKey])

  useEffect(() => {
    if (!storageReady) return
    const layout = {
      version: 3,
      savedAt: new Date().toISOString(),
      scene,
      settings: { showGrid, snapToGrid },
    } satisfies SavedLayout
    void writeLargeValue(tabAutoSaveKey, layout).then(() => {
      autoSaveWarningShownRef.current = false
    }).catch(() => {
      if (!autoSaveWarningShownRef.current) {
        autoSaveWarningShownRef.current = true
        setToast('ブラウザの保存領域を確保できませんでした')
      }
    })
  }, [scene, showGrid, snapToGrid, storageReady, tabAutoSaveKey])

  useEffect(() => {
    if (!storageReady || typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(SYNC_CHANNEL)
    syncChannelRef.current = channel

    channel.onmessage = (event: MessageEvent<{ type?: string; sender?: string }>) => {
      if (event.data.sender === tabIdRef.current) return
      if (event.data.type === 'layouts') {
        void readLargeValue<unknown>(SAVED_LAYOUTS_KEY).then((stored) => setSavedLayouts(parseNamedSavedLayouts(stored)))
      }
    }
    return () => {
      channel.close()
      if (syncChannelRef.current === channel) syncChannelRef.current = null
    }
  }, [storageReady])

  // Keep preferences and reusable tool defaults in sync across tabs, while
  // intentionally leaving each tab's workspace scene untouched.
  useEffect(() => {
    const syncSharedState = (event: StorageEvent) => {
      if (event.key === PREFERENCES_KEY) {
        const next = readPreferences()
        setPreferences(next)
        setShowGrid(next.showGrid)
        setDefaultTextStyle({ fontFamily: next.defaultFontFamily, fontSize: next.defaultTextFontSize, fontWeight: next.defaultTextFontWeight, color: next.defaultTextColor, textDecoration: next.defaultTextDecoration, backgroundColor: next.defaultTextBackgroundColor })
        setDefaultShapeColor(next.defaultShapeColor)
        setDefaultShapeStrokeWidth(next.defaultShapeStrokeWidth)
        setDefaultShapeStrokePattern(next.defaultShapeStrokePattern)
        const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
        if (icon) icon.href = next.appIconSrc || `${import.meta.env.BASE_URL}favicon.svg`
      } else if (event.key === SYMBOL_PRESETS_KEY) {
        setSymbolPresets(readSymbolPresets())
      } else if (event.key === DRAWING_PRESETS_KEY) {
        const next = readDrawingPresets()
        setDrawingPresets(next)
        setEraserSize(next.eraser.eraserSize)
      } else if (event.key === HAND_SUITS_KEY) {
        setHandSuits(readHandSuits())
      } else if (event.key === IISHANTEN_QUESTION_TYPES_KEY) {
        setIishantenQuestionTypes(readIishantenQuestionTypes())
      } else if (event.key === CUSTOM_SHAPES_KEY) {
        setCustomShapes(readCustomShapes())
      } else if (event.key === 'mahjong-layout-tool:custom-colors-v1') {
        window.dispatchEvent(new Event('mahjong-custom-colors-changed'))
      }
    }
    window.addEventListener('storage', syncSharedState)
    return () => window.removeEventListener('storage', syncSharedState)
  }, [])

  const nextZIndex = () => Math.max(0, ...scene.elements.map((element) => element.zIndex)) + 1

  useEffect(() => {
    setPages((current) => current.map((page, index) => index === activePageIndex ? { ...page, scene } : page))
  }, [scene, activePageIndex])

  useEffect(() => {
    try { localStorage.setItem(PAGE_DECK_KEY, JSON.stringify(pages)) } catch { /* browser storage may be full */ }
  }, [pages])

  useEffect(() => { localStorage.setItem(EFFICIENCY_PANEL_VISIBLE_KEY, String(efficiencyPanelVisible)) }, [efficiencyPanelVisible])
  useEffect(() => { localStorage.setItem(EFFICIENCY_PANEL_WIDTH_KEY, String(efficiencyPanelWidth)) }, [efficiencyPanelWidth])
  useEffect(() => {
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (icon) icon.href = preferences.appIconSrc || `${import.meta.env.BASE_URL}favicon.svg`
  }, [preferences.appIconSrc])

  const switchPage = (index: number) => {
    if (index === activePageIndex || !pagesRef.current[index]) return
    const next = pagesRef.current.map((page, pageIndex) => pageIndex === activePageIndex ? { ...page, scene } : page)
    setPages(next)
    setActivePageIndex(index)
    history.reset(next[index].scene)
  }
  switchPageRef.current = switchPage

  const addPage = () => {
    const blank = { ...EMPTY_SCENE, width: scene.width, height: scene.height }
    const next = [...pagesRef.current.map((page, index) => index === activePageIndex ? { ...page, scene } : page), { id: createId('page'), name: String(pagesRef.current.length + 1), scene: blank }]
    setPages(next)
    setActivePageIndex(next.length - 1)
    history.reset(blank)
  }

  const deletePage = (index: number) => {
    const current = pagesRef.current
    if (current.length === 1) {
      const blank = { ...EMPTY_SCENE, width: scene.width, height: scene.height }
      setPages([{ ...current[0], scene: blank }])
      history.reset(blank)
      return
    }
    const next = current.filter((_, pageIndex) => pageIndex !== index)
    const nextIndex = Math.min(index, next.length - 1)
    setPages(next)
    setActivePageIndex(nextIndex)
    history.reset(next[nextIndex].scene)
  }

  const reorderPages = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return
    const next = [...pagesRef.current]
    const [page] = next.splice(from, 1)
    next.splice(to, 0, page)
    setPages(next)
    setActivePageIndex(next.findIndex((item) => item.id === pagesRef.current[activePageIndex].id))
  }

  const renamePage = (index: number) => {
    const page = pagesRef.current[index]
    const name = window.prompt('ページ名を入力してください', page?.name)
    if (!page || !name?.trim()) return
    setPages((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: name.trim() } : item))
  }

  useEffect(() => {
    const changePage = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (event.key === 'ArrowLeft' && activePageIndex > 0) { event.preventDefault(); switchPageRef.current(activePageIndex - 1) }
      if (event.key === 'ArrowRight' && activePageIndex < pagesRef.current.length - 1) { event.preventDefault(); switchPageRef.current(activePageIndex + 1) }
    }
    window.addEventListener('keydown', changePage)
    return () => window.removeEventListener('keydown', changePage)
  }, [activePageIndex])

  const addTile = (tileId: string, dropX?: number, dropY?: number) => {
    hasInteractedBeforeRestoreRef.current = true
    const isDropped = dropX !== undefined || dropY !== undefined
    // 牌一覧からのクリック追加は、常に左上の初期位置から開始する。
    // 途中で牌を移動しても追加の開始位置は変えず、既存牌だけを避ける。
    const requestedX = isDropped ? snap(dropX ?? 32, snapToGrid) : 32
    // Align palette additions with the ruler's first tick, directly below it.
    const y = isDropped ? snap(dropY ?? 0, snapToGrid) : 0

    history.commitLatest((currentScene) => {
      let x = requestedX
      if (!preferences.allowTileOverlap || !isDropped) {
        const overlapsTile = (candidateX: number) => currentScene.elements.some((element) => {
          if (element.kind !== 'tile') return false
          const dimensions = getElementDimensions(element)
          return candidateX < element.x + dimensions.width
            && candidateX + TILE_WIDTH > element.x
            && y < element.y + dimensions.height
            && y + TILE_HEIGHT > element.y
        })
        while (overlapsTile(x)) x += TILE_WIDTH + TILE_GAP
      }
      const zIndex = Math.max(0, ...currentScene.elements.map((element) => element.zIndex)) + 1
      const tile = makeTile(tileId, x, y, zIndex)
      if (isDropped) {
        delete tile.autoX
        delete tile.autoY
        delete tile.autoOrder
      }
      return {
        ...currentScene,
        elements: [...currentScene.elements.map((element) => ({ ...element, selected: false })), tile],
      }
    })
    setRulerCount((count) => Math.min(13, count + 1))
    setPlacementMode('select')
  }

  const selectElement = (id: string, additive: boolean) => {
    const target = scene.elements.find((element) => element.id === id)
    if (!target) return
    const toggleOff = target.selected && !additive && target.kind !== 'tile'
    const preserveGroup = target.selected && !additive && target.kind === 'tile'
    history.updateLive({
      ...scene,
      elements: scene.elements.map((element) => ({
        ...element,
        selected: element.id === id
          ? toggleOff ? false : additive ? !element.selected : true
          : additive || preserveGroup ? element.selected : false,
      })),
    })
  }

  const selectRange = (ids: string[], additive: boolean) => {
    const selectedIds = new Set(ids)
    history.updateLive({
      ...scene,
      elements: scene.elements.map((element) => ({
        ...element,
        selected: additive ? element.selected || selectedIds.has(element.id) : selectedIds.has(element.id),
      })),
    })
  }

  const clearSelection = () => {
    if (!scene.elements.some((element) => element.selected)) return
    history.updateLive({ ...scene, elements: scene.elements.map((element) => ({ ...element, selected: false })) })
  }

  const moveElements = (positions: ElementPosition[]) => {
    const byId = new Map(positions.map((position) => [position.id, position]))
    const movedTile = scene.elements.some((element) => {
      const position = byId.get(element.id)
      return element.kind === 'tile' && !element.locked && position !== undefined
        && (position.x !== element.x || position.y !== element.y)
    })
    if (movedTile) setRulerCount(0)
    const elements = scene.elements.map((element) => {
        const position = byId.get(element.id)
        return position && !element.locked ? { ...element, x: position.x, y: position.y } : element
      })
    history.updateLive({
      ...scene,
      elements,
    })
  }

  const deleteElements = (ids: string[]) => {
    const targetIds = new Set(ids)
    const elements = scene.elements.filter((element) => !targetIds.has(element.id) || element.locked)
    if (elements.length === scene.elements.length) return
    const removedTiles = scene.elements.filter((element) => element.kind === 'tile' && targetIds.has(element.id) && !element.locked).length
    setRulerCount((count) => Math.max(0, count - removedTiles))
    history.commit({ ...scene, elements })
    notify('牌一覧へドロップした配置物を削除しました')
  }

  const eraseAt = (point: CanvasPoint, radius: number) => {
    let changed = false
    const elements = scene.elements.flatMap((element) => {
      if (element.kind === 'tile' || element.locked) return [element]
      if (element.kind === 'drawing' && (!element.drawingType || element.drawingType === 'freehand' || element.drawingType === 'marker')) {
        const touchesStroke = element.points.some((item, index) => index > 0 && distanceToSegment(
          { x: point.x - element.x, y: point.y - element.y },
          element.points[index - 1],
          item,
        ) <= radius + element.strokeWidth / 2)
        if (!touchesStroke) return [element]
        changed = true
        return splitFreehandDrawing(element, point, radius).map((points, index) => ({ ...element, id: index === 0 ? element.id : createId('drawing'), points, selected: false }))
      }
      if (element.kind === 'text') {
        const dimensions = getElementDimensions(element)
        const withinRow = point.y >= element.y - radius && point.y <= element.y + dimensions.height + radius
        if (!withinRow) return [element]
        const characters = Array.from(element.text)
        const characterWidth = dimensions.width / Math.max(characters.length, 1)
        const first = Math.max(0, Math.floor((point.x - radius - element.x) / characterWidth))
        const last = Math.min(characters.length - 1, Math.floor((point.x + radius - element.x) / characterWidth))
        if (last < 0 || first >= characters.length) return [element]
        const text = characters.filter((_, index) => index < first || index > last).join('')
        changed = true
        return text ? [{ ...element, text, selected: false }] : []
      }
      const dimensions = getElementDimensions(element)
      const touchesElement = point.x >= element.x - radius && point.x <= element.x + dimensions.width + radius
        && point.y >= element.y - radius && point.y <= element.y + dimensions.height + radius
      if (!touchesElement) return [element]
      changed = true
      return []
    })
    if (changed) history.updateLive({ ...scene, elements })
  }

  const deleteSelected = () => {
    const elements = scene.elements.filter((element) => !element.selected || element.locked)
    if (elements.length === scene.elements.length) return
    history.commit({ ...scene, elements })
  }

  const toggleTileFace = (id: string) => {
    const target = scene.elements.find((element) => element.id === id)
    if (!target || target.kind !== 'tile' || target.locked) return
    const targetIds = new Set(
      target.selected
        ? scene.elements.filter((element) => element.kind === 'tile' && element.selected && !element.locked).map((element) => element.id)
        : [id],
    )
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => element.kind === 'tile' && targetIds.has(element.id)
        ? { ...element, faceDown: !element.faceDown }
        : element),
    })
  }

  const toggleSelectedTileFaces = () => {
    const selectedIds = new Set(
      scene.elements
        .filter((element) => element.kind === 'tile' && element.selected && !element.locked)
        .map((element) => element.id),
    )
    if (!selectedIds.size) return
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => element.kind === 'tile' && selectedIds.has(element.id)
        ? { ...element, faceDown: !element.faceDown }
        : element),
    })
  }

  const resolveRotatedTileOverlaps = (elements: CanvasElement[], rotatedIds: Set<string>) => {
    const positions = new Map(elements.map((element) => [element.id, element]))
    const targets = elements.filter((element): element is TileElement => element.kind === 'tile' && rotatedIds.has(element.id)).sort((left, right) => left.x - right.x)
    for (const target of targets) {
      const currentTarget = positions.get(target.id)
      if (!currentTarget || currentTarget.kind !== 'tile') continue
      const targetBottom = currentTarget.y + getElementDimensions(currentTarget).height
      let rightEdge = currentTarget.x + getElementDimensions(currentTarget).width
      const rowTiles = [...positions.values()]
        .filter((element): element is TileElement => element.kind === 'tile' && element.id !== currentTarget.id && !element.locked && element.x >= currentTarget.x && Math.abs(element.y + getElementDimensions(element).height - targetBottom) < TILE_HEIGHT / 2)
        .sort((left, right) => left.x - right.x)
      for (const tile of rowTiles) {
        const resolved = positions.get(tile.id)
        if (!resolved || resolved.kind !== 'tile') continue
        if (resolved.x < rightEdge) positions.set(resolved.id, { ...resolved, x: rightEdge })
        const current = positions.get(tile.id) as TileElement
        rightEdge = current.x + getElementDimensions(current).width
      }
    }
    return elements.map((element) => positions.get(element.id) ?? element)
  }
  const rotateSelected = () => {
    if (!scene.elements.some((element) => element.selected && !element.locked)) return
    const horizontalizingTiles = scene.elements.filter((element) => element.kind === 'tile' && element.selected && !element.locked && (element.rotation === 0 || element.rotation === 180))
    const verticalizingTiles = scene.elements.filter((element) => element.kind === 'tile' && element.selected && !element.locked && (element.rotation === 90 || element.rotation === 270))
    const nextElements = scene.elements.map((element) => {
      if (element.kind === 'tile') {
        const rightShift = horizontalizingTiles
          .filter((source) => source.id !== element.id && element.x >= source.x + TILE_WIDTH && Math.abs(element.y - source.y) < TILE_HEIGHT / 2)
          .length * (TILE_HEIGHT - TILE_WIDTH)
          - verticalizingTiles
            .filter((source) => source.id !== element.id && element.x >= source.x + TILE_HEIGHT && Math.abs(element.y - source.y) < TILE_HEIGHT / 2)
            .length * (TILE_HEIGHT - TILE_WIDTH)
        if (element.locked) return element
        if (!element.selected) return rightShift ? { ...element, x: element.x + rightShift } : element
        const rotation = ((element.rotation + 90) % 360) as Rotation
        return { ...element, x: element.x + rightShift, y: element.y + ((element.rotation === 0 || element.rotation === 180) ? TILE_HEIGHT - TILE_WIDTH : TILE_WIDTH - TILE_HEIGHT), rotation }
      }
      if (!element.selected || element.locked) return element
      return { ...element, rotation: ((element.rotation + 90) % 360) as Rotation } as CanvasElement
    })
    history.commit({ ...scene, elements: resolveRotatedTileOverlaps(nextElements, new Set([...horizontalizingTiles, ...verticalizingTiles].map((tile) => tile.id))) })
  }

  const rotateTile = (id: string) => {
    const target = scene.elements.find((element) => element.id === id && element.kind === 'tile' && !element.locked)
    if (!target || target.kind !== 'tile') return
    const horizontalizing = target.rotation === 0 || target.rotation === 180
    const shift = TILE_HEIGHT - TILE_WIDTH
    const nextElements = scene.elements.map((element) => {
        if (element.id === target.id) return { ...element, y: element.y + (horizontalizing ? shift : -shift), rotation: ((element.rotation + 90) % 360) as Rotation }
        if (element.kind === 'tile' && element.x >= target.x + (horizontalizing ? TILE_WIDTH : TILE_HEIGHT) && Math.abs(element.y - target.y) < TILE_HEIGHT / 2 && !element.locked) return { ...element, x: element.x + (horizontalizing ? shift : -shift) }
        return element
      })
    history.commit({ ...scene, elements: resolveRotatedTileOverlaps(nextElements, new Set([target.id])) })
  }

  const generateHand = (type: 6 | 7 | 13 | 14 | '6-triplet' | 'continuous' | 'iishanten-random' | 'iishanten-question' | IishantenType) => {
    const isIishanten = typeof type === 'string' && ['surplus', 'complete', 'headless1', 'headless2', 'kuttsuki', 'iishanten-random', 'iishanten-question'].includes(type)
    const isIishantenQuestion = type === 'iishanten-question'
    const count: number = isIishantenQuestion ? 14 : isIishanten ? 13 : type === '6-triplet' ? 6 : type === 'continuous' ? 5 : type as number
    let tileIds: string[]
    let generatedIishantenType: IishantenType | null = null
    try {
      if (type === 'iishanten-question') {
        const question = generateIishantenQuestion(iishantenQuestionTypes); tileIds = question.tileIds; generatedIishantenType = question.type
      } else if (type === 'iishanten-random') {
        const hand = generateRandomIishanten(); tileIds = hand.tileIds; generatedIishantenType = hand.type
      } else tileIds = isIishanten ? generateIishanten(type as IishantenType) : type === 'continuous' ? randomContinuousHand(handSuits) : type === '6-triplet' ? randomShapeHand(6, true, handSuits) : type === 6 || type === 7 ? randomShapeHand(type, false, handSuits) : handSuits.length ? randomSingleSuitHand(type as 13 | 14, handSuits) : randomHand(type as 13 | 14)
    } catch (error) { notify(error instanceof Error ? error.message : '生成に失敗しました'); return }
    const totalWidth = count * TILE_WIDTH + (count - 1) * TILE_GAP
    const width = clamp(Math.max(scene.width, totalWidth + 40), MIN_WORKSPACE_WIDTH, MAX_WORKSPACE_WIDTH)
    // The ruler begins at x=32 and the canvas begins immediately below it.
    const startX = 32
    const zStart = nextZIndex()
    // A generated hand remains replaceable until the user moves a tile.  Moved
    // (or manually added) tiles are kept as a separate hand when generating again.
    const retained = scene.elements.filter((element) => element.kind !== 'tile'
      || element.autoX === undefined || element.autoY === undefined
      || element.x !== element.autoX || element.y !== element.autoY,
    ).map((element) => ({ ...element, selected: false }))
    history.commit({
      ...scene,
      width,
      elements: [
        ...retained,
        ...tileIds.map((tileId, index) => makeTile(tileId, startX + index * (TILE_WIDTH + TILE_GAP), 0, zStart + index)),
      ],
    })
    setRulerCount(count)
    setPlacementMode('select')
    const generatedLabel = generatedIishantenType ? IISHANTEN_LABELS[generatedIishantenType] : isIishanten ? IISHANTEN_LABELS[type as IishantenType] : type === 'continuous' ? '連続形' : type === '6-triplet' ? '6枚形暗刻含み' : `${count}枚${count === 6 || count === 7 ? '形' : 'の配牌'}`
    notify(`${generatedLabel}${isIishantenQuestion ? 'の何切る問題' : ''}を生成し、理牌しました`)
  }

  const sortSelectedTiles = () => {
    const selectedTiles = scene.elements.filter((element): element is TileElement => element.kind === 'tile' && element.selected && !element.locked)
    if (!selectedTiles.length) return
    const detectedMelds = detectOpenMelds(selectedTiles)
    const meldTileIds = new Set(detectedMelds.flatMap((meld) => meld.elementIds))
    const sortableTiles = selectedTiles.filter((tile) => !meldTileIds.has(tile.id))
    if (!sortableTiles.length) {
      notify(`副露${detectedMelds.length}組を保持しました`)
      return
    }
    const targetIds = [...sortableTiles].sort((left, right) => left.y - right.y || left.x - right.x || left.zIndex - right.zIndex).map((tile) => tile.id)
    const sortedTileIds = [...sortableTiles].sort((left, right) => (TILE_MAP.get(left.tileId)?.order ?? Number.MAX_SAFE_INTEGER) - (TILE_MAP.get(right.tileId)?.order ?? Number.MAX_SAFE_INTEGER)).map((tile) => tile.tileId)
    const tileIdsByTarget = new Map(targetIds.map((id, index) => [id, sortedTileIds[index]]))
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => element.kind === 'tile' && tileIdsByTarget.has(element.id)
        ? { ...element, tileId: tileIdsByTarget.get(element.id)! }
        : element),
    })
    notify(`${sortableTiles.length}枚を理牌しました${detectedMelds.length ? `（副露${detectedMelds.length}組を保持）` : ''}`)
  }

  const commitText = (text: string, x = 40, y?: number, id?: string, textRuns?: TextRun[]) => {
    if (id) {
      history.commit({
        ...scene,
        elements: scene.elements.map((element) => element.id === id && element.kind === 'text' && !element.locked
          ? { ...element, text, textRuns: textRuns?.length ? textRuns : undefined }
          : element),
      })
      return
    }
    const textCount = scene.elements.filter((element) => element.kind === 'text').length
    const item = { ...makeText(text, x, y ?? Math.min(scene.height - 50, 180 + textCount * 48), nextZIndex()), ...defaultTextStyle, textRuns: textRuns?.length ? textRuns : undefined }
    history.commit({ ...scene, elements: [...scene.elements, item] })
  }

  const placeSymbol = (symbolType: SymbolType, x: number, y: number, returnToSelect = false) => {
    const preset = symbolPresets[symbolType]
    const base = getSymbolBaseDimensions(symbolType)
    const item = {
      ...makeSymbol(symbolType, x, y, nextZIndex()),
      color: preset.color ?? defaultShapeColor,
      strokeWidth: preset.strokeWidth,
      strokePattern: preset.strokePattern ?? defaultShapeStrokePattern,
      scaleX: preset.width / base.width,
      scaleY: preset.height / base.height,
    }
    const dimensions = getElementDimensions(item)
    item.x = snap(x - dimensions.width / 2, snapToGrid)
    item.y = snap(y - dimensions.height / 2, snapToGrid)
    history.commit({ ...scene, elements: [...scene.elements, item] })
    if (returnToSelect) setPlacementMode('select')
  }

  const saveCustomShape = (name: string, color: string) => {
    const elements = scene.elements.filter((element) => element.selected && element.kind !== 'tile')
    if (!elements.length) return
    const minX = Math.min(...elements.map((element) => element.x))
    const minY = Math.min(...elements.map((element) => element.y))
    const template: CustomShapeTemplate = {
      id: createId('custom-shape'),
      name,
      color,
      elements: elements.map((element) => ({ ...structuredClone(element), id: createId('custom-shape-element'), x: element.x - minX, y: element.y - minY, selected: false, locked: false, zIndex: element.zIndex })),
    }
    setCustomShapes((current) => {
      const next = [...current, template].slice(-30)
      localStorage.setItem(CUSTOM_SHAPES_KEY, JSON.stringify(next))
      return next
    })
    setCustomShapeSaveOpen(false)
    notify(`「${name}」をマイ図形に保存しました`)
  }

  const insertCustomShape = (id: string, anchor?: { x: number; y: number }) => {
    const template = customShapes.find((shape) => shape.id === id)
    if (!template) return
    history.commitLatest((latestScene) => {
      const zStart = Math.max(0, ...latestScene.elements.map((element) => element.zIndex)) + 1
      const width = Math.max(...template.elements.map((element) => element.x + getElementDimensions(element).width))
      const height = Math.max(...template.elements.map((element) => element.y + getElementDimensions(element).height))
      const content = getSceneContentBounds(latestScene)
      const x = anchor ? clamp(anchor.x - width / 2, 0, latestScene.width - width) : latestScene.elements.length ? Math.min(latestScene.width - 40, content.width + 12) : 40
      const y = anchor ? clamp(anchor.y - height / 2, 0, latestScene.height - height) : 80
      const added: CustomShapeElement = { id: createId('custom-shape-instance'), kind: 'customShape', name: template.name, elements: structuredClone(template.elements) as CustomShapeElement['elements'], x: snap(x, snapToGrid), y: snap(y, snapToGrid), width, height, color: template.color ?? null, rotation: 0, selected: true, locked: false, zIndex: zStart }
      return { ...latestScene, elements: [...latestScene.elements.map((element) => ({ ...element, selected: false })), added] }
    })
    setPlacementMode('select')
    notify(`「${template.name}」を追加しました`)
  }

  const deleteCustomShape = (id: string) => setCustomShapes((current) => {
    const target = current.find((shape) => shape.id === id)
    const next = current.filter((shape) => shape.id !== id)
    localStorage.setItem(CUSTOM_SHAPES_KEY, JSON.stringify(next))
    if (target) notify(`「${target.name}」をマイ図形から削除しました`)
    return next
  })

  const renameCustomShape = (id: string, name: string, color: string) => setCustomShapes((current) => {
    const next = current.map((shape) => shape.id === id ? { ...shape, name, color } : shape)
    localStorage.setItem(CUSTOM_SHAPES_KEY, JSON.stringify(next))
    notify('マイ図形の名前を変更しました')
    return next
  })

  const commitDrawing = (points: CanvasPoint[], drawingType: DrawingType = 'freehand') => {
    if (points.length < 2) return
    const tool: DrawingTool = drawingType === 'freehand' ? 'draw' : drawingType
    const preset = drawingPresets[tool]
    const strokeWidth = preset.strokeWidth
    const arrowHeadSize = drawingType === 'arrow' ? preset.arrowHeadSize ?? 30 : undefined
    const bounds = getDrawingVisualBounds(points, drawingType, strokeWidth, arrowHeadSize)
    const x = Math.floor(bounds.minX)
    const y = Math.floor(bounds.minY)
    const width = Math.max(8, Math.ceil(bounds.maxX - x))
    const height = Math.max(8, Math.ceil(bounds.maxY - y))
    const relative = points.map((point) => ({ x: point.x - x, y: point.y - y }))
    const item = makeDrawing(relative, x, y, width, height, nextZIndex(), drawingType)
    history.commit({ ...scene, elements: [...scene.elements, { ...item, color: preset.color ?? defaultShapeColor, strokeWidth, strokePattern: preset.strokePattern ?? defaultShapeStrokePattern, opacity: drawingType === 'marker' ? preset.opacity ?? DEFAULT_MARKER_OPACITY : undefined, arrowHeadSize }] })
  }

  const addImageFile = async (file: File, anchor?: { x: number; y: number } | null) => {
    try {
      const loaded = await loadImageFile(file)
      const displayScale = Math.min(1, 360 / loaded.width, 260 / loaded.height)
      const width = Math.max(32, Math.round(loaded.width * displayScale))
      const height = Math.max(32, Math.round(loaded.height * displayScale))
      history.commitLatest((latestScene) => {
        const centerX = anchor?.x ?? latestScene.width / 2
        const centerY = anchor?.y ?? latestScene.height / 2
        const x = centerX - width / 2
        const y = centerY - height / 2
        const zIndex = 1
        const item = makeImage(loaded.src, file.name || '貼り付け画像', width, height, x, y, zIndex)
        return {
          ...latestScene,
          elements: [...latestScene.elements.map((element) => ({ ...element, selected: false })), { ...item, selected: true }],
        }
      })
      notify('画像をWorkspaceへ追加しました')
    } catch {
      notify('画像を読み込めませんでした')
    }
  }

  const requestImage = (anchor?: { x: number; y: number }) => {
    imageAnchorRef.current = anchor ?? null
    imageInputRef.current?.click()
  }

  const duplicateSelected = () => {
    const sources = scene.elements.filter((element) => element.selected)
    if (!sources.length) return
    const zStart = nextZIndex()
    const copies = sources.map((source, index) => {
      const dimensions = getElementDimensions(source)
      return {
        ...source,
        id: createId(source.kind),
        x: clamp(source.x + 18, 0, scene.width - dimensions.width),
        y: clamp(source.y + 18, 0, scene.height - dimensions.height),
        selected: true,
        locked: false,
        zIndex: zStart + index,
        // 複製は手動配置として扱う。自動配置の続き位置を変えないため、
        // 元の牌が持つ自動配置スロットは引き継がない。
        ...(source.kind === 'tile' ? { autoX: undefined, autoY: undefined, autoOrder: undefined } : {}),
      }
    }) as CanvasElement[]
    history.commit({
      ...scene,
      elements: [...scene.elements.map((element) => ({ ...element, selected: false })), ...copies],
    })
  }

  const copySelected = () => {
    const sources = scene.elements.filter((element) => element.selected)
    if (!sources.length) return
    setClipboard(sources.map((element) => ({ ...element })))
    const notation = (['man', 'pin', 'sou', 'honor'] as const).map((suit) => {
      const digits = sources
        .filter((element): element is TileElement => element.kind === 'tile' && TILE_MAP.get(element.tileId)?.suit === suit)
        .sort((left, right) => (TILE_MAP.get(left.tileId)?.rank ?? 0) - (TILE_MAP.get(right.tileId)?.rank ?? 0))
        .map((element) => element.tileId.startsWith('aka-') ? '0' : String(TILE_MAP.get(element.tileId)?.rank ?? ''))
        .join('')
      return digits ? `${digits}${suit === 'man' ? 'm' : suit === 'pin' ? 'p' : suit === 'sou' ? 's' : 'z'}` : ''
    }).join('')
    if (notation) void navigator.clipboard?.writeText(notation).catch(() => undefined)
    notify(`${sources.length}件をコピーしました`)
  }

  const pasteTileNotation = (text: string, anchor = pasteAnchorRef.current) => {
    const normalized = text.trim().replace(/\s/g, '')
    const notationText = normalized.normalize('NFKC').toLowerCase()
    const characterTile = (character: string) => {
      const manRank = '一二三四五六七八九'.indexOf(character)
      if (manRank >= 0) return `man${manRank + 1}`
      const pinRank = '①②③④⑤⑥⑦⑧⑨'.indexOf(character)
      if (pinRank >= 0) return `pin${pinRank + 1}`
      const souRank = '123456789１２３４５６７８９'.indexOf(character)
      if (souRank >= 0) return `sou${souRank % 9 + 1}`
      return ({ 東: 'ton', 南: 'nan', 西: 'sha', 北: 'pei', 白: 'haku', 發: 'hatsu', 発: 'hatsu', 中: 'chun' } as Record<string, string>)[character] ?? null
    }
    const tileIds: Array<string | null> = []
    for (let index = 0; index < normalized.length;) {
      const match = notationText.slice(index).match(/^([0-9]+)([mpsz])/)
      if (match) {
        const [, digits, suffix] = match
        tileIds.push(...[...digits].map((digit) => {
          if (suffix === 'z') return digit >= '1' && digit <= '7' ? ['ton', 'nan', 'sha', 'pei', 'haku', 'hatsu', 'chun'][Number(digit) - 1] : null
          if (digit === '0') return suffix === 'm' ? 'aka-man5' : suffix === 'p' ? 'aka-pin5' : 'aka-sou5'
          return digit >= '1' && digit <= '9' ? `${suffix === 'm' ? 'man' : suffix === 'p' ? 'pin' : 'sou'}${digit}` : null
        }))
        index += match[0].length
      } else {
        tileIds.push(characterTile(normalized[index]))
        index += 1
      }
    }
    if (!tileIds.length || tileIds.some((tileId) => !tileId || !TILE_MAP.has(tileId))) return false
    const totalWidth = tileIds.length * TILE_WIDTH + Math.max(0, tileIds.length - 1) * TILE_GAP
    let startX = clamp(anchor?.x ?? 32, 0, scene.width - totalWidth)
    const startY = clamp(anchor?.y ?? 0, 0, scene.height - TILE_HEIGHT)
    if (!anchor) while (scene.elements.some((element) => element.kind === 'tile' && element.y < TILE_HEIGHT && element.y + TILE_HEIGHT > 0 && startX < element.x + TILE_WIDTH && startX + totalWidth > element.x)) startX += TILE_WIDTH + TILE_GAP
    const zStart = nextZIndex()
    history.commit({
      ...scene,
      elements: [
        ...scene.elements.map((element) => ({ ...element, selected: false })),
        ...tileIds.map((tileId, index) => {
          const tile = makeTile(tileId!, startX + index * (TILE_WIDTH + TILE_GAP), startY, zStart + index)
          delete tile.autoX; delete tile.autoY; delete tile.autoOrder
          return { ...tile, selected: true }
        }),
      ],
    })
    setRulerCount((count) => Math.min(13, count + tileIds.length))
    return true
  }

  const pasteClipboard = (anchor?: { x: number; y: number }) => {
    if (!clipboard.length) return false
    const minX = Math.min(...clipboard.map((element) => element.x))
    const minY = Math.min(...clipboard.map((element) => element.y))
    const offsetX = anchor ? anchor.x - minX : 20
    const offsetY = anchor ? anchor.y - minY : 20
    const zStart = nextZIndex()
    const copies = clipboard.map((source, index) => {
      const dimensions = getElementDimensions(source)
      return {
        ...source,
        id: createId(source.kind),
        x: clamp(source.x + offsetX, 0, scene.width - dimensions.width),
        y: clamp(source.y + offsetY, 0, scene.height - dimensions.height),
        selected: true,
        locked: false,
        zIndex: zStart + index,
        // 貼り付けも自動配置の連番には参加させない。
        ...(source.kind === 'tile' ? { autoX: undefined, autoY: undefined, autoOrder: undefined } : {}),
      }
    }) as CanvasElement[]
    history.commit({
      ...scene,
      elements: [...scene.elements.map((element) => ({ ...element, selected: false })), ...copies],
    })
    return true
  }

  const pasteFromClipboard = async (anchor: { x: number; y: number }) => {
    if (pasteClipboard(anchor)) return
    try {
      const text = (await navigator.clipboard.readText()).trim()
      if (!text) return
      if (!pasteTileNotation(text, anchor)) commitText(text, anchor.x, anchor.y)
    } catch {
      notify('クリップボードを読み取れませんでした。Ctrl+Vでも貼り付けできます')
    }
  }

  const moveSelectedBy = (requestedX: number, requestedY: number) => {
    const selected = scene.elements.filter((element) => element.selected && !element.locked)
    if (!selected.length) return
    const deltaX = requestedX
    const deltaY = requestedY
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => element.selected && !element.locked
        ? { ...element, x: element.x + deltaX, y: element.y + deltaY }
        : element),
    })
  }

  const toggleLock = (id: string) => {
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => element.id === id ? { ...element, locked: !element.locked } : element),
    })
  }

  const getSpoilerTargets = (id: string) => {
    const selectedTargets = scene.elements.filter((element) => element.selected && !element.locked)
    return selectedTargets.some((element) => element.id === id)
      ? selectedTargets
      : scene.elements.filter((element) => element.id === id && !element.locked)
  }

  const toggleElementSpoiler = (id: string) => {
    const targets = getSpoilerTargets(id)
    if (!targets.length) return
    const shouldHide = targets.some((element) => !element.spoiler)
    const targetIds = new Set(targets.map((element) => element.id))
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => {
        if (!targetIds.has(element.id)) return element
        if (shouldHide) return { ...element, spoiler: true }
        if (element.kind !== 'text') return { ...element, spoiler: false }
        return { ...element, spoiler: false, textRuns: element.textRuns?.map((run) => ({ ...run, spoiler: false })) }
      }),
    })
  }

  const revealElementSpoiler = (id: string) => {
    const target = scene.elements.find((element) => element.id === id)
    if (!target || !target.spoiler || target.locked) return
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => {
        if (element.id !== id) return element
        if (element.kind !== 'text') return { ...element, spoiler: false }
        return { ...element, spoiler: false, textRuns: element.textRuns?.map((run) => ({ ...run, spoiler: false })) }
      }),
    })
  }

  const updateTextSpoiler = (id: string, start: number, end: number, spoiler: boolean) => {
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => {
        if (element.id !== id || element.kind !== 'text' || element.locked) return element
        const fallback: TextRunStyle = {
          color: element.color,
          fontSize: element.fontSize,
          fontFamily: element.fontFamily,
          fontWeight: element.fontWeight,
          textDecoration: element.textDecoration ?? 'none',
          backgroundColor: element.backgroundColor ?? null,
        }
        return { ...element, textRuns: applyTextRunStyle(element.text, element.textRuns, start, end, { spoiler }, fallback) }
      }),
    })
  }

  const revealTextSpoiler = (id: string, start: number, end: number) => updateTextSpoiler(id, start, end, false)

  const moveSelectedLayers = (direction: 'front' | 'back') => {
    const targets = scene.elements.filter((element) => element.selected && !element.locked && element.kind !== 'image')
    if (!targets.length) return
    const targetIds = new Set(targets.map((element) => element.id))
    const nonImageElements = scene.elements.filter((element) => element.kind !== 'image')
    const orderedTargets = [...targets].sort((a, b) => a.zIndex - b.zIndex)
    const boundary = direction === 'front'
      ? Math.max(0, ...nonImageElements.map((element) => element.zIndex)) + 1
      : Math.min(0, ...nonImageElements.map((element) => element.zIndex)) - orderedTargets.length
    const zIndexes = new Map(orderedTargets.map((element, index) => [element.id, boundary + index]))
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => targetIds.has(element.id) ? { ...element, zIndex: zIndexes.get(element.id)! } : element),
    })
  }

  const saveProperties = (
    id: string,
    properties: {
      text?: string
      color?: string
      fontSize?: number
      fontFamily?: string
      fontWeight?: 400 | 700
      textDecoration?: 'none' | 'underline'
      backgroundColor?: string | null
      strokeWidth?: number
      opacity?: number
      customShapeColor?: string | null
    },
  ) => {
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => {
        if (element.id !== id || element.locked || element.kind === 'tile') return element
        let updated: TextElement | SymbolElement | DrawingElement | ImageElement | CustomShapeElement
        if (element.kind === 'text') {
          updated = {
              ...element,
              text: properties.text ?? element.text,
              color: properties.color ?? element.color,
              fontSize: clamp(properties.fontSize ?? element.fontSize, 12, 72),
              fontFamily: properties.fontFamily ?? element.fontFamily,
              fontWeight: normalizeFontWeight(properties.fontWeight ?? element.fontWeight),
              textDecoration: properties.textDecoration ?? element.textDecoration ?? 'none',
              backgroundColor: properties.backgroundColor === undefined ? element.backgroundColor ?? null : properties.backgroundColor,
              textRuns: undefined,
            }
        } else if (element.kind === 'symbol') {
          updated = {
            ...element,
            color: properties.color ?? element.color,
            strokeWidth: clamp(properties.strokeWidth ?? element.strokeWidth, 1, 12),
          }
        } else if (element.kind === 'drawing') {
          updated = {
            ...element,
            color: properties.color ?? element.color,
            strokeWidth: clamp(properties.strokeWidth ?? element.strokeWidth, 1, 20),
          }
        } else if (element.kind === 'image') {
          updated = {
            ...element,
            opacity: clamp(properties.opacity ?? element.opacity, 0.1, 1),
          }
        } else {
          updated = { ...element, color: properties.customShapeColor ?? element.color }
        }
        return updated
      }),
    })
    setPropertyElementId(null)
  }

  // ホームタブの色ボタンはプロパティ画面を経由せず、選択中の要素へ即時反映する。
  // これにより、パレットをクリックしたときに編集パネルの開閉状態に左右されない。
  const updateElementColor = (id: string, color: string) => {
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => {
        if (element.id !== id || element.locked) return element
        if (element.kind !== 'text' && element.kind !== 'symbol' && element.kind !== 'drawing') return element
        return element.kind === 'text' ? { ...element, color, textRuns: undefined } : { ...element, color }
      }),
    })
  }

  const updateSelectedShapeStrokeWidth = (strokeWidth: number) => {
    const selectedIds = new Set(scene.elements.filter((element) => element.selected && !element.locked && (element.kind === 'symbol' || element.kind === 'drawing')).map((element) => element.id))
    if (!selectedIds.size) return false
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => selectedIds.has(element.id) && (element.kind === 'symbol' || element.kind === 'drawing')
        ? { ...element, strokeWidth: clamp(strokeWidth, 1, element.kind === 'symbol' ? 12 : 20) }
        : element),
    })
    return true
  }

  const updateDefaultShapeStrokeWidth = (strokeWidth: number) => {
    const nextStrokeWidth = clamp(strokeWidth, 1, 12)
    applySharedPreferences({ ...preferences, defaultShapeStrokeWidth: nextStrokeWidth })
    const nextSymbolPresets = Object.fromEntries((Object.keys(symbolPresets) as SymbolType[]).map((symbolType) => [symbolType, { ...symbolPresets[symbolType], strokeWidth: nextStrokeWidth }])) as Record<SymbolType, SymbolPreset>
    const nextDrawingPresets = Object.fromEntries((['draw', 'line', 'curve', 'arrow', 'marker'] as DrawingTool[]).map((tool) => [tool, { ...drawingPresets[tool], strokeWidth: nextStrokeWidth }])) as Pick<Record<DrawingTool, DrawingPreset>, 'draw' | 'line' | 'curve' | 'arrow' | 'marker'>
    const mergedDrawingPresets = { ...drawingPresets, ...nextDrawingPresets }
    setSymbolPresets(nextSymbolPresets)
    setDrawingPresets(mergedDrawingPresets)
    localStorage.setItem(SYMBOL_PRESETS_KEY, JSON.stringify(nextSymbolPresets))
    localStorage.setItem(DRAWING_PRESETS_KEY, JSON.stringify(mergedDrawingPresets))
  }

  const updateSelectedShapeStrokePattern = (strokePattern: StrokePattern) => {
    const selectedIds = new Set(scene.elements.filter((element) => element.selected && !element.locked && (element.kind === 'symbol' || element.kind === 'drawing')).map((element) => element.id))
    if (!selectedIds.size) return false
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => selectedIds.has(element.id) && (element.kind === 'symbol' || element.kind === 'drawing')
        ? { ...element, strokePattern }
        : element),
    })
    return true
  }

  const updateDefaultShapeStrokePattern = (strokePattern: StrokePattern) => {
    applySharedPreferences({ ...preferences, defaultShapeStrokePattern: strokePattern })
    const nextSymbolPresets = Object.fromEntries((Object.keys(symbolPresets) as SymbolType[]).map((symbolType) => [symbolType, { ...symbolPresets[symbolType], strokePattern }])) as Record<SymbolType, SymbolPreset>
    const nextDrawingPresets = Object.fromEntries((['draw', 'line', 'curve', 'arrow', 'marker'] as DrawingTool[]).map((tool) => [tool, { ...drawingPresets[tool], strokePattern }])) as Pick<Record<DrawingTool, DrawingPreset>, 'draw' | 'line' | 'curve' | 'arrow' | 'marker'>
    const mergedDrawingPresets = { ...drawingPresets, ...nextDrawingPresets }
    setSymbolPresets(nextSymbolPresets)
    setDrawingPresets(mergedDrawingPresets)
    localStorage.setItem(SYMBOL_PRESETS_KEY, JSON.stringify(nextSymbolPresets))
    localStorage.setItem(DRAWING_PRESETS_KEY, JSON.stringify(mergedDrawingPresets))
  }

  const resizeElement = (id: string, width: number, height: number) => {
    const elements = scene.elements.map((element) => {
        if (element.id !== id || element.locked) return element
        if (element.kind === 'symbol') {
          const base = getElementDimensions({ ...element, scale: 1, scaleX: 1, scaleY: 1 })
          return { ...element, scaleX: clamp(width / base.width, 0.25, 12), scaleY: clamp(height / base.height, 0.25, 12) }
        }
        if (element.kind === 'image' || element.kind === 'drawing' || element.kind === 'customShape') {
          return { ...element, width: Math.max(width, 24), height: Math.max(height, 24) }
        }
        return element
      })
    history.updateLive({
      ...scene,
      elements,
    })
  }

  const cropImage = (id: string, crop: { x: number; y: number; width: number; height: number }, width: number, height: number, x: number, y: number) => {
    const elements = scene.elements.map((element) => element.id === id && element.kind === 'image' && !element.locked
      ? { ...element, crop, width: Math.max(width, 24), height: Math.max(height, 24), x: Math.round(x), y: Math.round(y) }
      : element)
    history.updateLive({ ...scene, elements })
  }

  const openContextMenu = (state: ContextMenuState) => {
    if (state.elementId === null) {
      setContextMenu(state)
      return
    }
    const target = scene.elements.find((element) => element.id === state.elementId)
    if (!target) return
    if (!target.selected) selectElement(target.id, false)
    setContextMenu(state)
  }

  const loadIntoNewPages = (layouts: SavedLayout[], names: string[], message: string) => {
    if (!layouts.length) return
    const current = pagesRef.current.map((page, index) => index === activePageIndex ? { ...page, scene } : page)
    const loaded = layouts.map((layout, index) => ({
      id: createId('page'),
      name: names[index]?.slice(0, 40) || String(current.length + index + 1),
      scene: layout.scene,
    }))
    const next = [...current, ...loaded]
    setPages(next)
    setActivePageIndex(current.length)
    history.reset(loaded[0].scene)
    setRulerCount(loaded[0].scene.elements.filter((element) => element.kind === 'tile').length)
    setShowGrid(layouts[0].settings.showGrid)
    setPlacementMode('select')
    setContextMenu(null)
    notify(message)
  }

  const saveNamedLayout = async (name: string, categoryId = 'default') => {
    const layout = makeSavedLayout()
    const saved: NamedSavedLayout = {
      id: createId('saved-layout'),
      name,
      categoryId,
      pageNames: [pagesRef.current[activePageIndex]?.name ?? '1'],
      savedAt: layout.savedAt,
      layout: {
        ...layout,
        scene: { ...layout.scene, elements: layout.scene.elements.map((element) => ({ ...element })) },
      },
    }
    const next = [saved, ...savedLayouts]
    try {
      await writeLargeValue(SAVED_LAYOUTS_KEY, next)
      setSavedLayouts(next)
      notifySavedLayoutsChanged()
      notify(`「${name}」を保存しました`)
    } catch {
      notify('保存できませんでした。ブラウザの保存設定を確認してください')
    }
  }

  const saveAllPages = async () => {
    const source = pagesRef.current.map((page, index) => index === activePageIndex ? { ...page, scene } : page)
    const layouts = source.map((page) => ({ ...makeSavedLayout(), scene: page.scene }))
    const saved: NamedSavedLayout = { id: createId('saved-layout'), name: `全ページ保存 ${new Date().toLocaleString('ja-JP')}`, categoryId: 'default', savedAt: new Date().toISOString(), layout: layouts[0], pages: layouts, pageNames: source.map((page) => page.name) }
    const next = [saved, ...savedLayouts]
    await writeLargeValue(SAVED_LAYOUTS_KEY, next)
    setSavedLayouts(next)
    notifySavedLayoutsChanged()
    notify('全ページを保存しました')
  }

  const loadNamedLayout = (id: string) => {
    const saved = savedLayouts.find((item) => item.id === id)!
    if (!saved) return
    if (saved.pages?.length) {
      loadIntoNewPages(saved.pages, saved.pageNames ?? [], `「${saved.name}」の全ページを新しいタブへ読み込みました`)
      setSavedLayoutsOpen(false)
      return
    }
    loadIntoNewPages([saved.layout], [saved.pageNames?.[0] ?? saved.name], `「${saved.name}」を新しいタブへ読み込みました`)
    setSavedLayoutsOpen(false)
  }

  const overwriteNamedLayout = async (id: string) => {
    const saved = savedLayouts.find((item) => item.id === id)
    if (!saved) return
    const layout = makeSavedLayout()
    const next = savedLayouts.map((item) => item.id === id ? {
      ...item,
      savedAt: layout.savedAt,
      layout: { ...layout, scene: { ...layout.scene, elements: layout.scene.elements.map((element) => ({ ...element })) } },
    } : item)
    try {
      await writeLargeValue(SAVED_LAYOUTS_KEY, next)
      setSavedLayouts(next)
      notifySavedLayoutsChanged()
      notify(`「${saved.name}」を上書き保存しました`)
    } catch {
      notify('保存済みページを上書きできませんでした')
    }
  }

  const deleteNamedLayout = async (id: string) => {
    const saved = savedLayouts.find((item) => item.id === id)
    if (!saved) return
    const next = savedLayouts.filter((item) => item.id !== id)
    try {
      await writeLargeValue(SAVED_LAYOUTS_KEY, next)
      setSavedLayouts(next)
      notifySavedLayoutsChanged()
      notify(`「${saved.name}」を削除しました`)
    } catch {
      notify('保存ページを更新できませんでした')
    }
  }

  const renameNamedLayout = async (id: string, name: string) => {
    const next = savedLayouts.map((item) => item.id === id ? { ...item, name } : item)
    try {
      await writeLargeValue(SAVED_LAYOUTS_KEY, next)
      setSavedLayouts(next)
      notifySavedLayoutsChanged()
      notify('保存ページのタイトルを更新しました')
    } catch {
      notify('保存ページのタイトルを更新できませんでした')
    }
  }

  const moveNamedLayout = async (id: string, categoryId: string) => {
    const next = savedLayouts.map((item) => item.id === id ? { ...item, categoryId } : item)
    await writeLargeValue(SAVED_LAYOUTS_KEY, next)
    setSavedLayouts(next)
    notifySavedLayoutsChanged()
  }

  const reorderNamedLayouts = async (draggedId: string, targetId: string) => {
    const dragged = savedLayouts.find((item) => item.id === draggedId)
    const target = savedLayouts.find((item) => item.id === targetId)
    if (!dragged || !target || (dragged.categoryId ?? 'default') !== (target.categoryId ?? 'default')) return
    const remaining = savedLayouts.filter((item) => item.id !== draggedId)
    const index = remaining.findIndex((item) => item.id === targetId)
    const next = [...remaining.slice(0, index), dragged, ...remaining.slice(index)]
    await writeLargeValue(SAVED_LAYOUTS_KEY, next)
    setSavedLayouts(next)
    notifySavedLayoutsChanged()
  }

  const createSavedLayoutCategory = (name: string) => {
    const category = { id: createId('saved-category'), name }
    const next = [...savedLayoutCategories, category]
    setSavedLayoutCategories(next)
    localStorage.setItem(SAVED_LAYOUT_CATEGORIES_KEY, JSON.stringify(next))
  }

  const importSharedLayout = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Record<string, unknown>
      const layoutValue = data.layout ?? data
      const layout = parseSavedLayout(JSON.stringify(layoutValue))
      if (!layout) throw new Error('invalid-layout')
      const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : file.name.replace(/\.mahjong-layout\.json$/i, '')
      const pages = Array.isArray(data.pages) ? data.pages.flatMap((page) => {
        const parsed = parseSavedLayout(JSON.stringify(page))
        return parsed ? [parsed] : []
      }) : undefined
      const pageNames = Array.isArray(data.pageNames) ? data.pageNames.filter((pageName): pageName is string => typeof pageName === 'string') : undefined
      const saved: NamedSavedLayout = { id: createId('saved-layout'), name, savedAt: new Date().toISOString(), layout, pages, pageNames }
      const next = [saved, ...savedLayouts]
      await writeLargeValue(SAVED_LAYOUTS_KEY, next)
      setSavedLayouts(next)
      notifySavedLayoutsChanged()
      loadIntoNewPages(pages?.length ? pages : [layout], pageNames?.length ? pageNames : [name], `「${name}」を新しいタブへ読み込みました`)
    } catch {
      notify('共有ファイルを読み込めませんでした')
    }
  }

  const saveQuickLayout = () => {
    const name = `保存 ${new Date().toLocaleString('ja-JP')}`
    saveNamedLayout(name)
    setSavedLayoutsOpen(true)
  }

  const updateWorkspaceSize = (width: number, height: number) => {
    const nextWidth = clamp(Math.round(width), MIN_WORKSPACE_WIDTH, MAX_WORKSPACE_WIDTH)
    const nextHeight = clamp(Math.round(height), MIN_WORKSPACE_HEIGHT, MAX_WORKSPACE_HEIGHT)
    if (nextWidth === scene.width && nextHeight === scene.height) return
    history.commit({ ...scene, width: nextWidth, height: nextHeight })
  }

  const exportWorkspace = async (format: 'png' | 'pdf', transparent = false) => {
    const workspace = workspaceRef.current
    if (!workspace || isExporting) return
    const pixelRatio = 2
    if (scene.width * scene.height * pixelRatio * pixelRatio > 48_000_000) {
      notify('作業領域が大きすぎるため出力できません。サイズを小さくしてからお試しください。')
      return
    }
    setExportingTransparent(format === 'png' && transparent)
    setIsExporting(true)
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      const image = await toPng(workspace, {
        cacheBust: true,
        pixelRatio,
        width: scene.width,
        height: scene.height,
        backgroundColor: format === 'png' && transparent ? 'transparent' : '#ffffff',
      })
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      if (format === 'png') {
        const link = document.createElement('a')
        link.href = image
        link.download = `mahjong-workspace-${timestamp}.png`
        link.click()
        notify('PNGを保存しました')
        return
      }
      const pdf = new jsPDF({ orientation: scene.width >= scene.height ? 'landscape' : 'portrait', unit: 'pt', format: 'a4', compress: true })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const scale = Math.min(pageWidth / scene.width, pageHeight / scene.height)
      const width = scene.width * scale
      const height = scene.height * scale
      pdf.addImage(image, 'PNG', (pageWidth - width) / 2, (pageHeight - height) / 2, width, height)
      pdf.save(`mahjong-workspace-${timestamp}.pdf`)
      notify('PDFを保存しました')
    } catch {
      notify(`${format.toUpperCase()}の出力に失敗しました。画像の読み込み状態を確認して、もう一度お試しください。`)
    } finally {
      setIsExporting(false)
      setExportingTransparent(false)
    }
  }

  const keyboardActions = useRef({
    deleteSelected,
    rotateSelected,
    duplicateSelected,
    copySelected,
    pasteClipboard: () => pasteClipboard(),
    moveSelectedBy,
    clearSelection,
    undo: history.undo,
    redo: history.redo,
    saveQuickLayout,
  })
  keyboardActions.current = {
    deleteSelected,
    rotateSelected,
    duplicateSelected,
    copySelected,
    pasteClipboard: () => pasteClipboard(),
    moveSelectedBy,
    clearSelection,
    undo: history.undo,
    redo: history.redo,
    saveQuickLayout,
  }

  const imagePasteAction = useRef(addImageFile)
  imagePasteAction.current = addImageFile
  const textPasteAction = useRef(commitText)
  textPasteAction.current = commitText
  const tileNotationPasteAction = useRef(pasteTileNotation)
  tileNotationPasteAction.current = pasteTileNotation

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement
      if (target.matches('input, textarea, select')) return
      const imageItem = [...event.clipboardData?.items ?? []].find((item) => item.type.startsWith('image/'))
      const file = imageItem?.getAsFile()
      if (file) {
        event.preventDefault()
        void imagePasteAction.current(file)
      } else {
        const text = event.clipboardData?.getData('text/plain').trim()
        if (tileNotationPasteAction.current(text ?? '')) {
          event.preventDefault()
        } else if (keyboardActions.current.pasteClipboard()) {
          event.preventDefault()
        } else if (text) {
          event.preventDefault()
          textPasteAction.current(text)
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key === 'Escape') {
        setContextMenu(null)
        setPropertyElementId(null)
        setPlacementMode('select')
        keyboardActions.current.clearSelection()
        return
      }
      const command = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      if (command && key === 's') {
        event.preventDefault()
        keyboardActions.current.saveQuickLayout()
        return
      }
      if (target.matches('input, textarea, select')) return

      if (command && key === 'c') {
        event.preventDefault()
        keyboardActions.current.copySelected()
      } else if (command && key === 'd') {
        event.preventDefault()
        keyboardActions.current.duplicateSelected()
      } else if (command && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) keyboardActions.current.redo()
        else keyboardActions.current.undo()
      } else if (command && key === 'y') {
        event.preventDefault()
        keyboardActions.current.redo()
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        keyboardActions.current.deleteSelected()
      } else if (event.key.startsWith('Arrow')) {
        event.preventDefault()
        const amount = event.shiftKey ? 10 : 1
        const delta = {
          ArrowLeft: [-amount, 0],
          ArrowRight: [amount, 0],
          ArrowUp: [0, -amount],
          ArrowDown: [0, amount],
        }[event.key]
        if (delta) keyboardActions.current.moveSelectedBy(delta[0], delta[1])
      } else if (key === 'r' && !command) {
        keyboardActions.current.rotateSelected()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const selected = scene.elements.filter((element) => element.selected)
  const selectedText = selected.length === 1 && selected[0].kind === 'text' && !selected[0].locked ? selected[0] : null
  const selectedColoredElement = selected.length === 1 && (selected[0].kind === 'symbol' || selected[0].kind === 'drawing') && !selected[0].locked ? selected[0] : null
  const selectedEditable = selected.length === 1 && selected[0].kind !== 'tile' && !selected[0].locked ? selected[0] : null
  const selectedHandTiles = selected
    .filter((element): element is TileElement => element.kind === 'tile' && !element.faceDown)
  const detectedMelds = detectOpenMelds(selectedHandTiles)
  const detectedMeldTileIds = new Set(detectedMelds.flatMap((meld) => meld.elementIds))
  const selectedHandTileIds = selectedHandTiles
    .filter((tile) => !detectedMeldTileIds.has(tile.id))
    .map((tile) => tile.tileId)
  const tileCount = scene.elements.filter((element) => element.kind === 'tile').length
  const contextElement = contextMenu ? scene.elements.find((element) => element.id === contextMenu.elementId) ?? null : null
  const propertyElement = propertyElementId
    ? scene.elements.find((element): element is TextElement | SymbolElement | DrawingElement | ImageElement | CustomShapeElement => element.id === propertyElementId && element.kind !== 'tile') ?? null
    : null

  return (
    <div className="app-shell" style={{ '--app-scale': preferences.uiScale, '--popup-scale': preferences.popupFontScale, '--header-color': preferences.headerColor } as CSSProperties}>
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">{preferences.appIconSrc ? <img src={preferences.appIconSrc} alt="" /> : <span>牌</span>}</div>
        <div className="brand-copy">
          <span className="eyebrow">MAHJONG CANVAS</span>
          <h1>麻雀牌レイアウトツール</h1>
        </div>
        <div className="header-status">
          <span><i className="status-dot" />自動保存</span>
          <strong>{tileCount}<small>枚の牌</small></strong>
        </div>
      </header>

      <Toolbar
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        hasItems={scene.elements.length > 0}
        hasSelection={selected.some((element) => !element.locked)}
        canEditText={Boolean(selectedText)}
        textStyle={selectedText ? { fontFamily: selectedText.fontFamily, fontSize: selectedText.fontSize, fontWeight: selectedText.fontWeight, color: selectedText.color, textDecoration: selectedText.textDecoration ?? 'none', backgroundColor: selectedText.backgroundColor ?? null } : defaultTextStyle}
        isEditingSelectedText={Boolean(selectedText)}
        selectedShapeColor={selectedColoredElement?.color ?? null}
        shapeColor={selectedColoredElement?.color ?? defaultShapeColor}
        shapeStrokeWidth={selectedColoredElement?.strokeWidth ?? defaultShapeStrokeWidth}
        shapeStrokePattern={selectedColoredElement?.strokePattern ?? defaultShapeStrokePattern}
        eraserSize={eraserSize}
        canDuplicate={selected.length > 0}
        canToggleTileFaces={selected.some((element) => element.kind === 'tile' && !element.locked)}
        canEditProperties={Boolean(selectedEditable)}
        canChangeLayer={selected.some((element) => !element.locked && element.kind !== 'image')}
        placementMode={placementMode}
        onClear={() => {
          history.commit({ ...EMPTY_SCENE, width: scene.width, height: scene.height })
          setRulerCount(0)
        }}
        onUndo={history.undo}
        onRedo={history.redo}
        onDeleteSelected={deleteSelected}
        onDuplicate={duplicateSelected}
        canSaveCustomShape={selected.some((element) => element.kind !== 'tile')}
        onSaveCustomShape={() => setCustomShapeSaveOpen(true)}
        customShapes={customShapes}
        onInsertCustomShape={insertCustomShape}
        onDeleteCustomShape={deleteCustomShape}
        onEditCustomShape={setCustomShapeEditId}
        onRotate={rotateSelected}
        onToggleTileFaces={toggleSelectedTileFaces}
        onEditSelectedText={() => selectedText && setEditTextRequest({ id: selectedText.id, token: Date.now() })}
        onUpdateTextStyle={(style) => {
          if (selectedText) {
            if (style.color !== undefined) {
              updateElementColor(selectedText.id, style.color)
              return
            }
            saveProperties(selectedText.id, style)
            return
          }
          applySharedPreferences({
            ...preferences,
            defaultFontFamily: style.fontFamily ?? defaultTextStyle.fontFamily,
            defaultTextFontSize: style.fontSize === undefined ? defaultTextStyle.fontSize : clamp(style.fontSize, 12, 72),
            defaultTextFontWeight: style.fontWeight === undefined ? defaultTextStyle.fontWeight : normalizeFontWeight(style.fontWeight),
            defaultTextColor: style.color ?? defaultTextStyle.color,
            defaultTextDecoration: style.textDecoration ?? defaultTextStyle.textDecoration,
            defaultTextBackgroundColor: style.backgroundColor === undefined ? defaultTextStyle.backgroundColor : style.backgroundColor,
          })
        }}
        onUpdateSelectedShapeColor={(color) => {
          applySharedPreferences({ ...preferences, defaultShapeColor: color })
          if (selectedColoredElement) updateElementColor(selectedColoredElement.id, color)
          else if (placementMode === 'marker') {
            const next = { ...drawingPresets, marker: { ...drawingPresets.marker, color } }
            setDrawingPresets(next)
            localStorage.setItem(DRAWING_PRESETS_KEY, JSON.stringify(next))
          }
        }}
        onUpdateShapeStrokeWidth={(strokeWidth) => { if (!updateSelectedShapeStrokeWidth(strokeWidth)) updateDefaultShapeStrokeWidth(strokeWidth) }}
        onUpdateShapeStrokePattern={(strokePattern) => { if (!updateSelectedShapeStrokePattern(strokePattern)) updateDefaultShapeStrokePattern(strokePattern) }}
        onUpdateEraserSize={(size) => {
          const eraserSize = clamp(size, 8, 80)
          setEraserSize(eraserSize)
          const next = { ...drawingPresets, eraser: { ...drawingPresets.eraser, eraserSize } }
          setDrawingPresets(next)
          localStorage.setItem(DRAWING_PRESETS_KEY, JSON.stringify(next))
        }}
        onBringFront={() => moveSelectedLayers('front')}
        onSendBack={() => moveSelectedLayers('back')}
        onRandomHand={generateHand}
        handSuits={handSuits}
        onToggleHandSuit={(suit) => setHandSuits((current) => {
          const next = current.includes(suit) ? current.filter((value) => value !== suit) : [...current, suit]
          localStorage.setItem(HAND_SUITS_KEY, JSON.stringify(next))
          return next
        })}
        iishantenQuestionTypes={iishantenQuestionTypes}
        onToggleIishantenQuestionType={(type) => setIishantenQuestionTypes((current) => {
          const next = current.includes(type) ? current.filter((value) => value !== type) : [...current, type]
          localStorage.setItem(IISHANTEN_QUESTION_TYPES_KEY, JSON.stringify(next))
          return next
        })}
        canSortSelectedTiles={selected.some((element) => element.kind === 'tile' && !element.locked)}
        onSortSelectedTiles={sortSelectedTiles}
        onSetPlacementMode={setPlacementMode}
        onSaveLocal={saveQuickLayout}
        onOpenSavedLayouts={() => setSavedLayoutsOpen(true)}
        onImportSharedLayout={() => shareInputRef.current?.click()}
        onAddImage={() => requestImage()}
        onAddText={(text) => commitText(text)}
        onHelp={() => setHelpOpen(true)}
        onOpenReferences={() => setReferencesOpen(true)}
        onOpenAnnouncements={() => setAnnouncementsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSymbolPreset={setSymbolPresetTarget}
        onOpenDrawingPreset={setDrawingPresetTarget}
        workspaceWidth={scene.width}
        workspaceHeight={scene.height}
        onChangeWorkspaceSize={updateWorkspaceSize}
        showWorkspaceBoundary={showWorkspaceBoundary}
        onToggleWorkspaceBoundary={() => setShowWorkspaceBoundary((visible) => !visible)}
        onExportPng={() => { void exportWorkspace('png', pngTransparent) }}
        pngTransparent={pngTransparent}
        onTogglePngTransparent={() => setPngTransparent((transparent) => !transparent)}
        onExportPdf={() => { void exportWorkspace('pdf') }}
        isExporting={isExporting}
        pages={pages}
        activePageIndex={activePageIndex}
        onSwitchPage={switchPage}
        onAddPage={addPage}
        onDeletePage={deletePage}
        onReorderPages={reorderPages}
        onRenamePage={renamePage}
        symbolColors={symbolColors}
        drawingColors={Object.fromEntries((['draw', 'line', 'curve', 'arrow', 'marker'] as DrawingTool[]).map((tool) => [tool, drawingPresets[tool].color ?? defaultShapeColor])) as Record<Exclude<DrawingTool, 'eraser'>, string>}
      />

      <main className={`app-body${efficiencyPanelVisible ? '' : ' efficiency-panel-hidden'}`} style={{ '--efficiency-panel-requested-space': efficiencyPanelVisible ? `${efficiencyPanelWidth}px` : '0px' } as CSSProperties}>
        <TilePalette
          onAddTile={addTile}
          placementMode={placementMode}
          trashActive={trashActive}
          onSelectPlacementMode={setPlacementMode}
          onOpenSymbolPreset={setSymbolPresetTarget}
          onOpenDrawingPreset={setDrawingPresetTarget}
          symbolColors={symbolColors}
          symbolStrokeWidths={symbolStrokeWidths}
          symbolStrokePatterns={symbolStrokePatterns}
          drawingColors={Object.fromEntries((['draw', 'line', 'curve', 'arrow', 'marker'] as DrawingTool[]).map((tool) => [tool, drawingPresets[tool].color ?? defaultShapeColor])) as Record<Exclude<DrawingTool, 'eraser'>, string>}
          symbolSizes={symbolSizes}
          customShapes={customShapes}
          onInsertCustomShape={insertCustomShape}
          onEditCustomShape={setCustomShapeEditId}
          onCustomShapeDragChange={setDraggedCustomShapeId}
        />
        <section className="workspace-panel">
          <div className="workspace-scroll">
            <div className="workspace-tile-ruler" style={{ width: scene.width }} aria-label={`牌の枚数 ${rulerCount}枚。13枚基準`}>
              <div className="workspace-tile-ruler-title">牌数メモリ <strong>{rulerCount}<small>/13枚</small></strong></div>
              <div className="workspace-tile-ruler-track">
                {Array.from({ length: 13 }, (_, index) => (
                  <span key={index} className={index < rulerCount ? 'filled' : ''} title={`${index + 1}枚目`}>{index + 1}</span>
                ))}
              </div>
            </div>
            <Workspace
              ref={workspaceRef}
              scene={scene}
              showGrid={showGrid}
              allowTileOverlap={preferences.allowTileOverlap}
              placementMode={placementMode}
              eraserSize={eraserSize}
              textStyle={defaultTextStyle}
              drawingStyle={(() => {
                const tool = placementMode === 'draw' ? 'draw' : placementMode === 'line' ? 'line' : placementMode === 'curve' ? 'curve' : placementMode === 'arrow' ? 'arrow' : placementMode === 'marker' ? 'marker' : 'draw'
                const preset = drawingPresets[tool]
                return { color: preset.color ?? defaultShapeColor, strokeWidth: preset.strokeWidth, strokePattern: preset.strokePattern ?? defaultShapeStrokePattern, opacity: preset.opacity, arrowHeadSize: preset.arrowHeadSize ?? 30 }
              })()}
              symbolColors={symbolColors}
              symbolStrokeWidths={symbolStrokeWidths}
              symbolStrokePatterns={symbolStrokePatterns}
              symbolSizes={symbolSizes}
              customShapes={customShapes}
              draggedCustomShapeId={draggedCustomShapeId}
              editTextRequest={editTextRequest}
              onDropTile={addTile}
              onDropCustomShape={(id, x, y) => insertCustomShape(id, { x, y })}
              onDropFiles={(files, x, y) => {
                const sharedLayout = files.find((file) => file.name.toLowerCase().endsWith('.mahjong-layout.json'))
                if (sharedLayout) void importSharedLayout(sharedLayout)
                files.filter((file) => file.type.startsWith('image/')).forEach((file, index) => void addImageFile(file, { x: x + index * 20, y: y + index * 20 }))
              }}
              onDropText={(text, x, y) => {
                if (!pasteTileNotation(text, { x, y })) commitText(text, x, y)
              }}
              onCursorCanvasPoint={(point) => { pasteAnchorRef.current = point }}
              onSelectElement={selectElement}
              onSelectRange={selectRange}
              onClearSelection={clearSelection}
              onMoveElements={moveElements}
              onDeleteDragged={deleteElements}
              onEraseAt={eraseAt}
              onTrashHover={setTrashActive}
              onPlaceSymbol={placeSymbol}
              onCommitDrawing={commitDrawing}
              onCommitText={commitText}
              onFinishTextEditing={() => setEditTextRequest(null)}
              onToggleTileFace={toggleTileFace}
              onRevealSpoiler={revealElementSpoiler}
              onRevealTextSpoiler={revealTextSpoiler}
              onOpenContextMenu={openContextMenu}
              onResizeElement={resizeElement}
              onCropImage={cropImage}
              captureMode={isExporting}
              transparentBackground={exportingTransparent}
              showWorkspaceBoundary={showWorkspaceBoundary}
              onBeginDrag={history.beginTransaction}
              onEndDrag={history.endTransaction}
            />
          </div>
        </section>
        <EfficiencyPanel tileIds={selectedHandTileIds} melds={detectedMelds} onClose={() => setEfficiencyPanelVisible(false)} onResize={(width) => setEfficiencyPanelWidth(clamp(width, 190, 5000))} />
        <button type="button" className="efficiency-toggle" onClick={() => setEfficiencyPanelVisible((visible) => !visible)} aria-pressed={efficiencyPanelVisible}>{efficiencyPanelVisible ? '牌理を隠す' : '牌理・受け入れ'}</button>
      </main>

      <input
        ref={imageInputRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void addImageFile(file, imageAnchorRef.current)
          imageAnchorRef.current = null
          event.target.value = ''
        }}
      />

      <input
        ref={shareInputRef}
        className="visually-hidden"
        type="file"
        accept=".mahjong-layout.json,application/json"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void importSharedLayout(file)
          event.target.value = ''
        }}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.clientX}
          y={contextMenu.clientY}
          element={contextElement}
          hasSelection={selected.length > 0}
          canModifySelection={selected.some((element) => !element.locked)}
          canPaste={clipboard.length > 0 || Boolean(navigator.clipboard)}
          visibleItems={preferences.contextMenuItems}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onClose={() => setContextMenu(null)}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
          onCopy={copySelected}
          onPaste={() => { void pasteFromClipboard({ x: contextMenu.canvasX, y: contextMenu.canvasY }) }}
          onRotate={() => contextElement?.kind === 'tile' && rotateTile(contextElement.id)}
          onAddRectangle={() => placeSymbol('rectangle', contextMenu.canvasX, contextMenu.canvasY)}
          onAddTriangle={() => placeSymbol('triangle', contextMenu.canvasX, contextMenu.canvasY)}
          onAddCircle={() => placeSymbol('circle', contextMenu.canvasX, contextMenu.canvasY)}
          onAddCross={() => placeSymbol('cross', contextMenu.canvasX, contextMenu.canvasY)}
          onAddWave={() => placeSymbol('wave', contextMenu.canvasX, contextMenu.canvasY)}
          onDrawMode={() => setPlacementMode('draw')}
          onLineMode={() => setPlacementMode('line')}
          onCurveMode={() => setPlacementMode('curve')}
          onArrowMode={() => setPlacementMode('arrow')}
          onAddImage={() => requestImage({ x: contextMenu.canvasX, y: contextMenu.canvasY })}
          onSelectMode={() => setPlacementMode('select')}
          onTextMode={() => setPlacementMode('text')}
          onToggleFace={() => contextElement && toggleTileFace(contextElement.id)}
          onToggleLock={() => contextElement && toggleLock(contextElement.id)}
          onEditProperties={() => contextElement && setPropertyElementId(contextElement.id)}
          onToggleSpoiler={() => contextElement && toggleElementSpoiler(contextElement.id)}
          onBringFront={() => moveSelectedLayers('front')}
          onSendBack={() => moveSelectedLayers('back')}
          onClear={() => { history.commit({ ...EMPTY_SCENE, width: scene.width, height: scene.height }); setRulerCount(0) }}
          onUndo={history.undo}
          onRedo={history.redo}
          onEditWorkspace={() => setWorkspaceSizeOpen(true)}
        />
      )}

      {workspaceSizeOpen && <WorkspaceSizeDialog width={scene.width} height={scene.height} onSave={(width, height) => { updateWorkspaceSize(width, height); setWorkspaceSizeOpen(false) }} onClose={() => setWorkspaceSizeOpen(false)} />}

      {propertyElement && (
        <PropertyEditor
          key={propertyElement.id}
          element={propertyElement}
          onSave={(properties) => saveProperties(propertyElement.id, properties)}
          onClose={() => setPropertyElementId(null)}
        />
      )}

      {savedLayoutsOpen && (
        <SavedLayoutsDialog
          layouts={savedLayouts}
          categories={savedLayoutCategories}
          onSave={saveNamedLayout}
          onSaveAllPages={saveAllPages}
          onCreateCategory={createSavedLayoutCategory}
          onMove={moveNamedLayout}
          onReorder={reorderNamedLayouts}
          onOverwrite={overwriteNamedLayout}
          onLoad={loadNamedLayout}
          onDelete={deleteNamedLayout}
          onRename={renameNamedLayout}
          onClose={() => setSavedLayoutsOpen(false)}
        />
      )}

      {toast && <div className="toast" role="status">✓ {toast}</div>}
      {helpOpen && <HelpModal onClose={() => { localStorage.setItem(HELP_KEY, '1'); setHelpOpen(false) }} />}
      {referencesOpen && <ReferencesModal onClose={() => setReferencesOpen(false)} />}
      {announcementsOpen && <AnnouncementsModal onClose={() => setAnnouncementsOpen(false)} />}
      {settingsOpen && <SettingsDialog preferences={preferences} onSave={savePreferences} onClose={() => setSettingsOpen(false)} />}
      {symbolPresetTarget && <SymbolPresetDialog
        symbolType={symbolPresetTarget}
        preset={symbolPresets[symbolPresetTarget]}
        fallbackColor={defaultShapeColor}
        onClose={() => setSymbolPresetTarget(null)}
        onSave={(preset) => {
          const next = { ...symbolPresets, [symbolPresetTarget]: preset }
          setSymbolPresets(next)
          localStorage.setItem(SYMBOL_PRESETS_KEY, JSON.stringify(next))
          setSymbolPresetTarget(null)
          notify('これから配置する図形の設定を保存しました')
        }}
      />}
      {customShapeSaveOpen && <CustomShapeDialog itemCount={selected.filter((element) => element.kind !== 'tile').length} onSave={saveCustomShape} onClose={() => setCustomShapeSaveOpen(false)} />}
      {customShapeEditId && customShapes.find((shape) => shape.id === customShapeEditId) && <CustomShapeDialog initialName={customShapes.find((shape) => shape.id === customShapeEditId)!.name} initialColor={customShapes.find((shape) => shape.id === customShapeEditId)!.color ?? '#244a40'} onSave={(name, color) => { renameCustomShape(customShapeEditId, name, color); setCustomShapeEditId(null) }} onDelete={() => { deleteCustomShape(customShapeEditId); setCustomShapeEditId(null) }} onClose={() => setCustomShapeEditId(null)} />}
      {drawingPresetTarget && <DrawingPresetDialog
        tool={drawingPresetTarget}
        preset={drawingPresets[drawingPresetTarget]}
        fallbackColor={defaultShapeColor}
        onClose={() => setDrawingPresetTarget(null)}
        onSave={(preset) => {
          const next = { ...drawingPresets, [drawingPresetTarget]: preset }
          setDrawingPresets(next)
          localStorage.setItem(DRAWING_PRESETS_KEY, JSON.stringify(next))
          if (drawingPresetTarget === 'eraser') setEraserSize(preset.eraserSize)
          setDrawingPresetTarget(null)
          notify('描画ツールの既定設定を保存しました')
        }}
      />}
    </div>
  )
}

export default App
