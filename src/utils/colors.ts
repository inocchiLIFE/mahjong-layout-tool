export const CUSTOM_COLORS_KEY = 'mahjong-layout-tool:custom-colors-v1'

export const TEXT_COLOR_PALETTE = [
  '#102a24', '#e53935', '#f57c00', '#008f5b', '#1976d2', '#6a3db5', '#c2185b',
]

export const readCustomColors = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_COLORS_KEY) ?? '[]') as unknown
    return Array.isArray(saved)
      ? saved.filter((value): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)).slice(0, 24)
      : []
  } catch {
    return []
  }
}

export const saveCustomColors = (colors: string[]) => {
  try {
    localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(colors.slice(-24)))
    window.dispatchEvent(new Event('mahjong-custom-colors-changed'))
  } catch {
    // 保存に失敗しても、その時点のパレットは画面上で使えるようにする。
  }
}
