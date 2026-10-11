import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import DatabaseBlock, {
  databaseSearchText,
  databaseToMarkdown,
  makeDatabaseData,
  normalizeDatabaseData,
  type DatabaseData,
} from './DatabaseBlock'
import './features.css'

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
  | 'callout'
  | 'toggle'
  | 'divider'
  | 'bookmark'
  | 'image'
  | 'database'

type Block = {
  id: string
  type: BlockType
  text: string
  checked?: boolean
  database?: DatabaseData
  emoji?: string
  details?: string
  open?: boolean
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
  trashedAt?: number
}

type Theme = 'light' | 'dark'
type TemplateKind = 'study' | 'tasks' | 'project'

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
  { type: 'quote', label: 'Quote', description: 'Capture a quote', icon: '❝', keywords: 'quote blockquote' },
  { type: 'callout', label: 'Callout', description: 'Highlight important information', icon: '💡', keywords: 'callout note info warning' },
  { type: 'toggle', label: 'Toggle', description: 'Collapsible details', icon: '▸', keywords: 'toggle details collapse' },
  { type: 'divider', label: 'Divider', description: 'Visual separator', icon: '—', keywords: 'divider separator line horizontal' },
  { type: 'bookmark', label: 'Bookmark', description: 'Save a web link', icon: '↗', keywords: 'bookmark link url website' },
  { type: 'image', label: 'Image', description: 'Embed an image from a URL', icon: '▧', keywords: 'image photo picture url' },
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
    emoji: type === 'callout' ? '💡' : undefined,
    details: type === 'toggle' ? '' : undefined,
    open: type === 'toggle' ? true : undefined,
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

function templatePage(kind: TemplateKind, parentId: string | null = null): Page {
  const page = makePage('Untitled', parentId)

  if (kind === 'study') {
    return {
      ...page,
      title: 'Study notes',
      icon: '📚',
      blocks: [
        makeBlock('heading1', 'Topic'),
        makeBlock('text', 'Write a short summary here.'),
        makeBlock('heading2', 'Key ideas'),
        makeBlock('bullet', ''),
        makeBlock('heading2', 'Questions'),
        makeBlock('todo', ''),
      ],
    }
  }

  if (kind === 'tasks') {
    const database = makeDatabaseData()
    database.title = 'Tasks'
    return {
      ...page,
      title: 'Task planner',
      icon: '✅',
      blocks: [
        makeBlock('heading2', 'Tasks'),
        { ...makeBlock('database'), database },
      ],
    }
  }

  const database = makeDatabaseData()
  database.title = 'Project tracker'
  return {
    ...page,
    title: 'Project hub',
    icon: '🚀',
    blocks: [
      makeBlock('callout', 'Define what success looks like for this project.'),
      makeBlock('heading2', 'Goal'),
      makeBlock('text', ''),
      makeBlock('heading2', 'Next steps'),
      makeBlock('todo', ''),
      { ...makeBlock('database'), database },
    ],
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
        database: type === 'database' ? normalizeDatabaseData(block.database) : undefined,
        emoji: type === 'callout' ? block.emoji || '💡' : undefined,
        details: type === 'toggle' ? block.details || '' : undefined,
        open: type === 'toggle' ? block.open !== false : undefined,
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
    if (!Array.isArray(parsed) || parsed.length === 0) return [makePage('Welcome to Lumo')]

    const migrated = parsed.map((page) => ({
      id: page.id || crypto.randomUUID(),
      title: page.title || 'Untitled',
      blocks: migrateBlocks(page),
      icon: page.icon || '📄',
      parentId: page.parentId ?? null,
      createdAt: page.createdAt || Date.now(),
      updatedAt: page.updatedAt || Date.now(),
      trashedAt: typeof page.trashedAt === 'number' ? page.trashedAt : undefined,
    }))

    return migrated.some((page) => !page.trashedAt) ? migrated : [...migrated, makePage()]
  } catch {
    return [makePage('Welcome to Lumo')]
  }
}

function loadTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function blockSearchText(block: Block) {
  if (block.type === 'database') return databaseSearchText(block.database || makeDatabaseData())
  return `${block.text} ${block.details || ''}`
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
    case 'callout': return `> ${block.emoji || '💡'} ${block.text}`
    case 'toggle': return `<details>\n<summary>${block.text || 'Details'}</summary>\n\n${block.details || ''}\n\n</details>`
    case 'divider': return '---'
    case 'bookmark': return block.text ? `[${block.text}](${block.text})` : ''
    case 'image': return block.text ? `![Image](${block.text})` : ''
    case 'code': return `\`\`\`\n${block.text}\n\`\`\``
    case 'database': return databaseToMarkdown(block.database || makeDatabaseData())
    default: return block.text
  }
}

function blockPlaceholder(type: BlockType): string {
  switch (type) {
    case 'heading1':
    case 'heading2':
    case 'heading3': return 'Heading'
    case 'todo': return 'To-do'
    case 'quote': return 'Quote'
    case 'callout': return 'Type something important…'
    case 'toggle': return 'Toggle title'
    case 'bookmark': return 'https://example.com'
    case 'image': return 'Paste an image URL…'
    case 'code': return 'Write some code…'
    default: return "Type '/' for commands"
  }
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}

export default function App() {
  const [pages, setPages] = useState<Page[]>(loadPages)
  const visiblePages = useMemo(() => pages.filter((page) => !page.trashedAt), [pages])
  const trashedPages = useMemo(() => pages.filter((page) => page.trashedAt), [pages])
  const [activeId, setActiveId] = useState(() => pages.find((page) => !page.trashedAt)?.id ?? '')
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [slashMenu, setSlashMenu] = useState<{ blockId: string; query: string } | null>(null)
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null)
  const [collapsedPages, setCollapsedPages] = useState<Set<string>>(new Set())
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [trashOpen, setTrashOpen] = useState(false)
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null)
  const blockRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const paletteInputRef = useRef<HTMLInputElement | null>(null)

  const activePage = visiblePages.find((page) => page.id === activeId) ?? visiblePages[0]

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pages))
  }, [pages])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!visiblePages.some((page) => page.id === activeId) && visiblePages[0]) {
      setActiveId(visiblePages[0].id)
    }
  }, [visiblePages, activeId])

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
        setPaletteQuery('')
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false)
        setTrashOpen(false)
        setSlashMenu(null)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (paletteOpen) requestAnimationFrame(() => paletteInputRef.current?.focus())
  }, [paletteOpen])

  const filteredPages = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return visiblePages
    return visiblePages.filter((page) => {
      const blockText = page.blocks.map(blockSearchText).join(' ')
      return `${page.title} ${blockText}`.toLowerCase().includes(needle)
    })
  }, [visiblePages, query])

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
      ? visiblePages.filter((page) => page.title.toLowerCase().includes(needle))
      : visiblePages
    return matches.slice(0, 7)
  }, [visiblePages, paletteQuery])

  const backlinks = useMemo(() => {
    if (!activePage?.title.trim()) return []
    const token = `[[${activePage.title.trim()}]]`.toLowerCase()
    return visiblePages.filter((page) =>
      page.id !== activePage.id && page.blocks.some((block) => blockSearchText(block).toLowerCase().includes(token)),
    )
  }, [visiblePages, activePage])

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

  function addTemplate(kind: TemplateKind) {
    const page = templatePage(kind)
    setPages((current) => [page, ...current])
    setActiveId(page.id)
    setPaletteOpen(false)
  }

  function duplicateActive() {
    if (!activePage) return
    const copy: Page = {
      ...structuredClone(activePage),
      id: crypto.randomUUID(),
      title: `${activePage.title || 'Untitled'} copy`,
      blocks: activePage.blocks.map((block) => ({
        ...structuredClone(block),
        id: crypto.randomUUID(),
        database: block.database
          ? normalizeDatabaseData({
              ...structuredClone(block.database),
              rows: block.database.rows.map((row) => ({ ...structuredClone(row), id: crypto.randomUUID() })),
            })
          : undefined,
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trashedAt: undefined,
    }
    setPages((current) => [copy, ...current])
    setActiveId(copy.id)
    setPaletteOpen(false)
  }

  function updateActivePage(patch: Partial<Pick<Page, 'title' | 'blocks' | 'icon' | 'parentId'>>) {
    if (!activePage) return
    setPages((current) =>
      current.map((page) => page.id === activePage.id ? { ...page, ...patch, updatedAt: Date.now() } : page),
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
      blocks.map((block) => block.id === blockId ? { ...block, ...patch } : block),
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
    if (type !== 'database' && type !== 'divider') focusBlock(next.id)
  }

  function deleteBlock(blockId: string, fallbackIndex: number) {
    if (!activePage || activePage.blocks.length <= 1) return
    const previous = activePage.blocks[Math.max(0, fallbackIndex - 1)]
    changeBlocks((blocks) => blocks.filter((block) => block.id !== blockId))
    setSlashMenu(null)
    if (previous && previous.type !== 'database' && previous.type !== 'divider') focusBlock(previous.id)
  }

  function selectCommand(command: SlashCommand) {
    if (!slashMenu) return
    const blockId = slashMenu.blockId
    const replacement = makeBlock(command.type)
    updateBlock(blockId, {
      type: command.type,
      text: '',
      checked: replacement.checked,
      database: replacement.database,
      emoji: replacement.emoji,
      details: replacement.details,
      open: replacement.open,
    })
    setSlashMenu(null)
    if (command.type !== 'database' && command.type !== 'divider') focusBlock(blockId)
  }

  function applyInlineFormat(blockId: string, prefix: string, suffix = prefix) {
    const element = blockRefs.current[blockId]
    const block = activePage?.blocks.find((candidate) => candidate.id === blockId)
    if (!element || !block) return
    const start = element.selectionStart
    const end = element.selectionEnd
    const selection = block.text.slice(start, end)
    const nextText = `${block.text.slice(0, start)}${prefix}${selection}${suffix}${block.text.slice(end)}`
    updateBlock(blockId, { text: nextText })
    requestAnimationFrame(() => {
      element.focus()
      element.setSelectionRange(start + prefix.length, end + prefix.length)
    })
  }

  function handleBlockKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, block: Block, index: number) {
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const key = event.key.toLowerCase()
      if (key === 'b') {
        event.preventDefault()
        applyInlineFormat(block.id, '**')
        return
      }
      if (key === 'i') {
        event.preventDefault()
        applyInlineFormat(block.id, '*')
        return
      }
      if (key === 'e') {
        event.preventDefault()
        applyInlineFormat(block.id, '`')
        return
      }
      if (key === 's' && event.shiftKey) {
        event.preventDefault()
        applyInlineFormat(block.id, '~~')
        return
      }
    }

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
        updateBlock(block.id, { type: 'text', checked: undefined, database: undefined, emoji: undefined, details: undefined, open: undefined })
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
        updateBlock(block.id, { type: 'text', checked: undefined, database: undefined, emoji: undefined, details: undefined, open: undefined })
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

  function trashActive() {
    if (!activePage) return
    const deleting = collectDescendants(activePage.id, pages)
    const childCount = deleting.size - 1
    const suffix = childCount > 0 ? ` This also moves ${childCount} subpage${childCount === 1 ? '' : 's'} to Trash.` : ''
    if (!window.confirm(`Move “${activePage.title || 'Untitled'}” to Trash?${suffix}`)) return

    const remaining = visiblePages.filter((page) => !deleting.has(page.id))
    const fallback = remaining[0] || makePage()
    setPages((current) => {
      const next = current.map((page) => deleting.has(page.id) ? { ...page, trashedAt: Date.now() } : page)
      return remaining.length > 0 ? next : [fallback, ...next]
    })
    setActiveId(fallback.id)
    setSlashMenu(null)
  }

  function restorePage(pageId: string) {
    const restoring = collectDescendants(pageId, pages)
    setPages((current) => current.map((page) => {
      if (!restoring.has(page.id)) return page
      const parentStillTrashed = page.id === pageId && page.parentId
        ? current.find((candidate) => candidate.id === page.parentId)?.trashedAt
        : false
      return {
        ...page,
        trashedAt: undefined,
        parentId: parentStillTrashed ? null : page.parentId,
        updatedAt: Date.now(),
      }
    }))
    setActiveId(pageId)
    setTrashOpen(false)
  }

  function permanentlyDelete(pageId: string) {
    const deleting = collectDescendants(pageId, pages)
    if (!window.confirm('Permanently delete this page and its subpages? This cannot be undone.')) return
    setPages((current) => current.filter((page) => !deleting.has(page.id)))
  }

  function emptyTrash() {
    if (trashedPages.length === 0) return
    if (!window.confirm(`Permanently delete ${trashedPages.length} trashed page${trashedPages.length === 1 ? '' : 's'}?`)) return
    setPages((current) => current.filter((page) => !page.trashedAt))
  }

  function exportMarkdown() {
    if (!activePage) return
    const title = activePage.title.trim() || 'Untitled'
    const body = activePage.blocks.map(blockToMarkdown).filter(Boolean).join('\n\n')
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

  function changeCalloutIcon(block: Block) {
    const next = window.prompt('Choose a callout emoji', block.emoji || '💡')
    if (next !== null) updateBlock(block.id, { emoji: next.trim().slice(0, 4) || '💡' })
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
    const children = visiblePages.filter((page) => page.parentId === parentId)
    return children.map((page) => {
      const hasChildren = visiblePages.some((candidate) => candidate.parentId === page.id)
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
            <button className="page-child-add" onClick={() => addPage(page.id)} title="Add subpage">+</button>
          </div>
          {hasChildren && !collapsed && renderPageTree(page.id, depth + 1)}
        </div>
      )
    })
  }

  function renderTextArea(block: Block, index: number, className = '') {
    return (
      <textarea
        ref={(element) => {
          blockRefs.current[block.id] = element
          resizeTextarea(element)
        }}
        className={`block-input block-input--${block.type} ${block.checked ? 'block-input--checked' : ''} ${className}`}
        value={block.text}
        rows={1}
        onChange={(event) => {
          handleBlockChange(block.id, event.target.value)
          resizeTextarea(event.currentTarget)
        }}
        onKeyDown={(event) => handleBlockKeyDown(event, block, index)}
        onFocus={() => {
          setFocusedBlockId(block.id)
          if (block.text.startsWith('/')) setSlashMenu({ blockId: block.id, query: block.text.slice(1) })
        }}
        placeholder={blockPlaceholder(block.type)}
        spellCheck={block.type !== 'code'}
      />
    )
  }

  const paletteNeedle = paletteQuery.trim().toLowerCase()
  const showNewPageCommand = !paletteNeedle || 'new page create'.includes(paletteNeedle)
  const showThemeCommand = !paletteNeedle || 'theme dark light appearance'.includes(paletteNeedle)
  const showExportCommand = !paletteNeedle || 'export markdown md'.includes(paletteNeedle)
  const showDatabaseCommand = !paletteNeedle || 'database table board calendar kanban'.includes(paletteNeedle)
  const showDuplicateCommand = !paletteNeedle || 'duplicate copy page'.includes(paletteNeedle)
  const showStudyTemplate = !paletteNeedle || 'template study notes school'.includes(paletteNeedle)
  const showTaskTemplate = !paletteNeedle || 'template tasks planner todo'.includes(paletteNeedle)
  const showProjectTemplate = !paletteNeedle || 'template project hub tracker'.includes(paletteNeedle)
  const showTrashCommand = !paletteNeedle || 'trash deleted restore'.includes(paletteNeedle)

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? '' : 'sidebar--closed'}`}>
        <div className="brand-row">
          <div className="brand-mark">L</div>
          <div><strong>Lumo</strong><span>Local workspace</span></div>
        </div>

        <button className="new-page" onClick={() => addPage(null)}><span>＋</span> New page</button>

        <label className="search-box">
          <span>⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages" aria-label="Search pages" />
        </label>

        <nav className="page-list" aria-label="Pages">
          {query.trim() ? (
            filteredPages.length > 0 ? filteredPages.map((page) => (
              <button key={page.id} className={`page-item page-item--search ${page.id === activePage?.id ? 'page-item--active' : ''}`} onClick={() => openPage(page.id)}>
                <span className="page-icon">{page.icon || '📄'}</span>
                <span className="page-label">{page.title.trim() || 'Untitled'}</span>
              </button>
            )) : <div className="empty-search">No pages found.</div>
          ) : renderPageTree(null)}
        </nav>

        <div className="sidebar-footer">
          <button className="palette-shortcut" onClick={() => setPaletteOpen(true)}><span>Command palette</span><kbd>Ctrl K</kbd></button>
          <button onClick={() => setTrashOpen(true)}><span>🗑 Trash</span>{trashedPages.length > 0 && <span className="sidebar-count">{trashedPages.length}</span>}</button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}</button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button className="icon-button" onClick={() => setSidebarOpen((open) => !open)} aria-label="Toggle sidebar" title="Toggle sidebar">☰</button>
          <div className="topbar-title">{activePage?.icon} {activePage?.title.trim() || 'Untitled'}</div>
          <div className="topbar-actions">
            <button className="command-button" onClick={() => setPaletteOpen(true)}><span>⌕</span><kbd>Ctrl K</kbd></button>
            <button onClick={exportMarkdown}>Export .md</button>
            <button className="danger-button" onClick={trashActive}>Trash</button>
          </div>
        </header>

        {activePage && (
          <section className="editor-wrap" onClick={() => setSlashMenu(null)}>
            <div className="editor-meta"><span>Saved locally</span><span>•</span><span>{new Date(activePage.updatedAt).toLocaleString()}</span></div>
            <button className="page-hero-icon" onClick={changePageIcon} title="Change page icon">{activePage.icon || '📄'}</button>
            <input className="title-input" value={activePage.title} onChange={(event) => updateActivePage({ title: event.target.value })} placeholder="Untitled" aria-label="Page title" />

            {focusedBlockId && activePage.blocks.some((block) => block.id === focusedBlockId && !['database', 'divider', 'image'].includes(block.type)) && (
              <div className="inline-format-toolbar">
                <button onMouseDown={(event) => event.preventDefault()} onClick={() => applyInlineFormat(focusedBlockId, '**')} title="Bold (Ctrl+B)"><strong>B</strong></button>
                <button onMouseDown={(event) => event.preventDefault()} onClick={() => applyInlineFormat(focusedBlockId, '*')} title="Italic (Ctrl+I)"><em>I</em></button>
                <button onMouseDown={(event) => event.preventDefault()} onClick={() => applyInlineFormat(focusedBlockId, '~~')} title="Strikethrough (Ctrl+Shift+S)"><s>S</s></button>
                <button onMouseDown={(event) => event.preventDefault()} onClick={() => applyInlineFormat(focusedBlockId, '`')} title="Inline code (Ctrl+E)">{'</>'}</button>
                <span>Markdown formatting</span>
              </div>
            )}

            <div className="block-editor" onClick={(event) => event.stopPropagation()}>
              {activePage.blocks.map((block, index) => {
                const specialStatic = block.type === 'database' || block.type === 'divider'
                const bookmarkUrl = block.type === 'bookmark' ? safeHttpUrl(block.text) : ''
                const imageUrl = block.type === 'image' ? safeHttpUrl(block.text) : ''

                return (
                  <div
                    key={block.id}
                    className={`block-row block-row--${block.type} ${draggedBlockId === block.id ? 'block-row--dragging' : ''}`}
                    draggable={!specialStatic}
                    onDragStart={() => !specialStatic && setDraggedBlockId(block.id)}
                    onDragEnd={() => setDraggedBlockId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDrop(event, block.id)}
                  >
                    <div className="block-gutter" aria-hidden="true">
                      <button className="block-add" onClick={() => insertBlockAfter(block.id)} tabIndex={-1} title="Add block">+</button>
                      {specialStatic ? (
                        <button className="block-add" onClick={() => deleteBlock(block.id, index)} tabIndex={-1} title="Delete block">×</button>
                      ) : (
                        <span className="drag-handle" title="Drag to move">⋮⋮</span>
                      )}
                    </div>

                    <div className="block-main">
                      {block.type === 'database' ? (
                        <DatabaseBlock data={block.database || makeDatabaseData()} onChange={(database) => updateBlock(block.id, { database })} />
                      ) : block.type === 'divider' ? (
                        <hr className="lumo-divider" />
                      ) : block.type === 'callout' ? (
                        <div className="callout-block">
                          <button onClick={() => changeCalloutIcon(block)} title="Change icon">{block.emoji || '💡'}</button>
                          {renderTextArea(block, index, 'callout-input')}
                        </div>
                      ) : block.type === 'toggle' ? (
                        <div className="toggle-block">
                          <button className="toggle-button" onClick={() => updateBlock(block.id, { open: !block.open })}>{block.open ? '⌄' : '›'}</button>
                          <div className="toggle-content">
                            {renderTextArea(block, index, 'toggle-title-input')}
                            {block.open && (
                              <textarea
                                className="toggle-details-input"
                                value={block.details || ''}
                                onChange={(event) => updateBlock(block.id, { details: event.target.value })}
                                placeholder="Hidden details…"
                                rows={2}
                              />
                            )}
                          </div>
                        </div>
                      ) : block.type === 'bookmark' ? (
                        <div className="embed-block">
                          {renderTextArea(block, index, 'embed-url-input')}
                          {bookmarkUrl && <a className="bookmark-preview" href={bookmarkUrl} target="_blank" rel="noreferrer"><strong>{bookmarkUrl}</strong><span>Open bookmark ↗</span></a>}
                        </div>
                      ) : block.type === 'image' ? (
                        <div className="embed-block">
                          {renderTextArea(block, index, 'embed-url-input')}
                          {imageUrl && <img className="image-preview" src={imageUrl} alt="Embedded" />}
                        </div>
                      ) : (
                        <>
                          {block.type === 'bullet' && <span className="block-prefix">•</span>}
                          {block.type === 'numbered' && <span className="block-prefix">{index + 1}.</span>}
                          {block.type === 'todo' && <input className="todo-checkbox" type="checkbox" checked={Boolean(block.checked)} onChange={(event) => updateBlock(block.id, { checked: event.target.checked })} aria-label="Toggle to-do" />}
                          {renderTextArea(block, index)}
                        </>
                      )}

                      {slashMenu?.blockId === block.id && block.type !== 'database' && block.type !== 'divider' && (
                        <div className="slash-menu">
                          <div className="slash-menu-title">Blocks</div>
                          {visibleCommands.length > 0 ? visibleCommands.map((command) => (
                            <button key={command.type} className="slash-command" onMouseDown={(event) => event.preventDefault()} onClick={() => selectCommand(command)}>
                              <span className="slash-command-icon">{command.icon}</span>
                              <span><strong>{command.label}</strong><small>{command.description}</small></span>
                            </button>
                          )) : <div className="slash-empty">No matching blocks.</div>}
                          <div className="slash-menu-hint">Enter to select · Esc to close</div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <button className="editor-add-block" onClick={() => insertBlockAfter(activePage.blocks.at(-1)?.id ?? '')}>+ Add block</button>

            {backlinks.length > 0 && (
              <section className="backlinks-panel">
                <div><strong>Backlinks</strong><span>Pages that mention [[{activePage.title}]]</span></div>
                {backlinks.map((page) => <button key={page.id} onClick={() => openPage(page.id)}><span>{page.icon}</span>{page.title || 'Untitled'}</button>)}
              </section>
            )}
          </section>
        )}
      </main>

      {paletteOpen && (
        <div className="palette-backdrop" onMouseDown={() => setPaletteOpen(false)}>
          <div className="command-palette" onMouseDown={(event) => event.stopPropagation()}>
            <div className="palette-search-row">
              <span>⌕</span>
              <input ref={paletteInputRef} value={paletteQuery} onChange={(event) => setPaletteQuery(event.target.value)} placeholder="Search pages or run a command…" />
              <kbd>Esc</kbd>
            </div>
            <div className="palette-results">
              {(showNewPageCommand || showDatabaseCommand || showDuplicateCommand || showThemeCommand || showExportCommand || showTrashCommand) && <div className="palette-section-title">Commands</div>}
              {showNewPageCommand && <button onClick={() => addPage(null)}><span className="palette-icon">＋</span><span><strong>New page</strong><small>Create a blank page</small></span></button>}
              {showDatabaseCommand && activePage && <button onClick={() => { insertBlockAfter(activePage.blocks.at(-1)?.id ?? '', 'database'); setPaletteOpen(false) }}><span className="palette-icon">▦</span><span><strong>New database</strong><small>Add table, board and calendar views</small></span></button>}
              {showDuplicateCommand && activePage && <button onClick={duplicateActive}><span className="palette-icon">⧉</span><span><strong>Duplicate page</strong><small>Make a local copy</small></span></button>}
              {showTrashCommand && <button onClick={() => { setPaletteOpen(false); setTrashOpen(true) }}><span className="palette-icon">🗑</span><span><strong>Open Trash</strong><small>Restore or permanently delete pages</small></span></button>}
              {showThemeCommand && <button onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setPaletteOpen(false) }}><span className="palette-icon">◐</span><span><strong>Toggle theme</strong><small>Switch light and dark mode</small></span></button>}
              {showExportCommand && <button onClick={() => { exportMarkdown(); setPaletteOpen(false) }}><span className="palette-icon">⇩</span><span><strong>Export Markdown</strong><small>Download the current page</small></span></button>}

              {(showStudyTemplate || showTaskTemplate || showProjectTemplate) && <div className="palette-section-title">Templates</div>}
              {showStudyTemplate && <button onClick={() => addTemplate('study')}><span className="palette-icon">📚</span><span><strong>Study notes</strong><small>Summary, ideas and questions</small></span></button>}
              {showTaskTemplate && <button onClick={() => addTemplate('tasks')}><span className="palette-icon">✅</span><span><strong>Task planner</strong><small>Start with a task database</small></span></button>}
              {showProjectTemplate && <button onClick={() => addTemplate('project')}><span className="palette-icon">🚀</span><span><strong>Project hub</strong><small>Goal, next steps and tracker</small></span></button>}

              {palettePages.length > 0 && <div className="palette-section-title">Pages</div>}
              {palettePages.map((page) => (
                <button key={page.id} onClick={() => openPage(page.id)}><span className="palette-icon">{page.icon || '📄'}</span><span><strong>{page.title.trim() || 'Untitled'}</strong><small>Open page</small></span></button>
              ))}
            </div>
          </div>
        </div>
      )}

      {trashOpen && (
        <div className="palette-backdrop" onMouseDown={() => setTrashOpen(false)}>
          <div className="trash-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="trash-header"><div><strong>Trash</strong><span>Deleted pages stay here until you remove them permanently.</span></div><button onClick={emptyTrash} disabled={trashedPages.length === 0}>Empty trash</button></div>
            <div className="trash-list">
              {trashedPages.length === 0 ? <div className="trash-empty">Trash is empty.</div> : trashedPages.map((page) => (
                <div key={page.id} className="trash-item">
                  <span className="trash-icon">{page.icon || '📄'}</span>
                  <div><strong>{page.title || 'Untitled'}</strong><small>{page.trashedAt ? new Date(page.trashedAt).toLocaleString() : ''}</small></div>
                  <button onClick={() => restorePage(page.id)}>Restore</button>
                  <button className="danger-button" onClick={() => permanentlyDelete(page.id)}>Delete forever</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
