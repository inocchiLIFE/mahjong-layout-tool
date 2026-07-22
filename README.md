# 麻雀牌レイアウトツール

麻雀の問題作成、牌姿の説明、講義資料づくりに使えるブラウザ完結型の配置ツールです。

## 起動

```bash
npm install
npm run dev
```

本番ビルドは `npm run build`、静的プレビューは `npm run preview` で実行できます。

## 公開URL

GitHub Pages: https://inocchilife.github.io/mahjong-layout-tool/

`main`ブランチへpushすると、GitHub Actionsがlint・ビルド・Pages公開を自動実行します。

## 参考実装・ライセンス

一人麻雀の期待値計算にあるツモ・打牌の手牌変化グラフと確率・期待値の逆算処理は、
元サイトで使われている[nekobean/mahjong-cpp](https://github.com/nekobean/mahjong-cpp)（GNU GPLv3、参照版
`453cae05caf0e3c0da13846f82c20685becaea6e`）をブラウザ向けTypeScriptへ移植・変更しています。
この実装は[tomohxx/mahjong-win-prob](https://github.com/tomohxx/mahjong-win-prob)を基礎としています。変更日は2026年7月23日です。

このアプリ全体をGNU General Public License v3.0で公開します。詳しい条件は[LICENSE](LICENSE)を確認してください。
このソフトウェアは無保証です。

Copyright © 2026 inocchiLIFE. Portions © 2021–2026 nekobean; © 2022–2025 tomohxx.

## 主な機能

- 全34種＋赤牌3種のクリック／ドラッグ配置
- マウス・タッチでの移動、複数選択、削除、90度回転
- Undo / Redo、選択牌または全牌の整列、グリッド吸着
- 物理的な牌枚数を守る13枚／14枚のランダム配牌と自動理牌
- 牌のシャッフル、文字注釈の追加と移動
- localStorageへの自動保存・手動保存・復元
- 配置と文字を含むJSONの書き出し／読み込み
- 作業エリアのみのPNG保存（グリッド有無を選択可能）

## 牌画像の差し替え

表示データは `src/data/tiles.ts` に集約しています。画像は `public/tiles/` にあり、`man1.png`〜`man9.png`、`pin1.png`〜`pin9.png`、`sou1.png`〜`sou9.png`、字牌、赤牌の同名ファイルを差し替えると全画面へ反映されます。
