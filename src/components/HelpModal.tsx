import { useEffect } from 'react'

interface HelpModalProps {
  onClose: () => void
}

const Shortcut = ({ children }: { children: string }) => <kbd>{children}</kbd>

export const HelpModal = ({ onClose }: HelpModalProps) => {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" aria-describedby="help-intro" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="操作ガイドを閉じる">×</button>
        <header className="help-header">
          <span className="eyebrow">OPERATION GUIDE</span>
          <h2 id="help-title">麻雀牌レイアウトツールの使い方</h2>
          <p id="help-intro">牌姿の作成、牌理・受け入れの確認、図形や文字による解説画像づくりを、ひとつの画面で行えます。</p>
        </header>

        <nav className="help-index" aria-label="操作ガイドの目次">
          <a href="#help-start">はじめに</a>
          <a href="#help-edit">配置・編集</a>
          <a href="#help-efficiency">牌理・受け入れ</a>
          <a href="#help-hand">ランダム牌姿</a>
          <a href="#help-save">保存・共有</a>
        </nav>

        <div className="help-content">
          <section className="help-section" id="help-start">
            <div className="help-section-heading"><span>01</span><h3>はじめに</h3></div>
            <div className="help-steps">
              <div><b>1</b><p><strong>牌を配置する</strong><span>左の牌一覧から牌をクリックすると、ワークスペースに追加されます。空いている場所をクリックして配置することもできます。</span></p></div>
              <div><b>2</b><p><strong>選択して動かす</strong><span>牌や図形をクリックして選択し、ドラッグで移動します。複数選択は範囲選択または Ctrl / ⌘ を押しながらクリックで行えます。</span></p></div>
              <div><b>3</b><p><strong>タブを切り替える</strong><span>上部の「ホーム」「挿入」「手牌」「保存・共有」「設定」から、目的の操作を選びます。タブをダブルクリック、または Ctrl + F1 でリボンを折りたためます。</span></p></div>
            </div>
          </section>

          <section className="help-section" id="help-edit">
            <div className="help-section-heading"><span>02</span><h3>配置・編集</h3></div>
            <div className="help-grid">
              <article><strong>移動・整列・重なり順</strong><p>選択中の要素はドラッグで移動できます。ホームタブの整列、最前面／最背面で見やすく配置できます。</p></article>
              <article><strong>牌の表裏と回転</strong><p>牌を選択して表裏を切り替えられます。牌を右クリックして「牌を90度回転」を選ぶと、その牌だけを回転できます。</p></article>
              <article><strong>右クリックメニュー</strong><p>選択した要素を右クリックすると、複製、コピー、貼り付け、削除、ロック、プロパティ編集などを実行できます。表示項目は設定で自由に変更できます。</p></article>
              <article><strong>グリッドと吸着</strong><p>設定タブでグリッド表示を切り替えられます。要素の吸着は常に有効です。</p></article>
              <article><strong>文字・図形・画像</strong><p>挿入タブから文字、ペン、消しゴム、線・曲線・矢印、各種図形、画像を追加できます。画像はAltキーを押しながらドラッグすると、残したい範囲を囲んでトリミングできます。図形や描画ツールは右クリックで初期設定も変更できます。</p></article>
              <article><strong>コピー＆ペースト</strong><p>選択要素はコピーして貼り付けられます。牌姿表記をクリップボードから貼り付けた場合も、牌として配置できます。</p></article>
            </div>
          </section>

          <section className="help-section" id="help-efficiency">
            <div className="help-section-heading"><span>03</span><h3>牌理・受け入れ</h3></div>
            <div className="help-feature-list">
              <div><strong>表示する</strong><span>画面右上の「牌理・受け入れ」でパネルを表示／非表示にできます。パネル右上の×でも閉じられ、境界をドラッグすると大きさを変えられます。</span></div>
              <div><strong>13枚を選択した場合</strong><span>選択中の13枚を解析し、シャンテン数、有効牌（受け入れ）の種類数・枚数と、実際の有効牌を表示します。0シャンテンは「聴牌」と表示されます。</span></div>
              <div><strong>14枚を選択した場合</strong><span>選択した各牌を切ったときの受け入れだけを一覧で表示します。「受け入れ枚数順」はシャンテン数を優先し、同じシャンテン数では受け入れ枚数の多い順です。「牌の並び順」も選べます。</span></div>
              <div><strong>一人麻雀の期待値</strong><span>14枚を選択して「一人麻雀の期待値を計算」を開き、場風・自風・巡目・ドラ・見えている牌を設定して計算します。打牌ごとの期待値、和了率、聴牌率、平均和了点を表示します。</span></div>
              <div><strong>計算するもの</strong><span>手牌変化のグラフを作り、18巡目から逆算する動的計画法で和了率と得点期待値を求めます。和了時は役・符・親子・ドラを計算し、放銃、鳴き、一発、海底など他家が必要な要素は計算しません。</span></div>
              <div><strong>解析対象</strong><span>ワークスペース上の表向きの牌を選択して解析します。13枚または14枚を選択していない場合は結果を表示しません。</span></div>
            </div>
          </section>

          <section className="help-section" id="help-hand">
            <div className="help-section-heading"><span>04</span><h3>ランダム牌姿</h3></div>
            <div className="help-feature-list">
              <div><strong>基本のランダム生成</strong><span>手牌タブから連続形、6枚形、6枚形・複合形、7枚形、13枚、14枚を生成できます。シャッフルは配置済みの牌をランダムに並べ替えます。</span></div>
              <div><strong>1シャンテン形</strong><span>「余剰牌型」「完全形」「ヘッドレス1型」「ヘッドレス2型」「くっつき」を選ぶと、条件を検証した13枚の牌姿を生成します。同一牌は最大4枚です。</span></div>
              <div><strong>完全形のフォロー</strong><span>完全形は、ターツの構成牌を重ねる縦のフォローと、カンチャン形の外側・構成牌を使うフォローを含めて生成します。</span></div>
              <div><strong>使用する牌種</strong><span>1シャンテン形は萬子・筒子・索子・字牌を含む全34種から生成します。通常のランダム生成では、手牌タブの使用する牌種フィルターを利用できます。</span></div>
            </div>
          </section>

          <section className="help-section" id="help-save">
            <div className="help-section-heading"><span>05</span><h3>保存・共有</h3></div>
            <div className="help-steps compact">
              <div><b>1</b><p><strong>ブラウザに保存</strong><span>保存・共有タブの「保存」で、現在のページと配置をこのブラウザに保存します。保存ページから読み込み・名前変更・削除ができます。</span></p></div>
              <div><b>2</b><p><strong>保存ページを管理する</strong><span>保存ページでは、呼び出し、上書き保存、名前変更、分類、並べ替え、削除ができます。複数ページをまとめて保存することもできます。</span></p></div>
              <div><b>3</b><p><strong>共有する</strong><span>保存ページの「共有ファイル保存」でレイアウトファイルを書き出せます。保存・共有タブの「共有ファイル読込」から、受け取ったファイルを開けます。</span></p></div>
            </div>
          </section>

          <section className="help-section help-shortcuts" aria-labelledby="shortcut-title">
            <div className="help-section-heading"><span>⌨</span><h3 id="shortcut-title">よく使うショートカット</h3></div>
            <div className="shortcut-list">
              <span><Shortcut>Delete / Backspace</Shortcut> 選択要素を削除</span>
              <span><Shortcut>Ctrl / ⌘ + Z</Shortcut> 元に戻す</span>
              <span><Shortcut>Ctrl / ⌘ + Y</Shortcut> やり直す</span>
              <span><Shortcut>Ctrl / ⌘ + C / V</Shortcut> コピー・貼り付け</span>
              <span><Shortcut>Ctrl / ⌘ + D</Shortcut> 複製</span>
              <span><Shortcut>矢印キー</Shortcut> 少し移動</span>
              <span><Shortcut>Shift + 矢印キー</Shortcut> 大きく移動</span>
              <span><Shortcut>Esc</Shortcut> 選択・配置ツールを解除</span>
            </div>
          </section>
        </div>
        <footer className="help-footer"><button className="primary-button" type="button" onClick={onClose}>レイアウト編集をはじめる</button></footer>
      </section>
    </div>
  )
}
