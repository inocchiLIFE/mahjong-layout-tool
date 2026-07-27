import { useEffect, useState, type FormEvent } from 'react'
import { CONTEXT_MENU_ITEMS, DEFAULT_CONTEXT_MENU_ITEMS, type ContextMenuItemId } from './contextMenuItems'
import { DEFAULT_WORKSPACE_HEIGHT, DEFAULT_WORKSPACE_WIDTH, MAX_WORKSPACE_HEIGHT, MAX_WORKSPACE_WIDTH, MIN_WORKSPACE_HEIGHT, MIN_WORKSPACE_WIDTH, clamp } from '../utils/layout'

export interface AppPreferences {
  showGrid: boolean
  allowTileOverlap: boolean
  defaultFontFamily: string
  defaultTextFontSize: number
  defaultTextColor: string
  defaultShapeColor: string
  defaultShapeStrokeWidth: number
  uiScale: number
  popupFontScale: number
  contextMenuItems: ContextMenuItemId[]
  defaultWorkspaceWidth: number
  defaultWorkspaceHeight: number
  headerColor: string
  appIconSrc: string | null
}

interface SettingsDialogProps {
  preferences: AppPreferences
  onSave: (preferences: AppPreferences) => void
  onClose: () => void
}

const DEFAULT_PREFERENCES: AppPreferences = {
  showGrid: true,
  allowTileOverlap: true,
  defaultFontFamily: 'sans-serif',
  defaultTextFontSize: 35,
  defaultTextColor: '#172c27',
  defaultShapeColor: '#244a40',
  defaultShapeStrokeWidth: 4,
  uiScale: 1.1,
  popupFontScale: 1.2,
  contextMenuItems: DEFAULT_CONTEXT_MENU_ITEMS,
  defaultWorkspaceWidth: DEFAULT_WORKSPACE_WIDTH,
  defaultWorkspaceHeight: DEFAULT_WORKSPACE_HEIGHT,
  headerColor: '#0d3a31',
  appIconSrc: null,
}

