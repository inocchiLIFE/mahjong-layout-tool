import type { DragEvent as ReactDragEvent } from 'react'
import { TILE_GROUPS } from '../data/tiles'
import type { PlacementMode, TileDefinition } from '../types'

interface TilePaletteProps {
  onAddTile: (tileId: string) => void
  placementMode: PlacementMode
  trashActive: boolean
  onSelectPlacementMode: (mode: PlacementMode) => void
}

const PaletteTile = ({ tile, onAdd }: { tile: TileDefinition; onAdd: () => void }) => (
  <button
    className="palette-tile"
    type="button"
    draggable
    onClick={onAdd}
    onDragStart={(event) => {
      event.dataTransfer.setData('application/x-mahjong-tile', tile.id)
      event.dataTransfer.effectAllowed = 'copy'
    }}
    title={`${tile.label}を追加（ドラッグもできます）`}
    aria-label={`${tile.label}を作業エリアに追加`}
  >
    <img src={tile.asset} alt={tile.label} draggable={false} />
  </button>
)

const symbolChoices: Array<{ mode: PlacementMode; icon: string; label: string; hint: string; dragOnly?: boolean }> = [
  { mode: 'rectangle', icon: '▭', label: '長方形', hint: 'ドラッグして配置', dragOnly: true },
  { mode: 'circle', icon: '〇', label: '丸', hint: 'ドラッグして配置', dragOnly: true },
  { mode: 'triangle', icon: '△', label: '三角形', hint: 'ドラッグして配置', dragOnly: true },
  { mode: 'cross', icon: '✕', label: 'バツ', hint: 'ドラッグして配置', dragOnly: true },
  { mode: 'wave', icon: '〰', label: '波線（牌5枚分）', hint: 'ドラッグして配置', dragOnly: true },
  { mode: 'line', icon: '╱', label: '直線', hint: 'ドラッグで描画' },
  { mode: 'curve', icon: '⌒', label: '曲線', hint: 'ドラッグで描画' },
  { mode: 'arrow', icon: '→', label: '矢印', hint: 'ドラッグで描画' },
  { mode: 'text', icon: 'T', label: 'クリック文字', hint: '自由入力' },
]

const setSymbolDragPreview = (event: ReactDragEvent<HTMLButtonElement>, mode: PlacementMode) => {
  if (mode !== 'rectangle' && mode !== 'circle' && mode !== 'triangle' && mode !== 'cross' && mode !== 'wave') return
  const width = mode === 'wave' ? 240 : mode === 'rectangle' ? 148 : mode === 'cross' ? 48 : 98
  const height = mode === 'wave' ? 16 : 66
  const preview = document.createElement('div')
  preview.style.position = 'fixed'
  preview.style.left = '-10000px'
  preview.style.top = '-10000px'
  preview.style.width = `${width}px`
  preview.style.height = `${height}px`
  preview.style.boxSizing = 'border-box'
  preview.style.color = '#244a40'
  preview.style.background = 'rgba(255,255,255,.92)'
  preview.style.opacity = '.92'
  preview.style.pointerEvents = 'none'
  if (mode === 'rectangle') {
    preview.style.border = '4px solid currentColor'
    preview.style.borderRadius = '5px'
  } else if (mode === 'circle') {
    preview.style.border = '4px solid currentColor'
    preview.style.borderRadius = '50%'
  } else if (mode === 'cross') {
    preview.style.display = 'grid'
    preview.style.placeItems = 'center'
    preview.style.font = '700 49px/1 "Yu Gothic", sans-serif'
    preview.textContent = '✕'
  } else if (mode === 'wave') {
    preview.innerHTML = '<svg viewBox="0 0 240 16" width="240" height="16" aria-hidden="true"><path d="M 0 8 q 6 -5 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0" fill="none" stroke="#244a40" stroke-width="2" stroke-linecap="round" /></svg>'
  } else {
    preview.innerHTML = '<svg viewBox="0 0 99 66" width="98" height="66" aria-hidden="true"><polygon points="49.5,5 94,61 5,61" fill="none" stroke="#244a40" stroke-width="4" stroke-linejoin="round" /></svg>'
  }
  document.body.appendChild(preview)
  event.dataTransfer.setDragImage(preview, width / 2, height / 2)
  window.requestAnimationFrame(() => preview.remove())
}

export const TilePalette = ({ onAddTile, placementMode, trashActive, onSelectPlacementMode }: TilePaletteProps) => (
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
                setSymbolDragPreview(event, choice.mode)
              }}
              aria-pressed={!choice.dragOnly && placementMode === choice.mode}
              aria-label={choice.dragOnly ? `${choice.label}をドラッグして配置` : `${choice.label}配置ツール`}
            >
              <b aria-hidden="true">{choice.icon}</b>
              <span>{choice.label}<small>{choice.hint}</small></span>
            </button>
          ))}
        </div>
      </section>
    </div>
  </aside>
)
