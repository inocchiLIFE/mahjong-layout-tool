import { useEffect, useState } from 'react'
import type { PlacementMode, SymbolType } from '../types'
import type { DrawingTool } from './DrawingPresetDialog'
import type { IishantenType } from '../utils/iishanten'
import { TEXT_COLOR_PALETTE, readCustomColors, saveCustomColors } from '../utils/colors'

interface ToolbarProps {
  canUndo: boolean
  canRedo: boolean
  hasItems: boolean
  hasSelection: boolean
  canEditText: boolean
  textStyle: { fontFamily: string; fontSize: number; color: string }
  isEditingSelectedText: boolean
  selectedShapeColor: string | null
  shapeColor: string
  shapeStrokeWidth: number
  eraserSize: number
  canDuplicate: boolean
  canToggleTileFaces: boolean
  canEditProperties: boolean
  canChangeLayer: boolean
  placementMode: PlacementMode
  onClear: () => void
  onUndo: () => void
  onRedo: () => void
  onAlign: () => void
  onDeleteSelected: () => void
  onDuplicate: () => void
  onRotate: () => void
  onToggleTileFaces: () => void
  onEditSelectedText: () => void
  onUpdateTextStyle: (style: { fontFamily?: string; fontSize?: number; color?: string }) => void
  onUpdateSelectedShapeColor: (color: string) => void
  onUpdateShapeStrokeWidth: (strokeWidth: number) => void
  onUpdateEraserSize: (size: number) => void
  onEditProperties: () => void
  onBringFront: () => void
  onSendBack: () => void
  onRandomHand: (count: 6 | 7 | 13 | 14 | '6-triplet' | 'continuous' | IishantenType) => void
  handSuits: Array<'man' | 'pin' | 'sou'>
  onToggleHandSuit: (suit: 'man' | 'pin' | 'sou') => void
  onShuffle: () => void
  onSetPlacementMode: (mode: PlacementMode) => void
  onSaveLocal: () => void
  onOpenSavedLayouts: () => void
  onImportSharedLayout: () => void
  onAddImage: () => void
  onAddText: (text: string) => void
  onHelp: () => void
  onOpenReferences: () => void
  onOpenSettings: () => void
  onOpenSymbolPreset: (symbolType: SymbolType) => void
  onOpenDrawingPreset: (tool: DrawingTool) => void
  pages: Array<{ id: string; name: string }>
  activePageIndex: number
  onSwitchPage: (index: number) => void
  onAddPage: () => void
  onDeletePage: (index: number) => void
  onReorderPages: (from: number, to: number) => void
  onRenamePage: (index: number) => void
  symbolColors: Record<SymbolType, string>
  drawingColors: Record<Exclude<DrawingTool, 'eraser'>, string>
}

type RibbonTab = 'home' | 'insert' | 'hand' | 'view' | 'file'

const ToolButton = ({
  label,
  icon,
  onClick,
  disabled,
  active,
  danger,
  onContextMenu,
  iconColor,
  className,
}: {
  label: string
  icon: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  danger?: boolean
  onContextMenu?: () => void
  iconColor?: string
  className?: string
}) => (
  <button
    type="button"
    className={`tool-button${active ? ' active' : ''}${danger ? ' danger' : ''}${className ? ` ${className}` : ''}`}
    onClick={onClick}
    disabled={disabled}
    onContextMenu={(event) => { if (onContextMenu) { event.preventDefault(); onContextMenu() } }}
    aria-pressed={active}
  >
    <span aria-hidden="true" style={iconColor ? { color: iconColor } : undefined}>{icon}</span>
    {label}
  </button>
)

