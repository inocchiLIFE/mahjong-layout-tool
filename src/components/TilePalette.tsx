import { useRef, type DragEvent as ReactDragEvent } from 'react'
import { TILE_GROUPS } from '../data/tiles'
import type { CustomShapeTemplate, PlacementMode, StrokePattern, SymbolType, TileDefinition } from '../types'
import type { DrawingTool } from './DrawingPresetDialog'
import { getCssBorderStyle, getStrokeDasharray } from '../utils/stroke'

interface TilePaletteProps {
  onAddTile: (tileId: string) => void
  placementMode: PlacementMode
  trashActive: boolean
  onSelectPlacementMode: (mode: PlacementMode) => void
  onOpenSymbolPreset: (symbolType: SymbolType) => void
  onOpenDrawingPreset: (tool: DrawingTool) => void
  symbolColors: Record<SymbolType, string>
  symbolStrokeWidths: Record<SymbolType, number>
  symbolStrokePatterns: Record<SymbolType, StrokePattern>
  drawingColors: Record<Exclude<DrawingTool, 'eraser'>, string>
  symbolSizes: Record<SymbolType, { width: number; height: number }>
  customShapes: CustomShapeTemplate[]
  onInsertCustomShape: (id: string) => void
  onEditCustomShape: (id: string) => void
  onCustomShapeDragChange: (id: string | null) => void
}

const PaletteTile = ({ tile, onAdd }: { tile: TileDefinition; onAdd: () => void }) => {
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const addedForGesture = useRef(false)
  const addOnce = () => {
    if (addedForGesture.current) return
    addedForGesture.current = true
    onAdd()
  }
  return <button
      className="palette-tile"
      type="button"
      draggable
      onPointerDown={(event) => {
        pointerStart.current = { x: event.clientX, y: event.clientY }
        addedForGesture.current = false
      }}
      onClick={addOnce}
      onDragStart={(event) => {
        event.dataTransfer.setData('application/x-mahjong-tile', tile.id)
        event.dataTransfer.effectAllowed = 'copy'
      }}
      onDragEnd={(event) => {
        const start = pointerStart.current
        pointerStart.current = null
        if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 14) return
        // Browsers suppress click after a native drag. Treat a tiny drift as
        // a click so the palette remains easy to use with a trackpad or pen.
        addOnce()
      }}
      title={`${tile.label}を追加（ドラッグもできます）`}
      aria-label={`${tile.label}を作業エリアに追加`}
    >
      <img src={tile.asset} alt={tile.label} draggable={false} />
    </button>
}

const symbolChoices: Array<{ mode: PlacementMode; icon: string; label: string; hint: string; dragOnly?: boolean }> = [
  { mode: 'rectangle', icon: '▭', label: '長方形', hint: 'ドラッグして配置', dragOnly: true },
  { mode: 'circle', icon: '〇', label: '丸', hint: 'ドラッグして配置', dragOnly: true },
  { mode: 'triangle', icon: '△', label: '三角形', hint: 'ドラッグして配置', dragOnly: true },
  { mode: 'cross', icon: '✕', label: 'バツ', hint: 'ドラッグして配置', dragOnly: true },
  { mode: 'wave', icon: '〰', label: '波線（牌5枚分）', hint: 'ドラッグして配置', dragOnly: true },
  { mode: 'draw', icon: '✎', label: 'ペン', hint: '手描きで線を書く' },
  { mode: 'eraser', icon: '⌫', label: '消しゴム', hint: '要素をクリックして削除' },
  { mode: 'line', icon: '╱', label: '直線', hint: 'ドラッグで描画' },
  { mode: 'curve', icon: '⌒', label: '曲線', hint: 'ドラッグで描画' },
  { mode: 'arrow', icon: '→', label: '矢印', hint: 'ドラッグで描画' },
  { mode: 'text', icon: 'T', label: 'クリック文字', hint: '自由入力' },
]

const setSymbolDragPreview = (event: ReactDragEvent<HTMLButtonElement>, mode: PlacementMode, color: string, size: { width: number; height: number }, strokeWidth: number, strokePattern: StrokePattern) => {
  if (mode !== 'rectangle' && mode !== 'circle' && mode !== 'triangle' && mode !== 'cross' && mode !== 'wave') return
  const { width, height } = size
  const appScale = window.matchMedia('(min-width: 651px)').matches
    ? 0.8 * (Number.parseFloat(getComputedStyle(document.querySelector('.app-shell') ?? document.documentElement).getPropertyValue('--app-scale')) || 1.1)
    : 1
  const visualWidth = width * appScale
  const visualHeight = height * appScale
  const preview = document.createElement('div')
  preview.style.position = 'fixed'
  preview.style.left = '-10000px'
  preview.style.top = '-10000px'
  preview.style.width = `${visualWidth}px`
  preview.style.height = `${visualHeight}px`
  preview.style.boxSizing = 'border-box'
  preview.style.color = color
  preview.style.background = 'rgba(255,255,255,.92)'
  preview.style.opacity = '.92'
  preview.style.pointerEvents = 'none'
  const dasharray = getStrokeDasharray(strokePattern, strokeWidth)
  const dashAttribute = dasharray ? ` stroke-dasharray="${dasharray}"` : ''
  if (mode === 'rectangle') {
    preview.style.border = `${strokeWidth}px ${getCssBorderStyle(strokePattern)} currentColor`
    preview.style.borderRadius = '5px'
  } else if (mode === 'circle') {
    preview.style.border = `${strokeWidth}px ${getCssBorderStyle(strokePattern)} currentColor`
    preview.style.borderRadius = '50%'
  } else if (mode === 'cross') {
    preview.innerHTML = `<svg viewBox="0 0 48 66" width="${visualWidth}" height="${visualHeight}" aria-hidden="true"><path d="M 7 7 L 41 59 M 41 7 L 7 59" fill="none" stroke="currentColor" stroke-width="${strokeWidth}"${dashAttribute} stroke-linecap="round" /></svg>`
  } else if (mode === 'wave') {
    preview.innerHTML = `<svg viewBox="0 0 240 16" width="${visualWidth}" height="${visualHeight}" aria-hidden="true"><path d="M 0 8 q 6 -5 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0" fill="none" stroke="currentColor" stroke-width="${strokeWidth}"${dashAttribute} stroke-linecap="round" /></svg>`
  } else {
    preview.innerHTML = `<svg viewBox="0 0 99 66" width="${visualWidth}" height="${visualHeight}" aria-hidden="true"><polygon points="49.5,5 94,61 5,61" fill="none" stroke="currentColor" stroke-width="${strokeWidth}"${dashAttribute} stroke-linejoin="round" /></svg>`
  }
  document.body.appendChild(preview)
  event.dataTransfer.setDragImage(preview, visualWidth / 2, visualHeight / 2)
  window.requestAnimationFrame(() => preview.remove())
}

