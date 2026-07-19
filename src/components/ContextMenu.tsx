import { useEffect } from 'react'
import type { CanvasElement } from '../types'

interface ContextMenuProps {
  x: number
  y: number
  element: CanvasElement | null
  hasSelection: boolean
  canModifySelection: boolean
  canPaste: boolean
  canUndo: boolean
  canRedo: boolean
  onClose: () => void
  onDuplicate: () => void
  onDelete: () => void
  onCopy: () => void
  onPaste: () => void
  onAddRectangle: () => void
  onAddTriangle: () => void
  onAddCircle: () => void
  onAddCross: () => void
  onDrawMode: () => void
  onLineMode: () => void
  onCurveMode: () => void
  onArrowMode: () => void
  onAddImage: () => void
  onSelectMode: () => void
  onTextMode: () => void
  onToggleFace: () => void
  onToggleLock: () => void
  onEditProperties: () => void
  onBringFront: () => void
  onSendBack: () => void
  onUndo: () => void
  onRedo: () => void
}

const MenuButton = ({
  label,
  shortcut,
  onClick,
  disabled,
}: {
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
}) => (
  <button type="button" role="menuitem" disabled={disabled} onClick={onClick}>
    <span>{label}</span>
    {shortcut && <kbd>{shortcut}</kbd>}
  </button>
)

export const ContextMenu = (props: ContextMenuProps) => {
  useEffect(() => {
    const close = () => props.onClose()
    window.addEventListener('pointerdown', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('blur', close)
    }
  }, [props])

  const run = (action: () => void) => {
    action()
    props.onClose()
  }

  const left = Math.max(8, Math.min(props.x, window.innerWidth - 248))
  const top = Math.max(8, Math.min(props.y, window.innerHeight - 540))
  const locked = props.element?.locked ?? false

  return (
    <div
      className="context-menu export-hidden"
      role="menu"
      aria-label="配置物メニュー"
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="context-menu-heading">{props.hasSelection ? '選択中の配置物' : 'Workspace'}</div>
      <MenuButton label="選択" shortcut="Esc" onClick={() => run(props.onSelectMode)} />
      {props.hasSelection && (
        <>
          <MenuButton label="複製" shortcut="Ctrl+D" onClick={() => run(props.onDuplicate)} />
          <MenuButton label="削除" shortcut="Delete" onClick={() => run(props.onDelete)} disabled={!props.canModifySelection} />
          <MenuButton label="コピー" shortcut="Ctrl+C" onClick={() => run(props.onCopy)} />
        </>
      )}
      <MenuButton label="貼り付け" shortcut="Ctrl+V" onClick={() => run(props.onPaste)} disabled={!props.canPaste} />

      <div className="context-menu-separator" />
      <div className="context-menu-heading">この位置に追加</div>
      <MenuButton label="長方形" onClick={() => run(props.onAddRectangle)} />
      <MenuButton label="三角形" onClick={() => run(props.onAddTriangle)} />
      <MenuButton label="丸" onClick={() => run(props.onAddCircle)} />
      <MenuButton label="✕" onClick={() => run(props.onAddCross)} />
      <MenuButton label="クリック文字" onClick={() => run(props.onTextMode)} />
      <MenuButton label="線を描く" onClick={() => run(props.onDrawMode)} />
      <MenuButton label="直線" onClick={() => run(props.onLineMode)} />
      <MenuButton label="曲線" onClick={() => run(props.onCurveMode)} />
      <MenuButton label="矢印" onClick={() => run(props.onArrowMode)} />
      <MenuButton label="画像を追加" onClick={() => run(props.onAddImage)} />

      {props.element && (
        <>
          <div className="context-menu-separator" />
          {props.element.kind === 'tile' && (
            <MenuButton
              label={props.element.faceDown ? '表向きにする' : '裏向きにする'}
              onClick={() => run(props.onToggleFace)}
              disabled={locked}
            />
          )}
          <MenuButton label={locked ? 'ロック解除' : 'ロック'} onClick={() => run(props.onToggleLock)} />
          {props.element.kind !== 'tile' && (
            <MenuButton label="プロパティ編集" onClick={() => run(props.onEditProperties)} disabled={locked} />
          )}
          <MenuButton label="最前面へ" onClick={() => run(props.onBringFront)} disabled={locked} />
          <MenuButton label="最背面へ" onClick={() => run(props.onSendBack)} disabled={locked} />
        </>
      )}

      <div className="context-menu-separator" />
      <MenuButton label="元に戻す" shortcut="Ctrl+Z" onClick={() => run(props.onUndo)} disabled={!props.canUndo} />
      <MenuButton label="やり直す" shortcut="Ctrl+Y" onClick={() => run(props.onRedo)} disabled={!props.canRedo} />
    </div>
  )
}
