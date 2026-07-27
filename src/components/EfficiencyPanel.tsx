import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { TILE_MAP } from '../data/tiles'
import { getEfficiency, getTenpaiTransitions } from '../utils/mahjongEfficiency'
import { classifyIishantenCandidate, IISHANTEN_LABELS } from '../utils/iishanten'
import { calculateExpectedValues, EXPECTED_VALUE_TILE_IDS, type ExpectedValueSettings, type Wind } from '../utils/expectedValue'
import { MELD_KIND_LABELS, concealedTileCountForMelds, type MahjongMeld, type MeldKind } from '../utils/mahjongMelds'

const Tile = ({ tileId, className = '' }: { tileId: string; className?: string }) => {
  // Results use base tile IDs, while inputs can contain red fives. Keep the
  // source image at its native aspect ratio inside a fixed display frame.
  // Mixing native width/height attributes with different CSS dimensions caused
  // intermittent fragmented rendering during panel updates in Chromium.
  const tile = TILE_MAP.get(tileId)
  return tile ? <span className={`efficiency-tile ${className}`} title={tile.label}><img src={tile.asset} alt={tile.label} width="48" height="66" draggable={false} decoding="sync" /></span> : null
}

const tileNotation = (tileId: string) => {
  const tile = TILE_MAP.get(tileId)
  if (!tile) return tileId
  if (tile.suit === 'man') return `${tile.rank}m`
  if (tile.suit === 'pin') return `${tile.rank}p`
  if (tile.suit === 'sou') return `${tile.rank}s`
  return `${tile.rank}z`
}

const MeldTiles = ({ kind, tileIds }: { kind: MeldKind; tileIds: string[] }) => {
  // Open calls are identified by one sideways tile. Closed kans stay upright.
  const sidewaysIndex = kind === 'closed-kan' ? -1 : kind === 'added-kan' ? tileIds.length - 1 : 0
  return <span className="meld-tiles">{tileIds.map((tileId, index) => <Tile key={`${tileId}-${index}`} tileId={tileId} className={index === sidewaysIndex ? 'meld-sideways-tile' : ''} />)}</span>
}

const formatShanten = (shanten: number) => shanten === -1 ? '和了' : shanten === 0 ? '聴牌' : `${shanten}シャンテン`

