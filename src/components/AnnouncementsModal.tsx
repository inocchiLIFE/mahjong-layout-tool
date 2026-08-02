import { useEffect } from 'react'

const announcements = [
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
