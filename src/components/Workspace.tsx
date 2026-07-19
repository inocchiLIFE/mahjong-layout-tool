import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { TILE_MAP } from '../data/tiles'
import type {
  CanvasElement,
  CanvasPoint,
  ContextMenuState,
  ElementPosition,
  PlacementMode,
  Scene,
  SymbolType,
  TextElement,
  DrawingType,
} from '../types'
import {
  getElementDimensions,
  getArrowHeadPoints,
  getCurveControlPoint,
  getSymbolBaseDimensions,
  snap,
  SYMBOL_LABELS,
  TILE_GAP,
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
  onDropFiles: (files: File[], x: number, y: number) => void
  onDropText: (text: string, x: number, y: number) => void
  onSelectElement: (id: string, additive: boolean) => void
  onSelectRange: (ids: string[], additive: boolean) => void
  onClearSelection: () => void
  onMoveElements: (positions: ElementPosition[]) => void
  onDeleteDragged: (ids: string[]) => void
  onTrashHover: (active: boolean) => void
  onPlaceSymbol: (symbolType: SymbolType, x: number, y: number) => void
  onCommitDrawing: (points: CanvasPoint[], drawingType?: DrawingType) => void
  onCommitText: (text: string, x: number, y: number, id?: string) => void
  onFinishTextEditing: () => void
  onToggleTileFace: (id: string) => void
  onOpenContextMenu: (state: ContextMenuState) => void
  onResizeElement: (id: string, width: number, height: number) => void
  onBeginDrag: () => void
  onEndDrag: () => void
}