export const Toolbar = (props: ToolbarProps) => {
  const [text, setText] = useState('')
  const [activeTab, setActiveTab] = useState<RibbonTab>('home')
  const [customColors, setCustomColors] = useState(readCustomColors)
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false)
  const [pickerColor, setPickerColor] = useState('#172c27')
  const [ribbonCollapsed, setRibbonCollapsed] = useState(false)

  useEffect(() => {
    const refreshCustomColors = () => setCustomColors(readCustomColors())
    window.addEventListener('mahjong-custom-colors-changed', refreshCustomColors)
    return () => window.removeEventListener('mahjong-custom-colors-changed', refreshCustomColors)
  }, [])

  useEffect(() => {
    const toggleRibbon = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'F1') {
        event.preventDefault()
        setRibbonCollapsed((value) => !value)
      }
    }
    window.addEventListener('keydown', toggleRibbon)
    return () => window.removeEventListener('keydown', toggleRibbon)
  }, [])

  const addText = () => {
    const value = text.trim()
    if (!value) return
    props.onAddText(value)
    setText('')
  }

  const activeColor = props.selectedShapeColor ?? props.textStyle.color
  const isEditingShape = props.selectedShapeColor !== null
  const updateColor = (color: string) => {
    if (isEditingShape) props.onUpdateSelectedShapeColor(color)
    else props.onUpdateTextStyle({ color })
  }

  const addColorToPalette = (color: string) => {
    if (customColors.includes(color)) return
    const next = [...customColors, color].slice(-24)
    setCustomColors(next)
    saveCustomColors(next)
  }

  const openCustomColorPicker = () => {
    setPickerColor(activeColor.toLowerCase())
    setIsColorPickerOpen(true)
  }

  const applyCustomColor = () => {
    const color = pickerColor.trim().toLowerCase()
    if (!/^#[0-9a-f]{6}$/i.test(color)) return
    updateColor(color)
    addColorToPalette(color)
    setIsColorPickerOpen(false)
  }

  const removeCustomColor = (color: string) => {
    const next = customColors.filter((value) => value !== color)
    setCustomColors(next)
    saveCustomColors(next)
  }

  return (
    <section className={`toolbar${ribbonCollapsed ? ' collapsed' : ''}`} aria-label="編集ツール">
      <div className="ribbon-tabs" role="tablist" aria-label="リボンタブ">
        <div className="quick-access" aria-label="クイックアクセスツールバー">
          <button type="button" title="保存（Ctrl+S）" aria-label="保存（Ctrl+S）" onClick={props.onSaveLocal}>▣</button>
          <button type="button" title="元に戻す（Ctrl+Z）" aria-label="元に戻す" onClick={props.onUndo} disabled={!props.canUndo}>↶</button>
          <button type="button" title="やり直す（Ctrl+Y）" aria-label="やり直す" onClick={props.onRedo} disabled={!props.canRedo}>↷</button>
        </div>
        {([
          ['home', 'ホーム'],
          ['insert', '挿入'],
          ['hand', '配牌'],
          ['file', '保存・出力'],
          ['view', '設定'],
        ] as Array<[RibbonTab, string]>).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'active' : ''} onClick={() => { if (id === 'view') { props.onOpenSettings(); return } setActiveTab(id); if (ribbonCollapsed) setRibbonCollapsed(false) }} onDoubleClick={() => setRibbonCollapsed((value) => !value)} title="ダブルクリックでリボンを折りたたむ">{label}</button>
        ))}
        <div className="page-tabs" aria-label="ページ">
          {props.pages.map((page, index) => <div key={page.id} draggable onDragStart={(event) => event.dataTransfer.setData('application/x-mahjong-page', String(index))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const from = Number(event.dataTransfer.getData('application/x-mahjong-page')); if (Number.isInteger(from)) props.onReorderPages(from, index) }} className={`page-tab${index === props.activePageIndex ? ' active' : ''}`}><button type="button" onClick={() => props.onSwitchPage(index)} onDoubleClick={() => props.onRenamePage(index)} title={`${page.name}（ダブルクリックで名前変更）`}>{Array.from(page.name).slice(0, 5).join('')}</button>{index === props.activePageIndex && <button type="button" className="page-close-tab" onClick={(event) => { event.stopPropagation(); props.onDeletePage(index) }} title="ページを削除">×</button>}</div>)}
          <button type="button" className="page-add-tab" onClick={props.onAddPage} title="新規ページ">＋</button>
        </div>
        <button
          className="ribbon-collapse-button"
          type="button"
          onClick={() => setRibbonCollapsed((value) => !value)}
          title={ribbonCollapsed ? 'リボンを展開' : 'リボンを折りたたむ'}
          aria-label={ribbonCollapsed ? 'リボンを展開' : 'リボンを折りたたむ'}
        >{ribbonCollapsed ? '⌄' : '⌃'}</button>
        <button className="ribbon-help-button" type="button" onClick={props.onHelp} title="操作ガイド" aria-label="操作ガイド">?</button>
        <button className="ribbon-references-button" type="button" onClick={props.onOpenReferences} title="参考サイト・ライセンス">参考サイト</button>
      </div>

      <div className="ribbon-content" role="tabpanel">
        {activeTab === 'home' && <div className="tool-group">
          <ToolButton label="前面へ" icon="↑" onClick={props.onBringFront} disabled={!props.canChangeLayer} />
          <ToolButton label="背面へ" icon="↓" onClick={props.onSendBack} disabled={!props.canChangeLayer} />
          <span className="tool-group-label">編集</span>
          <ToolButton label="元に戻す" icon="↶" onClick={props.onUndo} disabled={!props.canUndo} />
          <ToolButton label="やり直す" icon="↷" onClick={props.onRedo} disabled={!props.canRedo} />
          <ToolButton label="牌を整列" icon="≡" onClick={props.onAlign} disabled={!props.hasItems} />
          <ToolButton label="複製" icon="⧉" onClick={props.onDuplicate} disabled={!props.canDuplicate} />
          <ToolButton label="表裏" icon="▣" onClick={props.onToggleTileFaces} disabled={!props.canToggleTileFaces} />
          <ToolButton label="回転" icon="↻" onClick={props.onRotate} disabled={!props.hasSelection} />
          <ToolButton label="文字編集" icon="Aa" onClick={props.onEditSelectedText} disabled={!props.canEditText} />
          <ToolButton label="スタイル" icon="🎨" onClick={props.onEditProperties} disabled={!props.canEditProperties} />
          <ToolButton label="選択を削除" icon="⌫" onClick={props.onDeleteSelected} disabled={!props.hasSelection} />
          <ToolButton label="すべて削除" icon="×" onClick={props.onClear} disabled={!props.hasItems} danger />
          <div className="font-ribbon" aria-label="フォント">
            <span className="font-ribbon-label">{props.isEditingSelectedText ? '選択中の文字' : isEditingShape ? '選択中の図形（色）' : '新規文字・図形の既定スタイル'}</span>
            <select
              aria-label="フォント"
              value={props.textStyle.fontFamily}
              onChange={(event) => props.onUpdateTextStyle({ fontFamily: event.target.value })}
              disabled={isEditingShape}
            >
              <option value="serif">明朝体</option>
              <option value="sans-serif">ゴシック体</option>
              <option value="'Yu Mincho', serif">游明朝</option>
              <option value="'Yu Gothic UI', sans-serif">游ゴシック</option>
              <option value="cursive">筆記体</option>
              <option value="monospace">等幅</option>
            </select>
            <div className="font-ribbon-controls">
              <button type="button" aria-label="文字サイズを小さく" disabled={isEditingShape} onClick={() => props.onUpdateTextStyle({ fontSize: Math.max(12, props.textStyle.fontSize - 2) })}>A−</button>
              <input
                type="number"
                min="12"
                max="72"
                aria-label="文字サイズ"
                value={props.textStyle.fontSize}
                onChange={(event) => props.onUpdateTextStyle({ fontSize: Number(event.target.value) })}
                disabled={isEditingShape}
              />
              <button type="button" aria-label="文字サイズを大きく" disabled={isEditingShape} onClick={() => props.onUpdateTextStyle({ fontSize: Math.min(72, props.textStyle.fontSize + 2) })}>A+</button>
              <div className="custom-color-picker-anchor">
                <button type="button" className="font-color-button" aria-label={isEditingShape ? '図形の色を選択してカスタム色へ追加' : '文字色を選択してカスタム色へ追加'} aria-expanded={isColorPickerOpen} onClick={openCustomColorPicker}>
                  <span>A</span><i style={{ backgroundColor: activeColor }} />
                </button>
                {isColorPickerOpen && <div className="custom-color-picker" role="dialog" aria-label="カスタム色の追加">
                  <div className="custom-color-picker-header">
                    <strong>カスタム色を追加</strong>
                    <button type="button" aria-label="カスタム色の選択を閉じる" onClick={() => setIsColorPickerOpen(false)}>×</button>
                  </div>
                  <div className="custom-color-picker-controls">
                    <label className="custom-color-preview" style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(pickerColor) ? pickerColor : '#ffffff' }}>
                      <span>色を選択</span>
                      <input type="color" aria-label="詳細な色を選択" value={/^#[0-9a-f]{6}$/i.test(pickerColor) ? pickerColor : '#172c27'} onChange={(event) => setPickerColor(event.target.value)} />
                    </label>
                    <label className="custom-color-code">HEX
                      <input aria-label="HEXカラーコード" value={pickerColor} onChange={(event) => setPickerColor(event.target.value)} maxLength={7} placeholder="#RRGGBB" />
                    </label>
                  </div>
                  <button type="button" className="custom-color-apply" onClick={applyCustomColor} disabled={!/^#[0-9a-f]{6}$/i.test(pickerColor.trim())}>色を適用して追加</button>
                  <div className="custom-color-manager">
                    <strong>登録済みの色</strong>
                    {customColors.length ? <div>{customColors.map((color) => <button key={color} type="button" className="custom-color-delete" style={{ backgroundColor: color }} aria-label={`${color}を削除`} title={`${color}を削除`} onClick={() => removeCustomColor(color)}>×</button>)}</div> : <span>まだ登録されていません</span>}
                  </div>
                </div>}
              </div>
            </div>
            <div className="text-color-palette" aria-label="文字色パレット">
              <small>文字</small>
              <div className="text-color-swatches">
                {TEXT_COLOR_PALETTE.map((color) => <button key={color} type="button" className={props.textStyle.color.toLowerCase() === color ? 'active' : ''} style={{ backgroundColor: color }} title={color} aria-label={`${color}の文字色`} onClick={() => props.onUpdateTextStyle({ color })} />)}
                {customColors.map((color) => <button key={color} type="button" className={`custom${props.textStyle.color.toLowerCase() === color ? ' active' : ''}`} style={{ backgroundColor: color }} title={color} aria-label={`${color}の文字色`} onClick={() => props.onUpdateTextStyle({ color })} />)}
              </div>
            </div>
          </div>
          <div className="shape-style-ribbon" aria-label="図形のスタイル">
            <span className="shape-style-label">図形・線</span>
            <label className="shape-stroke-control">太さ
              <input type="range" min="1" max="12" value={Math.min(12, props.shapeStrokeWidth)} onChange={(event) => props.onUpdateShapeStrokeWidth(Number(event.target.value))} aria-label="図形と線の太さ" />
              <output>{props.shapeStrokeWidth}</output>
            </label>
            <div className="shape-color-palette" aria-label="図形色パレット">
              <small>色</small>
              <div className="text-color-swatches">
                {TEXT_COLOR_PALETTE.map((color) => <button key={color} type="button" className={props.shapeColor.toLowerCase() === color ? 'active' : ''} style={{ backgroundColor: color }} title={color} aria-label={`${color}の図形色`} onClick={() => props.onUpdateSelectedShapeColor(color)} />)}
                {customColors.map((color) => <button key={color} type="button" className={`custom${props.shapeColor.toLowerCase() === color ? ' active' : ''}`} style={{ backgroundColor: color }} title={color} aria-label={`${color}の図形色`} onClick={() => props.onUpdateSelectedShapeColor(color)} />)}
              </div>
            </div>
          </div>
        </div>}

        {activeTab === 'insert' && <>
          <div className="tool-group placement-tools">
            <span className="tool-group-label">配置（Escで解除）</span>
            <ToolButton label="選択" icon="↖" onClick={() => props.onSetPlacementMode('select')} active={props.placementMode === 'select'} />
            {([
              ['text', 'クリック文字', 'T'], ['draw', 'ペン', '✎'], ['eraser', '消しゴム', '⌫'], ['line', '直線', '╱'], ['curve', '曲線', '⌒'], ['arrow', '矢印', '→'],
              ['rectangle', '長方形', '▭'], ['triangle', '三角形', '△'], ['cross', 'バツ', '✕'], ['circle', '丸', '〇'], ['wave', '波線（牌5枚分）', '〰'],
            ] as Array<[PlacementMode, string, string]>).map(([mode, label, icon]) => (
              <ToolButton
                key={mode}
                label={label}
                icon={icon}
                onClick={() => props.onSetPlacementMode(props.placementMode === mode ? 'select' : mode)}
                active={props.placementMode === mode}
                iconColor={['rectangle', 'triangle', 'cross', 'circle', 'wave'].includes(mode) ? props.symbolColors[mode as SymbolType] : ['draw', 'line', 'curve', 'arrow'].includes(mode) ? props.drawingColors[mode as Exclude<DrawingTool, 'eraser'>] : undefined}
                onContextMenu={['rectangle', 'triangle', 'cross', 'circle', 'wave'].includes(mode) ? () => props.onOpenSymbolPreset(mode as SymbolType) : ['draw', 'line', 'curve', 'arrow', 'eraser'].includes(mode) ? () => props.onOpenDrawingPreset(mode as DrawingTool) : undefined}
              />
            ))}
          </div>
          {props.placementMode === 'eraser' && <div className="tool-group eraser-size-tools">
            <span className="tool-group-label">消しゴムの大きさ</span>
            <label className="shape-stroke-control">大きさ
              <input type="range" min="8" max="80" value={props.eraserSize} onChange={(event) => props.onUpdateEraserSize(Number(event.target.value))} aria-label="消しゴムの大きさ" />
              <output>{props.eraserSize}</output>
            </label>
          </div>}
          <div className="tool-group text-tool">
            <span className="tool-group-label">クイック文字</span>
            <input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addText()} placeholder="説明を入力" aria-label="追加する文字" />
            <button className="text-add-button" type="button" onClick={addText} disabled={!text.trim()}>追加</button>
          </div>
          <div className="tool-group">
            <span className="tool-group-label">画像</span>
            <ToolButton label="画像追加" icon="▧" onClick={props.onAddImage} />
          </div>
        </>}

        {activeTab === 'hand' && <div className="tool-group">
          <span className="tool-group-label">配牌</span>
          <ToolButton label="連続形" icon="5" onClick={() => props.onRandomHand('continuous')} />
          <ToolButton label="6枚形" icon="6" onClick={() => props.onRandomHand(6)} />
          <ToolButton label="6枚形暗刻含み" icon="6" onClick={() => props.onRandomHand('6-triplet')} />
          <ToolButton label="7枚形" icon="7" onClick={() => props.onRandomHand(7)} />
          <ToolButton label="13枚" icon="13" onClick={() => props.onRandomHand(13)} />
          <ToolButton label="14枚" icon="14" onClick={() => props.onRandomHand(14)} />
          <ToolButton label="シャッフル" icon="⤨" onClick={props.onShuffle} disabled={!props.hasItems} />
        </div>}

        {activeTab === 'hand' && <div className="tool-group iishanten-generator-group">
          <span className="tool-group-label">1シャンテン形</span>
          <ToolButton label="余剰牌型" icon="" className="iishanten-button" onClick={() => props.onRandomHand('surplus')} />
          <ToolButton label="完全形" icon="" className="iishanten-button" onClick={() => props.onRandomHand('complete')} />
          <ToolButton label="ヘッドレス1" icon="" className="iishanten-button" onClick={() => props.onRandomHand('headless1')} />
          <ToolButton label="ヘッドレス2" icon="" className="iishanten-button" onClick={() => props.onRandomHand('headless2')} />
          <ToolButton label="くっつき" icon="" className="iishanten-button" onClick={() => props.onRandomHand('kuttsuki')} />
        </div>}

        {activeTab === 'hand' && <div className="tool-group hand-suit-filter-group">
          <span className="tool-group-label">使用する種類</span>
          <div className="hand-suit-filters" aria-label="配牌に使用する種類">
            {([['man', '萬子'], ['pin', '筒子'], ['sou', '索子']] as const).map(([suit, label]) => <label key={suit}><input type="checkbox" checked={props.handSuits.includes(suit)} onChange={() => props.onToggleHandSuit(suit)} />{label}</label>)}
          </div>
        </div>}


        {activeTab === 'file' && <>
          <div className="tool-group">
            <span className="tool-group-label">保存</span>
            <ToolButton label="保存" icon="↓" onClick={props.onSaveLocal} />
            <ToolButton label="保存ページ" icon="▤" onClick={props.onOpenSavedLayouts} />
            <ToolButton label="共有ファイル読込" icon="↥" onClick={props.onImportSharedLayout} />
          </div>
        </>}
      </div>
    </section>
  )
}
