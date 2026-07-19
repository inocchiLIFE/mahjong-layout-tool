import { useEffect, useRef, useState } from 'react'
import './App.css'
import { ContextMenu } from './components/ContextMenu'
import { HelpModal } from './components/HelpModal'
import { PropertyEditor } from './components/PropertyEditor'
import { SavedLayoutsDialog } from './components/SavedLayoutsDialog'
import { TilePalette } from './components/TilePalette'
import { Toolbar } from './components/Toolbar'
import { Workspace } from './components/Workspace'
import { TILE_MAP } from './data/tiles'
import { useSceneHistory } from './hooks/useSceneHistory'
import type {
  CanvasElement,
  CanvasPoint,
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
  TextElement,
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
  getDrawingVisualBounds,
  getSceneContentBounds,
  makeSymbol,
  makeDrawing,
  makeImage,
  makeText,
  makeTile,
  randomHand,
  snap,
} from './utils/layout'
import { readLargeValue, writeLargeValue } from './utils/largeStorage'

const AUTO_SAVE_KEY = 'mahjong-layout-tool:auto-v1'
const SAVED_LAYOUTS_KEY = 'mahjong-layout-tool:saved-pages-v1'
const SAVED_LAYOUTS_SIGNAL_KEY = 'mahjong-layout-tool:saved-pages-signal-v1'
const HELP_KEY = 'mahjong-layout-tool:help-seen'
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
  value === 'freehand' || value === 'line' || value === 'curve' || value === 'arrow'

