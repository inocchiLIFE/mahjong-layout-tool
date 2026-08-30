export const CONTEXT_MENU_ITEMS = [
  ['select', '選択'], ['duplicate', '複製'], ['delete', '削除'], ['copy', 'コピー'], ['paste', '貼り付け'], ['rotate', '牌を90度回転'], ['rectangle', '長方形'], ['triangle', '三角形'], ['circle', '丸'], ['cross', '✕'], ['wave', '波線'], ['text', 'クリック文字'], ['draw', '線を描く'], ['line', '直線'], ['curve', '曲線'], ['arrow', '矢印'], ['image', '画像を追加'], ['face', '表／裏を切替'], ['lock', 'ロック'], ['properties', 'プロパティ編集'], ['spoiler', '隠す'], ['front', '最前面へ'], ['back', '最背面へ'], ['clear', '作業画面をクリア'], ['undo', '元に戻す'], ['redo', 'やり直す'],
] as const
export type ContextMenuItemId = typeof CONTEXT_MENU_ITEMS[number][0]
export const DEFAULT_CONTEXT_MENU_ITEMS = CONTEXT_MENU_ITEMS.map(([id]) => id).filter((id) => id !== 'clear') as ContextMenuItemId[]
