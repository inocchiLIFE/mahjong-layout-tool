import { useState, type FormEvent } from 'react'

export const CustomShapeDialog = ({ itemCount, onSave, onClose }: { itemCount: number; onSave: (name: string) => void; onClose: () => void }) => {
  const [name, setName] = useState('マイ図形')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = name.trim()
    if (value) onSave(value.slice(0, 30))
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <form className="property-editor custom-shape-dialog" role="dialog" aria-modal="true" aria-labelledby="custom-shape-dialog-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" type="button" onClick={onClose} aria-label="閉じる">×</button>
      <span className="eyebrow">MY SHAPE</span>
      <h2 id="custom-shape-dialog-title">マイ図形に保存</h2>
      <p>選択中の{itemCount}個の要素を、挿入タブからいつでも呼び出せる図形として保存します。</p>
      <label>名前 <input autoFocus value={name} maxLength={30} onChange={(event) => setName(event.target.value)} /></label>
      <div className="property-actions"><button type="button" onClick={onClose}>キャンセル</button><button className="primary-button" type="submit" disabled={!name.trim()}>保存</button></div>
    </form>
  </div>
}
