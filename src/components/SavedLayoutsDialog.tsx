import { useEffect, useState, type DragEvent, type MouseEvent } from 'react'
import { TILE_MAP } from '../data/tiles'
import type { NamedSavedLayout } from '../types'
import { getArrowHeadPoints, getCurveControlPoint, getElementDimensions } from '../utils/layout'
import { StrokeLayers } from '../utils/stroke'
import { normalizeTextRuns } from '../utils/textRuns'

const curvePath = (points: { x: number; y: number }[]) => {
  const start = points[0]
  const end = points.at(-1) ?? start
  const control = getCurveControlPoint(points)
  return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`
}

const arrowHeadPoints = (points: { x: number; y: number }[], size?: number) => {
  return getArrowHeadPoints(points, size).map((point) => `${point.x},${point.y}`).join(' ')
}

interface SavedLayoutsDialogProps {
  layouts: NamedSavedLayout[]
  categories: Array<{ id: string; name: string }>
  onSave: (name: string, categoryId: string) => void
  onSaveAllPages: () => void
  onCreateCategory: (name: string) => void
  onMove: (id: string, categoryId: string) => void
  onReorder: (draggedId: string, targetId: string) => void
  onOverwrite: (id: string) => void
  onLoad: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onClose: () => void
}

const downloadFileName = (name: string) => `${name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || '麻雀レイアウト'}.mahjong-layout.json`

const createShareBlobUrl = (saved: NamedSavedLayout) => {
  const contents = JSON.stringify({
    format: 'mahjong-layout-tool', version: 2, name: saved.name, layout: saved.layout,
    pages: saved.pages, pageNames: saved.pageNames,
  })
  return URL.createObjectURL(new Blob([contents], { type: 'application/json;charset=utf-8' }))
}

const releaseShareBlobUrl = (url: string) => window.setTimeout(() => URL.revokeObjectURL(url), 5000)

const prepareShareDownload = (event: MouseEvent<HTMLAnchorElement>, saved: NamedSavedLayout) => {
  const url = createShareBlobUrl(saved)
  const anchor = event.currentTarget
  anchor.href = url
  releaseShareBlobUrl(url)
  window.setTimeout(() => {
    anchor.href = '#'
  }, 3000)
}

const prepareShareDrag = (event: DragEvent<HTMLAnchorElement>, saved: NamedSavedLayout) => {
  const url = createShareBlobUrl(saved)
  const fileName = downloadFileName(saved.name)
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('DownloadURL', `application/json:${fileName}:${url}`)
  event.dataTransfer.setData('text/uri-list', url)
  event.dataTransfer.setData('text/plain', fileName)
  releaseShareBlobUrl(url)
}

const LayoutPreview = ({ saved }: { saved: NamedSavedLayout }) => {
  const { scene } = saved.layout
  return (
    <div className="saved-layout-preview" aria-hidden="true">
      {scene.elements.map((element) => {
        const dimensions = getElementDimensions(element)
        const style = {
          left: `${element.x / scene.width * 100}%`,
          top: `${element.y / scene.height * 100}%`,
          width: `${dimensions.width / scene.width * 100}%`,
          height: `${dimensions.height / scene.height * 100}%`,
          zIndex: element.kind === 'image' ? Math.max(1, element.zIndex) : 100000 + element.zIndex,
        }
        if (element.kind === 'tile') {
          const tile = TILE_MAP.get(element.tileId)
          return element.faceDown
            ? <span key={element.id} className="saved-preview-item saved-preview-back" style={style} />
            : tile && <img key={element.id} className="saved-preview-item" src={tile.asset} alt="" style={style} />
        }
        if (element.kind === 'text') {
          const textRuns = normalizeTextRuns(element.text, element.textRuns, { color: element.color, fontSize: element.fontSize, fontFamily: element.fontFamily, fontWeight: element.fontWeight })
          return <span key={element.id} className="saved-preview-item saved-preview-text" style={{ ...style, color: element.color, fontFamily: element.fontFamily, fontWeight: element.fontWeight }}>{textRuns.map((run, index) => <span key={`${index}-${run.text}`} style={{ color: run.color, fontSize: run.fontSize, fontFamily: run.fontFamily, fontWeight: run.fontWeight }}>{run.text}</span>)}</span>
        }
        if (element.kind === 'image') {
          return <img key={element.id} className="saved-preview-item" src={element.src} alt="" style={{ ...style, opacity: element.opacity }} />
        }
        if (element.kind === 'drawing') {
          const drawingOpacity = element.drawingType === 'marker' ? element.opacity ?? 0.42 : 1
          return (
            <svg key={element.id} className="saved-preview-item" viewBox={`0 0 ${element.width} ${element.height}`} style={style}>
              {element.drawingType === 'curve' ? <StrokeLayers pattern={element.strokePattern} strokeWidth={element.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <path d={curvePath(element.points)} fill="none" stroke={element.color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" opacity={drawingOpacity} transform={transform} />}</StrokeLayers> : <>
                <StrokeLayers pattern={element.strokePattern} strokeWidth={element.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <polyline points={element.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={element.color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" strokeLinejoin="round" opacity={drawingOpacity} transform={transform} />}</StrokeLayers>
                {element.drawingType === 'arrow' && <StrokeLayers pattern={element.strokePattern} strokeWidth={element.strokeWidth}>{({ strokeWidth, strokeDasharray, transform }) => <polyline points={arrowHeadPoints(element.points, element.arrowHeadSize)} fill="none" stroke={element.color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round" strokeLinejoin="round" transform={transform} />}</StrokeLayers>}
              </>}
            </svg>
          )
        }
        if (element.kind === 'customShape') return <span key={element.id} className="saved-preview-item" style={{ ...style, color: element.color ?? '#244a40' }}>☆</span>
        return (
          <span key={element.id} className={`saved-preview-item saved-preview-symbol preview-${element.symbolType}`} style={{ ...style, color: element.color }}>
            {element.symbolType === 'cross' ? '✕' : element.symbolType === 'triangle' ? '△' : ''}
          </span>
        )
      })}
    </div>
  )
}

export const SavedLayoutsDialog = (props: SavedLayoutsDialogProps) => {
  const [name, setName] = useState(`保存ページ ${props.layouts.length + 1}`)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState('default')
  const [categoryName, setCategoryName] = useState('')
  const { onClose } = props

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    props.onSave(trimmed, activeCategoryId)
    setName(`保存ページ ${props.layouts.length + 2}`)
  }

  const beginRename = (saved: NamedSavedLayout) => {
    setEditingId(saved.id)
    setEditingName(saved.name)
  }

  const commitRename = () => {
    if (!editingId || !editingName.trim()) return
    props.onRename(editingId, editingName.trim())
    setEditingId(null)
  }

  const createCategory = () => {
    const trimmed = categoryName.trim()
    if (!trimmed) return
    props.onCreateCategory(trimmed)
    setCategoryName('')
  }

  const beginLayoutDrag = (event: DragEvent<HTMLElement>, id: string) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-mahjong-saved-layout', id)
  }

  const dropIntoCategory = (event: DragEvent<HTMLElement>, categoryId: string) => {
    event.preventDefault()
    const id = event.dataTransfer.getData('application/x-mahjong-saved-layout')
    if (id) props.onMove(id, categoryId)
  }

  const reorderLayout = (event: DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault()
    const draggedId = event.dataTransfer.getData('application/x-mahjong-saved-layout')
    if (draggedId && draggedId !== targetId) props.onReorder(draggedId, targetId)
  }

  const moveBy = (id: string, direction: -1 | 1) => {
    const index = visibleLayouts.findIndex((item) => item.id === id)
    const target = visibleLayouts[index + direction]
    if (target) props.onReorder(direction < 0 ? id : target.id, direction < 0 ? target.id : id)
  }

  const visibleLayouts = activeCategoryId === 'default' ? props.layouts : props.layouts.filter((saved) => saved.categoryId === activeCategoryId)

  return (
    <div className="modal-backdrop saved-layouts-backdrop" role="presentation" onPointerDown={props.onClose}>
      <section className="saved-layouts-dialog" role="dialog" aria-modal="true" aria-labelledby="saved-layouts-title" onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={props.onClose} aria-label="閉じる">×</button>
        <div className="saved-layouts-heading">
          <div>
            <span>LAYOUT LIBRARY</span>
            <h2 id="saved-layouts-title">保存したページ</h2>
          </div>
          <strong>{props.layouts.length}<small>件</small></strong>
        </div>

        <div className="saved-layout-form">
          <label htmlFor="saved-layout-name">現在の画面を新しく保存</label>
          <div>
            <input id="saved-layout-name" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && save()} />
            <button type="button" className="primary-button" onClick={save} disabled={!name.trim()}>保存</button>
          </div>
        </div>
        <button type="button" className="saved-layout-save-all" onClick={props.onSaveAllPages}>全ページを保存</button>

        <div className="saved-layout-tabs" role="tablist" aria-label="保存ページの分類">
          {props.categories.map((category) => <button key={category.id} type="button" role="tab" aria-selected={activeCategoryId === category.id} className={activeCategoryId === category.id ? 'active' : ''} onClick={() => setActiveCategoryId(category.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropIntoCategory(event, category.id)}>{category.name}</button>)}
          <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && createCategory()} placeholder="分類名" aria-label="新しい分類名" />
          <button type="button" onClick={createCategory} disabled={!categoryName.trim()}>＋タブ作成</button>
        </div>

        <div className="saved-layout-list">
          {visibleLayouts.length === 0 ? (
            <div className="saved-layout-empty"><strong>保存ページはまだありません</strong><span>名前を付けて現在の画面を保存できます。</span></div>
          ) : visibleLayouts.map((saved) => {
            const count = saved.layout.scene.elements.length
            return (
              <article className="saved-layout-card" key={saved.id} draggable onDragStart={(event) => beginLayoutDrag(event, saved.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => reorderLayout(event, saved.id)}>
                <LayoutPreview saved={saved} />
                <div className="saved-layout-card-copy">
                  {editingId === saved.id ? <input className="saved-layout-name-edit" aria-label="保存ページのタイトル" value={editingName} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && commitRename()} autoFocus /> : <strong>{saved.name}</strong>}
                  <span>{new Date(saved.savedAt).toLocaleString('ja-JP')}</span>
                  <small>{count}個の配置物 ・ {saved.layout.scene.width} × {saved.layout.scene.height}px</small>
                </div>
                <div className="saved-layout-card-actions">
                  <button type="button" onClick={() => moveBy(saved.id, -1)} disabled={visibleLayouts[0]?.id === saved.id}>↑ 上へ</button>
                  <button type="button" onClick={() => moveBy(saved.id, 1)} disabled={visibleLayouts.at(-1)?.id === saved.id}>↓ 下へ</button>
                  <select value={saved.categoryId ?? 'default'} onChange={(event) => props.onMove(saved.id, event.target.value)} aria-label="分類を変更">
                    {props.categories.map((category) => <option key={category.id} value={category.id}>{category.name}へ移動</option>)}
                  </select>
                  <button type="button" className="saved-layout-overwrite" onClick={() => props.onOverwrite(saved.id)}>上書き保存</button>
                  <button type="button" className="saved-layout-load" onClick={() => props.onLoad(saved.id)}>呼び出す</button>
                  {editingId === saved.id ? <button type="button" className="saved-layout-rename" onClick={commitRename}>タイトル保存</button> : <button type="button" className="saved-layout-rename" onClick={() => beginRename(saved)}>タイトル編集</button>}
                  <a className="saved-layout-share" href="#" download={downloadFileName(saved.name)} draggable onClick={(event) => prepareShareDownload(event, saved)} onDragStart={(event) => prepareShareDrag(event, saved)} title="クリックで保存、またはフォルダへドラッグして出力">共有ファイル保存</a>
                  <button type="button" className="saved-layout-delete" onClick={() => props.onDelete(saved.id)}>削除</button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
