import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'

const MIN_WIDTH = 360
const MIN_HEIGHT = 240

type DragState = {
  pointerId: number
  startX: number
  startY: number
  startLeft: number
  startTop: number
}

type ResizeState = DragState & {
  startWidth: number
  startHeight: number
}

const searchUrl = (query: string) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`

export const WebSearchPanel = ({ onClose }: { onClose: () => void }) => {
  const [query, setQuery] = useState('')
  const [url, setUrl] = useState(() => searchUrl(''))
  const [position, setPosition] = useState({ left: 120, top: 130 })
  const [size, setSize] = useState({ width: 620, height: 480 })
  const [minimized, setMinimized] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (dragRef.current) {
        const drag = dragRef.current
        const maxLeft = Math.max(0, window.innerWidth - 170)
        const maxTop = Math.max(0, window.innerHeight - 42)
        setPosition({
          left: Math.min(maxLeft, Math.max(0, drag.startLeft + event.clientX - drag.startX)),
          top: Math.min(maxTop, Math.max(0, drag.startTop + event.clientY - drag.startY)),
        })
      }
      if (resizeRef.current) {
        const resize = resizeRef.current
        setSize({
          width: Math.min(Math.max(MIN_WIDTH, resize.startWidth + event.clientX - resize.startX), Math.max(MIN_WIDTH, window.innerWidth - position.left)),
          height: Math.min(Math.max(MIN_HEIGHT, resize.startHeight + event.clientY - resize.startY), Math.max(MIN_HEIGHT, window.innerHeight - position.top)),
        })
      }
    }
    const end = () => {
      dragRef.current = null
      resizeRef.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
    }
  }, [position.left, position.top])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = query.trim()
    if (trimmed) setUrl(searchUrl(trimmed))
  }

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, input, a')) return
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startLeft: position.left, startTop: position.top }
  }

  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    resizeRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startLeft: position.left, startTop: position.top, startWidth: size.width, startHeight: size.height }
  }

  return <section
    className={`web-search-panel${minimized ? ' is-minimized' : ''}`}
    style={{ left: position.left, top: position.top, width: size.width, height: minimized ? undefined : size.height }}
    aria-label="Web検索"
  >
    <div className="web-search-titlebar" onPointerDown={beginDrag}>
      <strong><span aria-hidden="true">⌕</span> Web検索</strong>
      <div className="web-search-window-actions">
        <button type="button" title={minimized ? '元に戻す' : '最小化'} aria-label={minimized ? '元に戻す' : '最小化'} onClick={() => setMinimized((value) => !value)}>{minimized ? '□' : '—'}</button>
        <button type="button" title="閉じる" aria-label="閉じる" onClick={onClose}>×</button>
      </div>
    </div>
    {!minimized && <>
      <form className="web-search-form" onSubmit={submit}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Webを検索" aria-label="検索語句" autoFocus />
        <button type="submit">検索</button>
        <a href={url} target="_blank" rel="noreferrer">別タブで開く</a>
      </form>
      <div className="web-search-content">
        <iframe src={url} title="Web検索結果" />
        <p>表示できないページは「別タブで開く」をご利用ください。</p>
      </div>
      <button type="button" className="web-search-resize" aria-label="ウィンドウサイズを変更" onPointerDown={beginResize} />
    </>}
  </section>
}
