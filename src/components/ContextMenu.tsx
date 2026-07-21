import { useEffect } from 'react'
import type { CanvasElement } from '../types'
import type { ContextMenuItemId } from './contextMenuItems'

interface ContextMenuProps {
  x: number; y: number; element: CanvasElement | null; hasSelection: boolean; canModifySelection: boolean; canPaste: boolean; canUndo: boolean; canRedo: boolean
  visibleItems: ContextMenuItemId[]; onClose: () => void; onDuplicate: () => void; onDelete: () => void; onCopy: () => void; onPaste: () => void; onRotate: () => void
  onAddRectangle: () => void; onAddTriangle: () => void; onAddCircle: () => void; onAddCross: () => void; onDrawMode: () => void; onLineMode: () => void; onCurveMode: () => void; onArrowMode: () => void; onAddImage: () => void; onSelectMode: () => void; onTextMode: () => void
  onToggleFace: () => void; onToggleLock: () => void; onEditProperties: () => void; onBringFront: () => void; onSendBack: () => void; onAlign: () => void; onToggleGrid: () => void; onToggleSnap: () => void; onClear: () => void; onUndo: () => void; onRedo: () => void
}
const MenuButton = ({ label, shortcut, onClick, disabled }: { label: string; shortcut?: string; onClick: () => void; disabled?: boolean }) => <button type="button" role="menuitem" disabled={disabled} onClick={onClick}><span>{label}</span>{shortcut && <kbd>{shortcut}</kbd>}</button>

export const ContextMenu = (props: ContextMenuProps) => {
  useEffect(() => { const close = () => props.onClose(); window.addEventListener('pointerdown', close); window.addEventListener('blur', close); return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('blur', close) } }, [props])
  const run = (action: () => void) => { action(); props.onClose() }
  const show = (id: ContextMenuItemId) => props.visibleItems.includes(id)
  const left = Math.max(8, Math.min(props.x, window.innerWidth - 248)); const top = Math.max(8, Math.min(props.y, window.innerHeight - 540)); const locked = props.element?.locked ?? false
  const additions: Array<[ContextMenuItemId, string, () => void]> = [['rectangle', '長方形', props.onAddRectangle], ['triangle', '三角形', props.onAddTriangle], ['circle', '丸', props.onAddCircle], ['cross', '✕', props.onAddCross], ['text', 'クリック文字', props.onTextMode], ['draw', '線を描く', props.onDrawMode], ['line', '直線', props.onLineMode], ['curve', '曲線', props.onCurveMode], ['arrow', '矢印', props.onArrowMode], ['image', '画像を追加', props.onAddImage]]
  const workspaceActions: Array<[ContextMenuItemId, string, () => void]> = [['align', '選択牌を整列', props.onAlign], ['grid', 'グリッド表示を切替', props.onToggleGrid], ['snap', 'グリッド吸着を切替', props.onToggleSnap], ['clear', '作業画面をクリア', props.onClear]]
  return <div className="context-menu export-hidden" role="menu" aria-label="配置物メニュー" style={{ left, top }} onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
    <div className="context-menu-heading">{props.hasSelection ? '選択中の配置物' : 'Workspace'}</div>
    {show('select') && <MenuButton label="選択" shortcut="Esc" onClick={() => run(props.onSelectMode)} />}
    {props.hasSelection && <>{show('duplicate') && <MenuButton label="複製" shortcut="Ctrl+D" onClick={() => run(props.onDuplicate)} />}{show('delete') && <MenuButton label="削除" shortcut="Delete" onClick={() => run(props.onDelete)} disabled={!props.canModifySelection} />}{show('copy') && <MenuButton label="コピー" shortcut="Ctrl+C" onClick={() => run(props.onCopy)} />}</>}
    {show('paste') && <MenuButton label="貼り付け" shortcut="Ctrl+V" onClick={() => run(props.onPaste)} disabled={!props.canPaste} />}
    {show('rotate') && props.element?.kind === 'tile' && <MenuButton label="牌を90度回転" shortcut="R" onClick={() => run(props.onRotate)} disabled={locked} />}
    {additions.some(([id]) => show(id)) && <><div className="context-menu-separator" /><div className="context-menu-heading">この位置に追加</div>{additions.map(([id, label, action]) => show(id) && <MenuButton key={id} label={label} onClick={() => run(action)} />)}</>}
    {props.element && <><div className="context-menu-separator" />{props.element.kind === 'tile' && show('face') && <MenuButton label={props.element.faceDown ? '表向きにする' : '裏向きにする'} onClick={() => run(props.onToggleFace)} disabled={locked} />}{show('lock') && <MenuButton label={locked ? 'ロック解除' : 'ロック'} onClick={() => run(props.onToggleLock)} />}{props.element.kind !== 'tile' && show('properties') && <MenuButton label="プロパティ編集" onClick={() => run(props.onEditProperties)} disabled={locked} />}{show('front') && <MenuButton label="最前面へ" onClick={() => run(props.onBringFront)} disabled={locked} />}{show('back') && <MenuButton label="最背面へ" onClick={() => run(props.onSendBack)} disabled={locked} />}</>}
    {workspaceActions.some(([id]) => show(id)) && <><div className="context-menu-separator" />{workspaceActions.map(([id, label, action]) => show(id) && <MenuButton key={id} label={label} onClick={() => run(action)} disabled={id === 'align' && !props.hasSelection} />)}</>}
    {(show('undo') || show('redo')) && <><div className="context-menu-separator" />{show('undo') && <MenuButton label="元に戻す" shortcut="Ctrl+Z" onClick={() => run(props.onUndo)} disabled={!props.canUndo} />}{show('redo') && <MenuButton label="やり直す" shortcut="Ctrl+Y" onClick={() => run(props.onRedo)} disabled={!props.canRedo} />}</>}
  </div>
}
