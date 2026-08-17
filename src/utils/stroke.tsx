import type { ReactNode } from 'react'
import type { StrokePattern } from '../types'

export const STROKE_PATTERN_OPTIONS: Array<{ value: StrokePattern; label: string }> = [
  { value: 'solid', label: '実線' },
  { value: 'dashed', label: '破線' },
  { value: 'dotted', label: '点線' },
  { value: 'dashDot', label: '一点鎖線' },
  { value: 'double', label: '二重線' },
]

export const DEFAULT_STROKE_PATTERN: StrokePattern = 'solid'

export const isStrokePattern = (value: unknown): value is StrokePattern =>
  value === 'solid' || value === 'dashed' || value === 'dotted' || value === 'dashDot' || value === 'double'

export const getStrokeDasharray = (pattern: StrokePattern | undefined, strokeWidth: number) => {
  const width = Math.max(1, strokeWidth)
  if (pattern === 'dashed') return `${width * 4} ${width * 2.5}`
  if (pattern === 'dotted') return `${width} ${width * 2}`
  if (pattern === 'dashDot') return `${width * 4} ${width * 2} ${width} ${width * 2}`
  return undefined
}

interface StrokeLayerProps {
  pattern?: StrokePattern
  strokeWidth: number
  children: (props: { strokeWidth: number; strokeDasharray?: string; transform?: string }) => ReactNode
}

/**
 * Renders ordinary dash patterns through SVG stroke-dasharray. A double line
 * is represented by two narrow, parallel strokes so it remains visible on
 * both transparent and colored workspaces.
 */
export const StrokeLayers = ({ pattern = DEFAULT_STROKE_PATTERN, strokeWidth, children }: StrokeLayerProps) => {
  if (pattern !== 'double') {
    return children({ strokeWidth, strokeDasharray: getStrokeDasharray(pattern, strokeWidth) })
  }
  const lineWidth = Math.max(1, strokeWidth * 0.36)
  const offset = Math.max(1.5, strokeWidth * 0.72)
  return <g>{[-1, 1].map((direction) => <g key={direction}>{children({ strokeWidth: lineWidth, transform: `translate(0 ${direction * offset})` })}</g>)}</g>
}

export const getCssBorderStyle = (pattern: StrokePattern | undefined): 'solid' | 'dashed' | 'dotted' | 'double' => {
  if (pattern === 'dashed') return 'dashed'
  if (pattern === 'dotted') return 'dotted'
  if (pattern === 'double') return 'double'
  return 'solid'
}
