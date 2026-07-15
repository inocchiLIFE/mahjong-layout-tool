import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { TILE_MAP } from '../data/tiles'
import type {
  CanvasElement,
  ElementPosition,
  PlacementMode,
  Scene,
  SymbolType,
  TextElement,
} from '../types'
import {
  clamp,
  getElementDimensions,
  getSymbolBaseDimensions,
  MAX_WORKSPACE_HEIGHT,
  MAX_WORKSPACE_WIDTH,
  MIN_WORKSPACE_HEIGHT,
  MIN_WORKSPACE_WIDTH,
  snap,
  SYMBOL_LABELS,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../utils/layout'

interface EditTextRequest {
  id: string
  token: number
}

interface WorkspaceProps {
  scene: Scene
  showGrid: boolean
  snapToGrid: boolean
  placementMode: PlacementMode
  editTextRequest: EditTextRequest | null
  onDropTile: (tileId: string, x: number, y: number) => void
  onSelectElement: (id: string, additive: boolean) => void
  onSelectRange: (ids: string[], additive: boolean) => void
  onClearSelection: () => void
  onMoveElements: (positions: ElementPosition[]) => void
  onPlaceSymbol: (symbolType: SymbolType, x: number, y: number) => void
  onCommitText: (text: string, x: number, y: number, id?: string) => void
  onFinishTextEditing: () => void
  onPlacementComplete: () => void
  onResize: (width: number, height: number) => void
  onBeginDrag: () => void
  onEndDrag: () => void
}

interface DragState {
  startClientX: number
  startClientY: number
  primaryId: string
  starts: ElementPosition[]
  bounds: { left: number; top: number; right: number; bottom: number }
}

interface MarqueeState {
  startX: number
  startY: number
  currentX: number
  currentY: number
  visible: boolean
  additive: boolean
}

interface TextEditorState {
  id?: string
  x: number
  y: number
  value: string
}

const intersectionIds = (
  elements: CanvasElement[],
  left: number,
  top: number,
  right: number,
  bottom: number,
) => elements.filter((element) => {
  const dimensions = getElementDimensions(element)
  return element.x < right
    && element.x + dimensions.width > left
    && element.y < bottom
    && element.y + dimensions.height > top
}).map((element) => element.id)

export const Workspace = forwardRef<HTMLDivElement, WorkspaceProps>((props, ref) => {
  const dragRef = useRef<DragState | null>(null)
  const marqueeRef = useRef<MarqueeState | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; width: number; height: number } | null>(null)
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [editor, setEditor] = useState<TextEditorState | null>(null)

  useEffect(() => {
    if (!props.editTextRequest) return
    const item = props.scene.elements.find(
      (element): element is TextElement => element.id === props.editTextRequest?.id && element.kind === 'text',
    )
    if (item) setEditor({ id: item.id, x: item.x, y: item.y, value: item.text })
  }, [props.editTextRequest, props.scene.elements])

  const beginElementDrag = (event: ReactPointerEvent<HTMLButtonElement>, element: CanvasElement) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)

    const selectedElements = props.scene.elements.filter((item) => item.selected)
    const group = element.selected
      ? selectedElements
      : event.shiftKey
        ? [...selectedElements, element]
        : [element]
    const uniqueGroup = group.filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
    const bounds = uniqueGroup.reduce((result, item) => {
      const dimensions = getElementDimensions(item)
      return {
        left: Math.min(result.left, item.x),
        top: Math.min(result.top, item.y),
        right: Math.max(result.right, item.x + dimensions.width),
        bottom: Math.max(result.bottom, item.y + dimensions.height),
      }
    }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity })

    dragRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      primaryId: element.id,
      starts: uniqueGroup.map((item) => ({ id: item.id, x: item.x, y: item.y })),
      bounds,
    }
    props.onBeginDrag()
    props.onSelectElement(element.id, event.shiftKey)
  }

  const moveElementDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const primary = drag.starts.find((item) => item.id === drag.primaryId)
    if (!primary) return

    const rawX = primary.x + event.clientX - drag.startClientX
    const rawY = primary.y + event.clientY - drag.startClientY
    let deltaX = snap(rawX, props.snapToGrid) - primary.x
    let deltaY = snap(rawY, props.snapToGrid) - primary.y
    deltaX = clamp(deltaX, -drag.bounds.left, props.scene.width - drag.bounds.right)
    deltaY = clamp(deltaY, -drag.bounds.top, props.scene.height - drag.bounds.bottom)

    props.onMoveElements(drag.starts.map((item) => ({
      id: item.id,
      x: Math.round(item.x + deltaX),
      y: Math.round(item.y + deltaY),
    })))
  }

  const endElementDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    props.onEndDrag()
  }

  const canvasPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: clamp(event.clientX - bounds.left, 0, props.scene.width),
      y: clamp(event.clientY - bounds.top, 0, props.scene.height),
    }
  }

  const beginCanvasPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return
    const point = canvasPoint(event)
    const state: MarqueeState = {
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
      visible: false,
      additive: event.shiftKey,
    }
    marqueeRef.current = state
    setMarquee(state)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveCanvasPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = marqueeRef.current
    if (!state) return
    const point = canvasPoint(event)
    const next = {
      ...state,
      currentX: point.x,
      currentY: point.y,
      visible: state.visible || Math.hypot(point.x - state.startX, point.y - state.startY) > 4,
    }
    marqueeRef.current = next
    setMarquee(next)
  }

  const finishCanvasPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = marqueeRef.current
    if (!state) return
    marqueeRef.current = null
    setMarquee(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (state.visible) {
      const left = Math.min(state.startX, state.currentX)
      const top = Math.min(state.startY, state.currentY)
      const right = Math.max(state.startX, state.currentX)
      const bottom = Math.max(state.startY, state.currentY)
      props.onSelectRange(intersectionIds(props.scene.elements, left, top, right, bottom), state.additive)
      return
    }

    if (props.placementMode === 'text') {
      setEditor({ x: state.startX, y: state.startY, value: '' })
    } else if (props.placementMode !== 'select') {
      props.onPlaceSymbol(props.placementMode, state.startX, state.startY)
      props.onPlacementComplete()
    } else {
      props.onClearSelection()
    }
  }

  const finishTextEditor = (cancelled = false) => {
    if (!editor) return
    const text = editor.value.trim()
    if (!cancelled && text) props.onCommitText(text, editor.x, editor.y, editor.id)
    setEditor(null)
    props.onFinishTextEditing()
    props.onPlacementComplete()
  }

  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      width: props.scene.width,
      height: props.scene.height,
    }
    props.onBeginDrag()
  }

  const moveResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const resize = resizeRef.current
    if (!resize) return
    props.onResize(
      clamp(resize.width + event.clientX - resize.startX, MIN_WORKSPACE_WIDTH, MAX_WORKSPACE_WIDTH),
      clamp(resize.height + event.clientY - resize.startY, MIN_WORKSPACE_HEIGHT, MAX_WORKSPACE_HEIGHT),
    )
  }

  const endResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resizeRef.current) return
    resizeRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    props.onEndDrag()
  }

  const marqueeStyle = marquee ? {
    left: Math.min(marquee.startX, marquee.currentX),
    top: Math.min(marquee.startY, marquee.currentY),
    width: Math.abs(marquee.currentX - marquee.startX),
    height: Math.abs(marquee.currentY - marquee.startY),
  } : undefined

  return (
    <div
      ref={ref}
      className={`workspace-canvas${props.showGrid ? ' show-grid' : ''}`}
      style={{ width: props.scene.width, height: props.scene.height }}
      onPointerDown={beginCanvasPointer}
      onPointerMove={moveCanvasPointer}
      onPointerUp={finishCanvasPointer}
      onPointerCancel={finishCanvasPointer}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('application/x-mahjong-tile')) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        const tileId = event.dataTransfer.getData('application/x-mahjong-tile')
        if (!TILE_MAP.has(tileId)) return
        const bounds = event.currentTarget.getBoundingClientRect()
        props.onDropTile(tileId, event.clientX - bounds.left - TILE_WIDTH / 2, event.clientY - bounds.top - TILE_HEIGHT / 2)
      }}
      aria-label="麻雀牌・文字・記号の作業エリア"
    >
      {props.scene.elements.length === 0 && !editor && (
        <div className="empty-canvas" aria-hidden="true">
          <div className="empty-tile-stack"><span>東</span><span>一</span><span>●</span></div>
          <p><strong>ここに牌姿を作ります</strong><span>牌一覧からクリック、またはドラッグして追加</span></p>
        </div>
      )}

      {props.scene.elements.map((element) => {
        const dimensions = getElementDimensions(element)
        const commonProps = {
          type: 'button' as const,
          className: `placed-item placed-${element.kind}${element.selected ? ' selected' : ''}`,
          style: {
            left: element.x,
            top: element.y,
            zIndex: element.zIndex,
            width: dimensions.width,
            height: dimensions.height,
          },
          onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => beginElementDrag(event, element),
          onPointerMove: moveElementDrag,
          onPointerUp: endElementDrag,
          onPointerCancel: endElementDrag,
        }

        if (element.kind === 'tile') {
          const tile = TILE_MAP.get(element.tileId)
          if (!tile) return null
          return (
            <button key={element.id} {...commonProps} aria-label={`${tile.label}${element.selected ? '、選択中' : ''}`}>
              <img
                src={tile.asset}
                alt={tile.label}
                draggable={false}
                style={{ transform: `translate(-50%, -50%) rotate(${element.rotation}deg)` }}
              />
            </button>
          )
        }

        if (element.kind === 'text') {
          const baseWidth = Math.max(44, Math.ceil(element.text.length * element.fontSize * 1.05) + 16)
          const baseHeight = Math.ceil(element.fontSize * 1.5) + 8
          return (
            <button
              key={element.id}
              {...commonProps}
              className={`${commonProps.className}${editor?.id === element.id ? ' editing' : ''}`}
              onDoubleClick={() => setEditor({ id: element.id, x: element.x, y: element.y, value: element.text })}
              aria-label={`文字「${element.text}」${element.selected ? '、選択中' : ''}`}
            >
              <span
                className="text-visual"
                style={{
                  color: element.color,
                  fontSize: element.fontSize,
                  width: baseWidth,
                  height: baseHeight,
                  transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
                }}
              >{element.text}</span>
            </button>
          )
        }

        const base = getSymbolBaseDimensions(element.symbolType)
        return (
          <button key={element.id} {...commonProps} aria-label={`${SYMBOL_LABELS[element.symbolType]}${element.selected ? '、選択中' : ''}`}>
            <span
              className={`symbol-visual symbol-${element.symbolType}`}
              style={{
                width: base.width,
                height: base.height,
                transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
              }}
            >{element.symbolType === 'cross' ? '✕' : ''}</span>
          </button>
        )
      })}

      {editor && (
        <input
          className="workspace-text-editor export-hidden"
          style={{ left: editor.x, top: editor.y }}
          value={editor.value}
          autoFocus
          placeholder="文字を入力"
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => setEditor({ ...editor, value: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur()
            if (event.key === 'Escape') finishTextEditor(true)
          }}
          onBlur={() => finishTextEditor()}
        />
      )}

      {marquee?.visible && <div className="selection-marquee export-hidden" style={marqueeStyle} />}

      <button
        type="button"
        className="workspace-resize-handle export-hidden"
        aria-label="作業エリアのサイズをドラッグして変更"
        onPointerDown={beginResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      />
    </div>
  )
})

Workspace.displayName = 'Workspace'