interface DragState {
  pointerId: number
  startClientX: number
  startClientY: number
  primaryId: string
  starts: ElementPosition[]
  moved: boolean
  inTrash: boolean
  toggleOnClick: boolean
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

interface DrawingState {
  pointerId: number
  points: CanvasPoint[]
}

interface CurveDraftState {
  start: CanvasPoint
  end: CanvasPoint
}

interface ElementResizeState {
  pointerId: number
  id: string
  startClientX: number
  startClientY: number
  startWidth: number
  startHeight: number
}

interface PanState {
  pointerId: number
  startClientX: number
  startClientY: number
  startX: number
  startY: number
}

interface DropPreview {
  kind: 'tile' | 'symbol' | 'text' | 'image'
  symbolType?: SymbolType
  x: number
  y: number
  width: number
  height: number
  label: string
}

const isPalettePoint = (clientX: number, clientY: number) => {
  const palette = document.querySelector<HTMLElement>('.palette-panel')
  if (!palette) return false
  const bounds = palette.getBoundingClientRect()
  return clientX >= bounds.left
    && clientX <= bounds.right
    && clientY >= bounds.top
    && clientY <= bounds.bottom
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

const curvePath = (points: CanvasPoint[]) => {
  const start = points[0]
  const end = points.at(-1) ?? start
  const control = getCurveControlPoint(points)
  return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`
}

const arrowHeadPoints = (points: CanvasPoint[]) => {
  return getArrowHeadPoints(points).map((point) => `${point.x},${point.y}`).join(' ')
}

export const Workspace = forwardRef<HTMLDivElement, WorkspaceProps>((props, ref) => {
  const propsRef = useRef(props)
  propsRef.current = props
  const dragRef = useRef<DragState | null>(null)
  const marqueeRef = useRef<MarqueeState | null>(null)
  const drawingRef = useRef<DrawingState | null>(null)
  const elementResizeRef = useRef<ElementResizeState | null>(null)
  const panRef = useRef<PanState | null>(null)
  const spaceDownRef = useRef(false)
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [editor, setEditor] = useState<TextEditorState | null>(null)
  const [drawing, setDrawing] = useState<DrawingState | null>(null)
  const [curveDraft, setCurveDraft] = useState<CurveDraftState | null>(null)
  const [curvePreview, setCurvePreview] = useState<CanvasPoint | null>(null)
  const [camera, setCamera] = useState({ x: 0, y: 0 })
  const [draggingIds, setDraggingIds] = useState<Set<string>>(() => new Set())
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null)
  const [placementPreview, setPlacementPreview] = useState<DropPreview | null>(null)

  useEffect(() => {
    const down = (event: KeyboardEvent) => { if (event.code === 'Space') spaceDownRef.current = true }
    const up = (event: KeyboardEvent) => { if (event.code === 'Space') spaceDownRef.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useEffect(() => {
    if (!props.editTextRequest) return
    const item = props.scene.elements.find(
      (element): element is TextElement => element.id === props.editTextRequest?.id && element.kind === 'text',
    )
    if (item && !item.locked) setEditor({ id: item.id, x: item.x, y: item.y, value: item.text })
  }, [props.editTextRequest, props.scene.elements])

  useEffect(() => {
    if (props.placementMode === 'text' || props.placementMode === 'rectangle' || props.placementMode === 'circle' || props.placementMode === 'triangle' || props.placementMode === 'cross' || props.placementMode === 'wave') return
    setPlacementPreview(null)
  }, [props.placementMode])

  useEffect(() => {
    if (props.placementMode === 'curve') return
    setCurveDraft(null)
    setCurvePreview(null)
  }, [props.placementMode])

  const beginElementDrag = (event: ReactPointerEvent<HTMLButtonElement>, element: CanvasElement) => {
    if (event.button !== 0) return
    if (spaceDownRef.current) return
    event.stopPropagation()
    const toggleOnClick = element.selected && !event.shiftKey && element.kind !== 'tile'
    if (!toggleOnClick) props.onSelectElement(element.id, event.shiftKey)
    if (element.locked) return

    event.currentTarget.setPointerCapture(event.pointerId)
    const selectedElements = props.scene.elements.filter((item) => item.selected && !item.locked)
    const group = element.selected
      ? selectedElements
      : event.shiftKey
        ? [...selectedElements, element]
        : [element]
    const uniqueGroup = group.filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
    setDraggingIds(new Set(uniqueGroup.map((item) => item.id)))
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      primaryId: element.id,
      starts: uniqueGroup.map((item) => ({ id: item.id, x: item.x, y: item.y })),
      moved: false,
      inTrash: false,
      toggleOnClick,
    }
    props.onBeginDrag()
  }

  const moveElementDrag = useCallback((clientX: number, clientY: number) => {
    const currentProps = propsRef.current
    const drag = dragRef.current
    if (!drag) return
    if (!drag.moved && Math.hypot(clientX - drag.startClientX, clientY - drag.startClientY) <= 3) return
    drag.moved = true

    const inTrash = isPalettePoint(clientX, clientY)
    if (inTrash) {
      if (!drag.inTrash) currentProps.onMoveElements(drag.starts)
      drag.inTrash = true
      currentProps.onTrashHover(true)
      return
    }
    if (drag.inTrash) {
      drag.inTrash = false
      currentProps.onTrashHover(false)
    }

    const primary = drag.starts.find((item) => item.id === drag.primaryId)
    if (!primary) return
    const rawX = primary.x + clientX - drag.startClientX
    const rawY = primary.y + clientY - drag.startClientY
    let targetX = snap(rawX, currentProps.snapToGrid)
    let targetY = snap(rawY, currentProps.snapToGrid)
    const primaryElement = currentProps.scene.elements.find((element) => element.id === drag.primaryId)
    if (primaryElement?.kind === 'tile' && drag.starts.length === 1) {
      const neighbor = currentProps.scene.elements
        .filter((element) => element.kind === 'tile' && element.id !== primaryElement.id && !element.locked)
        .flatMap((element) => ([
          { x: element.x + TILE_WIDTH + TILE_GAP, y: element.y },
          { x: element.x - TILE_WIDTH - TILE_GAP, y: element.y },
        ]))
        .map((candidate) => ({ candidate, distance: Math.hypot(targetX - candidate.x, targetY - candidate.y) }))
        .filter(({ candidate }) => Math.abs(targetY - candidate.y) <= 10 && Math.abs(targetX - candidate.x) <= 10)
        .sort((a, b) => a.distance - b.distance)[0]
      if (neighbor) {
        targetX = neighbor.candidate.x
        targetY = neighbor.candidate.y
      }
    }
    const deltaX = targetX - primary.x
    const deltaY = targetY - primary.y
    currentProps.onMoveElements(drag.starts.map((item) => ({
      id: item.id,
      x: Math.round(item.x + deltaX),
      y: Math.round(item.y + deltaY),
    })))
  }, [])

  const endElementDrag = useCallback((clientX: number, clientY: number) => {
    const currentProps = propsRef.current
    const drag = dragRef.current
    if (!drag) return
    const droppedInTrash = drag.moved && (drag.inTrash || isPalettePoint(clientX, clientY))
    if (droppedInTrash) currentProps.onMoveElements(drag.starts)
    if (!drag.moved && drag.toggleOnClick) currentProps.onSelectElement(drag.primaryId, false)
    dragRef.current = null
    setDraggingIds(new Set())
    currentProps.onTrashHover(false)
    currentProps.onEndDrag()
    if (droppedInTrash) currentProps.onDeleteDragged(drag.starts.map((item) => item.id))
  }, [])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) moveElementDrag(event.clientX, event.clientY)
    }
    const handlePointerEnd = (event: PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) endElementDrag(event.clientX, event.clientY)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [moveElementDrag, endElementDrag])

  const beginElementResize = (event: ReactPointerEvent<HTMLButtonElement>, element: CanvasElement) => {
    if (event.button !== 0 || (element.kind !== 'symbol' && element.kind !== 'image' && element.kind !== 'drawing') || element.locked) return
    event.preventDefault()
    event.stopPropagation()
    const dimensions = getElementDimensions(element)
    event.currentTarget.setPointerCapture(event.pointerId)
    elementResizeRef.current = {
      pointerId: event.pointerId,
      id: element.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: dimensions.width,
      startHeight: dimensions.height,
    }
    props.onBeginDrag()
  }

  useEffect(() => {
    const moveElementResize = (event: PointerEvent) => {
      const resize = elementResizeRef.current
      if (!resize || resize.pointerId !== event.pointerId) return
      const deltaX = event.clientX - resize.startClientX
      const deltaY = event.clientY - resize.startClientY
      let width = Math.max(resize.startWidth + deltaX, 24)
      let height = Math.max(resize.startHeight + deltaY, 24)
      if (event.shiftKey) {
        const xScale = width / resize.startWidth
        const yScale = height / resize.startHeight
        const factor = Math.abs(xScale - 1) >= Math.abs(yScale - 1) ? xScale : yScale
        width = Math.max(resize.startWidth * factor, 24)
        height = Math.max(resize.startHeight * factor, 24)
      }
      propsRef.current.onResizeElement(resize.id, width, height)
    }
    const endElementResize = (event: PointerEvent) => {
      const resize = elementResizeRef.current
      if (!resize || resize.pointerId !== event.pointerId) return
      elementResizeRef.current = null
      propsRef.current.onEndDrag()
    }
    window.addEventListener('pointermove', moveElementResize)
    window.addEventListener('pointerup', endElementResize)
    window.addEventListener('pointercancel', endElementResize)
    return () => {
      window.removeEventListener('pointermove', moveElementResize)
      window.removeEventListener('pointerup', endElementResize)
      window.removeEventListener('pointercancel', endElementResize)
    }
  }, [])

  const canvasPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: event.clientX - bounds.left - camera.x,
      y: event.clientY - bounds.top - camera.y,
    }
  }

  const drawingPoint = (point: CanvasPoint, start?: CanvasPoint) => {
    const snapped = props.snapToGrid && props.placementMode === 'line'
      ? { x: snap(point.x, true), y: snap(point.y, true) }
      : point
    if (props.placementMode !== 'line' || !start) return snapped
    const deltaX = Math.abs(snapped.x - start.x)
    const deltaY = Math.abs(snapped.y - start.y)
    return deltaX >= deltaY
      ? { x: snapped.x, y: start.y }
      : { x: start.x, y: snapped.y }
  }

  const updatePlacementPreview = (point: CanvasPoint) => {
    const mode = props.placementMode
    if (mode === 'text') {
      setPlacementPreview({ kind: 'text', x: point.x - 70, y: point.y - 20, width: 140, height: 40, label: '文字' })
      return
    }
    if (mode === 'rectangle' || mode === 'circle' || mode === 'triangle' || mode === 'cross' || mode === 'wave') {
      const dimensions = getSymbolBaseDimensions(mode)
      setPlacementPreview({
        kind: 'symbol',
        symbolType: mode,
        x: point.x - dimensions.width / 2,
        y: point.y - dimensions.height / 2,
        width: dimensions.width,
        height: dimensions.height,
        label: SYMBOL_LABELS[mode],
      })
      return
    }
    setPlacementPreview(null)
  }

  const beginCanvasPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button === 1 || (event.button === 0 && spaceDownRef.current)) {
      event.preventDefault()
      panRef.current = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startX: camera.x, startY: camera.y }
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if (event.button !== 0) return
    if (props.placementMode === 'curve' && curveDraft) {
      const apex = canvasPoint(event)
      props.onCommitDrawing([curveDraft.start, apex, curveDraft.end], 'curve')
      setCurveDraft(null)
      setCurvePreview(null)
      return
    }
    if (props.placementMode === 'draw' || props.placementMode === 'line' || props.placementMode === 'curve' || props.placementMode === 'arrow') {
      const point = drawingPoint(canvasPoint(event))
      const state = { pointerId: event.pointerId, points: [point] }
      drawingRef.current = state
      setDrawing(state)
      props.onClearSelection()
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if (event.target !== event.currentTarget) return
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
    const pan = panRef.current
    if (pan?.pointerId === event.pointerId) {
      setCamera({ x: pan.startX + event.clientX - pan.startClientX, y: pan.startY + event.clientY - pan.startClientY })
      return
    }
    const activeDrawing = drawingRef.current
    if (activeDrawing?.pointerId === event.pointerId) {
      const point = drawingPoint(canvasPoint(event), activeDrawing.points[0])
      const previous = activeDrawing.points.at(-1)
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 2) {
        const next = { ...activeDrawing, points: props.placementMode === 'line' || props.placementMode === 'curve' || props.placementMode === 'arrow' ? [activeDrawing.points[0], point] : [...activeDrawing.points, point] }
        drawingRef.current = next
        setDrawing(next)
      }
      return
    }
    if (curveDraft) {
      setCurvePreview(canvasPoint(event))
      return
    }
    const state = marqueeRef.current
    const point = canvasPoint(event)
    if (!state) {
      updatePlacementPreview(point)
      return
    }
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
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      return
    }
    const activeDrawing = drawingRef.current
    if (activeDrawing?.pointerId === event.pointerId) {
      const point = drawingPoint(canvasPoint(event), activeDrawing.points[0])
      const points = props.placementMode === 'line' || props.placementMode === 'curve' || props.placementMode === 'arrow' ? [activeDrawing.points[0], point] : [...activeDrawing.points, point]
      drawingRef.current = null
      setDrawing(null)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      if (props.placementMode === 'curve' && points.length === 2 && Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) > 3) {
        setCurveDraft({ start: points[0], end: points[1] })
        setCurvePreview({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 })
        return
      }
      if (points.length >= 2 && Math.hypot(points.at(-1)!.x - points[0].x, points.at(-1)!.y - points[0].y) > 3) {
        props.onCommitDrawing(points, props.placementMode === 'line' ? 'line' : props.placementMode === 'curve' ? 'curve' : props.placementMode === 'arrow' ? 'arrow' : 'freehand')
      }
      return
    }
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
    } else if (props.placementMode !== 'select' && props.placementMode !== 'draw' && props.placementMode !== 'line' && props.placementMode !== 'curve' && props.placementMode !== 'arrow') {
      props.onPlaceSymbol(props.placementMode, state.startX, state.startY)
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
  }

  const openContextMenu = (event: React.MouseEvent<HTMLButtonElement>, element: CanvasElement) => {
    event.preventDefault()
    event.stopPropagation()
    const canvas = event.currentTarget.closest('.workspace-canvas')?.getBoundingClientRect()
    if (!canvas) return
    props.onOpenContextMenu({
      elementId: element.id,
      clientX: event.clientX,
      clientY: event.clientY,
      canvasX: event.clientX - canvas.left - camera.x,
      canvasY: event.clientY - canvas.top - camera.y,
    })
  }

  const openWorkspaceContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    const canvas = event.currentTarget.getBoundingClientRect()
    props.onOpenContextMenu({
      elementId: null,
      clientX: event.clientX,
      clientY: event.clientY,
      canvasX: event.clientX - canvas.left - camera.x,
      canvasY: event.clientY - canvas.top - camera.y,
    })
  }

  const updateDropPreview = (event: ReactDragEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left - camera.x
    const y = event.clientY - bounds.top - camera.y
    const symbolType = event.dataTransfer.getData('application/x-mahjong-symbol')
    if (symbolType === 'rectangle' || symbolType === 'circle' || symbolType === 'triangle' || symbolType === 'cross' || symbolType === 'wave') {
      const dimensions = getSymbolBaseDimensions(symbolType)
      setDropPreview({
        kind: 'symbol',
        x: x - dimensions.width / 2,
        y: y - dimensions.height / 2,
        width: dimensions.width,
        height: dimensions.height,
        label: SYMBOL_LABELS[symbolType],
        symbolType,
      })
      return
    }
    if (event.dataTransfer.types.includes('application/x-mahjong-tile')) {
      setDropPreview({ kind: 'tile', x: x - TILE_WIDTH / 2, y: y - TILE_HEIGHT / 2, width: TILE_WIDTH, height: TILE_HEIGHT, label: '牌' })
      return
    }
    if (event.dataTransfer.types.includes('Files')) {
      setDropPreview({ kind: 'image', x: x - 80, y: y - 55, width: 160, height: 110, label: '画像' })
      return
    }
    if (event.dataTransfer.types.includes('text/plain')) {
      setDropPreview({ kind: 'text', x: x - 70, y: y - 20, width: 140, height: 40, label: '文字' })
    }
  }

  const marqueeStyle = marquee ? {
    left: Math.min(marquee.startX, marquee.currentX) + camera.x,
    top: Math.min(marquee.startY, marquee.currentY) + camera.y,
    width: Math.abs(marquee.currentX - marquee.startX),
    height: Math.abs(marquee.currentY - marquee.startY),
  } : undefined
  const selectedResizable = props.scene.elements.find((element) => (element.kind === 'symbol' || element.kind === 'image' || element.kind === 'drawing') && element.selected && !element.locked) ?? null

  return (
    <div
      ref={ref}
      className={`workspace-canvas${props.showGrid ? ' show-grid' : ''}${props.placementMode === 'draw' || props.placementMode === 'line' || props.placementMode === 'curve' || props.placementMode === 'arrow' ? ' drawing-mode' : ''}`}
      style={{ width: props.scene.width, height: props.scene.height }}
      onPointerDown={beginCanvasPointer}
      onPointerMove={moveCanvasPointer}
      onPointerUp={finishCanvasPointer}
      onPointerCancel={finishCanvasPointer}
      onPointerLeave={() => setPlacementPreview(null)}
      onDragEnter={updateDropPreview}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('application/x-mahjong-tile') || event.dataTransfer.types.includes('application/x-mahjong-symbol') || event.dataTransfer.types.includes('Files') || event.dataTransfer.types.includes('text/plain')) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          updateDropPreview(event)
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropPreview(null)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDropPreview(null)
        const tileId = event.dataTransfer.getData('application/x-mahjong-tile')
        const bounds = event.currentTarget.getBoundingClientRect()
        const x = event.clientX - bounds.left - camera.x
        const y = event.clientY - bounds.top - camera.y
        if (TILE_MAP.has(tileId)) {
          props.onDropTile(tileId, x - TILE_WIDTH / 2, y - TILE_HEIGHT / 2)
          return
        }
        const symbolType = event.dataTransfer.getData('application/x-mahjong-symbol')
        if (symbolType === 'rectangle' || symbolType === 'circle' || symbolType === 'triangle' || symbolType === 'cross' || symbolType === 'wave') {
          props.onPlaceSymbol(symbolType, x, y)
          return
        }
        const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.mahjong-layout.json'))
        if (files.length) {
          props.onDropFiles(files, x, y)
          return
        }
        const text = event.dataTransfer.getData('text/plain').trim()
        if (text) props.onDropText(text, x, y)
      }}
      onContextMenu={openWorkspaceContextMenu}
      aria-label="麻雀牌・文字・記号・画像・線の作業エリア"
    >
      {props.scene.elements.length === 0 && !editor && (
        <div className="empty-canvas" aria-hidden="true">
          <div className="empty-tile-stack"><span>東</span><span>一</span><span>●</span></div>
          <p><strong>ここに牌姿を作ります</strong><span>牌一覧からクリック、またはドラッグして追加</span></p>
        </div>
      )}

      {props.scene.elements.map((element) => {
        const dimensions = getElementDimensions(element)
        const lockedLabel = element.locked ? '、ロック中' : ''
        const commonProps = {
          type: 'button' as const,
          className: `placed-item placed-${element.kind}${element.selected ? ' selected' : ''}${draggingIds.has(element.id) ? ' dragging' : ''}${element.locked ? ' locked' : ''}`,
          style: {
            left: element.x + camera.x,
            top: element.y + camera.y,
            zIndex: element.zIndex,
            width: dimensions.width,
            height: dimensions.height,
          },
          onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
            if (props.placementMode !== 'draw' && props.placementMode !== 'line' && props.placementMode !== 'curve' && props.placementMode !== 'arrow') beginElementDrag(event, element)
          },
          onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => openContextMenu(event, element),
        }

        if (element.kind === 'tile') {
          const tile = TILE_MAP.get(element.tileId)
          if (!tile) return null
          return (
            <button
              key={element.id}
              {...commonProps}
              className={`${commonProps.className}${element.faceDown ? ' face-down' : ''}`}
              onDoubleClick={(event) => {
                event.stopPropagation()
                if (!element.locked) props.onToggleTileFace(element.id)
              }}
              aria-label={`${tile.label}${element.faceDown ? '、裏向き' : ''}${element.selected ? '、選択中' : ''}${lockedLabel}`}
            >
              {element.faceDown ? (
                <span className="tile-back" style={{ transform: `translate(-50%, -50%) rotate(${element.rotation}deg)` }} />
              ) : (
                <img
                  src={tile.asset}
                  alt={tile.label}
                  draggable={false}
                  style={{ transform: `translate(-50%, -50%) rotate(${element.rotation}deg)` }}
                />
              )}
              {element.locked && <span className="lock-badge" aria-hidden="true">🔒</span>}
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
              onDoubleClick={() => !element.locked && setEditor({ id: element.id, x: element.x, y: element.y, value: element.text })}
              aria-label={`文字「${element.text}」${element.selected ? '、選択中' : ''}${lockedLabel}`}
            >
              <span
                className="text-visual"
                style={{
                  color: element.color,
                  fontSize: element.fontSize,
                  fontFamily: element.fontFamily,
                  width: baseWidth,
                  height: baseHeight,
                  transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
                }}
              >{element.text}</span>
              {element.locked && <span className="lock-badge" aria-hidden="true">🔒</span>}
            </button>
          )
        }

        if (element.kind === 'image') {
          return (
            <button key={element.id} {...commonProps} aria-label={`画像「${element.name}」${element.selected ? '、選択中' : ''}${lockedLabel}`}>
              <img
                className="image-visual"
                src={element.src}
                alt=""
                draggable={false}
                style={{
                  width: element.width,
                  height: element.height,
                  opacity: element.opacity,
                  transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
                }}
              />
              {element.locked && <span className="lock-badge" aria-hidden="true">🔒</span>}
            </button>
          )
        }

        if (element.kind === 'drawing') {
          return (
            <button key={element.id} {...commonProps} aria-label={`手描き線${element.selected ? '、選択中' : ''}${lockedLabel}`}>
              <svg
                className="drawing-visual"
                viewBox={`0 0 ${element.width} ${element.height}`}
                style={{ width: element.width, height: element.height, transform: `translate(-50%, -50%) rotate(${element.rotation}deg)` }}
                aria-hidden="true"
              >
                {element.drawingType === 'curve' ? <>
                  {element.selected && <path d={curvePath(element.points)} fill="none" stroke="#277fbd" strokeWidth={element.strokeWidth + 4} strokeLinecap="round" opacity=".7" />}
                  <path d={curvePath(element.points)} fill="none" stroke={element.color} strokeWidth={element.strokeWidth} strokeLinecap="round" />
                </> : <>
                  {element.selected && <polyline points={element.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#277fbd" strokeWidth={element.strokeWidth + 4} strokeLinecap="round" strokeLinejoin="round" opacity=".7" />}
                  <polyline points={element.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={element.color} strokeWidth={element.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                  {element.drawingType === 'arrow' && <>
                    {element.selected && <polyline points={arrowHeadPoints(element.points)} fill="none" stroke="#277fbd" strokeWidth={element.strokeWidth + 4} strokeLinecap="round" strokeLinejoin="round" opacity=".7" />}
                    <polyline points={arrowHeadPoints(element.points)} fill="none" stroke={element.color} strokeWidth={element.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                  </>}
                </>}
              </svg>
              {element.locked && <span className="lock-badge" aria-hidden="true">🔒</span>}
            </button>
          )
        }

        const base = getSymbolBaseDimensions(element.symbolType)
        const visualWidth = base.width * (element.scaleX ?? element.scale)
        const visualHeight = base.height * (element.scaleY ?? element.scale)
        const visualTransform = `translate(-50%, -50%) rotate(${element.rotation}deg)`
        return (
          <button
            key={element.id}
            {...commonProps}
            onDoubleClick={(event) => {
              event.stopPropagation()
              if (!element.locked) {
                window.requestAnimationFrame(() => propsRef.current.onSelectElement(element.id, false))
              }
            }}
            aria-label={`${SYMBOL_LABELS[element.symbolType]}${element.selected ? '、選択中' : ''}${lockedLabel}`}
          >
            {element.symbolType === 'triangle' ? (
              <svg
                className="symbol-visual symbol-triangle"
                viewBox="0 0 99 66"
                style={{ width: visualWidth, height: visualHeight, transform: visualTransform }}
                aria-hidden="true"
              >
                <polygon points="49.5,5 94,61 5,61" fill="none" stroke={element.color} strokeWidth={element.strokeWidth} strokeLinejoin="round" />
              </svg>
            ) : element.symbolType === 'wave' ? (
              <svg className="symbol-visual symbol-wave" viewBox="0 0 240 16" style={{ width: visualWidth, height: visualHeight, transform: visualTransform }} aria-hidden="true">
                <path d="M 0 8 q 6 -5 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0" fill="none" stroke={element.color} strokeWidth={Math.min(element.strokeWidth, 4)} strokeLinecap="round" />
              </svg>
            ) : (
              <span
                className={`symbol-visual symbol-${element.symbolType}`}
                style={{
                  width: visualWidth,
                  height: visualHeight,
                  transform: visualTransform,
                  color: element.color,
                  borderWidth: element.symbolType === 'rectangle' || element.symbolType === 'circle' ? element.strokeWidth : undefined,
                  fontSize: element.symbolType === 'cross' ? 49 * Math.min(element.scaleX ?? element.scale, element.scaleY ?? element.scale) : undefined,
                }}
              >{element.symbolType === 'cross' ? '✕' : ''}</span>
            )}
            {element.locked && <span className="lock-badge" aria-hidden="true">🔒</span>}
          </button>
        )
      })}

      {editor && (
        <input
          className="workspace-text-editor export-hidden"
          style={{ left: editor.x + camera.x, top: editor.y + camera.y }}
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

      {(dropPreview ?? placementPreview) && (() => {
        const preview = dropPreview ?? placementPreview
        if (!preview) return null
        return <div
        className={`drop-placement-preview drop-preview-${preview.kind} export-hidden`}
        style={{
          left: preview.x + camera.x,
          top: preview.y + camera.y,
          width: preview.width,
          height: preview.height,
        }}
        aria-hidden="true"
      >
        {preview.kind === 'symbol' && preview.symbolType === 'triangle' ? (
          <svg className="drop-symbol-preview drop-symbol-triangle" viewBox="0 0 99 66" aria-hidden="true">
            <polygon points="49.5,5 94,61 5,61" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
          </svg>
        ) : preview.kind === 'symbol' && preview.symbolType === 'wave' ? (
          <svg className="drop-symbol-preview drop-symbol-wave" viewBox="0 0 240 16" aria-hidden="true"><path d="M 0 8 q 6 -5 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        ) : preview.kind === 'symbol' && preview.symbolType ? (
          <span className={`drop-symbol-preview drop-symbol-${preview.symbolType}`} aria-hidden="true">
            {preview.symbolType === 'cross' ? '✕' : ''}
          </span>
        ) : <span>{preview.label}</span>}
      </div>
      })()}

      {drawing && (
        <svg
          className="drawing-preview export-hidden"
          style={{
            left: 0,
            top: 0,
            right: 'auto',
            bottom: 'auto',
            width: props.scene.width,
            height: props.scene.height,
            transform: `translate(${camera.x}px, ${camera.y}px)`,
          }}
          aria-hidden="true"
        >
          <>
            <polyline points={drawing.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#244a40" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {props.placementMode === 'arrow' && <polyline points={arrowHeadPoints(drawing.points)} fill="none" stroke="#244a40" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
          </>
        </svg>
      )}

      {curveDraft && curvePreview && (
        <svg className="drawing-preview export-hidden" style={{ left: 0, top: 0, right: 'auto', bottom: 'auto', width: props.scene.width, height: props.scene.height, transform: `translate(${camera.x}px, ${camera.y}px)` }} aria-hidden="true">
          <line x1={curveDraft.start.x} y1={curveDraft.start.y} x2={curveDraft.end.x} y2={curveDraft.end.y} stroke="#72988c" strokeWidth="2" strokeDasharray="6 5" />
          <path d={curvePath([curveDraft.start, curvePreview, curveDraft.end])} fill="none" stroke="#244a40" strokeWidth="4" strokeLinecap="round" />
          <circle cx={curvePreview.x} cy={curvePreview.y} r="5" fill="#fff" stroke="#244a40" strokeWidth="2" />
        </svg>
      )}

      {selectedResizable && (() => {
        const dimensions = getElementDimensions(selectedResizable)
        return <button
          type="button"
          className="element-resize-handle export-hidden"
          aria-label="選択中の要素の大きさを変更"
          style={{ left: selectedResizable.x + camera.x + dimensions.width - 10, top: selectedResizable.y + camera.y + dimensions.height - 10 }}
          onPointerDown={(event) => beginElementResize(event, selectedResizable)}
        />
      })()}

    </div>
  )
})

Workspace.displayName = 'Workspace'
