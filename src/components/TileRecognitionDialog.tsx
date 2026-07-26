import { useEffect, useState } from 'react'
import { TILE_DEFINITIONS } from '../data/tiles'
import type { ImageElement } from '../types'

type Candidate = { tileId: string; confidence: number }

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = reject
  image.src = src
})

const pixels = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return []
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data
  const result: number[] = []
  for (let index = 0; index < data.length; index += 4) result.push((data[index] * .299 + data[index + 1] * .587 + data[index + 2] * .114) / 255)
  return result
}

const similarity = (left: number[], right: number[]) => {
  if (!left.length || left.length !== right.length) return 0
  const error = left.reduce((sum, value, index) => sum + Math.abs(value - right[index]), 0) / left.length
  return Math.round(Math.max(0, 1 - error) * 100)
}

const cropSource = async (image: ImageElement) => {
  const source = await loadImage(image.src)
  const crop = image.crop ?? { x: 0, y: 0, width: 1, height: 1 }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(source.naturalWidth * crop.width))
  canvas.height = Math.max(1, Math.round(source.naturalHeight * crop.height))
  canvas.getContext('2d')?.drawImage(source, source.naturalWidth * crop.x, source.naturalHeight * crop.y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
  return canvas
}

const recognise = async (image: ImageElement): Promise<Candidate[]> => {
  const source = await cropSource(image)
  // A hand screenshot is normally one horizontal row.  Its tile aspect ratio
  // lets us split it locally without uploading the image anywhere.
  const count = Math.max(1, Math.min(14, Math.round(source.width / source.height / (48 / 66))))
  const templateSize = { width: 24, height: 33 }
  const templates = await Promise.all(TILE_DEFINITIONS.map(async (tile) => {
    const picture = await loadImage(tile.asset)
    const canvas = document.createElement('canvas')
    canvas.width = templateSize.width; canvas.height = templateSize.height
    canvas.getContext('2d')?.drawImage(picture, 0, 0, canvas.width, canvas.height)
    return { tileId: tile.id, pixels: pixels(canvas) }
  }))
  return Array.from({ length: count }, (_, index) => {
    const canvas = document.createElement('canvas')
    canvas.width = templateSize.width; canvas.height = templateSize.height
    const context = canvas.getContext('2d')
    context?.drawImage(source, index * source.width / count, 0, source.width / count, source.height, 0, 0, canvas.width, canvas.height)
    const sample = pixels(canvas)
    const best = templates.map((template) => ({ tileId: template.tileId, confidence: similarity(sample, template.pixels) })).sort((a, b) => b.confidence - a.confidence)[0]
    return best
  })
}

interface TileRecognitionDialogProps {
  image: ImageElement
  onApply: (tileIds: string[]) => void
  onClose: () => void
}

export const TileRecognitionDialog = ({ image, onApply, onClose }: TileRecognitionDialogProps) => {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void recognise(image).then((result) => { if (active) setCandidates(result) }).catch(() => { if (active) setError('画像を読み取れませんでした。画像を追加し直してからお試しください。') })
    return () => { active = false }
  }, [image])

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="tile-recognition-dialog" role="dialog" aria-modal="true" aria-labelledby="tile-recognition-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" type="button" onClick={onClose} aria-label="閉じる">×</button>
      <span className="eyebrow">LOCAL TILE READER</span>
      <h2 id="tile-recognition-title">画像から牌姿を読み取り</h2>
      <p>この端末内で処理しています。画像・APIキーは外部へ送信されず、料金も発生しません。</p>
      {!candidates && !error && <div className="recognition-loading">牌を読み取っています…</div>}
      {error && <p className="recognition-error">{error}</p>}
      {candidates && <>
        <p className="recognition-hint">自動結果を確認してください。デザインが異なる画像や低い一致度の牌は、下の選択欄で修正できます。</p>
        <div className="recognition-results">
          {candidates.map((candidate, index) => <label key={index} className="recognition-candidate">
            <span>{index + 1}</span>
            <select value={candidate.tileId} onChange={(event) => setCandidates((current) => current?.map((item, itemIndex) => itemIndex === index ? { ...item, tileId: event.target.value, confidence: 100 } : item) ?? null)}>
              {TILE_DEFINITIONS.map((tile) => <option key={tile.id} value={tile.id}>{tile.label}</option>)}
            </select>
            <small>一致度 {candidate.confidence}%</small>
          </label>)}
        </div>
        <div className="property-actions"><button type="button" onClick={onClose}>キャンセル</button><button type="button" className="primary-button" onClick={() => onApply(candidates.map((candidate) => candidate.tileId))}>この牌姿を配置</button></div>
      </>}
    </section>
  </div>
}
