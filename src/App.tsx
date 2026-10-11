import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import DatabaseBlock, {
  makeDatabaseData,
  type DatabaseData,
  type DatabaseRow,
} from './DatabaseBlock'

type BlockType =
  | 'text'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bullet'
  | 'numbered'
  | 'todo'
  | 'quote'
  | 'code'
  | 'database'

type Block = {
  id: string
  type: BlockType
  text: string
  checked?: boolean
  database?: DatabaseData
}

type Page = {
  id: string
  title: string
  blocks: Block[]
  content?: string
  icon: string
  parentId: string | null
  createdAt: number
  updatedAt: number
}

type Theme = 'light' | 'dark'

type SlashCommand = {
  type: BlockType
  label: string
  description: string
  icon: string
  keywords: string
}

const STORAGE_KEY = 'lumo.pages.v1'
const THEME_KEY = 'lumo.theme'

const SLASH_COMMANDS: SlashCommand[] = [
  { type: 'text', label: 'Text', description: 'Plain text block', icon: 'T', keywords: 'paragraph normal text' },
  { type: 'heading1', label: 'Heading 1', description: 'Large section heading', icon: 'H1', keywords: 'title heading h1' },
  { type: 'heading2', label: 'Heading 2', description: 'Medium section heading', icon: 'H2', keywords: 'subtitle heading h2' },
  { type: 'heading3', label: 'Heading 3', description: 'Small section heading', icon: 'H3', keywords: 'heading h3' },
  { type: 'bullet', label: 'Bulleted list', description: 'Create a simple list', icon: '•', keywords: 'bullet unordered list' },
  { type: 'numbered', label: 'Numbered list', description: 'Create a numbered list', icon: '1.', keywords: 'ordered numbered list' },
  { type: 'todo', label: 'To-do', description: 'Track a task with a checkbox', icon: '☑', keywords: 'todo task checkbox checklist' },
  { type: 'quote', label: 'Quote', description: 'Capture a quote or callout', icon: '❝', keywords: 'quote blockquote' },
  { type: 'code', label: 'Code', description: 'Monospace code block', icon: '</>', keywords: 'code snippet programming' },
  { type: 'database', label: 'Database', description: 'Table, board and calendar views', icon: '▦', keywords: 'database table board kanban calendar properties' },
]

function makeBlock(type: BlockType = 'text', text = ''): Block {
  return {
    id: crypto.randomUUID(),
    type,
    text,
    checked: type === 'todo' ? false : undefined,
    database: type === 'database' ? makeDatabaseData() : undefined,
  }
}

function makePage(title = 'Untitled', parentId: string | null = null): Page {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title,
    blocks: [makeBlock()],
    icon: '📄',
    parentId,
    createdAt: now,
    updatedAt: now,
  }
}

function migrateDatabase(input?: Partial<DatabaseData>): DatabaseData {
  const fallback = makeDatabaseData()
  if (!input) return fallback

  const rows = Array.isArray(input.rows)
    ? input.rows.map((row: Partial<DatabaseRow>) => ({
        id: row.id || crypto.randomUUID(),
        name: row.name || '',
        status:
          row.status === 'In progress' || row.status === 'Done'
            ? row.status
            : 'Not started',
        tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        date: typeof row.date === 'string' ? row.date : '',
      }))
    : fallback.rows

  return {
    title: input.title || 'Untitled database',
    view: input.view === 'board' || input.view === 'calendar' ? input.view : 'table',
    rows,
  }
}

function migrateBlocks(page: Partial<Page>): Block[] {
  if (Array.isArray(page.blocks) && page.blocks.length > 0) {
    return page.blocks.map((block) => {
      const type: BlockType = SLASH_COMMANDS.some((command) => command.type === block.type)
        ? block.type
        : 'text'
      return {
        id: block.id || crypto.randomUUID(),
        type,
        text: block.text || '',
        checked: type === 'todo' ? Boolean(block.checked) : undefined,
        database: type === 'database' ? migrateDatabase(block.database) : undefined,
      }
    })
  }

  if (typeof page.content === 'string' && page.content.length > 0) {
    return page.content.split('\n').map((line) => makeBlock('text', line))
  }

  return [makeBlock()]
}

