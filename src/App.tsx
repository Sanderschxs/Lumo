import { useEffect, useMemo, useState } from 'react'

type Page = {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'lumo.pages.v1'
const THEME_KEY = 'lumo.theme'

function makePage(title = 'Untitled'): Page {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title,
    content: '',
    createdAt: now,
    updatedAt: now,
  }
}

function loadPages(): Page[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [makePage('Welcome to Lumo')]
    const parsed = JSON.parse(raw) as Page[]
    return parsed.length > 0 ? parsed : [makePage('Welcome to Lumo')]
  } catch {
    return [makePage('Welcome to Lumo')]
  }
}

function loadTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [pages, setPages] = useState<Page[]>(loadPages)
  const [activeId, setActiveId] = useState(() => pages[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const activePage = pages.find((page) => page.id === activeId) ?? pages[0]

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pages))
  }, [pages])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!pages.some((page) => page.id === activeId) && pages[0]) {
      setActiveId(pages[0].id)
    }
  }, [pages, activeId])

  const filteredPages = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return pages
    return pages.filter((page) =>
      `${page.title} ${page.content}`.toLowerCase().includes(needle),
    )
  }, [pages, query])

  function addPage() {
    const page = makePage()
    setPages((current) => [page, ...current])
    setActiveId(page.id)
  }

  function updateActive(patch: Partial<Pick<Page, 'title' | 'content'>>) {
    if (!activePage) return
    setPages((current) =>
      current.map((page) =>
        page.id === activePage.id
          ? { ...page, ...patch, updatedAt: Date.now() }
          : page,
      ),
    )
  }

  function deleteActive() {
    if (!activePage) return
    if (!window.confirm(`Delete “${activePage.title || 'Untitled'}”?`)) return

    setPages((current) => {
      const remaining = current.filter((page) => page.id !== activePage.id)
      if (remaining.length > 0) return remaining
      return [makePage()]
    })
  }

  function exportMarkdown() {
    if (!activePage) return
    const title = activePage.title.trim() || 'Untitled'
    const markdown = `# ${title}\n\n${activePage.content}`
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${title.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Untitled'}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? '' : 'sidebar--closed'}`}>
        <div className="brand-row">
          <div className="brand-mark">L</div>
          <div>
            <strong>Lumo</strong>
            <span>Local workspace</span>
          </div>
        </div>

        <button className="new-page" onClick={addPage}>
          <span>＋</span> New page
        </button>

        <label className="search-box">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages"
            aria-label="Search pages"
          />
        </label>

        <nav className="page-list" aria-label="Pages">
          {filteredPages.map((page) => (
            <button
              key={page.id}
              className={`page-item ${page.id === activePage?.id ? 'page-item--active' : ''}`}
              onClick={() => setActiveId(page.id)}
            >
              <span className="page-icon">▤</span>
              <span className="page-label">{page.title.trim() || 'Untitled'}</span>
            </button>
          ))}
          {filteredPages.length === 0 && (
            <div className="empty-search">No pages found.</div>
          )}
        </nav>

        <div className="sidebar-footer">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button
            className="icon-button"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            ☰
          </button>
          <div className="topbar-title">{activePage?.title.trim() || 'Untitled'}</div>
          <div className="topbar-actions">
            <button onClick={exportMarkdown}>Export .md</button>
            <button className="danger-button" onClick={deleteActive}>Delete</button>
          </div>
        </header>

        {activePage && (
          <section className="editor-wrap">
            <div className="editor-meta">
              <span>Saved locally</span>
              <span>•</span>
              <span>{new Date(activePage.updatedAt).toLocaleString()}</span>
            </div>

            <input
              className="title-input"
              value={activePage.title}
              onChange={(event) => updateActive({ title: event.target.value })}
              placeholder="Untitled"
              aria-label="Page title"
            />

            <textarea
              className="page-editor"
              value={activePage.content}
              onChange={(event) => updateActive({ content: event.target.value })}
              placeholder="Start writing…"
              spellCheck
            />
          </section>
        )}
      </main>
    </div>
  )
}
