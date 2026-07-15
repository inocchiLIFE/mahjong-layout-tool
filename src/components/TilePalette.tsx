import { TILE_GROUPS } from '../data/tiles'
import type { TileDefinition } from '../types'

interface TilePaletteProps {
  onAddTile: (tileId: string) => void
}

const PaletteTile = ({ tile, onAdd }: { tile: TileDefinition; onAdd: () => void }) => (
  <button
    className={`palette-tile${tile.isRed ? ' red-tile' : ''}`}
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
    {tile.isRed && <span className="red-badge">赤</span>}
    <img src={tile.asset} alt={tile.label} draggable={false} />
  </button>
)

export const TilePalette = ({ onAddTile }: TilePaletteProps) => (
  <aside className="palette-panel" aria-label="牌一覧">
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
    </div>
  </aside>
)