function loadPages(): Page[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [makePage('Welcome to Lumo')]

    const parsed = JSON.parse(raw) as Partial<Page>[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [makePage('Welcome to Lumo')]
    }

    return parsed.map((page) => ({
      id: page.id || crypto.randomUUID(),
      title: page.title || 'Untitled',
      blocks: migrateBlocks(page),
      icon: page.icon || '📄',
      parentId: page.parentId ?? null,
      createdAt: page.createdAt || Date.now(),
      updatedAt: page.updatedAt || Date.now(),
    }))
  } catch {
    return [makePage('Welcome to Lumo')]
  }
}

function loadTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function databaseToMarkdown(database: DatabaseData) {
  const header = `### ${database.title || 'Database'}\n\n| Name | Status | Tags | Date |\n| --- | --- | --- | --- |`
  const rows = database.rows.map((row) =>
    `| ${row.name.replace(/\|/g, '\\|')} | ${row.status} | ${row.tags.join(', ').replace(/\|/g, '\\|')} | ${row.date} |`,
  )
  return [header, ...rows].join('\n')
}

function blockToMarkdown(block: Block): string {
  switch (block.type) {
    case 'heading1': return `# ${block.text}`
    case 'heading2': return `## ${block.text}`
    case 'heading3': return `### ${block.text}`
    case 'bullet': return `- ${block.text}`
    case 'numbered': return `1. ${block.text}`
    case 'todo': return `- [${block.checked ? 'x' : ' '}] ${block.text}`
    case 'quote': return `> ${block.text}`
    case 'code': return `\`\`\`\n${block.text}\n\`\`\``
    case 'database': return databaseToMarkdown(block.database || makeDatabaseData())
    default: return block.text
  }
}

function blockPlaceholder(type: BlockType): string {
  switch (type) {
    case 'heading1':
    case 'heading2':
    case 'heading3':
      return 'Heading'
    case 'todo': return 'To-do'
    case 'quote': return 'Quote'
    case 'code': return 'Write some code…'
    default: return "Type '/' for commands"
  }
}

