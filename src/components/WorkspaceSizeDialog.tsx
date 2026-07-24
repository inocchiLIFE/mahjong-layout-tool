import { useState, type FormEvent } from 'react'
import { MAX_WORKSPACE_HEIGHT, MAX_WORKSPACE_WIDTH, MIN_WORKSPACE_HEIGHT, MIN_WORKSPACE_WIDTH, clamp } from '../utils/layout'

interface WorkspaceSizeDialogProps {
  width: number
  height: number
  onSave: (width: number, height: number) => void
  onClose: () => void
}

export const WorkspaceSizeDialog = ({ width, height, onSave, onClose }: WorkspaceSizeDialogProps) => {
  const [draftWidth, setDraftWidth] = useState(width)
  const [draftHeight, setDraftHeight] = useState(height)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSave(clamp(Math.round(draftWidth), MIN_WORKSPACE_WIDTH, MAX_WORKSPACE_WIDTH), clamp(Math.round(draftHeight), MIN_WORKSPACE_HEIGHT, MAX_WORKSPACE_HEIGHT))
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <form className="property-editor workspace-size-dialog" role="dialog" aria-modal="true" aria-labelledby="workspace-size-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" type="button" onClick={onClose} aria-label="作業領域の設定を閉じる">×</button>
      <span className="eyebrow">WORKSPACE</span>
      <h2 id="workspace-size-title">作業領域を設定</h2>
      <p>左上の原点は <code>(0, 0)</code> です。入力した幅・高さの範囲を枠線で表示します。</p>
      <label>幅（px）<input type="number" min={MIN_WORKSPACE_WIDTH} max={MAX_WORKSPACE_WIDTH} value={draftWidth} onChange={(event) => setDraftWidth(Number(event.target.value))} autoFocus /></label>
      <label>高さ（px）<input type="number" min={MIN_WORKSPACE_HEIGHT} max={MAX_WORKSPACE_HEIGHT} value={draftHeight} onChange={(event) => setDraftHeight(Number(event.target.value))} /></label>
      <div className="property-actions"><button type="button" onClick={onClose}>キャンセル</button><button className="primary-button" type="submit">作業領域を変更</button></div>
    </form>
  </div>
}
