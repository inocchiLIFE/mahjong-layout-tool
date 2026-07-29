import { useEffect, useState, type FormEvent } from 'react'
import type { CustomShapeElement, DrawingElement, ImageElement, SymbolElement, TextElement } from '../types'
import { saveCustomColors } from '../utils/colors'

const CUSTOM_COLORS_KEY = 'mahjong-layout-tool:custom-colors-v1'

const readCustomColors = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_COLORS_KEY) ?? '[]') as unknown
    return Array.isArray(saved)
      ? saved.filter((value): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)).slice(0, 24)
      : []
  } catch {
    return []
  }
}

type EditableElement = TextElement | SymbolElement | DrawingElement | ImageElement | CustomShapeElement

interface PropertyEditorProps {
  element: EditableElement
  onSave: (properties: {
    text?: string
    color?: string
    fontSize?: number
    fontFamily?: string
    strokeWidth?: number
    opacity?: number
    customShapeColor?: string | null
  }) => void
  onClose: () => void
}

export const PropertyEditor = ({ element, onSave, onClose }: PropertyEditorProps) => {
  const [text, setText] = useState(element.kind === 'text' ? element.text : '')
  const [color, setColor] = useState(element.kind === 'image' ? '#244a40' : element.kind === 'customShape' ? element.color ?? '#244a40' : element.color)
  const [fontSize, setFontSize] = useState(element.kind === 'text' ? element.fontSize : 22)
  const [fontFamily, setFontFamily] = useState(element.kind === 'text' ? element.fontFamily : 'sans-serif')
  const [strokeWidth, setStrokeWidth] = useState(element.kind === 'symbol' || element.kind === 'drawing' ? element.strokeWidth : 4)
  const [opacity, setOpacity] = useState(element.kind === 'image' ? element.opacity : 1)
  const [customColors, setCustomColors] = useState(readCustomColors)

  useEffect(() => {
    const refreshCustomColors = () => setCustomColors(readCustomColors())
    window.addEventListener('mahjong-custom-colors-changed', refreshCustomColors)
    return () => window.removeEventListener('mahjong-custom-colors-changed', refreshCustomColors)
  }, [])

  const updateCustomColors = (next: string[]) => {
    setCustomColors(next)
    try {
      saveCustomColors(next)
    } catch {
      // 色パレットは現在の編集操作を妨げないよう、保存失敗時も画面上では利用可能にする。
    }
  }

  const addCustomColor = () => {
    const normalized = color.toLowerCase()
    if (customColors.includes(normalized)) return
    updateCustomColors([...customColors, normalized].slice(-24))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (element.kind === 'text' && !text.trim()) return
    onSave({
      text: element.kind === 'text' ? text.trim() : undefined,
      color: element.kind === 'image' || element.kind === 'customShape' ? undefined : color,
      customShapeColor: element.kind === 'customShape' ? color : undefined,
      fontSize: element.kind === 'text' ? fontSize : undefined,
      fontFamily: element.kind === 'text' ? fontFamily : undefined,
      strokeWidth: element.kind === 'symbol' || element.kind === 'drawing' ? strokeWidth : undefined,
      opacity: element.kind === 'image' ? opacity : undefined,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="property-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-title"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="プロパティ編集を閉じる">×</button>
        <span className="eyebrow">PROPERTIES</span>
        <h2 id="property-title">プロパティ編集</h2>

        {element.kind === 'text' && (
          <>
            <label>
              文字内容
              <textarea value={text} onChange={(event) => setText(event.target.value)} autoFocus />
            </label>
            <label>
              文字サイズ
              <input type="number" min="12" max="72" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} />
            </label>
            <label>
              フォント
              <select value={fontFamily} onChange={(event) => setFontFamily(event.target.value)}>
                <option value="serif">明朝体</option>
                <option value="sans-serif">ゴシック体</option>
                <option value="cursive">筆記体・手書き風</option>
                <option value="monospace">等幅フォント</option>
              </select>
            </label>
          </>
        )}

        {element.kind === 'symbol' && (
          <label>
            線の太さ
            <input type="number" min="1" max="12" value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))} />
          </label>
        )}

        {element.kind === 'drawing' && (
          <label>
            線の太さ
            <input type="number" min="1" max="20" value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))} />
          </label>
        )}

        {element.kind === 'image' && (
          <label>
            透明度（10〜100%）
            <input type="number" min="10" max="100" value={Math.round(opacity * 100)} onChange={(event) => setOpacity(Number(event.target.value) / 100)} />
          </label>
        )}

        {element.kind === 'customShape' && <p>「{element.name}」は固定グループとして配置されています。色は図形・線・文字へまとめて適用されます。</p>}

        {element.kind !== 'image' && (
          <label>
            {element.kind === 'text' ? '文字色' : element.kind === 'customShape' ? '全体の色' : '色'}
            <span className="color-field">
              <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
              <code>{color}</code>
            </span>
            <div className="custom-color-palette">
              <div><strong>自作カラーパレット</strong><button type="button" onClick={addCustomColor}>この色を追加</button></div>
              {customColors.length ? (
                <ul>
                  {customColors.map((customColor) => (
                    <li key={customColor}>
                      <button type="button" className="custom-color-swatch" style={{ backgroundColor: customColor }} onClick={() => setColor(customColor)} aria-label={`${customColor}を使う`} title={customColor} />
                      <button type="button" className="custom-color-remove" onClick={() => updateCustomColors(customColors.filter((value) => value !== customColor))} aria-label={`${customColor}をパレットから削除`}>×</button>
                    </li>
                  ))}
                </ul>
              ) : <span className="custom-color-empty">よく使う色を追加して再利用できます。</span>}
            </div>
          </label>
        )}

        <div className="property-actions">
          <button type="button" onClick={onClose}>キャンセル</button>
          <button className="primary-button" type="submit">変更を保存</button>
        </div>
      </form>
    </div>
  )
}
