import { useEffect, useState } from 'react'
import {
  MAX_WORKSPACE_HEIGHT,
  MAX_WORKSPACE_WIDTH,
  MIN_WORKSPACE_HEIGHT,
  MIN_WORKSPACE_WIDTH,
} from '../utils/layout'

interface WorkspaceSizeControlsProps {
  width: number
  height: number
  onChange: (width: number, height: number) => void
}

export const WorkspaceSizeControls = ({ width, height, onChange }: WorkspaceSizeControlsProps) => {
  const [draftWidth, setDraftWidth] = useState(String(width))
  const [draftHeight, setDraftHeight] = useState(String(height))

  useEffect(() => setDraftWidth(String(width)), [width])
  useEffect(() => setDraftHeight(String(height)), [height])

  const commit = () => {
    const nextWidth = Number(draftWidth)
    const nextHeight = Number(draftHeight)
    if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight)) {
      setDraftWidth(String(width))
      setDraftHeight(String(height))
      return
    }
    onChange(nextWidth, nextHeight)
  }

  return (
    <div className="workspace-size-controls" aria-label="作業エリアのサイズ">
      <label>
        幅
        <input
          type="number"
          min={MIN_WORKSPACE_WIDTH}
          max={MAX_WORKSPACE_WIDTH}
          value={draftWidth}
          onChange={(event) => setDraftWidth(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        />
      </label>
      <span>×</span>
      <label>
        高さ
        <input
          type="number"
          min={MIN_WORKSPACE_HEIGHT}
          max={MAX_WORKSPACE_HEIGHT}
          value={draftHeight}
          onChange={(event) => setDraftHeight(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        />
      </label>
      <small>px</small>
    </div>
  )
}
