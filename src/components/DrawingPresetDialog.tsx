import { useState, type FormEvent } from 'react'
import type { StrokePattern } from '../types'
import { DEFAULT_STROKE_PATTERN, STROKE_PATTERN_OPTIONS } from '../utils/stroke'

export type DrawingTool = 'draw' | 'line' | 'curve' | 'arrow' | 'eraser'
export interface DrawingPreset { color: string | null; strokeWidth: number; strokePattern?: StrokePattern; eraserSize: number; arrowHeadSize?: number }

const LABELS: Record<DrawingTool, string> = { draw: 'ペン', line: '直線', curve: '曲線', arrow: '矢印', eraser: '消しゴム' }

export const DrawingPresetDialog = ({ tool, preset, fallbackColor, onSave, onClose }: { tool: DrawingTool; preset: DrawingPreset; fallbackColor: string; onSave: (value: DrawingPreset) => void; onClose: () => void }) => {
  const [draft, setDraft] = useState<DrawingPreset>({ ...preset, color: preset.color ?? fallbackColor })
  const submit = (event: FormEvent) => { event.preventDefault(); onSave(draft) }
  const isEraser = tool === 'eraser'
  const isArrow = tool === 'arrow'
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <form className="property-editor" role="dialog" aria-modal="true" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" type="button" onClick={onClose} aria-label="閉じる">×</button>
      <span className="eyebrow">TOOL DEFAULT</span><h2>{LABELS[tool]}の既定設定</h2>
      <p>ここでの設定は、これから配置・描画する{LABELS[tool]}に使われます。</p>
      {isEraser ? <label>サイズ<input type="number" min="8" max="80" value={draft.eraserSize} onChange={(event) => setDraft({ ...draft, eraserSize: Math.max(8, Math.min(80, Number(event.target.value) || 8)) })} /></label> : <>
        <label>色 <span className="color-field"><input type="color" value={draft.color ?? fallbackColor} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /><code>{draft.color ?? fallbackColor}</code></span></label>
        <label>線の太さ<input type="number" min="1" max="20" value={draft.strokeWidth} onChange={(event) => setDraft({ ...draft, strokeWidth: Math.max(1, Math.min(20, Number(event.target.value) || 1)) })} /></label>
        <label>線のパターン<select value={draft.strokePattern ?? DEFAULT_STROKE_PATTERN} onChange={(event) => setDraft({ ...draft, strokePattern: event.target.value as StrokePattern })}>{STROKE_PATTERN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        {isArrow && <label>先端の大きさ<input type="number" min="12" max="64" value={draft.arrowHeadSize ?? 30} onChange={(event) => setDraft({ ...draft, arrowHeadSize: Math.max(12, Math.min(64, Number(event.target.value) || 12)) })} /></label>}
      </>}
      <div className="property-actions"><button type="button" onClick={() => setDraft({ color: null, strokeWidth: 4, strokePattern: DEFAULT_STROKE_PATTERN, eraserSize: 24 })}>初期値に戻す</button><button type="button" onClick={onClose}>キャンセル</button><button className="primary-button" type="submit">既定設定に保存</button></div>
    </form>
  </div>
}
