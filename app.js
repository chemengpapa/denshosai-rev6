const STORAGE_KEY = 'denshosai-rev6-state';
const uiState = {
  libraryQuery: '',
  libraryShelf: 'all',
  libraryCapture: 'all',
  libraryOwned: 'all',
  notesQuery: '',
  notesTag: 'all',
};

const shelfLabels = {
  new_release: '新刊候補',
  wishlist: 'ほしい本',
  backlog: '積読',
  reading_now: '読書中',
  finished: '読了',
};

const captureLabels = {
  unstarted: '未着手',
  memo_only: 'メモだけあり',
  in_progress: '抜き書き途中',
  organized: 'ある程度整理済み',
};

const priorityOptions = ['高', '中', '低'];

function generateId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16).slice(-4)}`;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function nowString() {
  const dt = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function parseTags(text) {
  return String(text || '')
    .split(/[\n,、]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex((x) => normalize(x) === normalize(item)) === index);
}

function tagsToText(tags) {
  return (tags || []).join(', ');
}

function normalize(text) {
  return String(text || '').normalize('NFKC').toLowerCase().trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function migrateNote(note) {
  return {
    id: note.id || generateId('note'),
    page: String(note.page || ''),
    quote: String(note.quote || ''),
    comment: String(note.comment || ''),
    tags: Array.isArray(note.tags) ? note.tags.filter(Boolean) : [],
    created_at: String(note.created_at || nowString()),
  };
}

function migrateBook(book) {
  const migrated = {
    id: book.id || generateId('book'),
    title: String(book.title || 'タイトル未設定'),
    author: String(book.author || ''),
    publisher: String(book.publisher || ''),
    release_date: String(book.release_date || ''),
    memo: String(book.memo || ''),
    tags: Array.isArray(book.tags) ? book.tags.filter(Boolean) : [],
    priority: priorityOptions.includes(book.priority) ? book.priority : '中',
    owned: Boolean(book.owned),
    read: Boolean(book.read),
    shelf: shelfLabels[book.shelf] ? book.shelf : 'wishlist',
    isbn: String(book.isbn || ''),
    source: String(book.source || 'mobile'),
    cover_url: String(book.cover_url || ''),
    external_url: String(book.external_url || ''),
    review: String(book.review || ''),
    rating: String(book.rating || ''),
    added_at: String(book.added_at || todayString()),
    finished_date: String(book.finished_date || ''),
    capture_status: captureLabels[book.capture_status] ? book.capture_status : 'unstarted',
    reading_notes: Array.isArray(book.reading_notes) ? book.reading_notes.map(migrateNote) : [],
  };

  if (migrated.shelf === 'finished') migrated.read = true;
  if (migrated.read && !migrated.finished_date) migrated.finished_date = todayString();
  return migrated;
}

function seedState() {
  const seed = window.REV6_SEED_DATA || { version: 1, books: [] };
  return {
    version: 1,
    updated_at: nowString(),
    books: Array.isArray(seed.books) ? seed.books.map(migrateBook) : [],
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const initial = seedState();
    saveState(initial);
    return initial;
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const state = { version: 1, updated_at: nowString(), books: parsed.map(migrateBook) };
      saveState(state);
      return state;
    }
    const state = {
      version: 1,
      updated_at: parsed.updated_at || nowString(),
      books: Array.isArray(parsed.books) ? parsed.books.map(migrateBook) : [],
    };
    saveState(state);
    return state;
  } catch (error) {
    console.error(error);
    const fallback = seedState();
    saveState(fallback);
    return fallback;
  }
}

function saveState(nextState) {
  nextState.updated_at = nowString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

let state = loadState();

function getBookById(bookId) {
  return state.books.find((book) => book.id === bookId) || null;
}

function getAllNoteTags() {
  const tags = [];
  state.books.forEach((book) => {
    (book.reading_notes || []).forEach((note) => {
      (note.tags || []).forEach((tag) => {
        if (!tags.some((item) => normalize(item) === normalize(tag))) tags.push(tag);
      });
    });
  });
  return tags.sort((a, b) => a.localeCompare(b, 'ja'));
}

function flattenNotes() {
  const items = [];
  state.books.forEach((book) => {
    (book.reading_notes || []).forEach((note) => {
      items.push({
        ...note,
        bookId: book.id,
        bookTitle: book.title,
        bookAuthor: book.author,
        bookCover: book.cover_url || '',
        bookShelf: book.shelf,
      });
    });
  });
  return items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseHash() {
  const hash = location.hash || '#/library';
  const cleaned = hash.replace(/^#/, '');
  const [pathPart, queryPart] = cleaned.split('?');
  const path = pathPart || '/library';
  const segments = path.split('/').filter(Boolean);
  const query = new URLSearchParams(queryPart || '');
  return { path, segments, query };
}

function navigate(path) {
  location.hash = path;
}

function summaryCounts() {
  return {
    total: state.books.length,
    reading_now: state.books.filter((b) => b.shelf === 'reading_now').length,
    backlog: state.books.filter((b) => b.shelf === 'backlog').length,
    wishlist: state.books.filter((b) => b.shelf === 'wishlist').length,
    finished: state.books.filter((b) => b.shelf === 'finished').length,
    unstartedCapture: state.books.filter((b) => b.capture_status === 'unstarted').length,
    notes: flattenNotes().length,
  };
}

function filterBooks() {
  const query = normalize(uiState.libraryQuery);
  return state.books.filter((book) => {
    if (uiState.libraryShelf !== 'all' && book.shelf !== uiState.libraryShelf) return false;
    if (uiState.libraryCapture !== 'all' && book.capture_status !== uiState.libraryCapture) return false;
    if (uiState.libraryOwned === 'owned' && !book.owned) return false;
    if (uiState.libraryOwned === 'not_owned' && book.owned) return false;

    if (!query) return true;
    const haystack = normalize([
      book.title,
      book.author,
      book.publisher,
      book.memo,
      book.review,
      tagsToText(book.tags),
    ].join(' '));
    return haystack.includes(query);
  });
}

function filterNotes() {
  const query = normalize(uiState.notesQuery);
  return flattenNotes().filter((note) => {
    if (uiState.notesTag !== 'all' && !(note.tags || []).some((tag) => normalize(tag) === normalize(uiState.notesTag))) {
      return false;
    }
    if (!query) return true;
    const haystack = normalize([
      note.quote,
      note.comment,
      note.page,
      tagsToText(note.tags),
      note.bookTitle,
      note.bookAuthor,
    ].join(' '));
    return haystack.includes(query);
  });
}

function statusBadge(text, tone = 'soft') {
  return `<span class="badge badge--${tone}">${escapeHtml(text)}</span>`;
}

function coverMarkup(book, size = 'm') {
  if (book.cover_url) {
    return `<img class="cover cover--${size}" src="${escapeHtml(book.cover_url)}" alt="${escapeHtml(book.title)}の表紙">`;
  }
  return `<div class="cover cover--${size} cover--placeholder"><span>NO COVER</span></div>`;
}

function bookCard(book) {
  return `
    <article class="book-card">
      <a class="book-card__cover" href="#/book/${encodeURIComponent(book.id)}">${coverMarkup(book, 'm')}</a>
      <div class="book-card__body">
        <div class="book-card__topline">
          ${statusBadge(shelfLabels[book.shelf] || book.shelf, 'accent')}
          ${statusBadge(captureLabels[book.capture_status] || '未設定', 'soft')}
        </div>
        <a class="book-card__title" href="#/book/${encodeURIComponent(book.id)}">${escapeHtml(book.title)}</a>
        <p class="book-card__meta">${escapeHtml(book.author || '著者未設定')} ・ ${escapeHtml(book.publisher || '出版社未設定')}</p>
        <p class="book-card__memo">${escapeHtml(book.memo || 'まだメモはありません。')}</p>
        <div class="book-card__foot">
          <span>${book.reading_notes.length}件の抜き書き</span>
          <a href="#/note/new?book=${encodeURIComponent(book.id)}">採集する</a>
        </div>
      </div>
    </article>
  `;
}

function renderLibraryView() {
  const counts = summaryCounts();
  const books = filterBooks();
  return `
    <section class="hero">
      <div>
        <p class="eyebrow">rev6 / local-first</p>
        <h1>電子書斎</h1>
        <p class="lead">完璧に整理する前に、まず1行だけでも残すための書斎です。</p>
      </div>
      <div class="hero-actions">
        <a class="button" href="#/book/new">本を追加</a>
        <a class="button button--ghost" href="#/note/new">クイック採集</a>
      </div>
    </section>

    <section class="summary-grid">
      <article class="summary-card"><span class="summary-card__number">${counts.total}</span><span class="summary-card__label">登録本</span></article>
      <article class="summary-card"><span class="summary-card__number">${counts.reading_now}</span><span class="summary-card__label">読書中</span></article>
      <article class="summary-card"><span class="summary-card__number">${counts.unstartedCapture}</span><span class="summary-card__label">抜き書き未着手</span></article>
      <article class="summary-card"><span class="summary-card__number">${counts.notes}</span><span class="summary-card__label">抜き書き総数</span></article>
    </section>

    <section class="panel">
      <div class="panel__header">
        <h2>探す・絞り込む</h2>
        <p>書名、著者、タグ、メモで探せます。抜き書き待ちの本もここで絞れます。</p>
      </div>
      <div class="filter-grid">
        <label class="field">
          <span>キーワード</span>
          <input id="library-query" type="search" placeholder="書名・著者・タグ・メモ" value="${escapeHtml(uiState.libraryQuery)}">
        </label>
        <label class="field">
          <span>棚</span>
          <select id="library-shelf">
            <option value="all">すべて</option>
            ${Object.entries(shelfLabels).map(([key, label]) => `<option value="${key}" ${uiState.libraryShelf === key ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>抜き書き進捗</span>
          <select id="library-capture">
            <option value="all">すべて</option>
            ${Object.entries(captureLabels).map(([key, label]) => `<option value="${key}" ${uiState.libraryCapture === key ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>所有状態</span>
          <select id="library-owned">
            <option value="all">すべて</option>
            <option value="owned" ${uiState.libraryOwned === 'owned' ? 'selected' : ''}>所有</option>
            <option value="not_owned" ${uiState.libraryOwned === 'not_owned' ? 'selected' : ''}>未所有</option>
          </select>
        </label>
      </div>
      <div class="inline-actions">
        <button class="button button--ghost" id="clear-library-filters" type="button">絞り込みを解除</button>
        <span class="muted">${books.length}冊表示中</span>
      </div>
    </section>

    <section class="book-list">
      ${books.length ? books.map(bookCard).join('') : `<div class="empty-state"><p>条件に合う本がありません。</p></div>`}
    </section>
  `;
}

function renderBookDetail(book) {
  if (!book) {
    return `<section class="empty-state"><p>本が見つかりませんでした。</p><a class="button" href="#/library">一覧へ戻る</a></section>`;
  }
  return `
    <section class="detail-hero panel">
      <div class="detail-cover">${coverMarkup(book, 'l')}</div>
      <div class="detail-main">
        <p class="eyebrow">${escapeHtml(shelfLabels[book.shelf] || '未分類')}</p>
        <h1>${escapeHtml(book.title)}</h1>
        <p class="detail-meta">${escapeHtml(book.author || '著者未設定')} ・ ${escapeHtml(book.publisher || '出版社未設定')}</p>
        <div class="badge-row">
          ${statusBadge(captureLabels[book.capture_status] || '未設定', 'soft')}
          ${statusBadge(book.owned ? '所有' : '未所有', 'soft')}
          ${statusBadge(book.read ? '読了' : '未読', 'soft')}
        </div>
        <p class="detail-memo">${escapeHtml(book.memo || 'まだメモはありません。')}</p>
        <div class="inline-actions">
          <a class="button" href="#/note/new?book=${encodeURIComponent(book.id)}">この本に採集する</a>
          <a class="button button--ghost" href="#/book/edit/${encodeURIComponent(book.id)}">本を編集</a>
        </div>
      </div>
    </section>

    <section class="panel detail-grid">
      <div>
        <h2>本の情報</h2>
        <dl class="meta-list">
          <div><dt>発売日</dt><dd>${escapeHtml(book.release_date || '未設定')}</dd></div>
          <div><dt>ISBN</dt><dd>${escapeHtml(book.isbn || '未設定')}</dd></div>
          <div><dt>優先度</dt><dd>${escapeHtml(book.priority || '中')}</dd></div>
          <div><dt>登録日</dt><dd>${escapeHtml(book.added_at || '未設定')}</dd></div>
          <div><dt>読了日</dt><dd>${escapeHtml(book.finished_date || '未設定')}</dd></div>
          <div><dt>タグ</dt><dd>${book.tags.length ? book.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join(' ') : 'なし'}</dd></div>
        </dl>
        ${book.review ? `<div class="review-box"><h3>感想</h3><p>${escapeHtml(book.review)}</p></div>` : ''}
      </div>
      <div>
        <h2>抜き書き (${book.reading_notes.length})</h2>
        ${book.reading_notes.length ? book.reading_notes.slice().sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')).map((note) => `
          <article class="note-card">
            <div class="note-card__top">${note.page ? `<span>${escapeHtml(note.page)}</span>` : '<span>ページ未設定</span>'}<span>${escapeHtml(note.created_at || '')}</span></div>
            ${note.quote ? `<blockquote>${escapeHtml(note.quote)}</blockquote>` : ''}
            ${note.comment ? `<p class="note-comment">${escapeHtml(note.comment)}</p>` : ''}
            ${(note.tags || []).length ? `<div class="tag-row">${note.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
          </article>
        `).join('') : `<div class="empty-state"><p>まだ採集はありません。まずは一言メモだけでも大丈夫です。</p></div>`}
      </div>
    </section>
  `;
}

function renderBookForm(book) {
  const isEdit = Boolean(book);
  const target = book || {
    title: '', author: '', publisher: '', release_date: '', memo: '', tags: [], priority: '中',
    owned: false, read: false, shelf: 'wishlist', isbn: '', cover_url: '', external_url: '', review: '', rating: '',
    capture_status: 'unstarted', finished_date: '',
  };
  return `
    <section class="panel form-panel">
      <div class="panel__header">
        <p class="eyebrow">${isEdit ? '編集' : '新規追加'}</p>
        <h1>${isEdit ? '本を編集する' : '本を追加する'}</h1>
        <p>あとで整えれば大丈夫です。まずは必要最低限だけでも保存できます。</p>
      </div>
      <form id="book-form" class="stack-form">
        <input type="hidden" name="book_id" value="${escapeHtml(book?.id || '')}">
        <label class="field"><span>タイトル *</span><input name="title" required value="${escapeHtml(target.title)}"></label>
        <label class="field"><span>著者</span><input name="author" value="${escapeHtml(target.author)}"></label>
        <label class="field"><span>出版社</span><input name="publisher" value="${escapeHtml(target.publisher)}"></label>
        <label class="field"><span>発売日</span><input name="release_date" placeholder="2026-04-19" value="${escapeHtml(target.release_date)}"></label>
        <label class="field"><span>棚</span><select name="shelf">${Object.entries(shelfLabels).map(([key, label]) => `<option value="${key}" ${target.shelf === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <div class="field-grid">
          <label class="field"><span>優先度</span><select name="priority">${priorityOptions.map((value) => `<option value="${value}" ${target.priority === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
          <label class="field"><span>抜き書き進捗</span><select name="capture_status">${Object.entries(captureLabels).map(([key, label]) => `<option value="${key}" ${target.capture_status === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        </div>
        <div class="toggle-grid">
          <label class="toggle"><input type="checkbox" name="owned" ${target.owned ? 'checked' : ''}><span>所有している</span></label>
          <label class="toggle"><input type="checkbox" name="read" ${target.read ? 'checked' : ''}><span>読了した</span></label>
        </div>
        <label class="field"><span>ひとことメモ</span><textarea name="memo" rows="3" placeholder="まずは短い一言でもOK">${escapeHtml(target.memo)}</textarea></label>
        <label class="field"><span>タグ</span><input name="tags" value="${escapeHtml(tagsToText(target.tags))}" placeholder="海外文学, 習慣, 構造化思考"></label>
        <details class="more-fields">
          <summary>詳細項目を開く</summary>
          <label class="field"><span>ISBN</span><input name="isbn" value="${escapeHtml(target.isbn)}"></label>
          <label class="field"><span>表紙URL</span><input name="cover_url" value="${escapeHtml(target.cover_url)}"></label>
          <label class="field"><span>外部リンク</span><input name="external_url" value="${escapeHtml(target.external_url)}"></label>
          <label class="field"><span>感想</span><textarea name="review" rows="4">${escapeHtml(target.review)}</textarea></label>
          <label class="field"><span>評価</span><input name="rating" value="${escapeHtml(target.rating)}" placeholder="5/5"></label>
          <label class="field"><span>読了日</span><input name="finished_date" value="${escapeHtml(target.finished_date)}" placeholder="2026-04-19"></label>
        </details>
        <div class="inline-actions">
          <button class="button" type="submit">${isEdit ? '更新する' : '追加する'}</button>
          <a class="button button--ghost" href="${isEdit ? `#/book/${encodeURIComponent(book.id)}` : '#/library'}">キャンセル</a>
        </div>
      </form>
    </section>
  `;
}

function renderNoteForm(preselectedBookId = '') {
  const options = state.books
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title, 'ja'))
    .map((book) => `<option value="${book.id}" ${book.id === preselectedBookId ? 'selected' : ''}>${escapeHtml(book.title)} / ${escapeHtml(book.author)}</option>`)
    .join('');

  return `
    <section class="panel form-panel">
      <div class="panel__header">
        <p class="eyebrow">quick capture</p>
        <h1>抜き書きを追加する</h1>
        <p>完璧に整えなくて大丈夫です。本文がなくても、一言メモだけ保存できます。</p>
      </div>
      <form id="note-form" class="stack-form">
        <label class="field"><span>本 *</span><select name="book_id" required><option value="">本を選ぶ</option>${options}</select></label>
        <label class="field"><span>ページ</span><input name="page" placeholder="p.45 / 45頁"></label>
        <label class="field"><span>抜き書き本文</span><textarea name="quote" rows="5" placeholder="ここに気になった文章をそのまま保存"></textarea></label>
        <label class="field"><span>一言メモ</span><textarea name="comment" rows="3" placeholder="なぜ引っかかったかを一言で"></textarea></label>
        <label class="field"><span>タグ</span><input name="tags" placeholder="言語化, 習慣, 構造化思考"></label>
        <div class="inline-actions">
          <button class="button" type="submit">採集する</button>
          <a class="button button--ghost" href="${preselectedBookId ? `#/book/${encodeURIComponent(preselectedBookId)}` : '#/library'}">キャンセル</a>
        </div>
      </form>
    </section>
  `;
}

function renderNotesView() {
  const notes = filterNotes();
  const tags = getAllNoteTags();
  return `
    <section class="panel">
      <div class="panel__header">
        <p class="eyebrow">notes</p>
        <h1>抜き書き一覧</h1>
        <p>本を横断して、言葉を探せます。タグやキーワードで振り返りやすくしています。</p>
      </div>
      <div class="filter-grid">
        <label class="field"><span>キーワード</span><input id="notes-query" type="search" value="${escapeHtml(uiState.notesQuery)}" placeholder="本文・一言メモ・書名・著者"></label>
        <label class="field"><span>タグ</span><select id="notes-tag"><option value="all">すべて</option>${tags.map((tag) => `<option value="${escapeHtml(tag)}" ${uiState.notesTag === tag ? 'selected' : ''}>${escapeHtml(tag)}</option>`).join('')}</select></label>
      </div>
      <div class="inline-actions"><button class="button button--ghost" id="clear-note-filters" type="button">絞り込みを解除</button><span class="muted">${notes.length}件表示中</span></div>
    </section>
    <section class="note-list">
      ${notes.length ? notes.map((note) => `
        <article class="note-card note-card--wide">
          <div class="note-card__top"><a href="#/book/${encodeURIComponent(note.bookId)}">${escapeHtml(note.bookTitle)}</a><span>${escapeHtml(note.created_at || '')}</span></div>
          <p class="note-book-author">${escapeHtml(note.bookAuthor || '')}${note.page ? ` ・ ${escapeHtml(note.page)}` : ''}</p>
          ${note.quote ? `<blockquote>${escapeHtml(note.quote)}</blockquote>` : ''}
          ${note.comment ? `<p class="note-comment">${escapeHtml(note.comment)}</p>` : ''}
          ${(note.tags || []).length ? `<div class="tag-row">${note.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        </article>
      `).join('') : `<div class="empty-state"><p>条件に合う抜き書きはありません。</p></div>`}
    </section>
  `;
}

function renderSettingsView() {
  const counts = summaryCounts();
  return `
    <section class="panel">
      <div class="panel__header">
        <p class="eyebrow">backup / restore</p>
        <h1>データを守る</h1>
        <p>このアプリのデータは、この端末のブラウザ内に保存しています。機種変更やブラウザ初期化に備えて、定期的にバックアップしてください。</p>
      </div>
      <div class="summary-grid summary-grid--small">
        <article class="summary-card"><span class="summary-card__number">${counts.total}</span><span class="summary-card__label">本</span></article>
        <article class="summary-card"><span class="summary-card__number">${counts.notes}</span><span class="summary-card__label">抜き書き</span></article>
      </div>
      <div class="panel stack-panel">
        <h2>バックアップを書き出す</h2>
        <p>JSONファイルとして保存します。スマホの「ファイル」やクラウド保存へ退避してください。</p>
        <button class="button" id="export-json" type="button">バックアップを書き出す</button>
      </div>
      <div class="panel stack-panel">
        <h2>バックアップを読み込む</h2>
        <p>rev5の sample_books.json も、そのまま読み込めます。現在の端末データは上書きされます。</p>
        <input id="import-json" type="file" accept="application/json,.json">
        <button class="button button--ghost" id="import-seed" type="button">初期サンプルへ戻す</button>
      </div>
      <div class="panel stack-panel panel--soft">
        <h2>いまの保存先</h2>
        <p>ブラウザ内ローカル保存（localStorage）です。アプリを削除したりブラウザデータを消すと失われる可能性があるため、エクスポートを定期実施してください。</p>
      </div>
    </section>
  `;
}

function renderLayout(content, active) {
  return `
    <div class="shell">
      <header class="app-header">
        <div>
          <a class="brand" href="#/library">電子書斎 rev6</a>
          <p class="brand-sub">スマホ単独で、読書の言葉をその場で採集する</p>
        </div>
      </header>

      <main class="content-area">${content}</main>

      <nav class="bottom-nav">
        <a class="nav-link ${active === 'library' ? 'is-active' : ''}" href="#/library">本棚</a>
        <a class="nav-link ${active === 'notes' ? 'is-active' : ''}" href="#/notes">抜き書き</a>
        <a class="nav-link ${active === 'new-note' ? 'is-active' : ''}" href="#/note/new">採集</a>
        <a class="nav-link ${active === 'settings' ? 'is-active' : ''}" href="#/settings">保存</a>
      </nav>
    </div>
  `;
}

function renderApp() {
  const app = document.getElementById('app');
  const route = parseHash();
  let active = 'library';
  let content = '';

  if (route.path === '/library') {
    active = 'library';
    content = renderLibraryView();
  } else if (route.segments[0] === 'book' && route.segments[1] && route.segments.length === 2) {
    active = 'library';
    content = renderBookDetail(getBookById(route.segments[1]));
  } else if (route.path === '/book/new') {
    active = 'library';
    content = renderBookForm(null);
  } else if (route.segments[0] === 'book' && route.segments[1] === 'edit' && route.segments[2]) {
    active = 'library';
    content = renderBookForm(getBookById(route.segments[2]));
  } else if (route.path === '/notes') {
    active = 'notes';
    content = renderNotesView();
  } else if (route.path === '/note/new') {
    active = 'new-note';
    content = renderNoteForm(route.query.get('book') || '');
  } else if (route.path === '/settings') {
    active = 'settings';
    content = renderSettingsView();
  } else {
    navigate('#/library');
    return;
  }

  app.innerHTML = renderLayout(content, active);
  bindViewEvents();
}

function bindViewEvents() {
  const libraryQuery = document.getElementById('library-query');
  if (libraryQuery) {
    libraryQuery.addEventListener('input', (event) => {
      uiState.libraryQuery = event.target.value;
      renderApp();
    });
  }
  const libraryShelf = document.getElementById('library-shelf');
  if (libraryShelf) libraryShelf.addEventListener('change', (event) => { uiState.libraryShelf = event.target.value; renderApp(); });
  const libraryCapture = document.getElementById('library-capture');
  if (libraryCapture) libraryCapture.addEventListener('change', (event) => { uiState.libraryCapture = event.target.value; renderApp(); });
  const libraryOwned = document.getElementById('library-owned');
  if (libraryOwned) libraryOwned.addEventListener('change', (event) => { uiState.libraryOwned = event.target.value; renderApp(); });
  const clearLibrary = document.getElementById('clear-library-filters');
  if (clearLibrary) clearLibrary.addEventListener('click', () => {
    uiState.libraryQuery = '';
    uiState.libraryShelf = 'all';
    uiState.libraryCapture = 'all';
    uiState.libraryOwned = 'all';
    renderApp();
  });

  const notesQuery = document.getElementById('notes-query');
  if (notesQuery) notesQuery.addEventListener('input', (event) => { uiState.notesQuery = event.target.value; renderApp(); });
  const notesTag = document.getElementById('notes-tag');
  if (notesTag) notesTag.addEventListener('change', (event) => { uiState.notesTag = event.target.value; renderApp(); });
  const clearNoteFilters = document.getElementById('clear-note-filters');
  if (clearNoteFilters) clearNoteFilters.addEventListener('click', () => {
    uiState.notesQuery = '';
    uiState.notesTag = 'all';
    renderApp();
  });

  const bookForm = document.getElementById('book-form');
  if (bookForm) {
    bookForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(bookForm);
      const bookId = formData.get('book_id');
      const isEdit = Boolean(bookId);
      const target = isEdit ? getBookById(bookId) : { id: generateId('book'), added_at: todayString(), source: 'mobile', reading_notes: [] };
      target.title = String(formData.get('title') || '').trim();
      target.author = String(formData.get('author') || '').trim();
      target.publisher = String(formData.get('publisher') || '').trim();
      target.release_date = String(formData.get('release_date') || '').trim();
      target.shelf = String(formData.get('shelf') || 'wishlist');
      target.priority = String(formData.get('priority') || '中');
      target.capture_status = String(formData.get('capture_status') || 'unstarted');
      target.owned = formData.get('owned') === 'on';
      target.read = formData.get('read') === 'on';
      target.memo = String(formData.get('memo') || '').trim();
      target.tags = parseTags(formData.get('tags'));
      target.isbn = String(formData.get('isbn') || '').trim();
      target.cover_url = String(formData.get('cover_url') || '').trim();
      target.external_url = String(formData.get('external_url') || '').trim();
      target.review = String(formData.get('review') || '').trim();
      target.rating = String(formData.get('rating') || '').trim();
      target.finished_date = String(formData.get('finished_date') || '').trim();
      if (target.read && !target.finished_date) target.finished_date = todayString();
      if (!target.read) target.finished_date = '';
      target.source = target.source || 'mobile';
      target.reading_notes = Array.isArray(target.reading_notes) ? target.reading_notes : [];
      if (!isEdit) state.books.unshift(migrateBook(target)); else Object.assign(target, migrateBook(target));
      saveState(state);
      navigate(`#/book/${target.id}`);
    });
  }

  const noteForm = document.getElementById('note-form');
  if (noteForm) {
    noteForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(noteForm);
      const book = getBookById(String(formData.get('book_id') || ''));
      if (!book) {
        alert('本を選んでください。');
        return;
      }
      const note = migrateNote({
        id: generateId('note'),
        page: String(formData.get('page') || '').trim(),
        quote: String(formData.get('quote') || '').trim(),
        comment: String(formData.get('comment') || '').trim(),
        tags: parseTags(formData.get('tags')),
        created_at: nowString(),
      });
      if (!note.quote && !note.comment) {
        alert('抜き書き本文か一言メモのどちらかを入れてください。');
        return;
      }
      book.reading_notes.unshift(note);
      if (book.capture_status === 'unstarted') {
        book.capture_status = note.quote ? 'in_progress' : 'memo_only';
      } else if (book.capture_status === 'memo_only' && note.quote) {
        book.capture_status = 'in_progress';
      }
      saveState(state);
      navigate(`#/book/${book.id}`);
    });
  }

  const exportJson = document.getElementById('export-json');
  if (exportJson) {
    exportJson.addEventListener('click', () => {
      downloadJson(`denshosai-rev6-backup-${todayString()}.json`, state);
    });
  }

  const importJson = document.getElementById('import-json');
  if (importJson) {
    importJson.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        let nextState;
        if (Array.isArray(parsed)) {
          nextState = { version: 1, updated_at: nowString(), books: parsed.map(migrateBook) };
        } else {
          nextState = { version: 1, updated_at: nowString(), books: Array.isArray(parsed.books) ? parsed.books.map(migrateBook) : [] };
        }
        if (!confirm('現在の端末内データを上書きして読み込みます。続けますか？')) return;
        state = nextState;
        saveState(state);
        alert('読み込みました。');
        navigate('#/library');
      } catch (error) {
        console.error(error);
        alert('JSONの読み込みに失敗しました。');
      } finally {
        event.target.value = '';
      }
    });
  }

  const importSeed = document.getElementById('import-seed');
  if (importSeed) {
    importSeed.addEventListener('click', () => {
      if (!confirm('初期サンプルデータへ戻します。現在の端末内データは上書きされます。')) return;
      state = seedState();
      saveState(state);
      navigate('#/library');
    });
  }
}

window.addEventListener('hashchange', renderApp);
document.addEventListener('DOMContentLoaded', () => {
  if (!location.hash) navigate('#/library');
  renderApp();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => console.error('service worker registration failed', error));
  }
});
