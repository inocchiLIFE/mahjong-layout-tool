import { useState, type FormEvent } from 'react'
import type { StrokePattern, SymbolType } from '../types'
import { getSymbolBaseDimensions } from '../utils/layout'
import { DEFAULT_STROKE_PATTERN, STROKE_PATTERN_OPTIONS } from '../utils/stroke'

export interface SymbolPreset { color: string | null; strokeWidth: number; strokePattern?: StrokePattern; width: number; height: number }

export const SymbolPresetDialog = ({ symbolType, preset, fallbackColor, onSave, onClose }: { symbolType: SymbolType; preset: SymbolPreset; fallbackColor: string; onSave: (preset: SymbolPreset) => void; onClose: () => void }) => {
  const [draft, setDraft] = useState<SymbolPreset>({ ...preset, color: preset.color ?? fallbackColor })
  const submit = (event: FormEvent) => { event.preventDefault(); onSave(draft) }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <form className="property-editor" role="dialog" aria-modal="true" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" type="button" onClick={onClose} aria-label="閉じる">×</button>
      <span className="eyebrow">SYMBOL DEFAULT</span><h2>{symbolType} の配置前設定</h2>
      <p>ここで保存したスタイルは、これから配置するこの図形に使われます。</p>
      <label>色 <span className="color-field"><input type="color" value={draft.color ?? fallbackColor} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /><code>{draft.color ?? fallbackColor}</code></span></label>
      <label>線の太さ <input type="number" min="1" max="12" value={draft.strokeWidth} onChange={(event) => setDraft({ ...draft, strokeWidth: Math.min(12, Math.max(1, Number(event.target.value) || 1)) })} /></label>
      <label>線のパターン <select value={draft.strokePattern ?? DEFAULT_STROKE_PATTERN} onChange={(event) => setDraft({ ...draft, strokePattern: event.target.value as StrokePattern })}>{STROKE_PATTERN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>横幅 <input type="number" min="24" max="100000" value={draft.width} onChange={(event) => setDraft({ ...draft, width: Math.max(24, Number(event.target.value) || 24) })} /></label>
      <label>縦幅 <input type="number" min="16" max="100000" value={draft.height} onChange={(event) => setDraft({ ...draft, height: Math.max(16, Number(event.target.value) || 16) })} /></label>
      <div className="property-actions"><button type="button" onClick={() => { const size = getSymbolBaseDimensions(symbolType); setDraft({ color: null, strokeWidth: 4, strokePattern: DEFAULT_STROKE_PATTERN, width: size.width, height: size.height }) }}>初期値に戻す</button><button type="button" onClick={onClose}>キャンセル</button><button className="primary-button" type="submit">この図形の既定値に保存</button></div>
    </form>
  </div>
}
