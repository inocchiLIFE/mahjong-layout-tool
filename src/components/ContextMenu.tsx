import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CanvasElement } from '../types'
import type { ContextMenuItemId } from './contextMenuItems'

interface ContextMenuProps {
  x: number; y: number; element: CanvasElement | null; hasSelection: boolean; canModifySelection: boolean; canPaste: boolean; canUndo: boolean; canRedo: boolean
  visibleItems: ContextMenuItemId[]; onClose: () => void; onDuplicate: () => void; onDelete: () => void; onCopy: () => void; onPaste: () => void; onRotate: () => void
  onAddRectangle: () => void; onAddTriangle: () => void; onAddCircle: () => void; onAddCross: () => void; onAddWave: () => void; onDrawMode: () => void; onLineMode: () => void; onCurveMode: () => void; onArrowMode: () => void; onAddImage: () => void; onSelectMode: () => void; onTextMode: () => void
  onToggleFace: () => void; onToggleLock: () => void; onEditProperties: () => void; onToggleSpoiler: () => void; onBringFront: () => void; onSendBack: () => void; onClear: () => void; onUndo: () => void; onRedo: () => void
  onEditWorkspace: () => void
}
const MenuButton = ({ label, shortcut, onClick, disabled }: { label: string; shortcut?: string; onClick: () => void; disabled?: boolean }) => <button type="button" role="menuitem" disabled={disabled} onClick={onClick}><span>{label}</span>{shortcut && <kbd>{shortcut}</kbd>}</button>

export const ContextMenu = (props: ContextMenuProps) => {
  useEffect(() => { const close = () => props.onClose(); window.addEventListener('pointerdown', close); window.addEventListener('blur', close); return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('blur', close) } }, [props])
  const run = (action: () => void) => { action(); props.onClose() }
  const show = (id: ContextMenuItemId) => props.visibleItems.includes(id)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: Math.max(8, props.x), top: Math.max(8, props.y) })
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const updatePosition = () => {
      const margin = 8
      const gap = 4
      // The desktop layout is rendered inside a zoomed app shell.  Context
      // menu coordinates are stored in that shell's logical pixels, while
      // getBoundingClientRect/window dimensions are screen pixels.  Convert
      // the measured menu size and viewport back to the same coordinate space
      // before deciding whether it fits below the pointer.
      const appShell = menu.closest('.app-shell')
      const parsedZoom = appShell ? Number.parseFloat(getComputedStyle(appShell).zoom) : 1
      const zoom = Number.isFinite(parsedZoom) && parsedZoom > 0 ? parsedZoom : 1
      const rect = menu.getBoundingClientRect()
      const width = rect.width / zoom
      const height = rect.height / zoom
      const viewportWidth = window.innerWidth / zoom
      const viewportHeight = window.innerHeight / zoom
      const maxLeft = Math.max(margin, viewportWidth - width - margin)
      const maxTop = Math.max(margin, viewportHeight - height - margin)
      const left = Math.max(margin, Math.min(props.x, maxLeft))
      const hasRoomBelow = props.y + height + margin <= viewportHeight
      const hasRoomAbove = props.y - height - gap >= margin
      const preferredTop = hasRoomBelow ? props.y : hasRoomAbove ? props.y - height - gap : props.y
      const top = Math.max(margin, Math.min(preferredTop, maxTop))
      setPosition((previous) => previous.left === left && previous.top === top ? previous : { left, top })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    return () => window.removeEventListener('resize', updatePosition)
  }, [props.x, props.y, props.element?.id, props.hasSelection, props.canModifySelection, props.canPaste, props.canUndo, props.canRedo, props.visibleItems])
  const locked = props.element?.locked ?? false
  const additions: Array<[ContextMenuItemId, string, () => void]> = [['rectangle', '長方形', props.onAddRectangle], ['triangle', '三角形', props.onAddTriangle], ['circle', '丸', props.onAddCircle], ['cross', '✕', props.onAddCross], ['wave', '波線', props.onAddWave], ['text', 'クリック文字', props.onTextMode], ['draw', '線を描く', props.onDrawMode], ['line', '直線', props.onLineMode], ['curve', '曲線', props.onCurveMode], ['arrow', '矢印', props.onArrowMode], ['image', '画像を追加', props.onAddImage]]
  const workspaceActions: Array<[ContextMenuItemId, string, () => void]> = [['clear', '作業画面をクリア', props.onClear]]
  return <div ref={menuRef} className="context-menu export-hidden" role="menu" aria-label="配置物メニュー" style={position} onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
    <div className="context-menu-heading">{props.hasSelection ? '選択中の配置物' : 'Workspace'}</div>
    {show('select') && <MenuButton label="選択" shortcut="Esc" onClick={() => run(props.onSelectMode)} />}
    {props.hasSelection && <>{show('duplicate') && <MenuButton label="複製" shortcut="Ctrl+D" onClick={() => run(props.onDuplicate)} />}{show('delete') && <MenuButton label="削除" shortcut="Delete" onClick={() => run(props.onDelete)} disabled={!props.canModifySelection} />}{show('copy') && <MenuButton label="コピー" shortcut="Ctrl+C" onClick={() => run(props.onCopy)} />}</>}
    {show('paste') && <MenuButton label="貼り付け" shortcut="Ctrl+V" onClick={() => run(props.onPaste)} disabled={!props.canPaste} />}
    {show('rotate') && props.element?.kind === 'tile' && <MenuButton label="牌を90度回転" shortcut="R" onClick={() => run(props.onRotate)} disabled={locked} />}
    {additions.some(([id]) => show(id)) && <><div className="context-menu-separator" /><div className="context-menu-heading">この位置に追加</div>{additions.map(([id, label, action]) => show(id) && <MenuButton key={id} label={label} onClick={() => run(action)} />)}</>}
    {props.element && <><div className="context-menu-separator" />{props.element.kind === 'tile' && show('face') && <MenuButton label={props.element.faceDown ? '表向きにする' : '裏向きにする'} onClick={() => run(props.onToggleFace)} disabled={locked} />}{show('lock') && <MenuButton label={locked ? 'ロック解除' : 'ロック'} onClick={() => run(props.onToggleLock)} />}{props.element.kind !== 'tile' && show('properties') && <MenuButton label="プロパティ編集" onClick={() => run(props.onEditProperties)} disabled={locked} />}{show('spoiler') && <MenuButton label={props.element.spoiler ? '隠し表示を解除' : '隠す'} onClick={() => run(props.onToggleSpoiler)} disabled={locked} />}{show('front') && <MenuButton label="最前面へ" onClick={() => run(props.onBringFront)} disabled={locked} />}{show('back') && <MenuButton label="最背面へ" onClick={() => run(props.onSendBack)} disabled={locked} />}</>}
    {!props.element && <><div className="context-menu-separator" /><MenuButton label="作業領域を設定" onClick={() => run(props.onEditWorkspace)} /></>}
    {workspaceActions.some(([id]) => show(id)) && <><div className="context-menu-separator" />{workspaceActions.map(([id, label, action]) => show(id) && <MenuButton key={id} label={label} onClick={() => run(action)} />)}</>}
    {(show('undo') || show('redo')) && <><div className="context-menu-separator" />{show('undo') && <MenuButton label="元に戻す" shortcut="Ctrl+Z" onClick={() => run(props.onUndo)} disabled={!props.canUndo} />}{show('redo') && <MenuButton label="やり直す" shortcut="Ctrl+Y" onClick={() => run(props.onRedo)} disabled={!props.canRedo} />}</>}
  </div>
}