export default function App() {
  const [pages, setPages] = useState<Page[]>(loadPages)
  const [activeId, setActiveId] = useState(() => pages[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [slashMenu, setSlashMenu] = useState<{ blockId: string; query: string } | null>(null)
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null)
  const [collapsedPages, setCollapsedPages] = useState<Set<string>>(new Set())
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const blockRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const paletteInputRef = useRef<HTMLInputElement | null>(null)

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

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
        setPaletteQuery('')
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false)
        setSlashMenu(null)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (paletteOpen) {
      requestAnimationFrame(() => paletteInputRef.current?.focus())
    }
  }, [paletteOpen])

  const filteredPages = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return pages
    return pages.filter((page) => {
      const blockText = page.blocks.map((block) => {
        if (block.type === 'database') {
          const db = block.database
          return `${db?.title ?? ''} ${db?.rows.map((row) => `${row.name} ${row.status} ${row.tags.join(' ')}`).join(' ') ?? ''}`
        }
        return block.text
      }).join(' ')
      return `${page.title} ${blockText}`.toLowerCase().includes(needle)
    })
  }, [pages, query])

  const visibleCommands = useMemo(() => {
    if (!slashMenu) return SLASH_COMMANDS
    const needle = slashMenu.query.trim().toLowerCase()
    if (!needle) return SLASH_COMMANDS
    return SLASH_COMMANDS.filter((command) =>
      `${command.label} ${command.description} ${command.keywords}`.toLowerCase().includes(needle),
    )
  }, [slashMenu])

  const palettePages = useMemo(() => {
    const needle = paletteQuery.trim().toLowerCase()
    const matches = needle
      ? pages.filter((page) => page.title.toLowerCase().includes(needle))
      : pages
    return matches.slice(0, 7)
  }, [pages, paletteQuery])

  function focusBlock(blockId: string) {
    requestAnimationFrame(() => {
      const element = blockRefs.current[blockId]
      element?.focus()
      if (element) {
        const end = element.value.length
        element.setSelectionRange(end, end)
      }
    })
  }

  function resizeTextarea(element: HTMLTextAreaElement | null) {
    if (!element) return
    element.style.height = '0px'
    element.style.height = `${Math.max(element.scrollHeight, 28)}px`
  }

  function addPage(parentId: string | null = null) {
    const page = makePage('Untitled', parentId)
    setPages((current) => [page, ...current])
    setActiveId(page.id)
    setSlashMenu(null)
    setPaletteOpen(false)
    if (parentId) {
      setCollapsedPages((current) => {
        const next = new Set(current)
        next.delete(parentId)
        return next
      })
    }
  }

  function updateActivePage(patch: Partial<Pick<Page, 'title' | 'blocks' | 'icon' | 'parentId'>>) {
    if (!activePage) return
    setPages((current) =>
      current.map((page) =>
        page.id === activePage.id ? { ...page, ...patch, updatedAt: Date.now() } : page,
      ),
    )
  }

  function changeBlocks(mutator: (blocks: Block[]) => Block[]) {
    if (!activePage) return
    setPages((current) =>
      current.map((page) =>
        page.id === activePage.id
          ? { ...page, blocks: mutator(page.blocks), updatedAt: Date.now() }
          : page,
      ),
    )
  }

  function updateBlock(blockId: string, patch: Partial<Block>) {
    changeBlocks((blocks) =>
      blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block)),
    )
  }

  function handleBlockChange(blockId: string, text: string) {
    updateBlock(blockId, { text })
    if (text.startsWith('/') && !text.includes('\n')) {
      setSlashMenu({ blockId, query: text.slice(1) })
    } else if (slashMenu?.blockId === blockId) {
      setSlashMenu(null)
    }
  }

  function insertBlockAfter(blockId: string, type: BlockType = 'text') {
    const next = makeBlock(type)
    changeBlocks((blocks) => {
      const index = blocks.findIndex((block) => block.id === blockId)
      if (index === -1) return [...blocks, next]
      return [...blocks.slice(0, index + 1), next, ...blocks.slice(index + 1)]
    })
    if (type !== 'database') focusBlock(next.id)
  }

  function deleteBlock(blockId: string, fallbackIndex: number) {
    if (!activePage || activePage.blocks.length <= 1) return
    const previous = activePage.blocks[Math.max(0, fallbackIndex - 1)]
    changeBlocks((blocks) => blocks.filter((block) => block.id !== blockId))
    setSlashMenu(null)
    if (previous && previous.type !== 'database') focusBlock(previous.id)
  }

  function selectCommand(command: SlashCommand) {
    if (!slashMenu) return
    const blockId = slashMenu.blockId
    updateBlock(blockId, {
      type: command.type,
      text: '',
      checked: command.type === 'todo' ? false : undefined,
      database: command.type === 'database' ? makeDatabaseData() : undefined,
    })
    setSlashMenu(null)
    if (command.type !== 'database') focusBlock(blockId)
  }

  function handleBlockKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
    block: Block,
    index: number,
  ) {
    if (slashMenu?.blockId === block.id) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setSlashMenu(null)
        return
      }
      if (event.key === 'Enter' && !event.shiftKey && visibleCommands[0]) {
        event.preventDefault()
        selectCommand(visibleCommands[0])
        return
      }
    }

    if (event.key === 'Enter' && !event.shiftKey && block.type !== 'code') {
      event.preventDefault()
      if (block.text.length === 0 && block.type !== 'text') {
        updateBlock(block.id, { type: 'text', checked: undefined, database: undefined })
        return
      }

      const continuation: BlockType =
        block.type === 'bullet' || block.type === 'numbered' || block.type === 'todo'
          ? block.type
          : 'text'
      insertBlockAfter(block.id, continuation)
      return
    }

    if (event.key === 'Backspace' && block.text.length === 0) {
      if (block.type !== 'text') {
        event.preventDefault()
        updateBlock(block.id, { type: 'text', checked: undefined, database: undefined })
        return
      }
      if (activePage && activePage.blocks.length > 1) {
        event.preventDefault()
        deleteBlock(block.id, index)
      }
    }
  }

  function reorderBlocks(fromId: string, toId: string) {
    if (fromId === toId) return
    changeBlocks((blocks) => {
      const fromIndex = blocks.findIndex((block) => block.id === fromId)
      const toIndex = blocks.findIndex((block) => block.id === toId)
      if (fromIndex === -1 || toIndex === -1) return blocks
      const next = [...blocks]
      const [moved] = next.splice(fromIndex, 1)
      if (!moved) return blocks
      next.splice(toIndex, 0, moved)
      return next
    })
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, targetId: string) {
    event.preventDefault()
    if (draggedBlockId) reorderBlocks(draggedBlockId, targetId)
    setDraggedBlockId(null)
  }

  function collectDescendants(rootId: string, source: Page[]) {
    const ids = new Set<string>([rootId])
    let changed = true
    while (changed) {
      changed = false
      source.forEach((page) => {
        if (page.parentId && ids.has(page.parentId) && !ids.has(page.id)) {
          ids.add(page.id)
          changed = true
        }
      })
    }
    return ids
  }

  function deleteActive() {
    if (!activePage) return
    const descendants = collectDescendants(activePage.id, pages)
    const childCount = descendants.size - 1
    const suffix = childCount > 0 ? ` This also deletes ${childCount} subpage${childCount === 1 ? '' : 's'}.` : ''
    if (!window.confirm(`Delete “${activePage.title || 'Untitled'}”?${suffix}`)) return

    setPages((current) => {
      const deleting = collectDescendants(activePage.id, current)
      const remaining = current.filter((page) => !deleting.has(page.id))
      return remaining.length > 0 ? remaining : [makePage()]
    })
    setSlashMenu(null)
  }

  function exportMarkdown() {
    if (!activePage) return
    const title = activePage.title.trim() || 'Untitled'
    const body = activePage.blocks.map(blockToMarkdown).join('\n\n')
    const markdown = `# ${title}\n\n${body}`
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${title.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Untitled'}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  function changePageIcon() {
    if (!activePage) return
    const next = window.prompt('Choose an emoji or short icon', activePage.icon || '📄')
    if (next === null) return
    updateActivePage({ icon: next.trim().slice(0, 4) || '📄' })
  }

  function togglePageCollapsed(pageId: string) {
    setCollapsedPages((current) => {
      const next = new Set(current)
      if (next.has(pageId)) next.delete(pageId)
      else next.add(pageId)
      return next
    })
  }

  function openPage(pageId: string) {
    setActiveId(pageId)
    setSlashMenu(null)
    setPaletteOpen(false)
  }

  function renderPageTree(parentId: string | null, depth = 0) {
    const children = pages.filter((page) => page.parentId === parentId)
    return children.map((page) => {
      const hasChildren = pages.some((candidate) => candidate.parentId === page.id)
      const collapsed = collapsedPages.has(page.id)
      return (
        <div key={page.id} className="page-tree-node">
          <div className={`page-row ${page.id === activePage?.id ? 'page-row--active' : ''}`} style={{ paddingLeft: `${4 + depth * 14}px` }}>
            <button
              className={`page-toggle ${hasChildren ? '' : 'page-toggle--empty'}`}
              onClick={() => hasChildren && togglePageCollapsed(page.id)}
              aria-label={collapsed ? 'Expand subpages' : 'Collapse subpages'}
              tabIndex={hasChildren ? 0 : -1}
            >
              {hasChildren ? (collapsed ? '›' : '⌄') : '·'}
            </button>
            <button className="page-item" onClick={() => openPage(page.id)}>
              <span className="page-icon">{page.icon || '📄'}</span>
              <span className="page-label">{page.title.trim() || 'Untitled'}</span>
            </button>
            <button
              className="page-child-add"
              onClick={() => addPage(page.id)}
              title="Add subpage"
              aria-label={`Add subpage to ${page.title || 'Untitled'}`}
            >
              +
            </button>
          </div>
          {hasChildren && !collapsed && renderPageTree(page.id, depth + 1)}
        </div>
      )
    })
  }

  const paletteNeedle = paletteQuery.trim().toLowerCase()
  const showNewPageCommand = !paletteNeedle || 'new page create'.includes(paletteNeedle)
  const showThemeCommand = !paletteNeedle || 'theme dark light appearance'.includes(paletteNeedle)
  const showExportCommand = !paletteNeedle || 'export markdown md'.includes(paletteNeedle)
  const showDatabaseCommand = !paletteNeedle || 'database table board calendar kanban'.includes(paletteNeedle)

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

        <button className="new-page" onClick={() => addPage(null)}>
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
          {query.trim() ? (
            filteredPages.length > 0 ? (
              filteredPages.map((page) => (
                <button key={page.id} className={`page-item page-item--search ${page.id === activePage?.id ? 'page-item--active' : ''}`} onClick={() => openPage(page.id)}>
                  <span className="page-icon">{page.icon || '📄'}</span>
                  <span className="page-label">{page.title.trim() || 'Untitled'}</span>
                </button>
              ))
            ) : (
              <div className="empty-search">No pages found.</div>
            )
          ) : (
            renderPageTree(null)
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="palette-shortcut" onClick={() => setPaletteOpen(true)}>
            <span>Command palette</span><kbd>Ctrl K</kbd>
          </button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button className="icon-button" onClick={() => setSidebarOpen((open) => !open)} aria-label="Toggle sidebar" title="Toggle sidebar">☰</button>
          <div className="topbar-title">{activePage?.icon} {activePage?.title.trim() || 'Untitled'}</div>
          <div className="topbar-actions">
            <button className="command-button" onClick={() => setPaletteOpen(true)}><span>⌕</span><kbd>Ctrl K</kbd></button>
            <button onClick={exportMarkdown}>Export .md</button>
            <button className="danger-button" onClick={deleteActive}>Delete</button>
          </div>
        </header>

        {activePage && (
          <section className="editor-wrap" onClick={() => setSlashMenu(null)}>
            <div className="editor-meta">
              <span>Saved locally</span><span>•</span><span>{new Date(activePage.updatedAt).toLocaleString()}</span>
            </div>

            <button className="page-hero-icon" onClick={changePageIcon} title="Change page icon">{activePage.icon || '📄'}</button>

            <input
              className="title-input"
              value={activePage.title}
              onChange={(event) => updateActivePage({ title: event.target.value })}
              placeholder="Untitled"
              aria-label="Page title"
            />

            <div className="block-editor" onClick={(event) => event.stopPropagation()}>
              {activePage.blocks.map((block, index) => (
                <div
                  key={block.id}
                  className={`block-row block-row--${block.type} ${draggedBlockId === block.id ? 'block-row--dragging' : ''}`}
                  draggable={block.type !== 'database'}
                  onDragStart={() => block.type !== 'database' && setDraggedBlockId(block.id)}
                  onDragEnd={() => setDraggedBlockId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, block.id)}
                >
                  <div className="block-gutter" aria-hidden="true">
                    <button className="block-add" onClick={() => insertBlockAfter(block.id)} tabIndex={-1} title="Add block">+</button>
                    {block.type === 'database' ? (
                      <button className="block-add" onClick={() => deleteBlock(block.id, index)} tabIndex={-1} title="Delete database">×</button>
                    ) : (
                      <span className="drag-handle" title="Drag to move">⋮⋮</span>
                    )}
                  </div>

                  <div className="block-main">
                    {block.type === 'database' ? (
                      <DatabaseBlock
                        data={block.database || makeDatabaseData()}
                        onChange={(database) => updateBlock(block.id, { database })}
                      />
                    ) : (
                      <>
                        {block.type === 'bullet' && <span className="block-prefix">•</span>}
                        {block.type === 'numbered' && <span className="block-prefix">{index + 1}.</span>}
                        {block.type === 'todo' && (
                          <input
                            className="todo-checkbox"
                            type="checkbox"
                            checked={Boolean(block.checked)}
                            onChange={(event) => updateBlock(block.id, { checked: event.target.checked })}
                            aria-label="Toggle to-do"
                          />
                        )}

                        <textarea
                          ref={(element) => {
                            blockRefs.current[block.id] = element
                            resizeTextarea(element)
                          }}
                          className={`block-input block-input--${block.type} ${block.checked ? 'block-input--checked' : ''}`}
                          value={block.text}
                          rows={1}
                          onChange={(event) => {
                            handleBlockChange(block.id, event.target.value)
                            resizeTextarea(event.currentTarget)
                          }}
                          onKeyDown={(event) => handleBlockKeyDown(event, block, index)}
                          onFocus={() => {
                            if (block.text.startsWith('/')) setSlashMenu({ blockId: block.id, query: block.text.slice(1) })
                          }}
                          placeholder={blockPlaceholder(block.type)}
                          spellCheck={block.type !== 'code'}
                        />

                        {slashMenu?.blockId === block.id && (
                          <div className="slash-menu">
                            <div className="slash-menu-title">Blocks</div>
                            {visibleCommands.length > 0 ? (
                              visibleCommands.map((command) => (
                                <button
                                  key={command.type}
                                  className="slash-command"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => selectCommand(command)}
                                >
                                  <span className="slash-command-icon">{command.icon}</span>
                                  <span><strong>{command.label}</strong><small>{command.description}</small></span>
                                </button>
                              ))
                            ) : (
                              <div className="slash-empty">No matching blocks.</div>
                            )}
                            <div className="slash-menu-hint">Enter to select · Esc to close</div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button className="editor-add-block" onClick={() => insertBlockAfter(activePage.blocks.at(-1)?.id ?? '')}>+ Add block</button>
          </section>
        )}
      </main>

      {paletteOpen && (
        <div className="palette-backdrop" onMouseDown={() => setPaletteOpen(false)}>
          <div className="command-palette" onMouseDown={(event) => event.stopPropagation()}>
            <div className="palette-search-row">
              <span>⌕</span>
              <input
                ref={paletteInputRef}
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                placeholder="Search pages or run a command…"
              />
              <kbd>Esc</kbd>
            </div>

            <div className="palette-results">
              {(showNewPageCommand || showThemeCommand || showExportCommand || showDatabaseCommand) && <div className="palette-section-title">Commands</div>}
              {showNewPageCommand && <button onClick={() => addPage(null)}><span className="palette-icon">＋</span><span><strong>New page</strong><small>Create a top-level page</small></span></button>}
              {showDatabaseCommand && activePage && <button onClick={() => { insertBlockAfter(activePage.blocks.at(-1)?.id ?? '', 'database'); setPaletteOpen(false) }}><span className="palette-icon">▦</span><span><strong>New database</strong><small>Add table, board and calendar views</small></span></button>}
              {showThemeCommand && <button onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setPaletteOpen(false) }}><span className="palette-icon">◐</span><span><strong>Toggle theme</strong><small>Switch light and dark mode</small></span></button>}
              {showExportCommand && <button onClick={() => { exportMarkdown(); setPaletteOpen(false) }}><span className="palette-icon">⇩</span><span><strong>Export Markdown</strong><small>Download the current page</small></span></button>}

              {palettePages.length > 0 && <div className="palette-section-title">Pages</div>}
              {palettePages.map((page) => (
                <button key={page.id} onClick={() => openPage(page.id)}>
                  <span className="palette-icon">{page.icon || '📄'}</span>
                  <span><strong>{page.title.trim() || 'Untitled'}</strong><small>Open page</small></span>
                </button>
              ))}

              {!showNewPageCommand && !showThemeCommand && !showExportCommand && !showDatabaseCommand && palettePages.length === 0 && (
                <div className="palette-empty">Nothing found.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
