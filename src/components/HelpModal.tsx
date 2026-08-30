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
          <p id="help-intro">牌姿の作成・牌理の確認・配牌の自動生成・画像出力までを、ひとつの画面で行えます。まずは牌を配置し、必要に応じて右側の牌理パネルを開いてください。</p>
        </header>

        <nav className="help-index" aria-label="操作ガイドの目次">
          <a href="#help-start">はじめに</a>
          <a href="#help-edit">配置・編集</a>
          <a href="#help-efficiency">牌理・受け入れ</a>
          <a href="#help-hand">配牌作成</a>
          <a href="#help-save">保存・出力</a>
          <a href="#help-settings">設定</a>
        </nav>

        <div className="help-content">
          <section className="help-section" id="help-start">
            <div className="help-section-heading"><span>01</span><h3>はじめに</h3></div>
            <div className="help-steps">
              <div><b>1</b><p><strong>牌一覧から追加する</strong><span>左側の牌をクリックすると、作業領域へ追加されます。牌・図形・文字はドラッグでも配置できます。不要な要素は左上の削除エリアへドラッグするか、選択して Delete / Backspace で削除します。</span></p></div>
              <div><b>2</b><p><strong>選択して操作する</strong><span>要素をクリックすると選択できます。複数選択は Ctrl / ⌘ を押しながらクリック、または空いている場所からドラッグして囲みます。選択中の牌は、牌理・受け入れの解析対象にもなります。右クリックではプロパティ編集、複製、コピー、貼り付けなどを行えます。</span></p></div>
              <div><b>3</b><p><strong>ページは自動保存される</strong><span>編集内容はこのブラウザに自動保存されます。上部のページタブで複数ページを作り、ページ名の変更・並べ替え・削除もできます。</span></p></div>
            </div>
          </section>

          <section className="help-section" id="help-edit">
            <div className="help-section-heading"><span>02</span><h3>配置・編集</h3></div>
            <div className="help-grid">
              <article><strong>移動・複製・重なり順</strong><p>選択した要素をドラッグして移動します。ホームタブから複製、最前面・最背面への移動、ロック、削除を行えます。コピー・貼り付けは右クリックメニューまたは Ctrl / ⌘ + C・V を使います。</p></article>
              <article><strong>牌の向き・理牌</strong><p>選択牌は表／裏を切り替え、90度回転できます。ホームタブの「理牌」で、選択した牌だけを種類・数字順に並べます。横向き牌を含む副露ブロックはそのまま保持されます。</p></article>
              <article><strong>文字・図形・線</strong><p>挿入タブまたは左側の記号・文字から追加できます。ペン、マーカー、直線、曲線、矢印、長方形・丸・三角形・✕・波線を配置できます。マーカーは図形・線の色設定で色を変更でき、Shiftを押しながら描くと直線になります。文字入力中に範囲を選択して右クリックすると、その部分だけ色・サイズ・フォント・太字・下線・背景色を変更できます。ホームの文字編集でも文字全体または次に入力する文字の書式を設定できます。</p></article>
              <article><strong>線のスタイル</strong><p>ホームの「図形・線」または各ツールを右クリックして、色・太さ・線パターンを設定できます。実線、破線、点線、一点鎖線、二重線に対応し、長方形・丸・三角形・✕・波線にも選んだパターンが反映されます。設定した色や太さ、パターンは次に配置する要素の初期値として使えます。</p></article>
              <article><strong>マイ図形を登録・配置する</strong><p>図形・線・文字・画像を選択して、ホームの「マイ図形に保存」を押します。名前と配置時の既定色を登録すると、挿入タブと左側の「マイ図形」から呼び出せます。ボタンをクリックして配置するほか、作業領域へドラッグして配置でき、ドラッグ中は登録した形をプレビューできます。登録ボタンを右クリックすると、名前・既定色の変更や削除ができます。</p></article>
              <article><strong>マイ図形を編集する</strong><p>配置したマイ図形はドラッグで移動できます。選択時の右下の■をドラッグすると、左上を固定して比率を保ったまま拡大・縮小します。右クリックの「プロパティ編集」では、その配置済み図形だけの全体色を変更できます。</p></article>
              <article><strong>画像の追加・トリミング</strong><p>画像は貼り付け・ファイル選択・ドラッグ＆ドロップで追加できます。選択すると表示されるハンドルで比率を保って拡大縮小でき、周囲のハンドルをドラッグするとトリミングできます。</p></article>
              <article><strong>作業領域の範囲</strong><p>作業領域は自由に広く使えます。保存・出力タブの幅・高さ、または作業領域の右クリックメニュー「作業領域を設定」で範囲を変更できます。設定タブでは新規ページの初期サイズも指定でき、「範囲表示」をオンにすると出力範囲の枠だけを表示します。</p></article>
              <article><strong>右クリックメニュー</strong><p>選択した要素を右クリックすると、複製・コピー・貼り付け・回転・表裏・ロック・プロパティ編集・スポイラー・前面／背面移動などを行えます。空いている場所では文字・画像・線・図形（波線を含む）をその位置に追加したり、作業領域を設定したりできます。表示する項目は設定画面または右クリックメニューの設定から選べます。</p></article>
              <article><strong>スポイラー（非表示）</strong><p>選択した要素をホームタブの「スポイラー」または右クリックの「スポイラーにする」から、内容を黒塗りで隠せます。黒塗り部分をクリックまたはEnter／Spaceで表示し、表示後にもう一度クリックすると再び隠せます。文字編集中に範囲を選択して書式メニューの▮を押すと、その範囲だけを同じように切り替えられます。</p></article>
              <article><strong>重なりと選択</strong><p>設定タブの「牌の重なりを許可する」で、牌を重ねて配置するか選べます。複数選択は Ctrl / ⌘ クリックまたはドラッグ範囲選択に対応し、右から左へ囲んだ場合も選択できます。</p></article>
            </div>
          </section>

          <section className="help-section" id="help-efficiency">
            <div className="help-section-heading"><span>03</span><h3>牌理・受け入れ</h3></div>
            <div className="help-feature-list">
              <div><strong>解析を始める</strong><span>表向きの牌を選択して「牌理・受け入れ」を開きます。最大14枚までの選択牌を解析し、通常形・七対子・国士無双を含むシャンテン数と有効牌を表示します。</span></div>
              <div><strong>13枚のとき</strong><span>シャンテン数、有効牌の種類数・残り枚数を確認できます。1シャンテンなら、余剰牌型・完全形・ヘッドレス1型・ヘッドレス2型・くっつき型も表示されます。</span></div>
              <div><strong>14枚のとき</strong><span>各打牌後のシャンテン数・1シャンテン分類・受け入れをカードで比較できます。聴牌になる打牌は和了牌と残り枚数を表示します。カードはドラッグで並べ替え、不要な候補は非表示にして残りだけを比較できます。パネルを広げると、カードは読みやすい幅を保ちながら2列・3列・4列と自動で増えます。</span></div>
              <div><strong>好形・愚形聴牌の内訳</strong><span>1シャンテン時は、好形・愚形聴牌の内訳表示をオンにできます。13枚では手牌全体、14枚では打牌ごとに確認できます。好形は待ちが合計6枚以上、愚形はそれ以外として、種類数・枚数・受け入れ枚数に対する割合を表示します。</span></div>
              <div><strong>副露を含む手牌</strong><span>横向きの牌を含む連続形または同一牌の3〜4枚を副露として自動認識します。牌1枚分の空きも認識し、副露牌は打牌候補に含めず、受け入れの残り枚数からも差し引きます。</span></div>
              <div><strong>一人麻雀の期待値</strong><span>14枚選択時は、右側パネルから期待値計算も実行できます。場風・自風・巡目・ドラ表示牌（最大5枚）・見えている牌などを設定でき、表示される和了率・聴牌率・平均和了点は一人麻雀用の目安です。</span></div>
            </div>
          </section>

          <section className="help-section" id="help-hand">
            <div className="help-section-heading"><span>04</span><h3>配牌作成</h3></div>
            <div className="help-feature-list">
              <div><strong>すぐに形を作る</strong><span>配牌タブの連続形、6枚形、6枚形暗刻含み、7枚形、13枚、14枚で、指定枚数の牌姿を自動生成します。使用する種類は萬子・筒子・索子から選べます。</span></div>
              <div><strong>何切る問題</strong><span>「何切る問題」を押すと14枚の手牌を作成し、選択した状態で置きます。使用する1シャンテン形をチェックすると、その分類から問題を作成します。複数選択時はその中からランダム、未選択時は5分類からランダムです。</span></div>
              <div><strong>1シャンテン形を指定</strong><span>余剰牌型・完全形・ヘッドレス1・ヘッドレス2・くっつきから選んで13枚の1シャンテン形を生成できます。ランダムで5分類から生成することも可能です。</span></div>
              <div><strong>作成後の使い方</strong><span>生成した牌は通常の牌と同じように移動・回転・複製できます。必要な牌だけ選択し、ホームタブの「理牌」で教材や検討図に仕上げてください。</span></div>
            </div>
          </section>

          <section className="help-section" id="help-save">
            <div className="help-section-heading"><span>05</span><h3>保存・出力</h3></div>
            <div className="help-steps compact">
              <div><b>1</b><p><strong>ブラウザに保存</strong><span>保存・出力タブの「保存」で、現在のページと作業状態をこのブラウザに保存します。保存ページから名前を付けて保存し、後から読み込み・複製・削除もできます。</span></p></div>
              <div><b>2</b><p><strong>PNG・PDFとして出力</strong><span>「PNG保存」で作業領域を画像として保存します。「PNG背景を透過」をオンにすると背景を透明にできます。「PDF保存」は作業領域をPDFとして出力します。</span></p></div>
              <div><b>3</b><p><strong>他の端末へ共有</strong><span>「共有ファイル読込」で、保存した共有ファイルを読み込めます。ページ・配置・設定を引き継ぎたい場合は、共有用の保存ファイルを利用してください。</span></p></div>
            </div>
          </section>

          <section className="help-section" id="help-settings">
            <div className="help-section-heading"><span>06</span><h3>設定</h3></div>
            <div className="help-feature-list">
              <div><strong>画面と作業領域</strong><span>設定タブから画面・ポップアップ・文字サイズ、グリッド表示、牌の重なり、新規作業領域の幅・高さを初期値として保存できます。</span></div>
              <div><strong>アプリの見た目</strong><span>上部バーの色とアプリアイコンを変更できます。作業画面の背景色は変わりません。</span></div>
              <div><strong>文字・図形の初期値</strong><span>フォント、文字サイズ、太字、下線、文字色・背景色、図形・描画の色、線の太さを、次に追加する要素の初期値として設定できます。</span></div>
              <div><strong>右クリック項目</strong><span>右クリックメニューに表示する操作を選べます。設定はこの端末のブラウザに保存され、後からいつでも変更できます。</span></div>
              <div><strong>参考サイト・更新情報</strong><span>右上の「参考サイト」から牌理・受け入れや期待値計算の参考資料を確認できます。📢の更新情報では、機能追加や修正内容を日時付きで確認できます。</span></div>
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
