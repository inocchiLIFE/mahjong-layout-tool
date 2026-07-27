import { useEffect } from 'react'

interface ReferencesModalProps {
  onClose: () => void
}

const MAHJONG_CPP_REVISION = '453cae05caf0e3c0da13846f82c20685becaea6e'
const WIN_PROB_REVISION = '36ac07db113ef9bad146a1e336800e8e79a52916'

export const ReferencesModal = ({ onClose }: ReferencesModalProps) => {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="references-modal" role="dialog" aria-modal="true" aria-labelledby="references-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="参考サイト・ライセンスを閉じる">×</button>
        <header className="references-header">
          <span className="eyebrow">REFERENCES &amp; LICENSE</span>
          <h2 id="references-title">参考サイト・ライセンス</h2>
          <p>一人麻雀の期待値計算で参照した資料と、ソフトウェアの利用条件を掲載しています。</p>
        </header>

        <div className="references-content">
          <section>
            <h3>参考サイト</h3>
            <div className="reference-links">
              <a href="https://kachikachi.net/mahjong/" target="_blank" rel="noreferrer">
                <strong>かちかち麻雀</strong>
                <span>このページの基礎となった参考サイト</span>
              </a>
              <a href="https://mahjong.org/training/training_006/" target="_blank" rel="noreferrer">
                <strong>麻雀トレーニング</strong>
                <span>牌理・受け入れで参考にしたサイト</span>
              </a>
            </div>
          </section>

          <section>
            <h3>期待値計算の参考資料</h3>
            <div className="reference-links">
              <a href="https://pystyle.info/apps/mahjong-nanikiru-simulator/" target="_blank" rel="noreferrer">
                <strong>麻雀何切るシミュレーター</strong>
                <span>入力項目と結果表示の参考サイト</span>
              </a>
              <a href="https://github.com/tomohxx/mahjong-algorithm-book" target="_blank" rel="noreferrer">
                <strong>麻雀アルゴリズム</strong>
                <span>手牌変化グラフと動的計画法の解説</span>
              </a>
              <a href="https://github.com/nekobean/mahjong-cpp" target="_blank" rel="noreferrer">
                <strong>mahjong-cpp</strong>
                <span>元サイトの現行計算実装（GNU GPLv3）</span>
              </a>
              <a href="https://github.com/tomohxx/mahjong-win-prob" target="_blank" rel="noreferrer">
                <strong>mahjong-win-prob</strong>
                <span>計算アルゴリズムの基礎となった実装（GNU GPLv3）</span>
              </a>
            </div>
          </section>

          <section className="license-notice">
            <h3>GNU General Public License v3.0</h3>
            <p className="copyright-notice">Copyright © 2026 inocchiLIFE. Portions © 2021–2026 nekobean; © 2022–2025 tomohxx.</p>
            <p>このアプリはGNU GPLv3で公開しています。利用者は同ライセンスの条件に従って、ソースコードを利用・変更・再配布できます。</p>
            <p>期待値計算の手牌グラフ生成と確率の逆算処理は、元サイトで使われているnekobean氏の <code>mahjong-cpp</code> をTypeScriptへ移植・変更したものです。この実装はtomohxx氏のアルゴリズムを基礎としています。</p>
            <dl>
              <div><dt>参照した版</dt><dd><code>{MAHJONG_CPP_REVISION.slice(0, 12)}</code></dd></div>
              <div><dt>変更内容</dt><dd>ブラウザ向けTypeScript化、既存UI・既知牌・赤牌表示への統合</dd></div>
              <div><dt>変更日</dt><dd>2026年7月23日</dd></div>
            </dl>
            <p className="no-warranty">このソフトウェアは無保証です。正確性や特定目的への適合性を含め、法律で認められる範囲で一切の保証を行いません。</p>
            <div className="license-links">
              <a href="https://github.com/inocchiLIFE/mahjong-layout-tool/blob/main/LICENSE" target="_blank" rel="noreferrer">GPLv3全文</a>
              <a href="https://github.com/inocchiLIFE/mahjong-layout-tool" target="_blank" rel="noreferrer">このアプリのソースコード</a>
              <a href={`https://github.com/nekobean/mahjong-cpp/tree/${MAHJONG_CPP_REVISION}`} target="_blank" rel="noreferrer">現行計算の参照元</a>
              <a href={`https://github.com/tomohxx/mahjong-win-prob/tree/${WIN_PROB_REVISION}`} target="_blank" rel="noreferrer">基礎実装の参照元</a>
            </div>
          </section>
        </div>

        <footer className="references-footer"><button className="primary-button" type="button" onClick={onClose}>閉じる</button></footer>
      </section>
    </div>
  )
}