export const TilePalette = ({ onAddTile, placementMode, trashActive, onSelectPlacementMode, onOpenSymbolPreset, onOpenDrawingPreset, symbolColors, drawingColors, symbolStrokeWidths, symbolStrokePatterns, symbolSizes, customShapes, onInsertCustomShape, onEditCustomShape, onCustomShapeDragChange }: TilePaletteProps) => (
  <aside className={`palette-panel${trashActive ? ' trash-active' : ''}`} aria-label="牌一覧と削除エリア">
    <div className="palette-trash-message" aria-hidden={!trashActive}>
      <strong>ここで離して削除</strong>
      <span>元に戻すで復元できます</span>
    </div>

    <div className="panel-heading">
      <div>
        <span className="eyebrow">TILE LIBRARY</span>
        <h2>牌一覧</h2>
      </div>
      <span className="panel-hint">クリック / ドラッグ</span>
    </div>

    <div className="palette-scroll">
      {TILE_GROUPS.map((group) => (
        <section className="tile-group" key={group.suit}>
          <h3>{group.label}</h3>
          <div className={`tile-grid${group.suit === 'honor' ? ' honor-grid' : ''}`}>
            {group.tiles.map((tile) => (
              <PaletteTile key={tile.id} tile={tile} onAdd={() => onAddTile(tile.id)} />
            ))}
          </div>
        </section>
      ))}

      <section className="tile-group symbol-palette-group">
        <h3>記号・文字</h3>
        <div className="symbol-palette-grid">
          {symbolChoices.map((choice) => (
            <button
              key={choice.mode}
              type="button"
              draggable={choice.dragOnly}
              className={`symbol-palette-button${!choice.dragOnly && placementMode === choice.mode ? ' active' : ''}${choice.dragOnly ? ' drag-only' : ''}`}
              onClick={() => !choice.dragOnly && onSelectPlacementMode(placementMode === choice.mode ? 'select' : choice.mode)}
              onDragStart={(event) => {
                if (!choice.dragOnly) return
                event.dataTransfer.setData('application/x-mahjong-symbol', choice.mode)
                event.dataTransfer.effectAllowed = 'copy'
                setSymbolDragPreview(event, choice.mode, symbolColors[choice.mode as SymbolType], symbolSizes[choice.mode as SymbolType], symbolStrokeWidths[choice.mode as SymbolType], symbolStrokePatterns[choice.mode as SymbolType])
              }}
              onContextMenu={(event) => { if (choice.dragOnly) { event.preventDefault(); onOpenSymbolPreset(choice.mode as SymbolType) } else if (['draw', 'line', 'curve', 'arrow', 'eraser'].includes(choice.mode)) { event.preventDefault(); onOpenDrawingPreset(choice.mode as DrawingTool) } }}
              aria-pressed={!choice.dragOnly && placementMode === choice.mode}
              aria-label={choice.dragOnly ? `${choice.label}をドラッグして配置` : `${choice.label}配置ツール`}
            >
              <b aria-hidden="true" style={choice.dragOnly ? { color: symbolColors[choice.mode as SymbolType] } : ['draw', 'line', 'curve', 'arrow'].includes(choice.mode) ? { color: drawingColors[choice.mode as Exclude<DrawingTool, 'eraser'>] } : undefined}>{choice.icon}</b>
              <span>{choice.label}<small>{choice.hint}</small></span>
            </button>
          ))}
        </div>
      </section>

      {customShapes.length > 0 && <section className="tile-group custom-shape-palette-group">
        <h3>マイ図形</h3>
        <div className="custom-shape-palette-list">
          {customShapes.map((shape) => <button key={shape.id} type="button" draggable onClick={() => onInsertCustomShape(shape.id)} onDragStart={(event) => { event.dataTransfer.setData('application/x-mahjong-custom-shape', shape.id); event.dataTransfer.effectAllowed = 'copy'; onCustomShapeDragChange(shape.id) }} onDragEnd={() => onCustomShapeDragChange(null)} onContextMenu={(event) => { event.preventDefault(); onEditCustomShape(shape.id) }} title={`${shape.name}を追加（ドラッグで配置・右クリックで編集）`}>☆ {shape.name}</button>)}
        </div>
      </section>}
    </div>
  </aside>
)
