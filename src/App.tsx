import { useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import './App.css'
import { HelpModal } from './components/HelpModal'
import { TilePalette } from './components/TilePalette'
import { Toolbar } from './components/Toolbar'
import { Workspace } from './components/Workspace'
import { WorkspaceSizeControls } from './components/WorkspaceSizeControls'
import { TILE_MAP } from './data/tiles'
import { useSceneHistory } from './hooks/useSceneHistory'
import type {
  CanvasElement,
  ElementPosition,
  PlacementMode,
  Rotation,
  SavedLayout,
  Scene,
  SymbolType,
} from './types'
import {
  DEFAULT_WORKSPACE_HEIGHT,
  DEFAULT_WORKSPACE_WIDTH,
  GRID_SIZE,
  MAX_WORKSPACE_HEIGHT,
  MAX_WORKSPACE_WIDTH,
  MIN_WORKSPACE_HEIGHT,
  MIN_WORKSPACE_WIDTH,
  TILE_GAP,
  TILE_HEIGHT,
  TILE_WIDTH,
  clamp,
  getElementDimensions,
  getSceneContentBounds,
  makeSymbol,
  makeText,
  makeTile,
  randomHand,
  snap,
} from './utils/layout'

const AUTO_SAVE_KEY = 'mahjong-layout-tool:auto-v1'
const MANUAL_SAVE_KEY = 'mahjong-layout-tool:manual-v1'
const HELP_KEY = 'mahjong-layout-tool:help-seen'
const EMPTY_SCENE: Scene = {
  elements: [],
  width: DEFAULT_WORKSPACE_WIDTH,
  height: DEFAULT_WORKSPACE_HEIGHT,
}

const isRotation = (value: unknown): value is Rotation =>
  value === 0 || value === 90 || value === 180 || value === 270

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
    x: Math.max(0, Math.round(item.x)),
    y: Math.max(0, Math.round(item.y)),
    rotation: isRotation(item.rotation) ? item.rotation : 0 as Rotation,
    selected: Boolean(item.selected),
    zIndex: typeof item.zIndex === 'number' ? item.zIndex : 1,
  }
  if (item.kind === 'tile' && typeof item.tileId === 'string' && TILE_MAP.has(item.tileId)) {
    return { ...base, kind: 'tile', tileId: item.tileId }
  }
  if (item.kind === 'text' && typeof item.text === 'string') {
    return {
      ...base,
      kind: 'text',
      text: item.text,
      color: normalizeTextColor(item.color),
      fontSize: typeof item.fontSize === 'number' ? clamp(item.fontSize, 12, 72) : 22,
    }
  }
  if (item.kind === 'symbol' && (item.symbolType === 'rectangle' || item.symbolType === 'cross' || item.symbolType === 'circle')) {
    return { ...base, kind: 'symbol', symbolType: item.symbolType }
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
    version: 2,
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
    if (data.version !== 2 || !scene || !Array.isArray(scene.elements)) return null
    const elements = scene.elements.map(parseElement).filter((item): item is CanvasElement => item !== null)
    const settings = data.settings as Record<string, unknown> | undefined
    const width = clamp(typeof scene.width === 'number' ? scene.width : DEFAULT_WORKSPACE_WIDTH, MIN_WORKSPACE_WIDTH, MAX_WORKSPACE_WIDTH)
    const height = clamp(typeof scene.height === 'number' ? scene.height : DEFAULT_WORKSPACE_HEIGHT, MIN_WORKSPACE_HEIGHT, MAX_WORKSPACE_HEIGHT)
    return {
      version: 2,
      savedAt: typeof data.savedAt === 'string' ? data.savedAt : new Date().toISOString(),
      scene: { elements, width, height },
      settings: {
        showGrid: settings?.showGrid !== false,
        snapToGrid: settings?.snapToGrid === true,
      },
    }
  } catch {
    return null
  }
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const App = () => {
  const [initialLayout] = useState(() => parseSavedLayout(localStorage.getItem(AUTO_SAVE_KEY)))
  const history = useSceneHistory(initialLayout?.scene ?? EMPTY_SCENE)
  const scene = history.scene
  const [showGrid, setShowGrid] = useState(initialLayout?.settings.showGrid ?? true)
  const [snapToGrid, setSnapToGrid] = useState(initialLayout?.settings.snapToGrid ?? false)
  const [screenshotGrid, setScreenshotGrid] = useState(true)
  const [placementMode, setPlacementMode] = useState<PlacementMode>('select')
  const [editTextRequest, setEditTextRequest] = useState<{ id: string; token: number } | null>(null)
  const [helpOpen, setHelpOpen] = useState(() => localStorage.getItem(HELP_KEY) !== '1')
  const [toast, setToast] = useState('')
  const workspaceRef = useRef<HTMLDivElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const toastTimerRef = useRef<number | null>(null)

  const notify = (message: string) => {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2400)
  }

  const makeSavedLayout = (): SavedLayout => ({
    version: 2,
    savedAt: new Date().toISOString(),
    scene,
    settings: { showGrid, snapToGrid },
  })

  useEffect(() => {
    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify({
      version: 2,
      savedAt: new Date().toISOString(),
      scene,
      settings: { showGrid, snapToGrid },
    } satisfies SavedLayout))
  }, [scene, showGrid, snapToGrid])

  const nextZIndex = () => Math.max(0, ...scene.elements.map((element) => element.zIndex)) + 1

  const addTile = (tileId: string, dropX?: number, dropY?: number) => {
    const tileCount = scene.elements.filter((element) => element.kind === 'tile').length
    const columnCount = Math.max(1, Math.floor((scene.width - 40) / (TILE_WIDTH + TILE_GAP)))
    const x = dropX ?? 24 + (tileCount % columnCount) * (TILE_WIDTH + TILE_GAP)
    const y = dropY ?? 32 + Math.floor(tileCount / columnCount) * (TILE_HEIGHT + TILE_GAP)
    history.commit({
      ...scene,
      elements: [
        ...scene.elements,
        makeTile(
          tileId,
          clamp(snap(x, snapToGrid), 0, scene.width - TILE_WIDTH),
          clamp(snap(y, snapToGrid), 0, scene.height - TILE_HEIGHT),
          nextZIndex(),
        ),
      ],
    })
  }

  const selectElement = (id: string, additive: boolean) => {
    const target = scene.elements.find((element) => element.id === id)
    if (!target) return
    const preserveGroup = target.selected && !additive
    const maxZ = nextZIndex()
    history.updateLive({
      ...scene,
      elements: scene.elements.map((element) => ({
        ...element,
        selected: element.id === id
          ? additive ? !element.selected : true
          : additive || preserveGroup ? element.selected : false,
        zIndex: element.id === id ? maxZ : element.zIndex,
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
    history.updateLive({
      ...scene,
      elements: scene.elements.map((element) => {
        const position = byId.get(element.id)
        return position ? { ...element, x: position.x, y: position.y } : element
      }),
    })
  }

  const deleteSelected = () => {
    const elements = scene.elements.filter((element) => !element.selected)
    if (elements.length === scene.elements.length) return
    history.commit({ ...scene, elements })
  }

  const rotateSelected = () => {
    if (!scene.elements.some((element) => element.selected)) return
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => {
        if (!element.selected) return element
        const rotation = ((element.rotation + 90) % 360) as Rotation
        const rotated = { ...element, rotation } as CanvasElement
        const dimensions = getElementDimensions(rotated)
        return {
          ...rotated,
          x: clamp(rotated.x, 0, scene.width - dimensions.width),
          y: clamp(rotated.y, 0, scene.height - dimensions.height),
        }
      }),
    })
  }

  const alignTiles = () => {
    const tiles = scene.elements.filter((element) => element.kind === 'tile')
    if (!tiles.length) return
    const selected = tiles.filter((tile) => tile.selected)
    const targets = selected.length ? selected : tiles
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
    notify(selected.length ? `${selected.length}枚を等間隔で整列しました` : 'すべての牌を等間隔で整列しました')
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
    notify(`${count}枚の配牌を生成し、理牌しました`)
  }

  const shuffleTiles = () => {
    const tileIds = scene.elements.filter((element) => element.kind === 'tile').map((tile) => tile.tileId)
    if (!tileIds.length) return
    for (let index = tileIds.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1))
      ;[tileIds[index], tileIds[target]] = [tileIds[target], tileIds[index]]
    }
    let tileIndex = 0
    history.commit({
      ...scene,
      elements: scene.elements.map((element) => element.kind === 'tile'
        ? { ...element, tileId: tileIds[tileIndex++] }
        : element),
    })
    notify('配置位置を保ったまま牌をシャッフルしました')
  }

  const commitText = (text: string, x = 40, y?: number, id?: string) => {
    if (id) {
      history.commit({
        ...scene,
        elements: scene.elements.map((element) => element.id === id && element.kind === 'text'
          ? { ...element, text }
          : element),
      })
      return
    }
    const textCount = scene.elements.filter((element) => element.kind === 'text').length
    const item = makeText(text, x, y ?? Math.min(scene.height - 50, 180 + textCount * 48), nextZIndex())
    const dimensions = getElementDimensions(item)
    item.x = clamp(item.x, 0, scene.width - dimensions.width)
    item.y = clamp(item.y, 0, scene.height - dimensions.height)
    history.commit({ ...scene, elements: [...scene.elements, item] })
  }

  const placeSymbol = (symbolType: SymbolType, x: number, y: number) => {
    const item = makeSymbol(symbolType, x, y, nextZIndex())
    const dimensions = getElementDimensions(item)
    item.x = clamp(snap(x, snapToGrid), 0, scene.width - dimensions.width)
    item.y = clamp(snap(y, snapToGrid), 0, scene.height - dimensions.height)
    history.commit({ ...scene, elements: [...scene.elements, item] })
  }

  const resizeWorkspace = (width: number, height: number, live = false) => {
    const bounds = getSceneContentBounds(scene)
    const nextScene = {
      ...scene,
      width: clamp(Math.max(width, bounds.width), MIN_WORKSPACE_WIDTH, MAX_WORKSPACE_WIDTH),
      height: clamp(Math.max(height, bounds.height), MIN_WORKSPACE_HEIGHT, MAX_WORKSPACE_HEIGHT),
    }
    if (live) history.updateLive(nextScene)
    else history.commit(nextScene)
  }

  const saveLocal = () => {
    localStorage.setItem(MANUAL_SAVE_KEY, JSON.stringify(makeSavedLayout()))
    notify('配置・文字・記号・作業エリアサイズを保存しました')
  }

  const loadLayout = (layout: SavedLayout, message: string) => {
    history.load(layout.scene)
    setShowGrid(layout.settings.showGrid)
    setSnapToGrid(layout.settings.snapToGrid)
    setPlacementMode('select')
    notify(message)
  }

  const loadLocal = () => {
    const layout = parseSavedLayout(localStorage.getItem(MANUAL_SAVE_KEY))
    if (!layout) {
      notify('ブラウザ保存データがありません')
      return
    }
    loadLayout(layout, '保存した配置を復元しました')
  }

  const exportJson = () => {
    downloadBlob(new Blob([JSON.stringify(makeSavedLayout(), null, 2)], { type: 'application/json' }), 'mahjong-layout.json')
    notify('JSONを書き出しました')
  }

  const importJson = async (file: File) => {
    const layout = parseSavedLayout(await file.text())
    if (!layout) {
      notify('読み込めないJSON形式です')
      return
    }
    loadLayout(layout, 'JSONから配置を読み込みました')
  }

  const saveScreenshot = async () => {
    const canvas = workspaceRef.current
    if (!canvas) return
    try {
      canvas.classList.add('is-capturing')
      if (!screenshotGrid) canvas.classList.add('capture-hide-grid')
      await new Promise(requestAnimationFrame)
      const dataUrl = await toPng(canvas, { cacheBust: true, pixelRatio: 2, backgroundColor: '#ffffff' })
      const response = await fetch(dataUrl)
      downloadBlob(await response.blob(), `mahjong-layout-${new Date().toISOString().slice(0, 10)}.png`)
      notify('作業エリアをPNGで保存しました')
    } catch {
      notify('PNGの保存に失敗しました')
    } finally {
      canvas.classList.remove('is-capturing', 'capture-hide-grid')
    }
  }

  const keyboardActions = useRef({
    deleteSelected,
    rotateSelected,
    undo: history.undo,
    redo: history.redo,
  })
  keyboardActions.current = { deleteSelected, rotateSelected, undo: history.undo, redo: history.redo }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.matches('input, textarea, select')) return
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        keyboardActions.current.deleteSelected()
      } else if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.metaKey) {
        keyboardActions.current.rotateSelected()
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) keyboardActions.current.redo()
        else keyboardActions.current.undo()
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        keyboardActions.current.redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const selected = scene.elements.filter((element) => element.selected)
  const selectedText = selected.length === 1 && selected[0].kind === 'text' ? selected[0] : null
  const tileCount = scene.elements.filter((element) => element.kind === 'tile').length

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
        hasSelection={selected.length > 0}
        canEditText={Boolean(selectedText)}
        showGrid={showGrid}
        snapToGrid={snapToGrid}
        screenshotGrid={screenshotGrid}
        placementMode={placementMode}
        onClear={() => history.commit({ ...EMPTY_SCENE, width: scene.width, height: scene.height })}
        onUndo={history.undo}
        onRedo={history.redo}
        onAlign={alignTiles}
        onDeleteSelected={deleteSelected}
        onRotate={rotateSelected}
        onEditSelectedText={() => selectedText && setEditTextRequest({ id: selectedText.id, token: Date.now() })}
        onRandomHand={generateHand}
        onShuffle={shuffleTiles}
        onSetPlacementMode={setPlacementMode}
        onToggleGrid={() => setShowGrid((value) => !value)}
        onToggleSnap={() => setSnapToGrid((value) => !value)}
        onSaveLocal={saveLocal}
        onLoadLocal={loadLocal}
        onExportJson={exportJson}
        onImportJson={() => importInputRef.current?.click()}
        onAddText={(text) => commitText(text)}
        onScreenshot={saveScreenshot}
        onToggleScreenshotGrid={() => setScreenshotGrid((value) => !value)}
        onHelp={() => setHelpOpen(true)}
      />

      <main className="app-body">
        <TilePalette onAddTile={addTile} />
        <section className="workspace-panel">
          <div className="workspace-meta">
            <div>
              <span className="canvas-badge">WORKSPACE</span>
              <span>{selected.length ? `${selected.length}件を選択中` : '空白をドラッグして範囲選択'}</span>
            </div>
            <div className="workspace-meta-actions">
              <WorkspaceSizeControls
                width={scene.width}
                height={scene.height}
                onChange={(width, height) => resizeWorkspace(width, height)}
              />
              <div className="legend"><span><i className="legend-grid" />{GRID_SIZE}pxグリッド</span><span><i className="legend-select" />選択中</span></div>
            </div>
          </div>
          <div className="workspace-scroll">
            <Workspace
              ref={workspaceRef}
              scene={scene}
              showGrid={showGrid}
              snapToGrid={snapToGrid}
              placementMode={placementMode}
              editTextRequest={editTextRequest}
              onDropTile={addTile}
              onSelectElement={selectElement}
              onSelectRange={selectRange}
              onClearSelection={clearSelection}
              onMoveElements={moveElements}
              onPlaceSymbol={placeSymbol}
              onCommitText={commitText}
              onFinishTextEditing={() => setEditTextRequest(null)}
              onPlacementComplete={() => setPlacementMode('select')}
              onResize={(width, height) => resizeWorkspace(width, height, true)}
              onBeginDrag={history.beginTransaction}
              onEndDrag={history.endTransaction}
            />
          </div>
        </section>
      </main>

      <input
        ref={importInputRef}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void importJson(file)
          event.target.value = ''
        }}
      />
      {toast && <div className="toast" role="status">✓ {toast}</div>}
      {helpOpen && <HelpModal onClose={() => { localStorage.setItem(HELP_KEY, '1'); setHelpOpen(false) }} />}
    </div>
  )
}

export default App
