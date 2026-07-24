import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { TILE_MAP } from '../data/tiles'
import { getEfficiency } from '../utils/mahjongEfficiency'
import { calculateExpectedValues, EXPECTED_VALUE_TILE_IDS, type ExpectedValueSettings, type Wind } from '../utils/expectedValue'
import { MELD_KIND_LABELS, concealedTileCountForMelds, createMeldChoices, isValidMeld, type MeldKind } from '../utils/mahjongMelds'

const Tile = ({ tileId, className = '' }: { tileId: string; className?: string }) => {
  const tile = TILE_MAP.get(tileId)
  return tile ? <img className={`efficiency-tile ${className}`} src={tile.asset} alt={tile.label} title={tile.label} /> : null
}

const MeldTiles = ({ kind, tileIds }: { kind: MeldKind; tileIds: string[] }) => {
  // Open calls are identified by one sideways tile. Closed kans stay upright.
  const sidewaysIndex = kind === 'closed-kan' ? -1 : kind === 'added-kan' ? tileIds.length - 1 : 0
  return <span className="meld-tiles">{tileIds.map((tileId, index) => <Tile key={`${tileId}-${index}`} tileId={tileId} className={index === sidewaysIndex ? 'meld-sideways-tile' : ''} />)}</span>
}

const formatShanten = (shanten: number) => shanten === -1 ? '和了' : shanten === 0 ? '聴牌' : `${shanten}シャンテン`

export const EfficiencyPanel = ({ tileIds, onClose, onResize }: { tileIds: string[]; onClose: () => void; onResize: (width: number) => void }) => {
  const panelRef = useRef<HTMLElement>(null)
  const [discardSort, setDiscardSort] = useState<'efficiency' | 'tile'>('efficiency')
  const [showExpectedValue, setShowExpectedValue] = useState(false)
  const [showVisibleTiles, setShowVisibleTiles] = useState(false)
  const [expectedValues, setExpectedValues] = useState<ReturnType<typeof calculateExpectedValues>>([])
  const [expectedError, setExpectedError] = useState('')
  const [isCalculatingExpectedValue, setIsCalculatingExpectedValue] = useState(false)
  const [meldKind, setMeldKind] = useState<MeldKind>('open-sequence')
  const [expectedSettings, setExpectedSettings] = useState<ExpectedValueSettings>(() => ({
    roundWind: 'ton', seatWind: 'ton', turn: 3, doraIndicator: null, visibleCounts: {},
    includeRedDora: true, includeUraDora: true, allowShantenBack: true, allowHandChange: true, melds: [],
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
  const melds = expectedSettings.melds ?? []
  const fixedMeldCount = melds.length
  const concealedTileCount = concealedTileCountForMelds(melds)
  const result = getEfficiency(baseTileIds, fixedMeldCount)
  const discards = baseTileIds.length === concealedTileCount
    ? [...new Set(baseTileIds)].map((discardTileId) => ({ discardTileId, result: getEfficiency(baseTileIds.filter((tileId, index) => tileId !== discardTileId || index !== baseTileIds.indexOf(discardTileId)), fixedMeldCount) }))
    : []
  useEffect(() => { setExpectedValues([]); setExpectedError('') }, [tileIds, expectedSettings])
  const runExpectedValueCalculation = () => {
    setIsCalculatingExpectedValue(true)
    setExpectedError('')
    window.setTimeout(() => {
      try {
        if (tileIds.length !== concealedTileCount) throw new Error(`副露${melds.length}組では、手牌は${concealedTileCount}枚を選択してください。`)
        setExpectedValues(calculateExpectedValues(tileIds, expectedSettings))
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
      {!isDiscardAnalysis && <><span className="efficiency-count">{tileIds.length}枚を解析中</span><div className="efficiency-summary"><b>{formatShanten(result.shanten)}</b><span>受け入れ <em>{result.effectiveTileIds.length}種 {result.effectiveTileCount}牌</em></span></div>{result.effectiveTileIds.length > 0 && <div className="efficiency-waits" aria-label="有効牌">{result.effectiveTileIds.map((tileId) => <Tile key={tileId} tileId={tileId} />)}</div>}</>}
      {discards.length > 0 && <div className="efficiency-discards"><div className="efficiency-discard-heading"><strong>選択打牌ごとの受け入れ</strong><label>並び順<select value={discardSort} onChange={(event) => setDiscardSort(event.target.value as 'efficiency' | 'tile')}><option value="efficiency">受け入れ枚数順</option><option value="tile">牌の並び順</option></select></label></div>{sortedDiscards.map(({ discardTileId, result: discardResult }) => <div className="efficiency-discard" key={discardTileId}><div className="efficiency-discard-summary"><Tile tileId={discardTileId} /><span>切り</span><b>{formatShanten(discardResult.shanten)}</b><em>{discardResult.effectiveTileIds.length}種 {discardResult.effectiveTileCount}牌</em></div>{discardResult.effectiveTileIds.length > 0 && <div className="efficiency-discard-waits" aria-label={`${TILE_MAP.get(discardTileId)?.label ?? ''}切りの有効牌`}>{discardResult.effectiveTileIds.map((tileId) => <Tile key={tileId} tileId={tileId} />)}</div>}</div>)}</div>}
      {baseTileIds.length >= 2 && <section className="expected-value-section">
        <div className="meld-input">
          <strong>副露ブロック</strong>
          <label>種類<select value={meldKind} onChange={(event) => setMeldKind(event.target.value as MeldKind)}>{(Object.keys(MELD_KIND_LABELS) as MeldKind[]).map((kind) => <option key={kind} value={kind}>{MELD_KIND_LABELS[kind]}</option>)}</select></label>
          <div className="meld-choice-grid">{createMeldChoices(meldKind).map((choice) => <button type="button" key={`${meldKind}-${choice.join(',')}`} onClick={() => {
            const next = [...melds, { id: `${Date.now()}-${choice.join('-')}`, kind: meldKind, tileIds: choice }]
            if (next.length > 4 || !next.every(isValidMeld)) return
            setExpectedSettings({ ...expectedSettings, melds: next })
          }}><MeldTiles kind={meldKind} tileIds={choice} /></button>)}</div>
          {melds.length > 0 && <div className="meld-list">{melds.map((meld, index) => <div key={meld.id}><span>{MELD_KIND_LABELS[meld.kind]}</span><MeldTiles kind={meld.kind} tileIds={meld.tileIds} /><button type="button" onClick={() => setExpectedSettings({ ...expectedSettings, melds: melds.filter((_, meldIndex) => meldIndex !== index) })}>×</button></div>)}</div>}
          <small>副露{melds.length}組：手牌は{concealedTileCount}枚を選択します。副露牌は手牌へ重ねて選択しません。</small>
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
