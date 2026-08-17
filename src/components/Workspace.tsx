import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { TILE_MAP } from '../data/tiles'
import type {
  CanvasElement,
  CanvasPoint,
  CustomShapeTemplate,
  ContextMenuState,
  ElementPosition,
  PlacementMode,
  Scene,
  SymbolType,
  StrokePattern,
  TextElement,
  TextRun,
  DrawingType,
} from '../types'
import {
  getElementDimensions,
  getArrowHeadPoints,
  getCurveControlPoint,
  getSymbolBaseDimensions,
  getTextElementContentDimensions,
  snap,
  SYMBOL_LABELS,
  TILE_GAP,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../utils/layout'
import { readCustomColors, TEXT_COLOR_PALETTE } from '../utils/colors'
import { StrokeLayers, getCssBorderStyle } from '../utils/stroke'
import { applyTextRunStyle, getTextRunStyleAt, normalizeTextRuns, reconcileTextRuns, type TextRunStyle, type TextRunStylePatch } from '../utils/textRuns'

interface EditTextRequest {
  id: string
  token: number
}

interface WorkspaceProps {
  scene: Scene
  showGrid: boolean
  allowTileOverlap: boolean
  placementMode: PlacementMode
  eraserSize: number
  textStyle: { fontFamily: string; fontSize: number; color: string }
  drawingStyle: { color: string; strokeWidth: number; strokePattern: StrokePattern; opacity?: number; arrowHeadSize: number }
  symbolColors: Record<SymbolType, string>
  symbolStrokeWidths: Record<SymbolType, number>
  symbolStrokePatterns: Record<SymbolType, StrokePattern>
  symbolSizes: Record<SymbolType, { width: number; height: number }>
  customShapes: CustomShapeTemplate[]
  draggedCustomShapeId: string | null
  editTextRequest: EditTextRequest | null
  onDropTile: (tileId: string, x: number, y: number) => void
  onDropCustomShape: (id: string, x: number, y: number) => void
  onDropFiles: (files: File[], x: number, y: number) => void
  onDropText: (text: string, x: number, y: number) => void
  onCursorCanvasPoint: (point: CanvasPoint) => void
  onSelectElement: (id: string, additive: boolean) => void
  onSelectRange: (ids: string[], additive: boolean) => void
  onClearSelection: () => void
  onMoveElements: (positions: ElementPosition[]) => void
  onDeleteDragged: (ids: string[]) => void
  onEraseAt: (point: CanvasPoint, radius: number) => void
  onTrashHover: (active: boolean) => void
  onPlaceSymbol: (symbolType: SymbolType, x: number, y: number, returnToSelect?: boolean) => void
  onCommitDrawing: (points: CanvasPoint[], drawingType?: DrawingType) => void
  onCommitText: (text: string, x: number, y: number, id?: string, textRuns?: TextRun[]) => void
  onFinishTextEditing: () => void
  onToggleTileFace: (id: string) => void
  onOpenContextMenu: (state: ContextMenuState) => void
  onResizeElement: (id: string, width: number, height: number) => void
  onCropImage: (id: string, crop: { x: number; y: number; width: number; height: number }, width: number, height: number, x: number, y: number) => void
  captureMode?: boolean
  transparentBackground?: boolean
  showWorkspaceBoundary?: boolean
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
  clearOnClick?: boolean
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
  runs: TextRun[]
  baseStyle: TextRunStyle
}

interface TextSelectionRange {
  start: number
  end: number
}

interface TextFormatMenuState {
  clientX: number
  clientY: number
  start: number
  end: number
  anchor: { left: number; top: number; right: number; bottom: number }
  zoom: number
}

interface DrawingState {
  pointerId: number
  points: CanvasPoint[]
}

interface EraserState {
  pointerId: number
  lastPoint: CanvasPoint
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
  lockAspectRatio: boolean
}

type ImageCropEdge = 'left' | 'right' | 'top' | 'bottom'

interface ImageCropEdgeState {
  pointerId: number
  id: string
  edge: ImageCropEdge
  startClientX: number
  startClientY: number
  width: number
  height: number
  x: number
  y: number
  crop: { x: number; y: number; width: number; height: number }
}

interface PanState {
  pointerId: number
  startClientX: number
  startClientY: number
  startX: number
  startY: number
}

interface DropPreview {
  kind: 'tile' | 'symbol' | 'text' | 'image' | 'customShape'
  symbolType?: SymbolType
  x: number
  y: number
  width: number
  height: number
  label: string
  color?: string
  strokeWidth?: number
  strokePattern?: StrokePattern
  customShape?: CustomShapeTemplate
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

// Matches the desktop density setting in App.css. Pointer positions are reported
// in screen pixels, so convert them back to the workspace's logical pixels.
const getDisplayScale = () => window.matchMedia('(min-width: 651px)').matches
  ? 0.8 * Number.parseFloat(getComputedStyle(document.querySelector('.app-shell') ?? document.documentElement).getPropertyValue('--app-scale')) || 0.88
  : 1
const toLogicalDelta = (value: number) => value / getDisplayScale()
const toCanvasCoordinate = (client: number, edge: number, cameraOffset: number) =>
  toLogicalDelta(client - edge) - cameraOffset

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

const isDrawingPlacementMode = (mode: PlacementMode) => mode === 'draw' || mode === 'line' || mode === 'curve' || mode === 'arrow' || mode === 'marker'

const renderTextRuns = (
  text: string,
  runs: TextRun[] | undefined,
  fallback: TextRunStyle,
  colorOverride?: string,
  selection?: TextSelectionRange,
): ReactNode => {
  const normalized = normalizeTextRuns(text, runs, fallback)
  if (!normalized.length) return text
  if (!selection || selection.start >= selection.end) {
    return normalized.map((run, index) => <span key={`${index}-${run.text}`} style={{ color: colorOverride ?? run.color, fontSize: run.fontSize, fontFamily: run.fontFamily }}>{run.text}</span>)
  }

  const selectedStart = Math.max(0, Math.min(selection.start, text.length))
  const selectedEnd = Math.max(selectedStart, Math.min(selection.end, text.length))
  let offset = 0
  return normalized.flatMap((run, runIndex) => {
    const runStart = offset
    const runEnd = offset + run.text.length
    offset = runEnd
    const boundaries = [runStart, Math.max(runStart, Math.min(selectedStart, runEnd)), Math.max(runStart, Math.min(selectedEnd, runEnd)), runEnd]
      .filter((boundary, index, values) => index === 0 || boundary !== values[index - 1])
    return boundaries.slice(0, -1).map((segmentStart, segmentIndex) => {
      const segmentEnd = boundaries[segmentIndex + 1]
      const selected = segmentStart < selectedEnd && segmentEnd > selectedStart
      return <span
        key={`${runIndex}-${segmentIndex}-${segmentStart}-${segmentEnd}`}
        style={{
          color: selected ? '#082b26' : colorOverride ?? run.color,
          fontSize: run.fontSize,
          fontFamily: run.fontFamily,
          backgroundColor: selected ? '#dcae5e' : undefined,
          borderRadius: selected ? 2 : undefined,
        }}
      >{run.text.slice(segmentStart - runStart, segmentEnd - runStart)}</span>
    })
  })
}

const getTextFormatMenuPosition = (menu: TextFormatMenuState) => {
  const width = 270
  const height = 190
  const gap = 12
  const margin = 8
  const zoom = menu.zoom
  const viewportWidth = window.innerWidth / zoom
  const viewportHeight = window.innerHeight / zoom
  const anchor = {
    left: menu.anchor.left / zoom,
    top: menu.anchor.top / zoom,
    right: menu.anchor.right / zoom,
    bottom: menu.anchor.bottom / zoom,
  }
  const candidates = [
    { left: anchor.right + gap, top: anchor.top },
    { left: anchor.left - width - gap, top: anchor.top },
    { left: anchor.left, top: anchor.bottom + gap },
    { left: anchor.left, top: anchor.top - height - gap },
    { left: menu.clientX / zoom + gap, top: menu.clientY / zoom + gap },
  ]
  const fits = candidates.find(({ left, top }) => left >= margin && top >= margin && left + width <= viewportWidth - margin && top + height <= viewportHeight - margin)
  const position = fits ?? candidates[0]
  return {
    left: Math.max(margin, Math.min(position.left, viewportWidth - width - margin)),
    top: Math.max(margin, Math.min(position.top, viewportHeight - height - margin)),
  }
}

const getCollapsedTextRangeRect = (root: HTMLElement, offset: number): DOMRect | null => {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode() as Text | null
  let lastNode: Text | null = null
  let remaining = Math.max(0, offset)
  while (node) {
    lastNode = node
    if (remaining <= node.data.length) {
      const range = root.ownerDocument.createRange()
      range.setStart(node, remaining)
      range.collapse(true)
      return range.getClientRects()[0] ?? range.getBoundingClientRect()
    }
    remaining -= node.data.length
    node = walker.nextNode() as Text | null
  }
  if (!lastNode) return null
  const range = root.ownerDocument.createRange()
  range.setStart(lastNode, lastNode.data.length)
  range.collapse(true)
  return range.getClientRects()[0] ?? range.getBoundingClientRect()
}

const arrowHeadPoints = (points: CanvasPoint[], size = 30) => {
  return getArrowHeadPoints(points, size).map((point) => `${point.x},${point.y}`).join(' ')
}

/** Near-horizontal and near-vertical lines snap their endpoints to the grid,
 * making clean axes easy without changing ordinary diagonal lines. */
const constrainStraightLine = (start: CanvasPoint, end: CanvasPoint): CanvasPoint[] => {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const axisThreshold = Math.tan(5 * Math.PI / 180)
  const horizontal = Math.abs(deltaY) <= Math.abs(deltaX) * axisThreshold
  const vertical = Math.abs(deltaX) <= Math.abs(deltaY) * axisThreshold
  if (!horizontal && !vertical) return [start, end]

  const snappedStart = { x: snap(start.x, true), y: snap(start.y, true) }
  if (horizontal) return [snappedStart, { x: snap(end.x, true), y: snappedStart.y }]
  return [snappedStart, { x: snappedStart.x, y: snap(end.y, true) }]
}

/** Keep the curve handle perpendicular to its chord: horizontal curves bend
 * vertically, while vertically drawn curves bend along the horizontal axis. */
const constrainCurveApex = (start: CanvasPoint, end: CanvasPoint, point: CanvasPoint): CanvasPoint =>
  Math.abs(end.y - start.y) > Math.abs(end.x - start.x)
    ? { x: point.x, y: (start.y + end.y) / 2 }
    : { x: (start.x + end.x) / 2, y: point.y }

export const Workspace = forwardRef<HTMLDivElement, WorkspaceProps>((props, ref) => {
  const propsRef = useRef(props)
  propsRef.current = props
  const dragRef = useRef<DragState | null>(null)
  const marqueeRef = useRef<MarqueeState | null>(null)
  const drawingRef = useRef<DrawingState | null>(null)
  const eraserRef = useRef<EraserState | null>(null)
  const textEditorRef = useRef<HTMLTextAreaElement>(null)
  const textPreviewRef = useRef<HTMLSpanElement>(null)
  const elementResizeRef = useRef<ElementResizeState | null>(null)
  const imageCropEdgeRef = useRef<ImageCropEdgeState | null>(null)
  const panRef = useRef<PanState | null>(null)
  const spaceDownRef = useRef(false)
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [editor, setEditor] = useState<TextEditorState | null>(null)
  const [textSelection, setTextSelection] = useState<TextSelectionRange | null>(null)
  const [textCaretIndex, setTextCaretIndex] = useState<number | null>(null)
  const [textCaret, setTextCaret] = useState<{ left: number; top: number; height: number } | null>(null)
  const [textFormatMenu, setTextFormatMenu] = useState<TextFormatMenuState | null>(null)
  const [drawing, setDrawing] = useState<DrawingState | null>(null)
  const [curveDraft, setCurveDraft] = useState<CurveDraftState | null>(null)
  const [curvePreview, setCurvePreview] = useState<CanvasPoint | null>(null)
  const [camera, setCamera] = useState({ x: 0, y: 0 })
  const [draggingIds, setDraggingIds] = useState<Set<string>>(() => new Set())
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null)
  const [placementPreview, setPlacementPreview] = useState<DropPreview | null>(null)
  const [customTextColors, setCustomTextColors] = useState(readCustomColors)

  const createTextEditorState = (value: string, x: number, y: number, id?: string, runs?: TextRun[], baseStyle: TextRunStyle = props.textStyle): TextEditorState => ({
    id,
    x,
    y,
    value,
    runs: normalizeTextRuns(value, runs, baseStyle),
    baseStyle,
  })

  const syncTextSelection = (input: HTMLTextAreaElement) => {
    const start = Math.min(input.selectionStart, input.selectionEnd)
    const end = Math.max(input.selectionStart, input.selectionEnd)
    const next = start === end ? null : { start, end }
    setTextCaretIndex(input.selectionEnd)
    setTextSelection((previous) => {
      if (!next && !previous) return previous
      if (next && previous && next.start === previous.start && next.end === previous.end) return previous
      return next
    })
  }

  const restoreTextSelection = (start: number, end: number) => {
    setTextCaretIndex(end)
    setTextSelection({ start, end })
    window.requestAnimationFrame(() => {
      const input = textEditorRef.current
      if (!input) return
      input.focus()
      input.setSelectionRange(start, end)
    })
  }

  // Exporting always starts from the top-left of the logical workspace, not
  // from the user's current panned viewport. Restore the viewport afterwards.
  const cameraBeforeCaptureRef = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    if (props.captureMode) {
      if (!cameraBeforeCaptureRef.current) {
        cameraBeforeCaptureRef.current = camera
        setCamera({ x: 0, y: 0 })
      }
    } else if (cameraBeforeCaptureRef.current) {
      setCamera(cameraBeforeCaptureRef.current)
      cameraBeforeCaptureRef.current = null
    }
  }, [props.captureMode, camera])

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
    const refreshCustomColors = () => setCustomTextColors(readCustomColors())
    window.addEventListener('mahjong-custom-colors-changed', refreshCustomColors)
    return () => window.removeEventListener('mahjong-custom-colors-changed', refreshCustomColors)
  }, [])

  useEffect(() => {
    if (!props.editTextRequest) return
    const item = props.scene.elements.find(
      (element): element is TextElement => element.id === props.editTextRequest?.id && element.kind === 'text',
    )
    if (item && !item.locked) {
      setEditor(createTextEditorState(item.text, item.x, item.y, item.id, item.textRuns, { color: item.color, fontSize: item.fontSize, fontFamily: item.fontFamily }))
      setTextSelection(null)
      setTextCaretIndex(0)
      setTextFormatMenu(null)
    }
  }, [props.editTextRequest, props.scene.elements])

  useEffect(() => {
    if (!editor) return
    const syncActiveSelection = () => {
      const input = textEditorRef.current
      if (!input || document.activeElement !== input) return
      syncTextSelection(input)
    }
    document.addEventListener('selectionchange', syncActiveSelection)
    window.addEventListener('pointerup', syncActiveSelection)
    return () => {
      document.removeEventListener('selectionchange', syncActiveSelection)
      window.removeEventListener('pointerup', syncActiveSelection)
    }
  }, [editor])

  useLayoutEffect(() => {
    if (!editor || textCaretIndex === null || textSelection) {
      setTextCaret(null)
      return
    }
    const preview = textPreviewRef.current
    const canvas = preview?.closest('.workspace-canvas') as HTMLElement | null
    const input = textEditorRef.current
    if (!preview || !canvas || !input) {
      setTextCaret(null)
      return
    }
    const caretRect = getCollapsedTextRangeRect(preview, textCaretIndex) ?? input.getBoundingClientRect()
    const canvasRect = canvas.getBoundingClientRect()
    const scaleX = canvas.offsetWidth > 0 ? canvasRect.width / canvas.offsetWidth : 1
    const scaleY = canvas.offsetHeight > 0 ? canvasRect.height / canvas.offsetHeight : 1
    const next = {
      left: (caretRect.left - canvasRect.left) / scaleX,
      top: (caretRect.top - canvasRect.top) / scaleY,
      height: Math.max(18, caretRect.height / scaleY),
    }
    setTextCaret((previous) => previous
      && Math.abs(previous.left - next.left) < .1
      && Math.abs(previous.top - next.top) < .1
      && Math.abs(previous.height - next.height) < .1
      ? previous
      : next)
  }, [camera, editor, textCaretIndex, textSelection])

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

  const beginSelectedAreaDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const selected = props.scene.elements.filter((element) => element.selected && !element.locked)
    if (!selected.length || selected.every((element) => element.kind === 'tile') || props.placementMode !== 'select') return false
    setDraggingIds(new Set(selected.map((element) => element.id)))
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      primaryId: selected[0].id,
      starts: selected.map((element) => ({ id: element.id, x: element.x, y: element.y })),
      moved: false,
      inTrash: false,
      toggleOnClick: false,
      clearOnClick: true,
    }
    props.onBeginDrag()
    event.currentTarget.setPointerCapture(event.pointerId)
    return true
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
    const rawX = primary.x + toLogicalDelta(clientX - drag.startClientX)
    const rawY = primary.y + toLogicalDelta(clientY - drag.startClientY)
    let targetX = snap(rawX, true)
    let targetY = snap(rawY, true)
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
    const nextPositions = drag.starts.map((item) => ({
      id: item.id,
      x: Math.round(item.x + deltaX),
      y: Math.round(item.y + deltaY),
    }))
    if (!currentProps.allowTileOverlap) {
      const movingIds = new Set(nextPositions.map((position) => position.id))
      const movingTiles = nextPositions.flatMap((position) => {
        const element = currentProps.scene.elements.find((item) => item.id === position.id)
        return element?.kind === 'tile' ? [{ ...position, dimensions: getElementDimensions(element) }] : []
      })
      const overlaps = movingTiles.some((moving) => currentProps.scene.elements.some((element) => {
        if (element.kind !== 'tile' || movingIds.has(element.id)) return false
        const dimensions = getElementDimensions(element)
        return moving.x < element.x + dimensions.width
          && moving.x + moving.dimensions.width > element.x
          && moving.y < element.y + dimensions.height
          && moving.y + moving.dimensions.height > element.y
      }))
      if (overlaps) return
    }
    currentProps.onMoveElements(nextPositions)
  }, [])

  const endElementDrag = useCallback((clientX: number, clientY: number) => {
    const currentProps = propsRef.current
    const drag = dragRef.current
    if (!drag) return
    const droppedInTrash = drag.moved && (drag.inTrash || isPalettePoint(clientX, clientY))
    if (droppedInTrash) currentProps.onMoveElements(drag.starts)
    if (!drag.moved && drag.toggleOnClick) currentProps.onSelectElement(drag.primaryId, false)
    if (!drag.moved && drag.clearOnClick) currentProps.onClearSelection()
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
    if (event.button !== 0 || (element.kind !== 'symbol' && element.kind !== 'image' && element.kind !== 'drawing' && element.kind !== 'customShape') || element.locked) return
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
      // Pasted images should never be stretched by the resize handle.
      lockAspectRatio: element.kind === 'image' || element.kind === 'customShape',
    }
    props.onBeginDrag()
  }

  useEffect(() => {
    const moveElementResize = (event: PointerEvent) => {
      const resize = elementResizeRef.current
      if (!resize || resize.pointerId !== event.pointerId) return
      const deltaX = toLogicalDelta(event.clientX - resize.startClientX)
      const deltaY = toLogicalDelta(event.clientY - resize.startClientY)
      let width = Math.max(resize.startWidth + deltaX, 24)
      let height = Math.max(resize.startHeight + deltaY, 24)
      if (resize.lockAspectRatio || event.shiftKey) {
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

  const beginImageCropEdge = (event: ReactPointerEvent<HTMLButtonElement>, element: Extract<CanvasElement, { kind: 'image' }>, edge: ImageCropEdge) => {
    if (event.button !== 0 || element.locked || props.placementMode !== 'select') return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    imageCropEdgeRef.current = { pointerId: event.pointerId, id: element.id, edge, startClientX: event.clientX, startClientY: event.clientY, width: element.width, height: element.height, x: element.x, y: element.y, crop: element.crop ?? { x: 0, y: 0, width: 1, height: 1 } }
    props.onBeginDrag()
  }

  useEffect(() => {
    const updateCropEdge = (event: PointerEvent) => {
      const state = imageCropEdgeRef.current
      if (!state || state.pointerId !== event.pointerId) return
      const minSize = 24
      const delta = state.edge === 'left' || state.edge === 'right'
        ? toLogicalDelta(event.clientX - state.startClientX)
        : toLogicalDelta(event.clientY - state.startClientY)
      const inset = state.edge === 'left' || state.edge === 'top'
        ? Math.max(0, Math.min((state.edge === 'left' ? state.width : state.height) - minSize, delta))
        : Math.max(0, Math.min((state.edge === 'right' ? state.width : state.height) - minSize, -delta))
      const horizontal = state.edge === 'left' || state.edge === 'right'
      const nextWidth = horizontal ? state.width - inset : state.width
      const nextHeight = horizontal ? state.height : state.height - inset
      const nextX = state.x + (state.edge === 'left' ? inset : 0)
      const nextY = state.y + (state.edge === 'top' ? inset : 0)
      const cropInset = horizontal ? inset / state.width * state.crop.width : inset / state.height * state.crop.height
      propsRef.current.onCropImage(state.id, {
        x: state.crop.x + (state.edge === 'left' ? cropInset : 0),
        y: state.crop.y + (state.edge === 'top' ? cropInset : 0),
        width: horizontal ? state.crop.width - cropInset : state.crop.width,
        height: horizontal ? state.crop.height : state.crop.height - cropInset,
      }, nextWidth, nextHeight, nextX, nextY)
    }
    const finishCropEdge = (event: PointerEvent) => {
      const state = imageCropEdgeRef.current
      if (!state || state.pointerId !== event.pointerId) return
      imageCropEdgeRef.current = null
      propsRef.current.onEndDrag()
    }
    window.addEventListener('pointermove', updateCropEdge)
    window.addEventListener('pointerup', finishCropEdge)
    window.addEventListener('pointercancel', finishCropEdge)
    return () => {
      window.removeEventListener('pointermove', updateCropEdge)
      window.removeEventListener('pointerup', finishCropEdge)
      window.removeEventListener('pointercancel', finishCropEdge)
    }
  }, [])

  const canvasPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: toCanvasCoordinate(event.clientX, bounds.left, camera.x),
      y: toCanvasCoordinate(event.clientY, bounds.top, camera.y),
    }
  }

  const updatePlacementPreview = (point: CanvasPoint) => {
    const mode = props.placementMode
    // Text uses the editor itself as its preview.  Avoid showing a second,
    // misleading blue placeholder before the user clicks.
    if (mode === 'text') {
      setPlacementPreview(null)
      return
    }
    if (mode === 'rectangle' || mode === 'circle' || mode === 'triangle' || mode === 'cross' || mode === 'wave') {
      const dimensions = props.symbolSizes[mode]
      setPlacementPreview({
        kind: 'symbol',
        symbolType: mode,
        x: point.x - dimensions.width / 2,
        y: point.y - dimensions.height / 2,
        width: dimensions.width,
        height: dimensions.height,
        label: SYMBOL_LABELS[mode],
        color: props.symbolColors[mode],
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
    if (props.placementMode === 'eraser') {
      const point = canvasPoint(event)
      eraserRef.current = { pointerId: event.pointerId, lastPoint: point }
      props.onBeginDrag()
      props.onEraseAt(point, props.eraserSize / 2)
      props.onClearSelection()
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if (props.placementMode === 'curve' && curveDraft) {
      const apex = constrainCurveApex(curveDraft.start, curveDraft.end, canvasPoint(event))
      props.onCommitDrawing([curveDraft.start, apex, curveDraft.end], 'curve')
      setCurveDraft(null)
      setCurvePreview(null)
      return
    }
    if (isDrawingPlacementMode(props.placementMode)) {
      const point = canvasPoint(event)
      const state = { pointerId: event.pointerId, points: [point] }
      drawingRef.current = state
      setDrawing(state)
      props.onClearSelection()
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if (event.target !== event.currentTarget) return
    if (beginSelectedAreaDrag(event)) return
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
    props.onCursorCanvasPoint(canvasPoint(event))
    const pan = panRef.current
    if (pan?.pointerId === event.pointerId) {
      setCamera({ x: pan.startX + toLogicalDelta(event.clientX - pan.startClientX), y: pan.startY + toLogicalDelta(event.clientY - pan.startClientY) })
      return
    }
    const activeDrawing = drawingRef.current
    if (activeDrawing?.pointerId === event.pointerId) {
      const point = canvasPoint(event)
      const previous = activeDrawing.points.at(-1)
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 2) {
        const next = {
          ...activeDrawing,
          points: props.placementMode === 'line' || props.placementMode === 'curve' || props.placementMode === 'arrow'
            ? constrainStraightLine(activeDrawing.points[0], point)
            : [...activeDrawing.points, point],
        }
        drawingRef.current = next
        setDrawing(next)
      }
      return
    }
    const eraser = eraserRef.current
    if (eraser?.pointerId === event.pointerId) {
      const point = canvasPoint(event)
      if (Math.hypot(point.x - eraser.lastPoint.x, point.y - eraser.lastPoint.y) >= 2) {
        eraser.lastPoint = point
        props.onEraseAt(point, props.eraserSize / 2)
      }
      return
    }
    if (curveDraft) {
      setCurvePreview(constrainCurveApex(curveDraft.start, curveDraft.end, canvasPoint(event)))
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
      const point = canvasPoint(event)
      const points = props.placementMode === 'line' || props.placementMode === 'curve' || props.placementMode === 'arrow'
        ? constrainStraightLine(activeDrawing.points[0], point)
        : [...activeDrawing.points, point]
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
        props.onCommitDrawing(points, props.placementMode === 'line' ? 'line' : props.placementMode === 'curve' ? 'curve' : props.placementMode === 'arrow' ? 'arrow' : props.placementMode === 'marker' ? 'marker' : 'freehand')
      }
      return
    }
    if (eraserRef.current?.pointerId === event.pointerId) {
      eraserRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      props.onEndDrag()
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
      setTextSelection(null)
      setTextCaretIndex(0)
      setEditor(createTextEditorState('', state.startX, state.startY))
    } else if (props.placementMode !== 'select' && !isDrawingPlacementMode(props.placementMode) && props.placementMode !== 'eraser') {
      props.onPlaceSymbol(props.placementMode, state.startX, state.startY)
    } else {
      props.onClearSelection()
    }
  }

  const openTextFormatMenu = (event: ReactMouseEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget
    const start = Math.min(textarea.selectionStart, textarea.selectionEnd)
    const end = Math.max(textarea.selectionStart, textarea.selectionEnd)
    event.preventDefault()
    event.stopPropagation()
    if (!editor || start === end) {
      setTextCaretIndex(end)
      setTextSelection(null)
      setTextFormatMenu(null)
      return
    }
    setTextSelection({ start, end })
    const bounds = textarea.getBoundingClientRect()
    const appShell = textarea.closest('.app-shell')
    const parsedZoom = appShell ? Number.parseFloat(getComputedStyle(appShell).zoom) : 1
    const zoom = Number.isFinite(parsedZoom) && parsedZoom > 0 ? parsedZoom : 1
    setTextFormatMenu({
      clientX: event.clientX,
      clientY: event.clientY,
      start,
      end,
      anchor: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
      zoom,
    })
  }

  const applyTextFormat = (style: TextRunStylePatch) => {
    if (!editor || !textFormatMenu) return
    const { start, end } = textFormatMenu
    const runs = applyTextRunStyle(editor.value, editor.runs, start, end, style, editor.baseStyle)
    setEditor({ ...editor, runs })
    restoreTextSelection(start, end)
  }

  const finishTextEditor = (cancelled = false) => {
    if (!editor) return
    const text = editor.value.trim()
    if (!cancelled && text) props.onCommitText(text, editor.x, editor.y, editor.id, normalizeTextRuns(text, editor.runs, editor.baseStyle))
    setEditor(null)
    setTextSelection(null)
    setTextCaretIndex(null)
    setTextCaret(null)
    setTextFormatMenu(null)
    props.onFinishTextEditing()
  }

  const openContextMenu = (event: React.MouseEvent<HTMLButtonElement>, element: CanvasElement) => {
    event.preventDefault()
    event.stopPropagation()
    const canvas = event.currentTarget.closest('.workspace-canvas')?.getBoundingClientRect()
    if (!canvas) return
    props.onOpenContextMenu({
      elementId: element.id,
      clientX: toLogicalDelta(event.clientX),
      clientY: toLogicalDelta(event.clientY),
      canvasX: toCanvasCoordinate(event.clientX, canvas.left, camera.x),
      canvasY: toCanvasCoordinate(event.clientY, canvas.top, camera.y),
    })
  }

  const openWorkspaceContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    const canvas = event.currentTarget.getBoundingClientRect()
    props.onOpenContextMenu({
      elementId: null,
      clientX: toLogicalDelta(event.clientX),
      clientY: toLogicalDelta(event.clientY),
      canvasX: toCanvasCoordinate(event.clientX, canvas.left, camera.x),
      canvasY: toCanvasCoordinate(event.clientY, canvas.top, camera.y),
    })
  }

  const updateDropPreview = (event: ReactDragEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = toCanvasCoordinate(event.clientX, bounds.left, camera.x)
    const y = toCanvasCoordinate(event.clientY, bounds.top, camera.y)
    const symbolType = event.dataTransfer.getData('application/x-mahjong-symbol')
    if (symbolType === 'rectangle' || symbolType === 'circle' || symbolType === 'triangle' || symbolType === 'cross' || symbolType === 'wave') {
      const dimensions = props.symbolSizes[symbolType]
      setDropPreview({
        kind: 'symbol',
        x: x - dimensions.width / 2,
        y: y - dimensions.height / 2,
        width: dimensions.width,
        height: dimensions.height,
        label: SYMBOL_LABELS[symbolType],
        symbolType,
        color: props.symbolColors[symbolType],
        strokeWidth: props.symbolStrokeWidths[symbolType],
        strokePattern: props.symbolStrokePatterns[symbolType],
      })
      return
    }
    if (event.dataTransfer.types.includes('application/x-mahjong-tile')) {
      setDropPreview({ kind: 'tile', x: x - TILE_WIDTH / 2, y: y - TILE_HEIGHT / 2, width: TILE_WIDTH, height: TILE_HEIGHT, label: '牌' })
      return
    }
    const customShapeId = event.dataTransfer.getData('application/x-mahjong-custom-shape') || props.draggedCustomShapeId
    const customShape = props.customShapes.find((shape) => shape.id === customShapeId)
    if (customShape) {
      const width = Math.max(...customShape.elements.map((element) => element.x + getElementDimensions(element).width))
      const height = Math.max(...customShape.elements.map((element) => element.y + getElementDimensions(element).height))
      setDropPreview({ kind: 'customShape', x: x - width / 2, y: y - height / 2, width, height, label: customShape.name, color: customShape.color ?? '#244a40', customShape })
      return
    }
    if (event.dataTransfer.types.includes('Files')) {
      setDropPreview({ kind: 'image', x: x - 80, y: y - 55, width: 160, height: 110, label: '画像' })
      return
    }
    if (event.dataTransfer.types.includes('text/plain') && !event.dataTransfer.types.includes('application/x-mahjong-symbol')) {
      setDropPreview({ kind: 'text', x: x - 70, y: y - 20, width: 140, height: 40, label: '文字' })
    }
  }

  const marqueeStyle = marquee ? {
    left: Math.min(marquee.startX, marquee.currentX) + camera.x,
    top: Math.min(marquee.startY, marquee.currentY) + camera.y,
    width: Math.abs(marquee.currentX - marquee.startX),
    height: Math.abs(marquee.currentY - marquee.startY),
  } : undefined
  const selectedResizable = props.scene.elements.find((element) => (element.kind === 'symbol' || element.kind === 'image' || element.kind === 'customShape' || (element.kind === 'drawing' && element.drawingType !== 'freehand')) && element.selected && !element.locked) ?? null
  const selectedImage = props.scene.elements.find((element): element is Extract<CanvasElement, { kind: 'image' }> => element.kind === 'image' && element.selected && !element.locked) ?? null

  return (
    <div
      ref={ref}
      className={`workspace-canvas${props.showGrid ? ' show-grid' : ''}${props.captureMode ? ' capture-hide-grid is-capturing' : ''}${props.transparentBackground ? ' capture-transparent' : ''}${isDrawingPlacementMode(props.placementMode) ? ' drawing-mode' : ''}${props.placementMode === 'eraser' ? ' eraser-mode' : ''}`}
      style={{ width: props.scene.width, height: props.scene.height }}
      onPointerDownCapture={(event) => {
        if (!editor) return
        const target = event.target
        if (target instanceof Element && target.closest('.workspace-text-editor, .text-format-context-menu')) return
        finishTextEditor()
      }}
      onPointerDown={beginCanvasPointer}
      onPointerMove={moveCanvasPointer}
      onPointerUp={finishCanvasPointer}
      onPointerCancel={finishCanvasPointer}
      onPointerLeave={() => setPlacementPreview(null)}
      onDoubleClick={(event) => {
        if (event.target !== event.currentTarget || props.placementMode !== 'select') return
        const bounds = event.currentTarget.getBoundingClientRect()
        const point = {
          x: toCanvasCoordinate(event.clientX, bounds.left, camera.x),
          y: toCanvasCoordinate(event.clientY, bounds.top, camera.y),
        }
        setTextSelection(null)
        setTextCaretIndex(0)
        setEditor(createTextEditorState('', point.x, point.y))
      }}
      onDragEnter={updateDropPreview}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('application/x-mahjong-tile') || event.dataTransfer.types.includes('application/x-mahjong-symbol') || event.dataTransfer.types.includes('application/x-mahjong-custom-shape') || event.dataTransfer.types.includes('Files') || event.dataTransfer.types.includes('text/plain')) {
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
        const x = toCanvasCoordinate(event.clientX, bounds.left, camera.x)
        const y = toCanvasCoordinate(event.clientY, bounds.top, camera.y)
        if (TILE_MAP.has(tileId)) {
          props.onDropTile(tileId, x - TILE_WIDTH / 2, y - TILE_HEIGHT / 2)
          return
        }
        const customShapeId = event.dataTransfer.getData('application/x-mahjong-custom-shape')
        if (customShapeId) {
          props.onDropCustomShape(customShapeId, x, y)
          return
        }
        const symbolType = event.dataTransfer.getData('application/x-mahjong-symbol')
        if (symbolType === 'rectangle' || symbolType === 'circle' || symbolType === 'triangle' || symbolType === 'cross' || symbolType === 'wave') {
          props.onPlaceSymbol(symbolType, x, y, true)
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
      {props.showWorkspaceBoundary && <div className="workspace-boundary export-hidden" style={{ left: camera.x, top: camera.y, width: props.scene.width, height: props.scene.height }} aria-hidden="true" />}
      {props.scene.elements.length === 0 && !editor && (
        <div className="empty-canvas" aria-hidden="true">
          <div className="empty-tile-stack"><span>東</span><span>一</span><span>●</span></div>
          <p><strong>ここに牌姿を作ります</strong><span>牌一覧からクリック、またはドラッグして追加</span></p>
        </div>
      )}

      {props.scene.elements.map((element) => {
        const editingText = element.kind === 'text' && editor?.id === element.id
          ? { ...element, text: editor.value, textRuns: editor.runs }
          : null
        const dimensions = getElementDimensions(editingText ?? element)
        const lockedLabel = element.locked ? '、ロック中' : ''
        const commonProps = {
          type: 'button' as const,
          className: `placed-item placed-${element.kind}${element.selected ? ' selected' : ''}${draggingIds.has(element.id) ? ' dragging' : ''}${element.locked ? ' locked' : ''}`,
          style: {
            left: element.x + camera.x,
            top: element.y + camera.y,
            // Annotation elements are always drawn above tiles; their own
            // z-index still controls overlap order between annotations.
            zIndex: element.kind === 'image'
              ? Math.max(1, element.zIndex)
              : element.kind === 'tile'
                ? 100000 + element.zIndex
                : 200000 + element.zIndex,
            width: dimensions.width,
            height: dimensions.height,
          },
          onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
            if (props.placementMode === 'eraser') {
              event.preventDefault()
              event.stopPropagation()
              if (!element.locked) props.onDeleteDragged([element.id])
              return
            }
            if (!isDrawingPlacementMode(props.placementMode)) beginElementDrag(event, element)
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
          const { width: baseWidth, height: baseHeight } = getTextElementContentDimensions(editingText ?? element)
          return (
            <button
              key={element.id}
              {...commonProps}
              className={`${commonProps.className}${editor?.id === element.id ? ' editing' : ''}`}
              onDoubleClick={() => {
                if (element.locked) return
                setTextSelection(null)
                setTextCaretIndex(0)
                setEditor(createTextEditorState(element.text, element.x, element.y, element.id, element.textRuns, { color: element.color, fontSize: element.fontSize, fontFamily: element.fontFamily }))
              }}
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
                  transform: `rotate(${element.rotation}deg)`,
                  transformOrigin: 'top left',
                }}
              >{renderTextRuns(element.text, element.textRuns, { color: element.color, fontSize: element.fontSize, fontFamily: element.fontFamily })}</span>
              {element.locked && <span className="lock-badge" aria-hidden="true">🔒</span>}
            </button>
          )
        }

        if (element.kind === 'image') {
          const crop = element.crop ?? { x: 0, y: 0, width: 1, height: 1 }
          return (
            <button key={element.id} {...commonProps} aria-label={`画像「${element.name}」${element.selected ? '、選択中' : ''}${lockedLabel}`}>
              <span className="image-crop-frame" style={{ width: element.width, height: element.height, opacity: element.opacity, transform: `translate(-50%, -50%) rotate(${element.rotation}deg)` }}>
                <img className="image-crop-source" src={element.src} alt="" draggable={false} style={{ width: `${100 / crop.width}%`, height: `${100 / crop.height}%`, left: `${-crop.x / crop.width * 100}%`, top: `${-crop.y / crop.height * 100}%` }} />
              </span>
              {element.locked && <span className="lock-badge" aria-hidden="true">🔒</span>}
            </button>
          )
        }

        if (element.kind === 'customShape') {
          // width/height are the current, user-resized dimensions.  The
          // saved parts retain their original coordinates, so derive the
          // natural bounds from them before scaling the fixed group.
          const naturalWidth = Math.max(...element.elements.map((part) => part.x + getElementDimensions(part).width))
          const naturalHeight = Math.max(...element.elements.map((part) => part.y + getElementDimensions(part).height))
          const scaleX = element.width / naturalWidth
          const scaleY = element.height / naturalHeight
          return <button key={element.id} {...commonProps} aria-label={`マイ図形「${element.name}」${element.selected ? '、選択中' : ''}${lockedLabel}`}>
            <span className="custom-shape-visual" style={{ width: naturalWidth, height: naturalHeight, transform: `scale(${scaleX}, ${scaleY}) rotate(${element.rotation}deg)` }}>
              {element.elements.map((part) => {
                const partDimensions = getElementDimensions(part)
                const color = element.color ?? (part.kind === 'image' ? undefined : part.color)
                if (part.kind === 'text') return <span key={part.id} className="custom-shape-part custom-shape-text" style={{ left: part.x, top: part.y, width: partDimensions.width, height: partDimensions.height, color, fontSize: part.fontSize, fontFamily: part.fontFamily, transform: `rotate(${part.rotation}deg)` }}>{renderTextRuns(part.text, part.textRuns, { color: part.color, fontSize: part.fontSize, fontFamily: part.fontFamily }, color)}</span>
                if (part.kind === 'image') return <span key={part.id} className="custom-shape-part custom-shape-image" style={{ left: part.x, top: part.y, width: part.width, height: part.height, opacity: part.opacity, transform: `rotate(${part.rotation}deg)` }}><img src={part.src} alt="" draggable={false} /></span>
                if (part.kind === 'drawing') return <svg key={part.id} className="custom-shape-part" viewBox={`0 0 ${part.width} ${part.height}`} style={{ left: part.x, top: part.y, width: part.width, height: part.height, transform: `rotate(${part.rotation}deg)` }}><StrokeLayers pattern={part.strokePattern} strokeWidth={part.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <polyline points={part.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" strokeLinejoin="round" transform={transform} />}</StrokeLayers></svg>
                const base = getSymbolBaseDimensions(part.symbolType); const width = base.width * (part.scaleX ?? part.scale); const height = base.height * (part.scaleY ?? part.scale); const style = { left: part.x, top: part.y, width, height, transform: `rotate(${part.rotation}deg)` }
                if (part.symbolType === 'cross') return <svg key={part.id} className="custom-shape-part" viewBox="0 0 48 66" style={style}><StrokeLayers pattern={part.strokePattern} strokeWidth={part.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <path d="M 7 7 L 41 59 M 41 7 L 7 59" fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" transform={transform} />}</StrokeLayers></svg>
                if (part.symbolType === 'triangle') return <svg key={part.id} className="custom-shape-part" viewBox="0 0 99 66" style={style}><StrokeLayers pattern={part.strokePattern} strokeWidth={part.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <polygon points="49.5,5 94,61 5,61" fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinejoin="round" transform={transform} />}</StrokeLayers></svg>
                if (part.symbolType === 'wave') return <svg key={part.id} className="custom-shape-part" viewBox="0 0 240 16" style={style}><StrokeLayers pattern={part.strokePattern} strokeWidth={part.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <path d="M 0 8 q 6 -5 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0" fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" transform={transform} />}</StrokeLayers></svg>
                if (part.symbolType === 'circle') return <svg key={part.id} className="custom-shape-part" viewBox={`0 0 ${width} ${height}`} style={style}><StrokeLayers pattern={part.strokePattern} strokeWidth={part.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <ellipse cx={width / 2} cy={height / 2} rx={Math.max(1, width / 2 - part.strokeWidth / 2)} ry={Math.max(1, height / 2 - part.strokeWidth / 2)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} transform={transform} />}</StrokeLayers></svg>
                return <span key={part.id} className={`custom-shape-part custom-shape-symbol custom-shape-${part.symbolType}`} style={{ ...style, color, borderWidth: part.strokeWidth, borderStyle: getCssBorderStyle(part.strokePattern) }} />
              })}
            </span>
            {element.locked && <span className="lock-badge" aria-hidden="true">🔒</span>}
          </button>
        }

        if (element.kind === 'drawing') {
          const drawingOpacity = element.drawingType === 'marker' ? element.opacity ?? 0.42 : 1
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
                  <StrokeLayers pattern={element.strokePattern} strokeWidth={element.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <path d={curvePath(element.points)} fill="none" stroke={element.color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" opacity={drawingOpacity} transform={transform} />}</StrokeLayers>
                </> : <>
                  {element.selected && <polyline points={element.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#277fbd" strokeWidth={element.strokeWidth + 4} strokeLinecap="round" strokeLinejoin="round" opacity=".7" />}
                  <StrokeLayers pattern={element.strokePattern} strokeWidth={element.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <polyline points={element.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={element.color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" strokeLinejoin="round" opacity={drawingOpacity} transform={transform} />}</StrokeLayers>
                  {element.drawingType === 'arrow' && <>
                    {element.selected && <polyline points={arrowHeadPoints(element.points, element.arrowHeadSize)} fill="none" stroke="#277fbd" strokeWidth={element.strokeWidth + 4} strokeLinecap="round" strokeLinejoin="round" opacity=".7" />}
                    <StrokeLayers pattern={element.strokePattern} strokeWidth={element.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <polyline points={arrowHeadPoints(element.points, element.arrowHeadSize)} fill="none" stroke={element.color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" strokeLinejoin="round" opacity={drawingOpacity} transform={transform} />}</StrokeLayers>
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
            {element.symbolType === 'cross' ? (
              <svg className="symbol-visual symbol-cross" viewBox="0 0 48 66" style={{ width: visualWidth, height: visualHeight, transform: visualTransform }} aria-hidden="true">
                <StrokeLayers pattern={element.strokePattern} strokeWidth={element.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <path d="M 7 7 L 41 59 M 41 7 L 7 59" fill="none" stroke={element.color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" transform={transform} />}</StrokeLayers>
              </svg>
            ) : element.symbolType === 'triangle' ? (
              <svg
                className="symbol-visual symbol-triangle"
                viewBox="0 0 99 66"
                style={{ width: visualWidth, height: visualHeight, transform: visualTransform }}
                aria-hidden="true"
              >
                <StrokeLayers pattern={element.strokePattern} strokeWidth={element.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <polygon points="49.5,5 94,61 5,61" fill="none" stroke={element.color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinejoin="round" transform={transform} />}</StrokeLayers>
              </svg>
            ) : element.symbolType === 'wave' ? (
              <svg className="symbol-visual symbol-wave" viewBox="0 0 240 16" style={{ width: visualWidth, height: visualHeight, transform: visualTransform }} aria-hidden="true">
                <StrokeLayers pattern={element.strokePattern} strokeWidth={element.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <path d="M 0 8 q 6 -5 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0" fill="none" stroke={element.color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" transform={transform} />}</StrokeLayers>
              </svg>
            ) : element.symbolType === 'circle' ? (
              <svg className="symbol-visual" viewBox={`0 0 ${visualWidth} ${visualHeight}`} style={{ width: visualWidth, height: visualHeight, transform: visualTransform }} aria-hidden="true">
                <StrokeLayers pattern={element.strokePattern} strokeWidth={element.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <ellipse cx={visualWidth / 2} cy={visualHeight / 2} rx={Math.max(1, visualWidth / 2 - element.strokeWidth / 2)} ry={Math.max(1, visualHeight / 2 - element.strokeWidth / 2)} fill="none" stroke={element.color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} transform={transform} />}</StrokeLayers>
              </svg>
            ) : (
              <span
                className={`symbol-visual symbol-${element.symbolType}`}
                style={{
                  width: visualWidth,
                  height: visualHeight,
                  transform: visualTransform,
                  color: element.color,
                  borderWidth: element.strokeWidth,
                  borderStyle: getCssBorderStyle(element.strokePattern),
                }}
              />
            )}
            {element.locked && <span className="lock-badge" aria-hidden="true">🔒</span>}
          </button>
        )
      })}

      {editor && (
        <textarea
          ref={textEditorRef}
          className="workspace-text-editor export-hidden"
          style={{
            left: editor.x + camera.x,
            top: editor.y + camera.y,
            color: editor.value ? 'transparent' : editor.baseStyle.color,
            WebkitTextFillColor: editor.value ? 'transparent' : editor.baseStyle.color,
            fontSize: editor.baseStyle.fontSize,
            fontFamily: editor.baseStyle.fontFamily,
            caretColor: 'transparent',
          }}
          value={editor.value}
          rows={Math.max(1, editor.value.split('\n').length)}
          autoFocus
          aria-label="文字を入力"
          onPointerDown={(event) => {
            event.stopPropagation()
            window.requestAnimationFrame(() => syncTextSelection(event.currentTarget))
          }}
          onPointerMove={(event) => {
            if (event.buttons & 1) syncTextSelection(event.currentTarget)
          }}
          onContextMenu={openTextFormatMenu}
          onSelect={(event) => {
            syncTextSelection(event.currentTarget)
          }}
          onChange={(event) => {
            const start = Math.min(event.currentTarget.selectionStart, event.currentTarget.selectionEnd)
            const end = Math.max(event.currentTarget.selectionStart, event.currentTarget.selectionEnd)
            setTextSelection(start === end ? null : { start, end })
            setEditor({ ...editor, value: event.target.value, runs: reconcileTextRuns(editor.value, event.target.value, editor.runs, editor.baseStyle) })
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              event.currentTarget.blur()
            }
            if (event.key === 'Escape') finishTextEditor(true)
          }}
          onBlur={(event) => {
            const nextTarget = event.relatedTarget
            if (nextTarget instanceof HTMLElement && nextTarget.closest('.text-format-context-menu')) return
            finishTextEditor()
          }}
        />
      )}

      {editor && editor.value && (() => {
        const previewFontSize = Math.max(editor.baseStyle.fontSize, ...(editor.runs.map((run) => run.fontSize)))
        return <span
          ref={textPreviewRef}
          className="workspace-text-editor-preview export-hidden"
          style={{ left: editor.x + camera.x, top: editor.y + camera.y, fontSize: previewFontSize, fontFamily: editor.baseStyle.fontFamily }}
          aria-hidden="true"
        >{renderTextRuns(editor.value, editor.runs, editor.baseStyle, undefined, textSelection ?? undefined)}</span>
      })()}

      {editor && !editor.value && <span ref={textPreviewRef} className="workspace-text-editor-preview export-hidden" style={{ left: editor.x + camera.x, top: editor.y + camera.y, fontSize: editor.baseStyle.fontSize, fontFamily: editor.baseStyle.fontFamily }} aria-hidden="true" />}
      {editor && !textSelection && textCaret && (() => {
        const caretIndex = Math.max(0, Math.min(editor.value.length - 1, textCaretIndex ?? 0))
        const caretStyle = getTextRunStyleAt(editor.value, editor.runs, caretIndex, editor.baseStyle)
        return <span className="workspace-text-editor-caret export-hidden" style={{ left: textCaret.left, top: textCaret.top, height: textCaret.height, backgroundColor: caretStyle.color }} aria-hidden="true" />
      })()}

      {editor && textFormatMenu && (() => {
        const selectedStyle = getTextRunStyleAt(editor.value, editor.runs, textFormatMenu.start, editor.baseStyle)
        const colorChoices = Array.from(new Set([...TEXT_COLOR_PALETTE, ...customTextColors]))
        const menuPosition = getTextFormatMenuPosition(textFormatMenu)
        return <div
          className="text-format-context-menu export-hidden"
          style={menuPosition}
          onPointerDown={(event) => {
            event.stopPropagation()
            if (event.target instanceof HTMLButtonElement) event.preventDefault()
          }}
          onContextMenu={(event) => event.preventDefault()}
          role="menu"
          aria-label="選択文字の書式"
        >
          <strong>選択部分を編集</strong>
          <div className="text-format-context-row">
            <button type="button" onClick={() => applyTextFormat({ fontSize: Math.max(12, selectedStyle.fontSize - 2) })} aria-label="文字を小さく">A−</button>
            <output>{selectedStyle.fontSize}px</output>
            <button type="button" onClick={() => applyTextFormat({ fontSize: Math.min(72, selectedStyle.fontSize + 2) })} aria-label="文字を大きく">A+</button>
            <select value={selectedStyle.fontFamily} onChange={(event) => applyTextFormat({ fontFamily: event.target.value })} aria-label="フォント">
              <option value="sans-serif">ゴシック体</option>
              <option value="serif">明朝体</option>
              <option value="cursive">手書き風</option>
              <option value="monospace">等幅</option>
            </select>
          </div>
          <div className="text-format-context-colors" aria-label="文字色">
            {colorChoices.map((color) => <button key={color} type="button" style={{ backgroundColor: color }} className={selectedStyle.color.toLowerCase() === color.toLowerCase() ? 'active' : ''} onClick={() => applyTextFormat({ color })} aria-label={`${color}に変更`} />)}
            <label className="text-format-custom-color" title="その他の色"><input type="color" value={selectedStyle.color} onChange={(event) => applyTextFormat({ color: event.target.value })} aria-label="その他の文字色" />＋</label>
          </div>
        </div>
      })()}

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
          color: preview.color,
        }}
        aria-hidden="true"
      >
      {preview.kind === 'customShape' && preview.customShape ? <span className="custom-shape-drop-content">
        {preview.customShape.elements.filter((part) => part.kind !== 'tile' && part.kind !== 'customShape').map((part) => {
          const dimensions = getElementDimensions(part)
          const color = preview.color ?? (part.kind === 'image' ? undefined : part.color)
          if (part.kind === 'text') return <span key={part.id} className="custom-shape-part custom-shape-text" style={{ left: part.x, top: part.y, width: dimensions.width, height: dimensions.height, color, fontSize: part.fontSize, fontFamily: part.fontFamily, transform: `rotate(${part.rotation}deg)` }}>{renderTextRuns(part.text, part.textRuns, { color: part.color, fontSize: part.fontSize, fontFamily: part.fontFamily }, color)}</span>
          if (part.kind === 'image') return <span key={part.id} className="custom-shape-part custom-shape-image" style={{ left: part.x, top: part.y, width: part.width, height: part.height, opacity: part.opacity, transform: `rotate(${part.rotation}deg)` }}><img src={part.src} alt="" /></span>
          if (part.kind === 'drawing') return <svg key={part.id} className="custom-shape-part" viewBox={`0 0 ${part.width} ${part.height}`} style={{ left: part.x, top: part.y, width: part.width, height: part.height, transform: `rotate(${part.rotation}deg)` }}><StrokeLayers pattern={part.strokePattern} strokeWidth={part.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <polyline points={part.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" strokeLinejoin="round" transform={transform} />}</StrokeLayers></svg>
          const base = getSymbolBaseDimensions(part.symbolType); const width = base.width * (part.scaleX ?? part.scale); const height = base.height * (part.scaleY ?? part.scale); const style = { left: part.x, top: part.y, width, height, transform: `rotate(${part.rotation}deg)` }
          if (part.symbolType === 'cross') return <svg key={part.id} className="custom-shape-part" viewBox="0 0 48 66" style={style}><StrokeLayers pattern={part.strokePattern} strokeWidth={part.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <path d="M 7 7 L 41 59 M 41 7 L 7 59" fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" transform={transform} />}</StrokeLayers></svg>
          if (part.symbolType === 'triangle') return <svg key={part.id} className="custom-shape-part" viewBox="0 0 99 66" style={style}><StrokeLayers pattern={part.strokePattern} strokeWidth={part.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <polygon points="49.5,5 94,61 5,61" fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinejoin="round" transform={transform} />}</StrokeLayers></svg>
          if (part.symbolType === 'wave') return <svg key={part.id} className="custom-shape-part" viewBox="0 0 240 16" style={style}><StrokeLayers pattern={part.strokePattern} strokeWidth={part.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <path d="M 0 8 q 6 -5 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0" fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" transform={transform} />}</StrokeLayers></svg>
          if (part.symbolType === 'circle') return <svg key={part.id} className="custom-shape-part" viewBox={`0 0 ${width} ${height}`} style={style}><StrokeLayers pattern={part.strokePattern} strokeWidth={part.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <ellipse cx={width / 2} cy={height / 2} rx={Math.max(1, width / 2 - part.strokeWidth / 2)} ry={Math.max(1, height / 2 - part.strokeWidth / 2)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} transform={transform} />}</StrokeLayers></svg>
          return <span key={part.id} className={`custom-shape-part custom-shape-symbol custom-shape-${part.symbolType}`} style={{ ...style, color, borderWidth: part.strokeWidth, borderStyle: getCssBorderStyle(part.strokePattern) }} />
        })}
      </span> : preview.kind === 'symbol' && preview.symbolType === 'cross' ? (
          <svg className="drop-symbol-preview drop-symbol-cross" viewBox="0 0 48 66" aria-hidden="true"><StrokeLayers pattern={preview.strokePattern} strokeWidth={preview.strokeWidth ?? 4}>{({ strokeWidth, strokeDasharray, transform }) => <path d="M 7 7 L 41 59 M 41 7 L 7 59" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" transform={transform} />}</StrokeLayers></svg>
        ) : preview.kind === 'symbol' && preview.symbolType === 'triangle' ? (
          <svg className="drop-symbol-preview drop-symbol-triangle" viewBox="0 0 99 66" aria-hidden="true">
            <StrokeLayers pattern={preview.strokePattern} strokeWidth={preview.strokeWidth ?? 4}>{({ strokeWidth, strokeDasharray, transform }) => <polygon points="49.5,5 94,61 5,61" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinejoin="round" transform={transform} />}</StrokeLayers>
          </svg>
        ) : preview.kind === 'symbol' && preview.symbolType === 'wave' ? (
          <svg className="drop-symbol-preview drop-symbol-wave" viewBox="0 0 240 16" aria-hidden="true"><StrokeLayers pattern={preview.strokePattern} strokeWidth={preview.strokeWidth ?? 4}>{({ strokeWidth, strokeDasharray, transform }) => <path d="M 0 8 q 6 -5 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" transform={transform} />}</StrokeLayers></svg>
        ) : preview.kind === 'symbol' && preview.symbolType === 'circle' ? (
          <svg className="drop-symbol-preview" viewBox={`0 0 ${preview.width} ${preview.height}`} aria-hidden="true"><StrokeLayers pattern={preview.strokePattern} strokeWidth={preview.strokeWidth ?? 4}>{({ strokeWidth, strokeDasharray, transform }) => <ellipse cx={preview.width / 2} cy={preview.height / 2} rx={Math.max(1, preview.width / 2 - (preview.strokeWidth ?? 4) / 2)} ry={Math.max(1, preview.height / 2 - (preview.strokeWidth ?? 4) / 2)} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} transform={transform} />}</StrokeLayers></svg>
        ) : preview.kind === 'symbol' && preview.symbolType ? (
          <span className={`drop-symbol-preview drop-symbol-${preview.symbolType}`} style={{ borderWidth: preview.strokeWidth ?? 4, borderStyle: getCssBorderStyle(preview.strokePattern) }} aria-hidden="true" />
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
            <StrokeLayers pattern={props.drawingStyle.strokePattern} strokeWidth={props.drawingStyle.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <polyline points={drawing.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={props.drawingStyle.color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" strokeLinejoin="round" opacity={props.placementMode === 'marker' ? props.drawingStyle.opacity ?? 0.42 : 1} transform={transform} />}</StrokeLayers>
            {props.placementMode === 'arrow' && <StrokeLayers pattern={props.drawingStyle.strokePattern} strokeWidth={props.drawingStyle.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <polyline points={arrowHeadPoints(drawing.points, props.drawingStyle.arrowHeadSize)} fill="none" stroke={props.drawingStyle.color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" strokeLinejoin="round" transform={transform} />}</StrokeLayers>}
          </>
        </svg>
      )}

      {curveDraft && curvePreview && (
        <svg className="drawing-preview export-hidden" style={{ left: 0, top: 0, right: 'auto', bottom: 'auto', width: props.scene.width, height: props.scene.height, transform: `translate(${camera.x}px, ${camera.y}px)` }} aria-hidden="true">
          <line x1={curveDraft.start.x} y1={curveDraft.start.y} x2={curveDraft.end.x} y2={curveDraft.end.y} stroke="#72988c" strokeWidth="2" strokeDasharray="6 5" />
          <StrokeLayers pattern={props.drawingStyle.strokePattern} strokeWidth={props.drawingStyle.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <path d={curvePath([curveDraft.start, curvePreview, curveDraft.end])} fill="none" stroke={props.drawingStyle.color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" transform={transform} />}</StrokeLayers>
          <circle cx={curvePreview.x} cy={curvePreview.y} r="5" fill="#fff" stroke={props.drawingStyle.color} strokeWidth="2" />
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

      {selectedImage && <>
        <div className="image-crop-selection export-hidden" style={{ left: selectedImage.x + camera.x, top: selectedImage.y + camera.y, width: selectedImage.width, height: selectedImage.height }} aria-hidden="true" />
        {(['left', 'right', 'top', 'bottom'] as ImageCropEdge[]).map((edge) => <button
          key={edge}
          type="button"
          className={`image-crop-handle image-crop-handle-${edge} export-hidden`}
          aria-label={`画像を${edge === 'left' ? '左' : edge === 'right' ? '右' : edge === 'top' ? '上' : '下'}からトリミング`}
          style={{ left: selectedImage.x + camera.x + (edge === 'left' ? -10 : edge === 'right' ? selectedImage.width - 10 : selectedImage.width / 2 - 10), top: selectedImage.y + camera.y + (edge === 'top' ? -10 : edge === 'bottom' ? selectedImage.height - 10 : selectedImage.height / 2 - 10) }}
          onPointerDown={(event) => beginImageCropEdge(event, selectedImage, edge)}
        />)}
      </>}

    </div>
  )
})

Workspace.displayName = 'Workspace'