export const EfficiencyPanel = ({ tileIds, melds, onClose, onResize }: { tileIds: string[]; melds: MahjongMeld[]; onClose: () => void; onResize: (width: number) => void }) => {
  const panelRef = useRef<HTMLElement>(null)
  const [showTenpaiShapeBreakdown, setShowTenpaiShapeBreakdown] = useState(false)
  const [showExpectedValue, setShowExpectedValue] = useState(false)
  const [showVisibleTiles, setShowVisibleTiles] = useState(false)
  const [expectedValues, setExpectedValues] = useState<ReturnType<typeof calculateExpectedValues>>([])
  const [expectedError, setExpectedError] = useState('')
  const [isCalculatingExpectedValue, setIsCalculatingExpectedValue] = useState(false)
  const [expectedSettings, setExpectedSettings] = useState<ExpectedValueSettings>(() => ({
    roundWind: 'ton', seatWind: 'ton', turn: 3, doraIndicator: null, visibleCounts: {},
    includeRedDora: true, includeUraDora: true, allowShantenBack: true, allowHandChange: true,
  }))
  const startResize = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = panelRef.current?.getBoundingClientRect().width ?? 260
    const move = (moveEvent: globalThis.PointerEvent) => onResize(startWidth + startX - moveEvent.clientX)
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }
  const baseTileIds = tileIds.map((id) => TILE_MAP.get(id)?.baseId ?? id)
  const fixedMeldCount = melds.length
  const concealedTileCount = concealedTileCountForMelds(melds)
  const result = getEfficiency(baseTileIds, fixedMeldCount)
  const discards = baseTileIds.length === concealedTileCount
    ? [...new Set(baseTileIds)].map((discardTileId) => ({ discardTileId, result: getEfficiency(baseTileIds.filter((tileId, index) => tileId !== discardTileId || index !== baseTileIds.indexOf(discardTileId)), fixedMeldCount) }))
    : []
  const meldKey = melds.map((meld) => `${meld.kind}:${meld.tileIds.join(',')}`).join('|')
  useEffect(() => { setExpectedValues([]); setExpectedError('') }, [tileIds, expectedSettings, meldKey])
  const runExpectedValueCalculation = () => {
    setIsCalculatingExpectedValue(true)
    setExpectedError('')
    window.setTimeout(() => {
      try {
        if (tileIds.length !== concealedTileCount) throw new Error(`副露${melds.length}組では、手牌は${concealedTileCount}枚を選択してください。`)
        setExpectedValues(calculateExpectedValues(tileIds, { ...expectedSettings, melds }))
      } catch (error) {
        setExpectedValues([])
        setExpectedError(error instanceof Error ? error.message : '期待値を計算できませんでした。')
      } finally {
        setIsCalculatingExpectedValue(false)
      }
    }, 30)
  }
  const sortedDiscards = discards
    .filter((discard): discard is { discardTileId: string; result: NonNullable<typeof discard.result> } => discard.result !== null && discard.result.shanten <= (result?.shanten ?? Number.MAX_SAFE_INTEGER))
    .sort((left, right) => {
      const tileOrder = (tileId: string) => TILE_MAP.get(tileId)?.order ?? Number.MAX_SAFE_INTEGER
      return left.result.shanten - right.result.shanten
        || right.result.effectiveTileCount - left.result.effectiveTileCount
        || tileOrder(left.discardTileId) - tileOrder(right.discardTileId)
    })
  const tenpaiShapeSummary = (hand: string[], shanten: number) => shanten === 1 ? (() => {
    const groups = getTenpaiTransitions(hand, fixedMeldCount).reduce((result, transition) => {
      const waitCount = Math.max(...transition.tenpaiOptions.map((option) => option.waitTileCount))
      const kind = waitCount >= 6 ? 'good' : 'bad'
      const remaining = 4 - hand.filter((tileId) => tileId === transition.drawTileId).length
      result[kind].push({ tileId: transition.drawTileId, waitCount, remaining })
      return result
    }, { good: [] as Array<{ tileId: string; waitCount: number; remaining: number }>, bad: [] as Array<{ tileId: string; waitCount: number; remaining: number }> })
    const totalRemaining = [...groups.good, ...groups.bad].reduce((sum, item) => sum + item.remaining, 0)
    const formatRate = (items: Array<{ remaining: number }>) => totalRemaining > 0
      ? `${Math.round(items.reduce((sum, item) => sum + item.remaining, 0) / totalRemaining * 1000) / 10}%`
      : '0%'
    const render = (label: '好形聴牌' | '愚形聴牌', items: Array<{ tileId: string; waitCount: number; remaining: number }>) => items.length
      ? <div className={`tenpai-shape-group ${label === '好形聴牌' ? 'good' : 'bad'}`}><span className="tenpai-shape-title">{label}する牌</span><div className="tenpai-shape-tiles">{items.map((item) => <Tile key={item.tileId} tileId={item.tileId} />)}</div><div className="tenpai-shape-summary"><strong>{label}</strong><span>{items.length}種 {items.reduce((sum, item) => sum + item.remaining, 0)}枚（{label === '好形聴牌' ? '好形率' : '愚形率'} {formatRate(items)}）</span><small>{items.map((item) => `${tileNotation(item.tileId)}:${item.waitCount}枚待ち`).join(' / ')}</small></div></div>
      : null
    return <section className="tenpai-shape-summaries" aria-label="好形・愚形聴牌の受け入れ">{render('好形聴牌', groups.good)}{render('愚形聴牌', groups.bad)}</section>
  })() : null
  const isDiscardAnalysis = discards.length > 0
  const hasTenpaiShapeBreakdown = sortedDiscards.some((discard) => {
    if (discard.result.shanten !== 1) return false
    const hand = baseTileIds.filter((tileId, index) => tileId !== discard.discardTileId || index !== baseTileIds.indexOf(discard.discardTileId))
    return getTenpaiTransitions(hand, fixedMeldCount).length > 0
  }) || (!isDiscardAnalysis && result?.shanten === 1 && getTenpaiTransitions(baseTileIds, fixedMeldCount).length > 0)
  const iishantenType = (hand: string[], shanten: number) => {
    if (shanten !== 1) return null
    const type = classifyIishantenCandidate(hand)
    return type ? IISHANTEN_LABELS[type] : null
  }
  const heading = <div className="efficiency-heading"><strong>牌理・受け入れ</strong><button type="button" onClick={onClose} aria-label="牌理・受け入れを隠す" title="隠す">×</button></div>
  const resizeHandle = <button type="button" className="efficiency-resize-handle" onPointerDown={startResize} aria-label="パネル幅を変更" />
  if (!tileIds.length) return <aside ref={panelRef} className="efficiency-panel empty">{resizeHandle}{heading}<span>表向きの牌を選択すると解析します</span></aside>
  if (!result) return <aside ref={panelRef} className="efficiency-panel invalid">{resizeHandle}{heading}<span>同一牌は4枚まで、解析できるのは14枚までです</span></aside>
  return (
    <aside ref={panelRef} className="efficiency-panel" aria-live="polite">
      {resizeHandle}{heading}
      {hasTenpaiShapeBreakdown && <label className="good-shape-toggle tenpai-breakdown-toggle"><input type="checkbox" checked={showTenpaiShapeBreakdown} onChange={(event) => setShowTenpaiShapeBreakdown(event.target.checked)} />好形・愚形聴牌内訳を表示</label>}
      {!isDiscardAnalysis && (() => {
        const type = iishantenType(baseTileIds, result.shanten)
        const acceptanceLabel = result.shanten === 0 ? '和了牌' : '受け入れ'
        return <><span className="efficiency-count">{tileIds.length}枚を解析中</span><div className="efficiency-summary">{tileIds.length >= 13 && <b>{formatShanten(result.shanten)}</b>}{type && <small className="iishanten-type">1シャンテン形：{type}</small>}<span>{acceptanceLabel} <em>{result.effectiveTileIds.length}種 {result.effectiveTileCount}牌</em></span></div>{result.effectiveTileIds.length > 0 && <div className="efficiency-waits" aria-label={acceptanceLabel}>{result.effectiveTileIds.map((tileId) => <Tile key={tileId} tileId={tileId} />)}</div>}{showTenpaiShapeBreakdown && tenpaiShapeSummary(baseTileIds, result.shanten)}</>
      })()}
      {discards.length > 0 && <div className="efficiency-discards"><div className="efficiency-discard-heading"><strong>選択打牌ごとの受け入れ</strong></div>{sortedDiscards.map(({ discardTileId, result: discardResult }) => {
        const hand = baseTileIds.filter((tileId, index) => tileId !== discardTileId || index !== baseTileIds.indexOf(discardTileId))
        const type = iishantenType(hand, discardResult.shanten)
        const acceptanceLabel = discardResult.shanten === 0 ? '和了牌' : '受け入れ'
        return <div className="efficiency-discard" key={discardTileId}><div className="efficiency-discard-summary"><Tile tileId={discardTileId} /><span className="efficiency-discard-status"><span>切り</span><b>{formatShanten(discardResult.shanten)}</b>{type && <strong className="iishanten-type discard">{type}</strong>}</span><em>{acceptanceLabel} {discardResult.effectiveTileIds.length}種 {discardResult.effectiveTileCount}牌</em></div>{showTenpaiShapeBreakdown && discardResult.shanten === 1 ? tenpaiShapeSummary(hand, discardResult.shanten) : discardResult.effectiveTileIds.length > 0 && <div className="efficiency-discard-waits" aria-label={`${TILE_MAP.get(discardTileId)?.label ?? ''}切りの${acceptanceLabel}`}>{discardResult.effectiveTileIds.map((tileId) => <Tile key={tileId} tileId={tileId} />)}</div>}</div>
      })}</div>}
      {baseTileIds.length >= 2 && <section className="expected-value-section">
        <div className="meld-input">
          <strong>副露ブロック</strong>
          {melds.length > 0 ? <div className="meld-list">{melds.map((meld) => <div key={meld.id}><span>{MELD_KIND_LABELS[meld.kind]}</span><MeldTiles kind={meld.kind} tileIds={meld.tileIds} /></div>)}</div> : <small>横向きにした牌を含む副露形は、選択すると自動で認識します。</small>}
          <small>副露{melds.length}組：横向きの牌を1枚含む、連続または同一牌の3〜4枚を副露として扱います。副露牌は打牌候補に入りません。</small>
        </div>
        <button type="button" className="expected-value-toggle" disabled={tileIds.length !== concealedTileCount} onClick={() => setShowExpectedValue((value) => !value)}>{showExpectedValue ? '期待値を閉じる' : '一人麻雀の期待値を計算'}</button>
        {showExpectedValue && <>
          <div className="expected-value-settings">
            <label>場風<select value={expectedSettings.roundWind} onChange={(event) => setExpectedSettings({ ...expectedSettings, roundWind: event.target.value as Wind })}>{([['ton', '東'], ['nan', '南'], ['sha', '西'], ['pei', '北']] as const).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <label>自風<select value={expectedSettings.seatWind} onChange={(event) => setExpectedSettings({ ...expectedSettings, seatWind: event.target.value as Wind })}>{([['ton', '東'], ['nan', '南'], ['sha', '西'], ['pei', '北']] as const).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <label>巡目<input type="number" min="1" max="18" value={expectedSettings.turn} onChange={(event) => setExpectedSettings({ ...expectedSettings, turn: Math.max(1, Math.min(18, Number(event.target.value) || 1)) })} /></label>
            <label>ドラ表示牌<select value={expectedSettings.doraIndicator ?? ''} onChange={(event) => setExpectedSettings({ ...expectedSettings, doraIndicator: event.target.value || null })}><option value="">なし</option>{EXPECTED_VALUE_TILE_IDS.map((id) => <option key={id} value={id}>{TILE_MAP.get(id)?.label}</option>)}</select></label>
          </div>
          <div className="expected-value-options">
            <label><input type="checkbox" checked={expectedSettings.includeRedDora} onChange={(event) => setExpectedSettings({ ...expectedSettings, includeRedDora: event.target.checked })} />赤ドラ</label>
            <label><input type="checkbox" checked={expectedSettings.includeUraDora} onChange={(event) => setExpectedSettings({ ...expectedSettings, includeUraDora: event.target.checked })} />裏ドラ</label>
            <label><input type="checkbox" checked={expectedSettings.allowShantenBack} onChange={(event) => setExpectedSettings({ ...expectedSettings, allowShantenBack: event.target.checked })} />向聴戻し</label>
            <label><input type="checkbox" checked={expectedSettings.allowHandChange} onChange={(event) => setExpectedSettings({ ...expectedSettings, allowHandChange: event.target.checked })} />手変わり</label>
          </div>
          <button type="button" className="visible-tile-toggle" onClick={() => setShowVisibleTiles((value) => !value)}>見えている牌を設定</button>
          {showVisibleTiles && <div className="visible-tile-grid">{EXPECTED_VALUE_TILE_IDS.map((id) => <label key={id}><img src={TILE_MAP.get(id)?.asset} alt={TILE_MAP.get(id)?.label ?? id} /><input aria-label={`${TILE_MAP.get(id)?.label ?? id}の見えている枚数`} type="number" min="0" max="4" value={expectedSettings.visibleCounts[id] ?? 0} onChange={(event) => setExpectedSettings({ ...expectedSettings, visibleCounts: { ...expectedSettings.visibleCounts, [id]: Math.max(0, Math.min(4, Number(event.target.value) || 0)) } })} /></label>)}</div>}
          <button type="button" className="expected-value-calculate" disabled={isCalculatingExpectedValue} onClick={runExpectedValueCalculation}>{isCalculatingExpectedValue ? '計算中…' : 'この設定で計算する'}</button>
          {expectedError && <p className="expected-value-error" role="alert">{expectedError}</p>}
          <div className="expected-value-results">{expectedValues.map((value) => <article key={value.discardTileId}><div><Tile tileId={value.discardTileId} /><b>切り</b><strong>{value.expectedPoints.toLocaleString()}点</strong></div><span>和了 {Math.round(value.winProbability * 1000) / 10}%　聴牌 {Math.round(value.tenpaiProbability * 1000) / 10}%</span><small>平均和了点 {value.estimatedWinPoints.toLocaleString()}点／受け入れ {value.effectiveTileCount}牌</small></article>)}</div>
          <p className="expected-value-note">手牌変化グラフを18巡目から逆算する動的計画法です。役・符・親子・ドラを計算し、他家・放銃・鳴き・一発・海底は考慮しません。</p>
        </>}
      </section>}
      <small>通常形・七対子・国士無双を含む。残り枚数は選択中の手牌だけを既知牌として計算します。</small>
    </aside>
  )
}