const normalizeTextColor = (value: unknown) => {
  if (typeof value !== 'string') return '#172c27'
  const normalized = value.toLowerCase().replace(/\s/g, '')
  if (normalized === '#fff' || normalized === '#ffffff' || normalized === '#f4f0df') return '#172c27'
  return value
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
    return {
      ...base,
      kind: 'text',
      text: item.text,
      color: normalizeTextColor(item.color),
      fontSize: typeof item.fontSize === 'number' ? clamp(item.fontSize, 12, 72) : 22,
      fontFamily: typeof item.fontFamily === 'string' ? item.fontFamily : 'serif',
    }
  }
  if (item.kind === 'symbol' && isSymbolType(item.symbolType)) {
    return {
      ...base,
      kind: 'symbol',
      symbolType: item.symbolType,
      color: typeof item.color === 'string' ? item.color : item.symbolType === 'cross' ? '#b13f34' : '#244a40',
      strokeWidth: typeof item.strokeWidth === 'number' ? clamp(item.strokeWidth, 1, 12) : 4,
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
    const visualBounds = getDrawingVisualBounds(points, drawingType, strokeWidth)
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
      drawingType,
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
      snapToGrid: settings?.snapToGrid === true,
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
        snapToGrid: settings?.snapToGrid === true,
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

const signalSavedLayoutsChanged = () => {
  try {
    localStorage.setItem(SAVED_LAYOUTS_SIGNAL_KEY, `${Date.now()}:${Math.random()}`)
  } catch {
    // IndexedDB remains the source of truth; the signal is only for other tabs.
  }
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
  const [sharedLayout] = useState(readSharedLayout)
  const [initialLayout] = useState(() => sharedLayout ?? parseSavedLayout(localStorage.getItem(AUTO_SAVE_KEY)))
  const history = useSceneHistory(initialLayout?.scene ?? EMPTY_SCENE)
  const scene = history.scene
  const [rulerCount, setRulerCount] = useState(() => initialLayout?.scene.elements.filter((element) => element.kind === 'tile').length ?? 0)
  const [showGrid, setShowGrid] = useState(initialLayout?.settings.showGrid ?? true)
  const [snapToGrid, setSnapToGrid] = useState(initialLayout?.settings.snapToGrid ?? false)
  const [defaultTextStyle, setDefaultTextStyle] = useState({ fontFamily: 'serif', fontSize: 22, color: '#172c27' })
  const [defaultShapeColor, setDefaultShapeColor] = useState('#244a40')
  const [defaultShapeStrokeWidth, setDefaultShapeStrokeWidth] = useState(4)
  const [placementMode, setPlacementMode] = useState<PlacementMode>('select')
  const [editTextRequest, setEditTextRequest] = useState<{ id: string; token: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [propertyElementId, setPropertyElementId] = useState<string | null>(null)
  const [clipboard, setClipboard] = useState<CanvasElement[]>([])
  const [trashActive, setTrashActive] = useState(false)
  const [savedLayouts, setSavedLayouts] = useState<NamedSavedLayout[]>(readNamedSavedLayouts)
  const [storageReady, setStorageReady] = useState(false)
  const [savedLayoutsOpen, setSavedLayoutsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(() => localStorage.getItem(HELP_KEY) !== '1')
  const [toast, setToast] = useState('')
  const workspaceRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const shareInputRef = useRef<HTMLInputElement>(null)
  const imageAnchorRef = useRef<{ x: number; y: number } | null>(null)
  const autoSaveWarningShownRef = useRef(false)
  const toastTimerRef = useRef<number | null>(null)
  const restoreHistoryLoadRef = useRef(history.load)
  const sharedLayoutRef = useRef(sharedLayout)
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

        let storedAutoSave = await readLargeValue<unknown>(AUTO_SAVE_KEY)
        if (storedAutoSave === null) {
          const legacyAutoSave = parseSavedLayout(localStorage.getItem(AUTO_SAVE_KEY))
          storedAutoSave = legacyAutoSave
          if (legacyAutoSave) await writeLargeValue(AUTO_SAVE_KEY, legacyAutoSave)
        }
        const restored = storedAutoSave ? parseSavedLayout(JSON.stringify(storedAutoSave)) : null
        if (!cancelled && !sharedLayoutRef.current && restored) {
          restoreHistoryLoadRef.current(restored.scene)
          setRulerCount(restored.scene.elements.filter((element) => element.kind === 'tile').length)
          setShowGrid(restored.settings.showGrid)
          setSnapToGrid(restored.settings.snapToGrid)
        }
        localStorage.removeItem(AUTO_SAVE_KEY)
        localStorage.removeItem(SAVED_LAYOUTS_KEY)
      } catch {
        if (!cancelled) notify('大容量保存の初期化に失敗しました')
      } finally {
        if (!cancelled) setStorageReady(true)
      }
    }
    void restoreLargeStorage()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!storageReady) return
    let cancelled = false
    const reloadSavedLayouts = async () => {
      try {
        const storedLayouts = await readLargeValue<unknown>(SAVED_LAYOUTS_KEY)
        if (!cancelled) setSavedLayouts(parseNamedSavedLayouts(storedLayouts))
      } catch {
        if (!cancelled) notify('保存ページを同期できませんでした')
      }
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SAVED_LAYOUTS_SIGNAL_KEY) void reloadSavedLayouts()
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      cancelled = true
      window.removeEventListener('storage', handleStorage)
    }
  }, [storageReady])

  useEffect(() => {
    if (!storageReady) return
    void writeLargeValue(AUTO_SAVE_KEY, {
        version: 3,
        savedAt: new Date().toISOString(),
        scene,
        settings: { showGrid, snapToGrid },
      } satisfies SavedLayout).then(() => {
      autoSaveWarningShownRef.current = false
    }).catch(() => {
      if (!autoSaveWarningShownRef.current) {
        autoSaveWarningShownRef.current = true
        setToast('ブラウザの保存領域を確保できませんでした')
      }
    })
  }, [scene, showGrid, snapToGrid, storageReady])

  const nextZIndex = () => Math.max(0, ...scene.elements.map((element) => element.zIndex)) + 1

  const addTile = (tileId: string, dropX?: number, dropY?: number) => {
    const isDropped = dropX !== undefined || dropY !== undefined
    // 牌一覧からのクリック追加は、常に左上の初期位置から開始する。
    // 途中で牌を移動しても追加の開始位置は変えず、既存牌だけを避ける。
    let x = dropX ?? 32
    const y = dropY ?? 32

    if (!isDropped) {
      const overlapsTile = (candidateX: number) => scene.elements.some((element) => element.kind === 'tile'
        && candidateX < element.x + TILE_WIDTH
        && candidateX + TILE_WIDTH > element.x
        && y < element.y + TILE_HEIGHT
        && y + TILE_HEIGHT > element.y)
      while (overlapsTile(x)) x += TILE_WIDTH + TILE_GAP
    }

    const tile = makeTile(
      tileId,
      isDropped ? snap(x, snapToGrid) : x,
      isDropped ? snap(y, snapToGrid) : y,
      nextZIndex(),
    )
    if (isDropped) {
      delete tile.autoX
      delete tile.autoY
      delete tile.autoOrder
    }
    history.commit({
      ...scene,
      elements: [...scene.elements, tile],
    })
    setRulerCount((count) => Math.min(13, count + 1))
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

  const rotateSelected = () => {
    if (!scene.elements.some((element) => element.selected && !element.locked)) return
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => {
        if (!element.selected || element.locked) return element
        const rotation = ((element.rotation + 90) % 360) as Rotation
        const rotated = { ...element, rotation } as CanvasElement
        return rotated
      }),
    })
  }

  const alignTiles = () => {
    const tiles = scene.elements.filter((element) => element.kind === 'tile' && !element.locked)
    if (!tiles.length) return
    const selectedTiles = tiles.filter((tile) => tile.selected)
    const targets = selectedTiles.length ? selectedTiles : tiles
    const targetIds = new Set(targets.map((tile) => tile.id))
    const totalWidth = targets.length * TILE_WIDTH + Math.max(0, targets.length - 1) * TILE_GAP
    const width = clamp(Math.max(scene.width, totalWidth + 40), MIN_WORKSPACE_WIDTH, MAX_WORKSPACE_WIDTH)
    const startX = clamp(Math.min(...targets.map((tile) => tile.x)), 20, width - totalWidth - 20)
    const y = clamp(Math.min(...targets.map((tile) => tile.y)), 20, scene.height - TILE_HEIGHT)
    history.commit({
      ...scene,
      width,
      elements: scene.elements.map((element) => {
        const index = targets.findIndex((target) => target.id === element.id)
        return targetIds.has(element.id)
          ? { ...element, x: startX + index * (TILE_WIDTH + TILE_GAP), y, rotation: 0 as Rotation }
          : element
      }),
    })
    notify(selectedTiles.length ? `${selectedTiles.length}枚を等間隔で整列しました` : 'すべての牌を等間隔で整列しました')
  }

  const generateHand = (count: 13 | 14) => {
    const tileIds = randomHand(count)
    const totalWidth = count * TILE_WIDTH + (count - 1) * TILE_GAP
    const width = clamp(Math.max(scene.width, totalWidth + 40), MIN_WORKSPACE_WIDTH, MAX_WORKSPACE_WIDTH)
    const startX = Math.max(20, (width - totalWidth) / 2)
    const zStart = nextZIndex()
    const nonTiles = scene.elements.filter((element) => element.kind !== 'tile').map((element) => ({ ...element, selected: false }))
    history.commit({
      ...scene,
      width,
      elements: [
        ...nonTiles,
        ...tileIds.map((tileId, index) => makeTile(tileId, startX + index * (TILE_WIDTH + TILE_GAP), 76, zStart + index)),
      ],
    })
    setRulerCount(count)
    notify(`${count}枚の配牌を生成し、理牌しました`)
  }

  const shuffleTiles = () => {
    const tileIds = scene.elements
      .filter((element): element is TileElement => element.kind === 'tile' && !element.locked)
      .map((tile) => tile.tileId)
    if (!tileIds.length) return
    for (let index = tileIds.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1))
      ;[tileIds[index], tileIds[target]] = [tileIds[target], tileIds[index]]
    }
    let tileIndex = 0
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => element.kind === 'tile' && !element.locked
        ? { ...element, tileId: tileIds[tileIndex++] }
        : element),
    })
    notify('配置位置を保ったまま牌をシャッフルしました')
  }

  const commitText = (text: string, x = 40, y?: number, id?: string) => {
    if (id) {
      history.commit({
        ...scene,
        elements: scene.elements.map((element) => element.id === id && element.kind === 'text' && !element.locked
          ? { ...element, text }
          : element),
      })
      return
    }
    const textCount = scene.elements.filter((element) => element.kind === 'text').length
    const item = { ...makeText(text, x, y ?? Math.min(scene.height - 50, 180 + textCount * 48), nextZIndex()), ...defaultTextStyle }
    history.commit({ ...scene, elements: [...scene.elements, item] })
  }

  const placeSymbol = (symbolType: SymbolType, x: number, y: number) => {
    // 新規文字と同じ既定色を、これから追加する図形にも使用する。
    const item = { ...makeSymbol(symbolType, x, y, nextZIndex()), color: defaultShapeColor, strokeWidth: defaultShapeStrokeWidth }
    const dimensions = getElementDimensions(item)
    item.x = snap(x - dimensions.width / 2, snapToGrid)
    item.y = snap(y - dimensions.height / 2, snapToGrid)
    history.commit({ ...scene, elements: [...scene.elements, item] })
  }

  const commitDrawing = (points: CanvasPoint[], drawingType: DrawingType = 'freehand') => {
    if (points.length < 2) return
    const bounds = getDrawingVisualBounds(points, drawingType, defaultShapeStrokeWidth)
    const x = Math.floor(bounds.minX)
    const y = Math.floor(bounds.minY)
    const width = Math.max(8, Math.ceil(bounds.maxX - x))
    const height = Math.max(8, Math.ceil(bounds.maxY - y))
    const relative = points.map((point) => ({ x: point.x - x, y: point.y - y }))
    const item = makeDrawing(relative, x, y, width, height, nextZIndex(), drawingType)
    history.commit({ ...scene, elements: [...scene.elements, { ...item, color: defaultShapeColor, strokeWidth: defaultShapeStrokeWidth }] })
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
        const zIndex = Math.max(0, ...latestScene.elements.map((element) => element.zIndex)) + 1
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
    notify(`${sources.length}件をコピーしました`)
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

  const moveLayer = (id: string, direction: 'front' | 'back') => {
    const target = scene.elements.find((element) => element.id === id)
    if (!target || target.locked) return
    const zIndex = direction === 'front'
      ? Math.max(0, ...scene.elements.map((element) => element.zIndex)) + 1
      : Math.min(0, ...scene.elements.map((element) => element.zIndex)) - 1
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => element.id === id ? { ...element, zIndex } : element),
    })
  }

  const saveProperties = (
    id: string,
    properties: {
      text?: string
      color?: string
      fontSize?: number
      fontFamily?: string
      strokeWidth?: number
      opacity?: number
    },
  ) => {
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => {
        if (element.id !== id || element.locked || element.kind === 'tile') return element
        let updated: TextElement | SymbolElement | DrawingElement | ImageElement
        if (element.kind === 'text') {
          updated = {
              ...element,
              text: properties.text ?? element.text,
              color: properties.color ?? element.color,
              fontSize: clamp(properties.fontSize ?? element.fontSize, 12, 72),
              fontFamily: properties.fontFamily ?? element.fontFamily,
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
        } else {
          updated = {
            ...element,
            opacity: clamp(properties.opacity ?? element.opacity, 0.1, 1),
          }
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
        return { ...element, color }
      }),
    })
  }

  const updateElementStrokeWidth = (id: string, strokeWidth: number) => {
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => element.id === id && (element.kind === 'symbol' || element.kind === 'drawing') && !element.locked
        ? { ...element, strokeWidth: clamp(strokeWidth, 1, element.kind === 'symbol' ? 12 : 20) }
        : element),
    })
  }

  const resizeElement = (id: string, width: number, height: number) => {
    const elements = scene.elements.map((element) => {
        if (element.id !== id || element.locked) return element
        if (element.kind === 'symbol') {
          const base = getElementDimensions({ ...element, scale: 1, scaleX: 1, scaleY: 1 })
          return { ...element, scaleX: clamp(width / base.width, 0.25, 12), scaleY: clamp(height / base.height, 0.25, 12) }
        }
        if (element.kind === 'image' || element.kind === 'drawing') {
          return { ...element, width: Math.max(width, 24), height: Math.max(height, 24) }
        }
        return element
      })
    history.updateLive({
      ...scene,
      elements,
    })
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

  const loadLayout = (layout: SavedLayout, message: string) => {
    history.load(layout.scene)
    setRulerCount(layout.scene.elements.filter((element) => element.kind === 'tile').length)
    setShowGrid(layout.settings.showGrid)
    setSnapToGrid(layout.settings.snapToGrid)
    setPlacementMode('select')
    setContextMenu(null)
    notify(message)
  }

  const saveNamedLayout = async (name: string) => {
    const layout = makeSavedLayout()
    const saved: NamedSavedLayout = {
      id: createId('saved-layout'),
      name,
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
      signalSavedLayoutsChanged()
      notify(`「${name}」を保存しました`)
    } catch {
      notify('保存できませんでした。ブラウザの保存設定を確認してください')
    }
  }

  const loadNamedLayout = (id: string) => {
    const saved = savedLayouts.find((item) => item.id === id)
    if (!saved) return
    loadLayout(saved.layout, `「${saved.name}」を呼び出しました`)
    setSavedLayoutsOpen(false)
  }

  const deleteNamedLayout = async (id: string) => {
    const saved = savedLayouts.find((item) => item.id === id)
    if (!saved) return
    const next = savedLayouts.filter((item) => item.id !== id)
    try {
      await writeLargeValue(SAVED_LAYOUTS_KEY, next)
      setSavedLayouts(next)
      signalSavedLayoutsChanged()
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
      signalSavedLayoutsChanged()
      notify('保存ページのタイトルを更新しました')
    } catch {
      notify('保存ページのタイトルを更新できませんでした')
    }
  }

  const importSharedLayout = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Record<string, unknown>
      const layoutValue = data.layout ?? data
      const layout = parseSavedLayout(JSON.stringify(layoutValue))
      if (!layout) throw new Error('invalid-layout')
      const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : file.name.replace(/\.mahjong-layout\.json$/i, '')
      const saved: NamedSavedLayout = { id: createId('saved-layout'), name, savedAt: new Date().toISOString(), layout }
      const next = [saved, ...savedLayouts]
      await writeLargeValue(SAVED_LAYOUTS_KEY, next)
      setSavedLayouts(next)
      signalSavedLayoutsChanged()
      loadLayout(layout, `「${name}」を読み込みました`)
    } catch {
      notify('共有ファイルを読み込めませんでした')
    }
  }

  const saveQuickLayout = () => {
    const name = `保存 ${new Date().toLocaleString('ja-JP')}`
    saveNamedLayout(name)
    setSavedLayoutsOpen(true)
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
  }

  const imagePasteAction = useRef(addImageFile)
  imagePasteAction.current = addImageFile
  const textPasteAction = useRef(commitText)
  textPasteAction.current = commitText

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement
      if (target.matches('input, textarea, select')) return
      const imageItem = [...event.clipboardData?.items ?? []].find((item) => item.type.startsWith('image/'))
      const file = imageItem?.getAsFile()
      if (file) {
        event.preventDefault()
        void imagePasteAction.current(file)
      } else if (keyboardActions.current.pasteClipboard()) {
        event.preventDefault()
      } else {
        const text = event.clipboardData?.getData('text/plain').trim()
        if (text) {
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
      if (target.matches('input, textarea, select')) return

      const command = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
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
  const tileCount = scene.elements.filter((element) => element.kind === 'tile').length
  const contextElement = contextMenu ? scene.elements.find((element) => element.id === contextMenu.elementId) ?? null : null
  const propertyElement = propertyElementId
    ? scene.elements.find((element): element is TextElement | SymbolElement | DrawingElement | ImageElement => element.id === propertyElementId && element.kind !== 'tile') ?? null
    : null

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true"><span>牌</span></div>
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
        textStyle={selectedText ? { fontFamily: selectedText.fontFamily, fontSize: selectedText.fontSize, color: selectedText.color } : defaultTextStyle}
        isEditingSelectedText={Boolean(selectedText)}
        selectedShapeColor={selectedColoredElement?.color ?? null}
        shapeColor={selectedColoredElement?.color ?? defaultShapeColor}
        shapeStrokeWidth={selectedColoredElement?.strokeWidth ?? defaultShapeStrokeWidth}
        canDuplicate={selected.length > 0}
        canToggleTileFaces={selected.some((element) => element.kind === 'tile' && !element.locked)}
        canEditProperties={Boolean(selectedEditable)}
        showGrid={showGrid}
        snapToGrid={snapToGrid}
        placementMode={placementMode}
        onClear={() => {
          history.commit({ ...EMPTY_SCENE, width: scene.width, height: scene.height })
          setRulerCount(0)
        }}
        onUndo={history.undo}
        onRedo={history.redo}
        onAlign={alignTiles}
        onDeleteSelected={deleteSelected}
        onDuplicate={duplicateSelected}
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
          setDefaultTextStyle((current) => ({
            fontFamily: style.fontFamily ?? current.fontFamily,
            fontSize: style.fontSize === undefined ? current.fontSize : clamp(style.fontSize, 12, 72),
            color: style.color ?? current.color,
          }))
        }}
        onUpdateSelectedShapeColor={(color) => selectedColoredElement ? updateElementColor(selectedColoredElement.id, color) : setDefaultShapeColor(color)}
        onUpdateShapeStrokeWidth={(strokeWidth) => selectedColoredElement ? updateElementStrokeWidth(selectedColoredElement.id, strokeWidth) : setDefaultShapeStrokeWidth(clamp(strokeWidth, 1, 20))}
        onEditProperties={() => selectedEditable && setPropertyElementId(selectedEditable.id)}
        onRandomHand={generateHand}
        onShuffle={shuffleTiles}
        onSetPlacementMode={setPlacementMode}
        onToggleGrid={() => setShowGrid((value) => !value)}
        onToggleSnap={() => setSnapToGrid((value) => !value)}
        onSaveLocal={saveQuickLayout}
        onOpenSavedLayouts={() => setSavedLayoutsOpen(true)}
        onImportSharedLayout={() => shareInputRef.current?.click()}
        onAddImage={() => requestImage()}
        onAddText={(text) => commitText(text)}
        onHelp={() => setHelpOpen(true)}
      />

      <main className="app-body">
        <TilePalette
          onAddTile={addTile}
          placementMode={placementMode}
          trashActive={trashActive}
          onSelectPlacementMode={setPlacementMode}
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
              snapToGrid={snapToGrid}
              placementMode={placementMode}
              editTextRequest={editTextRequest}
              onDropTile={addTile}
              onDropFiles={(files, x, y) => {
                const sharedLayout = files.find((file) => file.name.toLowerCase().endsWith('.mahjong-layout.json'))
                if (sharedLayout) void importSharedLayout(sharedLayout)
                files.filter((file) => file.type.startsWith('image/')).forEach((file, index) => void addImageFile(file, { x: x + index * 20, y: y + index * 20 }))
              }}
              onDropText={(text, x, y) => commitText(text, x, y)}
              onSelectElement={selectElement}
              onSelectRange={selectRange}
              onClearSelection={clearSelection}
              onMoveElements={moveElements}
              onDeleteDragged={deleteElements}
              onTrashHover={setTrashActive}
              onPlaceSymbol={placeSymbol}
              onCommitDrawing={commitDrawing}
              onCommitText={commitText}
              onFinishTextEditing={() => setEditTextRequest(null)}
              onToggleTileFace={toggleTileFace}
              onOpenContextMenu={openContextMenu}
              onResizeElement={resizeElement}
              onBeginDrag={history.beginTransaction}
              onEndDrag={history.endTransaction}
            />
          </div>
        </section>
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
          canPaste={clipboard.length > 0}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onClose={() => setContextMenu(null)}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
          onCopy={copySelected}
          onPaste={() => pasteClipboard({ x: contextMenu.canvasX, y: contextMenu.canvasY })}
          onAddRectangle={() => placeSymbol('rectangle', contextMenu.canvasX, contextMenu.canvasY)}
          onAddTriangle={() => placeSymbol('triangle', contextMenu.canvasX, contextMenu.canvasY)}
          onAddCircle={() => placeSymbol('circle', contextMenu.canvasX, contextMenu.canvasY)}
          onAddCross={() => placeSymbol('cross', contextMenu.canvasX, contextMenu.canvasY)}
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
          onBringFront={() => contextElement && moveLayer(contextElement.id, 'front')}
          onSendBack={() => contextElement && moveLayer(contextElement.id, 'back')}
          onUndo={history.undo}
          onRedo={history.redo}
        />
      )}

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
          onSave={saveNamedLayout}
          onLoad={loadNamedLayout}
          onDelete={deleteNamedLayout}
          onRename={renameNamedLayout}
          onClose={() => setSavedLayoutsOpen(false)}
        />
      )}

      {toast && <div className="toast" role="status">✓ {toast}</div>}
      {helpOpen && <HelpModal onClose={() => { localStorage.setItem(HELP_KEY, '1'); setHelpOpen(false) }} />}
    </div>
  )
}

export default App
