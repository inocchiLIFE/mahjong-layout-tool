import { useEffect } from 'react'

const announcements = [
  { date: '2026年8月17日 23:59', title: '文字選択を改善', text: '文字サイズを変更した後も、右から左へのドラッグを含む範囲選択ができるように修正しました。選択位置が再描画で末尾へ戻らないようにし、表示文字の大きさに合わせて選択範囲を広げています。' },
  { date: '2026年8月17日 23:37', title: '太文字に対応', text: 'ホームの文字編集、右クリックの選択範囲編集、プロパティ編集で太字を設定できるようになりました。設定した太字は保存後も保持されます。' },
  { date: '2026年8月17日 23:29', title: '文字カーソルの位置を修正', text: '部分的に文字サイズを変更した文字を入力するときも、カーソル線が実際の文字の位置とサイズに合うように修正しました。' },
  { date: '2026年8月17日 23:23', title: '選択色のリアルタイム表示を改善', text: '文字をドラッグして選択している途中から、設置文字側へ選択色が反映されるようにしました。' },
  { date: '2026年8月17日 23:17', title: '部分文字サイズ変更時の選択枠を修正', text: '一部の文字だけサイズを変更したときも、選択枠や操作線が実際に表示される文字の幅・高さに合うように修正しました。' },
  { date: '2026年8月17日 23:09', title: '選択文字の表示と書式メニューを改善', text: '選択中の文字を設置文字の上でハイライト表示し、入力欄に重なる標準の選択表示をなくしました。文字サイズ変更後も選択範囲と書式メニューをそのまま使えます。' },
  { date: '2026年8月17日 22:31', title: '選択文字の書式と改行表示を修正', text: '文字入力中に選択した範囲を右クリックして色・サイズ・フォントを変更したとき、サイズ変更が反映され、文字が意図せず改行されないように修正しました。' },
  { date: '2026年8月17日 22:11', title: '選択文字の書式設定に対応', text: '文字入力中に範囲を選択して右クリックすると、その部分だけ文字色・サイズ・フォントを変更できるようになりました。保存後も書式を保持します。' },
  { date: '2026年8月17日 21:58', title: 'マーカー描画を追加', text: 'ホームの図形・線から半透明のマーカーを選んで、作業領域に線を引けるようになりました。記号・文字の一覧からも配置できます。' },
  { date: '2026年7月30日 18:00', title: 'マイ図形のドラッグ配置に対応', text: '左側のマイ図形を作業領域へドラッグ＆ドロップして配置できるようになりました。ドラッグ中は登録した図形の内容をプレビューできます。' },
  { date: '2026年7月30日 17:30', title: 'マイ図形の表示を改善', text: '三角形・✕・丸を含むマイ図形を、登録した形のまま正しく表示するように修正しました。' },
  { date: '2026年7月30日 16:00', title: 'マイ図形の編集機能を追加', text: '登録したマイ図形を固定グループとして扱い、移動・比率を保ったサイズ変更・右クリック編集ができるようになりました。配置時の既定色も設定できます。' },
  { date: '2026年7月29日 19:00', title: '使い方を更新', text: 'マイ図形の登録、既定色、右クリック編集、コピー・貼り付け操作の説明を使い方に追加しました。' },
]

export const AnnouncementsModal = ({ onClose }: { onClose: () => void }) => {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="announcements-modal" role="dialog" aria-modal="true" aria-labelledby="announcements-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" type="button" onClick={onClose} aria-label="お知らせを閉じる">×</button>
      <header className="announcements-header">
        <span className="eyebrow">ANNOUNCEMENTS</span>
        <h2 id="announcements-title">アップデートのお知らせ</h2>
        <p>このアプリの更新内容を日時順に表示しています。</p>
      </header>
      <div className="announcements-content">
        {announcements.map((announcement) => <article key={`${announcement.date}-${announcement.title}`} className="announcement-item">
          <time dateTime={announcement.date.replace(/[年月]/g, '-').replace('日 ', 'T').replace('時', ':').replace('分', '')}>{announcement.date}</time>
          <div><h3>{announcement.title}</h3><p>{announcement.text}</p></div>
        </article>)}
      </div>
      <footer className="announcements-footer"><button className="primary-button" type="button" onClick={onClose}>閉じる</button></footer>
    </section>
  </div>
}
