import { useRef, useState, type PointerEvent } from 'react'
import { TILE_MAP } from '../data/tiles'
import { getDiscardEfficiencies, getEfficiency } from '../utils/mahjongEfficiency'

const Tile = ({ tileId }: { tileId: string }) => {
  const tile = TILE_MAP.get(tileId)
  return tile ? <img className="efficiency-tile" src={tile.asset} alt={tile.label} title={tile.label} /> : null
}

export const EfficiencyPanel = ({ tileIds, onClose, onResize }: { tileIds: string[]; onClose: () => void; onResize: (width: number) => void }) => {
  const panelRef = useRef<HTMLElement>(null)
  const [discardSort, setDiscardSort] = useState<'efficiency' | 'tile'>('efficiency')
  const startResize = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = panelRef.current?.getBoundingClientRect().width ?? 260
    const move = (moveEvent: globalThis.PointerEvent) => onResize(startWidth + startX - moveEvent.clientX)
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }
  const result = getEfficiency(tileIds)
  const discards = tileIds.length === 14 ? getDiscardEfficiencies(tileIds) : []
  const sortedDiscards = discards
    .filter((discard): discard is { discardTileId: string; result: NonNullable<typeof discard.result> } => discard.result !== null)
    .sort((left, right) => {
      const tileOrder = (tileId: string) => TILE_MAP.get(tileId)?.order ?? Number.MAX_SAFE_INTEGER
      if (discardSort === 'tile') return tileOrder(left.discardTileId) - tileOrder(right.discardTileId)
      return left.result.shanten - right.result.shanten
        || right.result.effectiveTileCount - left.result.effectiveTileCount
        || tileOrder(left.discardTileId) - tileOrder(right.discardTileId)
    })
  const isDiscardAnalysis = discards.length > 0
  const heading = <div className="efficiency-heading"><strong>牌理・受け入れ</strong><button type="button" onClick={onClose} aria-label="牌理・受け入れを隠す" title="隠す">×</button></div>
  const resizeHandle = <button type="button" className="efficiency-resize-handle" onPointerDown={startResize} aria-label="パネル幅を変更" />
  if (!tileIds.length) return <aside ref={panelRef} className="efficiency-panel empty">{resizeHandle}{heading}<span>表向きの牌を選択すると解析します</span></aside>
  if (!result) return <aside ref={panelRef} className="efficiency-panel invalid">{resizeHandle}{heading}<span>同一牌は4枚まで、解析できるのは14枚までです</span></aside>
  return (
    <aside ref={panelRef} className="efficiency-panel" aria-live="polite">
      {resizeHandle}{heading}
      {!isDiscardAnalysis && <><span className="efficiency-count">{tileIds.length}枚を解析中</span><div className="efficiency-summary"><b>{result.shanten === -1 ? '和了' : `${result.shanten}シャンテン`}</b><span>受け入れ <em>{result.effectiveTileIds.length}種 {result.effectiveTileCount}牌</em></span></div>{result.effectiveTileIds.length > 0 && <div className="efficiency-waits" aria-label="有効牌">{result.effectiveTileIds.map((tileId) => <Tile key={tileId} tileId={tileId} />)}</div>}</>}
      {discards.length > 0 && <div className="efficiency-discards"><div className="efficiency-discard-heading"><strong>選択打牌ごとの受け入れ</strong><label>並び順<select value={discardSort} onChange={(event) => setDiscardSort(event.target.value as 'efficiency' | 'tile')}><option value="efficiency">受け入れ枚数順</option><option value="tile">牌の並び順</option></select></label></div>{sortedDiscards.map(({ discardTileId, result: discardResult }) => <div className="efficiency-discard" key={discardTileId}><div className="efficiency-discard-summary"><Tile tileId={discardTileId} /><span>切り</span><b>{discardResult.shanten === -1 ? '和了' : `${discardResult.shanten}シャンテン`}</b><em>{discardResult.effectiveTileIds.length}種 {discardResult.effectiveTileCount}牌</em></div>{discardResult.effectiveTileIds.length > 0 && <div className="efficiency-discard-waits" aria-label={`${TILE_MAP.get(discardTileId)?.label ?? ''}切りの有効牌`}>{discardResult.effectiveTileIds.map((tileId) => <Tile key={tileId} tileId={tileId} />)}</div>}</div>)}</div>}
      <small>通常形・七対子・国士無双を含む。残り枚数は選択中の手牌だけを既知牌として計算します。</small>
    </aside>
  )
}
