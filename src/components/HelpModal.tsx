interface HelpModalProps {
  onClose: () => void
}

export const HelpModal = ({ onClose }: HelpModalProps) => (
  <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" type="button" onClick={onClose} aria-label="操作ガイドを閉じる">×</button>
      <span className="eyebrow">QUICK START</span>
      <h2 id="help-title">直感的に牌姿を作れます</h2>
      <div className="help-steps">
        <div><b>1</b><p><strong>牌や記号を置く</strong><span>牌一覧をクリックするかドラッグ。記号はツールを選び、白いWorkspaceをクリックします。</span></p></div>
        <div><b>2</b><p><strong>文字を好きな位置へ</strong><span>「クリック文字」を選んでWorkspaceをクリック。文字はダブルクリックまたは「文字編集」で直せます。</span></p></div>
        <div><b>3</b><p><strong>まとめて選択・移動</strong><span>空白をドラッグして範囲選択。選択した要素の一つをドラッグするとまとめて移動します。</span></p></div>
        <div><b>4</b><p><strong>サイズと保存</strong><span>数値入力または右下のハンドルでサイズ変更。JSONとPNGにも書き出せます。</span></p></div>
      </div>
      <div className="shortcut-list">
        <span><kbd>Delete</kbd> 選択を削除</span>
        <span><kbd>R</kbd> 選択を回転</span>
        <span><kbd>Ctrl / ⌘ + Z</kbd> 元に戻す</span>
        <span><kbd>Shift + クリック</kbd> 選択を追加・解除</span>
      </div>
      <button className="primary-button" type="button" onClick={onClose}>はじめる</button>
    </section>
  </div>
)