export const SettingsDialog = ({ preferences, onSave, onClose }: SettingsDialogProps) => {
  const [draft, setDraft] = useState(preferences)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const submit = (event: FormEvent) => { event.preventDefault(); onSave(draft) }
  const chooseAppIcon = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setDraft((current) => ({ ...current, appIconSrc: typeof reader.result === 'string' ? reader.result : null }))
    reader.readAsDataURL(file)
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="設定を閉じる">×</button>
        <div className="settings-dialog-scroll">
          <span className="eyebrow">SETTINGS</span>
          <h2 id="settings-title">アプリの設定</h2>
          <p>ここで選んだ初期値は、この端末のブラウザに保存されます。</p>

          <fieldset>
            <legend>表示と配置</legend>
            <label>画面・文字サイズ <input type="range" min="0.9" max="1.3" step="0.05" value={draft.uiScale} onChange={(event) => setDraft((current) => ({ ...current, uiScale: Number(event.target.value) }))} /><output>{Math.round(draft.uiScale * 100)}%</output></label>
            <label><input type="checkbox" checked={draft.showGrid} onChange={(event) => setDraft((current) => ({ ...current, showGrid: event.target.checked }))} /> グリッドを表示する</label>
            <label><input type="checkbox" checked={draft.allowTileOverlap} onChange={(event) => setDraft((current) => ({ ...current, allowTileOverlap: event.target.checked }))} /> 牌の重なりを許可する</label>
            <label>ポップアップ・文字サイズ <input type="range" min="1" max="1.5" step="0.05" value={draft.popupFontScale} onChange={(event) => setDraft((current) => ({ ...current, popupFontScale: Number(event.target.value) }))} /><output>{Math.round(draft.popupFontScale * 100)}%</output></label>
            <label>新規作業領域の幅（px）<input type="number" min={MIN_WORKSPACE_WIDTH} max={MAX_WORKSPACE_WIDTH} value={draft.defaultWorkspaceWidth} onChange={(event) => setDraft((current) => ({ ...current, defaultWorkspaceWidth: clamp(Number(event.target.value) || MIN_WORKSPACE_WIDTH, MIN_WORKSPACE_WIDTH, MAX_WORKSPACE_WIDTH) }))} /></label>
            <label>新規作業領域の高さ（px）<input type="number" min={MIN_WORKSPACE_HEIGHT} max={MAX_WORKSPACE_HEIGHT} value={draft.defaultWorkspaceHeight} onChange={(event) => setDraft((current) => ({ ...current, defaultWorkspaceHeight: clamp(Number(event.target.value) || MIN_WORKSPACE_HEIGHT, MIN_WORKSPACE_HEIGHT, MAX_WORKSPACE_HEIGHT) }))} /></label>
            <label>上部バーの色 <input type="color" value={draft.headerColor} onChange={(event) => setDraft((current) => ({ ...current, headerColor: event.target.value }))} /></label>
            <label>アプリアイコン
              <span className="settings-icon-control">
                {draft.appIconSrc ? <img src={draft.appIconSrc} alt="設定したアイコン" /> : <b>牌</b>}
                <input type="file" accept="image/*" onChange={(event) => chooseAppIcon(event.target.files?.[0])} />
                {draft.appIconSrc && <button type="button" onClick={() => setDraft((current) => ({ ...current, appIconSrc: null }))}>削除</button>}
              </span>
            </label>
          </fieldset>

          <fieldset>
            <legend>文字の初期設定</legend>
            <label>フォント
              <select value={draft.defaultFontFamily} onChange={(event) => setDraft((current) => ({ ...current, defaultFontFamily: event.target.value }))}>
                <option value="sans-serif">ゴシック体</option>
                <option value="serif">明朝体</option>
                <option value="'Yu Gothic UI', sans-serif">游ゴシック</option>
                <option value="'Yu Mincho', serif">游明朝</option>
                <option value="cursive">筆記体風</option>
                <option value="monospace">等幅</option>
              </select>
            </label>
            <label>文字サイズ <input type="number" min="12" max="72" value={draft.defaultTextFontSize} onChange={(event) => setDraft((current) => ({ ...current, defaultTextFontSize: Math.min(72, Math.max(12, Number(event.target.value) || 12)) }))} /></label>
            <label>文字色 <input type="color" value={draft.defaultTextColor} onChange={(event) => setDraft((current) => ({ ...current, defaultTextColor: event.target.value }))} /></label>
          </fieldset>

          <fieldset>
            <legend>図形・描画の初期設定</legend>
            <label>色 <input type="color" value={draft.defaultShapeColor} onChange={(event) => setDraft((current) => ({ ...current, defaultShapeColor: event.target.value }))} /></label>
            <label>線の太さ <input type="range" min="1" max="12" value={draft.defaultShapeStrokeWidth} onChange={(event) => setDraft((current) => ({ ...current, defaultShapeStrokeWidth: Number(event.target.value) }))} /><output>{draft.defaultShapeStrokeWidth}</output></label>
          </fieldset>

          <fieldset>
            <legend>右クリックメニュー</legend>
            <p className="context-menu-settings-note">表示する項目を選べます。後から右クリックしても、この設定を変更できます。</p>
            <div className="context-menu-settings">
              {CONTEXT_MENU_ITEMS.map(([id, label]) => <label key={id}><input type="checkbox" checked={draft.contextMenuItems.includes(id)} onChange={(event) => setDraft((current) => ({ ...current, contextMenuItems: event.target.checked ? [...current.contextMenuItems, id] : current.contextMenuItems.filter((item) => item !== id) }))} /> {label}</label>)}
            </div>
          </fieldset>
        </div>

        <div className="settings-actions">
          <button type="button" onClick={() => setDraft(DEFAULT_PREFERENCES)}>初期設定に戻す</button>
          <button className="primary-button" type="submit">設定を保存</button>
        </div>
      </form>
    </div>
  )
}
