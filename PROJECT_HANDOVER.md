# 麻雀レイアウトツール 引継ぎメモ

最終更新: 2026-07-20  
公開URL: https://inocchilife.github.io/mahjong-layout-tool/  
リポジトリ: `inocchiLIFE/mahjong-layout-tool` / `main`

## 開発・公開

- React + TypeScript + Vite のSPA。
- GitHub Pagesへ `main` のpushで自動公開される。
- 基本確認: `pnpm run lint`、`pnpm run build`、`git diff --check`。
- 公開確認: `gh run list --workflow "Deploy to GitHub Pages" --limit 1` と `gh run watch <id> --exit-status`。
- 麻雀牌の画像は `assets/tiles/` を利用。画像セットは置き換えない。

## 主な構成

- `src/App.tsx`: 状態、保存、ページ、操作の中心。
- `src/components/Workspace.tsx`: ワークスペース、描画、ドラッグ、選択。
- `src/components/Toolbar.tsx`: 上部リボンとページタブ。
- `src/components/TilePalette.tsx`: 牌一覧・記号・描画ツール。
- `src/components/SavedLayoutsDialog.tsx`: 保存ページ、分類、並び替え。
- `src/components/SettingsDialog.tsx`: 共通設定。
- `src/hooks/useSceneHistory.ts`: 現在ページのUndo/Redo。
- `src/utils/layout.ts`: 牌・図形・描画の生成、ランダム配牌。
- `src/App.css`: 画面全体のスタイル。

## 実装済み機能

### 牌・配牌

- 牌一覧からのクリック／ドラッグ設置。牌はルーラー直下へ配置。
- 13枚、14枚、5枚連続形、6枚形、6枚暗刻含み、7枚形、シャッフル。
- 万子・筒子・索子の絞り込み、牌姿のランダム生成、左右反転・シフト。
- 牌をコピーすると麻雀表記テキストにし、貼り付け・ドラッグ＆ドロップでは牌画像へ変換。
- 半角／全角の数字・英字、日本語牌文字、混在表記を解析。

### ワークスペース・編集

- 牌、文字、図形、画像、ペン、直線、曲線、矢印、消しゴム。
- 図形・描画ツールは右クリックで初期設定（色・太さ・サイズ）を変更可能。
- ペン等の初期色は個別色が未設定ならパレット色を利用。
- 画像はワークスペース背景より前、他の要素より背面。
- 選択要素はホームタブの「前面へ」「背面へ」で重ね順変更可能。
- 空白クリックで選択解除、空白ダブルクリックで文字入力。
- 直線・曲線・矢印は水平／垂直から5度以内でグリッドへ自動補正。
- 曲線は始点終点を決めた後、中央位置から上下方向のみで曲がりを指定。
- 矢印先端は初期30。矢印の右クリック初期設定で12〜64に変更可能。

### 保存・共有・設定

- 自動保存、名前付き保存、上書き保存、読み込み、削除、名称変更、JSON共有。
- 保存ページは分類タブを作成して移動可能。カードのドラッグ、または上下ボタンで並び替え。
- 保存画面の操作ボタンは横一列（幅不足時は横スクロール）。
- 設定・ツール初期値は端末内で保存し、別タブ間でも共有。
- ポップアップ文字サイズは設定で100〜150%（初期120%）。

### 複数ページ（スライド）

- 上部リボンの「設定」タブ右側にChrome風ページタブを表示。
- `＋`で新規ページ、選択中タブの`×`で削除、左右矢印キーでページ移動。
- ページタブはドラッグ＆ドロップで並び替え。タブ名はダブルクリックで変更。
- 表示名は先頭5文字。並び替え後も名前を維持。
- ページタブ一式は `localStorage` の `mahjong-layout-tool:page-deck-v1` に自動保存。
- 通常保存は現在ページのみ。全ページ保存は複数ページを1つの保存データにまとめ、読み込み時に全ページを復元。
- ページ切替には履歴をリセットする `history.reset()` を使う。`history.load()` を使うとUndoで別ページの内容が出るため注意。

## 保存データの注意

- 名前付き保存: `mahjong-layout-tool:saved-pages-v1`（大容量保存ユーティリティも利用）。
- `NamedSavedLayout` は単一ページの `layout` を必ず持つ。
- 全ページ保存では `pages?: SavedLayout[]` と `pageNames?: string[]` を持つ。
- `parseNamedSavedLayouts` が `pages` と `pageNames` を復元する。
- 既存の単一ページ保存は互換性を保つ。

## 直近の注意点・今後の確認候補

- ページデッキの自動保存は実装済みだが、リロード直後の現在ページ復元の挙動は実機で確認すること。
- 保存ページの分類タブは `localStorage` の `mahjong-layout-tool:saved-page-categories-v1`。
- ページ切替／削除／並び替えを変更する際は、`pages`、`pagesRef`、`activePageIndex`、`history.reset()` の整合性を確認すること。
- GitHub Pages公開前に必ずビルドとデプロイ成功を確認すること。
