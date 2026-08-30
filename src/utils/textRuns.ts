import type { TextDecoration, TextRun } from '../types'

export interface TextRunStyle {
  color: string
  fontSize: number
  fontFamily: string
  fontWeight: 400 | 700
  textDecoration: TextDecoration
  backgroundColor: string | null
  spoiler?: boolean
}

export type TextRunStylePatch = Partial<TextRunStyle>

const sameStyle = (left: TextRun, right: TextRun) =>
  left.color === right.color
  && left.fontSize === right.fontSize
  && left.fontFamily === right.fontFamily
  && left.fontWeight === right.fontWeight
  && (left.textDecoration ?? 'none') === (right.textDecoration ?? 'none')
  && (left.backgroundColor ?? null) === (right.backgroundColor ?? null)
  && Boolean(left.spoiler) === Boolean(right.spoiler)

const mergeRuns = (runs: TextRun[]) => runs.reduce<TextRun[]>((result, run) => {
  if (!run.text) return result
  const previous = result.at(-1)
  if (previous && sameStyle(previous, run)) previous.text += run.text
  else result.push({ ...run })
  return result
}, [])

export const normalizeTextRuns = (text: string, runs: TextRun[] | undefined, fallback: TextRunStyle): TextRun[] => {
  if (!text) return []
  const normalized: TextRun[] = []
  let offset = 0
  for (const run of runs ?? []) {
    if (offset >= text.length || !run?.text) break
    const available = text.slice(offset, offset + run.text.length)
    if (!available) break
    normalized.push({
      text: available,
      color: typeof run.color === 'string' ? run.color : fallback.color,
      fontSize: typeof run.fontSize === 'number' ? run.fontSize : fallback.fontSize,
      fontFamily: typeof run.fontFamily === 'string' ? run.fontFamily : fallback.fontFamily,
      fontWeight: run.fontWeight === 700 ? 700 : run.fontWeight === 400 ? 400 : fallback.fontWeight,
      textDecoration: run.textDecoration === 'underline' ? 'underline' : fallback.textDecoration,
      backgroundColor: typeof run.backgroundColor === 'string' ? run.backgroundColor : run.backgroundColor === null ? null : fallback.backgroundColor,
      spoiler: Boolean(run.spoiler),
    })
    offset += available.length
  }
  if (offset < text.length) normalized.push({ ...fallback, text: text.slice(offset) })
  return mergeRuns(normalized)
}

export const sliceTextRuns = (text: string, runs: TextRun[] | undefined, start: number, end: number, fallback: TextRunStyle) => {
  const normalized = normalizeTextRuns(text, runs, fallback)
  const left = Math.max(0, Math.min(start, end))
  const right = Math.min(text.length, Math.max(start, end))
  if (left >= right) return []
  const result: TextRun[] = []
  let offset = 0
  for (const run of normalized) {
    const runEnd = offset + run.text.length
    const overlapStart = Math.max(left, offset)
    const overlapEnd = Math.min(right, runEnd)
    if (overlapStart < overlapEnd) result.push({ ...run, text: run.text.slice(overlapStart - offset, overlapEnd - offset) })
    offset = runEnd
    if (offset >= right) break
  }
  return result
}

export const getTextRunStyleAt = (text: string, runs: TextRun[] | undefined, index: number, fallback: TextRunStyle): TextRunStyle => {
  const normalized = normalizeTextRuns(text, runs, fallback)
  const target = Math.max(0, Math.min(index, Math.max(0, text.length - 1)))
  let offset = 0
  for (const run of normalized) {
    if (target < offset + run.text.length) return {
      color: run.color,
      fontSize: run.fontSize,
      fontFamily: run.fontFamily,
      fontWeight: run.fontWeight,
      textDecoration: run.textDecoration ?? 'none',
      backgroundColor: run.backgroundColor ?? null,
      spoiler: Boolean(run.spoiler),
    }
    offset += run.text.length
  }
  return { ...fallback }
}

export const applyTextRunStyle = (
  text: string,
  runs: TextRun[] | undefined,
  start: number,
  end: number,
  patch: TextRunStylePatch,
  fallback: TextRunStyle,
) => {
  const left = Math.max(0, Math.min(start, end))
  const right = Math.min(text.length, Math.max(start, end))
  if (!text || left >= right) return normalizeTextRuns(text, runs, fallback)
  const normalized = normalizeTextRuns(text, runs, fallback)
  return mergeRuns([
    ...sliceTextRuns(text, normalized, 0, left, fallback),
    ...sliceTextRuns(text, normalized, left, right, fallback).map((run) => ({ ...run, ...patch })),
    ...sliceTextRuns(text, normalized, right, text.length, fallback),
  ])
}

/** Return whether every character in a range is already hidden. */
export const isTextRunRangeSpoiler = (
  text: string,
  runs: TextRun[] | undefined,
  start: number,
  end: number,
  fallback: TextRunStyle,
) => {
  const left = Math.max(0, Math.min(start, end))
  const right = Math.min(text.length, Math.max(start, end))
  if (!text || left >= right) return false
  const normalized = normalizeTextRuns(text, runs, fallback)
  let offset = 0
  let covered = 0
  for (const run of normalized) {
    const runEnd = offset + run.text.length
    const overlapStart = Math.max(left, offset)
    const overlapEnd = Math.min(right, runEnd)
    if (overlapStart < overlapEnd) {
      covered += overlapEnd - overlapStart
      if (!run.spoiler) return false
    }
    offset = runEnd
    if (offset >= right) break
  }
  return covered === right - left
}

/** Preserve the old formatting around a simple insertion/deletion in the editor. */
export const reconcileTextRuns = (
  previousText: string,
  nextText: string,
  runs: TextRun[] | undefined,
  fallback: TextRunStyle,
) => {
  if (!nextText) return []
  const normalized = normalizeTextRuns(previousText, runs, fallback)
  let prefix = 0
  while (prefix < previousText.length && prefix < nextText.length && previousText[prefix] === nextText[prefix]) prefix += 1
  let suffix = 0
  while (suffix < previousText.length - prefix && suffix < nextText.length - prefix
    && previousText[previousText.length - 1 - suffix] === nextText[nextText.length - 1 - suffix]) suffix += 1
  const nextMiddleStart = prefix
  const nextMiddleEnd = nextText.length - suffix
  const inserted = nextText.slice(nextMiddleStart, nextMiddleEnd)
  const insertedStyle = getTextRunStyleAt(previousText, normalized, Math.max(0, prefix - 1), fallback)
  return mergeRuns([
    ...sliceTextRuns(previousText, normalized, 0, prefix, fallback),
    ...(inserted ? [{ text: inserted, ...insertedStyle }] : []),
    ...sliceTextRuns(previousText, normalized, previousText.length - suffix, previousText.length, fallback),
  ])
}
