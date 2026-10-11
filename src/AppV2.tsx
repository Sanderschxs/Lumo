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
import SlashMenu, { type SlashMenuItem } from './SlashMenu'
import './features.css'
import './appV2.css'

type BlockType =
  | 'text'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'bullet'
  | 'numbered'
  | 'todo'
  | 'quote'
  | 'callout'
  | 'toggle'
  | 'table'
  | 'divider'
  | 'bookmark'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'embed'
  | 'code'
  | 'toc'
  | 'equation'
  | 'button'
  | 'breadcrumb'
  | 'columns'
  | 'database'

type Tone = 'default' | 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red'

type Block = {
  id: string
  type: BlockType
  text: string
  checked?: boolean
  database?: DatabaseData
  emoji?: string
  details?: string
  open?: boolean
  columns?: string[]
  table?: string[][]
  textColor?: Tone
  backgroundColor?: Tone
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

type CommandAction =
  | { kind: 'block'; type: BlockType; databaseView?: DatabaseData['view']; columnCount?: number }
  | { kind: 'template'; template: TemplateKind }
  | { kind: 'subpage' }
  | { kind: 'page-link' }
  | { kind: 'insert-date' }
  | { kind: 'insert-emoji' }
  | { kind: 'insert-inline-equation' }
  | { kind: 'duplicate-block' }
  | { kind: 'delete-block' }
  | { kind: 'copy-block-link' }
  | { kind: 'move-block' }
  | { kind: 'text-color'; tone: Tone }
  | { kind: 'background-color'; tone: Tone }
  | { kind: 'database-page' }
  | { kind: 'disabled' }

type SlashCommand = SlashMenuItem & {
  keywords: string
  action: CommandAction
}

const STORAGE_KEY = 'lumo.pages.v1'
const THEME_KEY = 'lumo.theme'

const BLOCK_TYPES: BlockType[] = [
  'text', 'heading1', 'heading2', 'heading3', 'heading4', 'bullet', 'numbered', 'todo',
  'quote', 'callout', 'toggle', 'table', 'divider', 'bookmark', 'image', 'video', 'audio',
  'file', 'embed', 'code', 'toc', 'equation', 'button', 'breadcrumb', 'columns', 'database',
]

const TONES: Array<{ tone: Tone; label: string; swatch: string }> = [
  { tone: 'default', label: 'Default', swatch: '#b7b7b7' },
  { tone: 'gray', label: 'Gray', swatch: '#8b8b8b' },
  { tone: 'brown', label: 'Brown', swatch: '#9a6f52' },
  { tone: 'orange', label: 'Orange', swatch: '#d47a25' },
  { tone: 'yellow', label: 'Yellow', swatch: '#c79a27' },
  { tone: 'green', label: 'Green', swatch: '#4d9b65' },
  { tone: 'blue', label: 'Blue', swatch: '#4b82d0' },
  { tone: 'purple', label: 'Purple', swatch: '#8a62c8' },
  { tone: 'pink', label: 'Pink', swatch: '#c85f91' },
  { tone: 'red', label: 'Red', swatch: '#d45454' },
]

const coreCommands: SlashCommand[] = [
  { id: 'suggest-study', group: 'Suggested', label: 'Study notes', description: 'Start a structured notes page', icon: '✦', keywords: 'study notes template school', action: { kind: 'template', template: 'study' } },
  { id: 'suggest-database', group: 'Suggested', label: 'Database', description: 'Create a flexible database', icon: '▦', keywords: 'database table tracker', action: { kind: 'block', type: 'database', databaseView: 'table' } },

  { id: 'text', group: 'Basic blocks', label: 'Text', icon: 'T', keywords: 'text paragraph', action: { kind: 'block', type: 'text' } },
  { id: 'h1', group: 'Basic blocks', label: 'Heading 1', icon: 'H1', keywords: 'heading h1 title', action: { kind: 'block', type: 'heading1' } },
  { id: 'h2', group: 'Basic blocks', label: 'Heading 2', icon: 'H2', keywords: 'heading h2', action: { kind: 'block', type: 'heading2' } },
  { id: 'h3', group: 'Basic blocks', label: 'Heading 3', icon: 'H3', keywords: 'heading h3', action: { kind: 'block', type: 'heading3' } },
  { id: 'h4', group: 'Basic blocks', label: 'Heading 4', icon: 'H4', keywords: 'heading h4', action: { kind: 'block', type: 'heading4' } },
  { id: 'bullet', group: 'Basic blocks', label: 'Bulleted list', icon: '•', keywords: 'bullet list unordered', action: { kind: 'block', type: 'bullet' } },
  { id: 'numbered', group: 'Basic blocks', label: 'Numbered list', icon: '1.', keywords: 'numbered ordered list', action: { kind: 'block', type: 'numbered' } },
  { id: 'todo', group: 'Basic blocks', label: 'To-do list', icon: '☑', keywords: 'todo task checkbox checklist', action: { kind: 'block', type: 'todo' } },
  { id: 'toggle', group: 'Basic blocks', label: 'Toggle list', icon: '›', keywords: 'toggle collapse details', action: { kind: 'block', type: 'toggle' } },
  { id: 'page', group: 'Basic blocks', label: 'Page', icon: '▤', keywords: 'page subpage child', action: { kind: 'subpage' } },
  { id: 'callout', group: 'Basic blocks', label: 'Callout', icon: '▣', keywords: 'callout notice info', action: { kind: 'block', type: 'callout' } },
  { id: 'quote', group: 'Basic blocks', label: 'Quote', icon: '❝', keywords: 'quote blockquote', action: { kind: 'block', type: 'quote' } },
  { id: 'simple-table', group: 'Basic blocks', label: 'Table', icon: '▦', keywords: 'simple table grid cells', action: { kind: 'block', type: 'table' } },
  { id: 'divider', group: 'Basic blocks', label: 'Divider', icon: '—', keywords: 'divider separator line', action: { kind: 'block', type: 'divider' } },
  { id: 'link-page', group: 'Basic blocks', label: 'Link to page', icon: '↗', keywords: 'link page mention backlink', action: { kind: 'page-link' } },

  { id: 'image', group: 'Media', label: 'Image', icon: '▧', keywords: 'image photo picture media', action: { kind: 'block', type: 'image' } },
  { id: 'video', group: 'Media', label: 'Video', icon: '▶', keywords: 'video movie media youtube', action: { kind: 'block', type: 'video' } },
  { id: 'audio', group: 'Media', label: 'Audio', icon: '◖', keywords: 'audio music sound', action: { kind: 'block', type: 'audio' } },
  { id: 'code', group: 'Media', label: 'Code', icon: '</>', keywords: 'code snippet programming', action: { kind: 'block', type: 'code' } },
  { id: 'file', group: 'Media', label: 'File', icon: '⌕', keywords: 'file attachment download', action: { kind: 'block', type: 'file' } },
  { id: 'bookmark', group: 'Media', label: 'Web bookmark', icon: '▱', keywords: 'bookmark web url link', action: { kind: 'block', type: 'bookmark' } },

  { id: 'db-table', group: 'Database', label: 'Table view', icon: '▦', keywords: 'database table view', action: { kind: 'block', type: 'database', databaseView: 'table' } },
  { id: 'db-board', group: 'Database', label: 'Board view', icon: '▥', keywords: 'database board kanban view', action: { kind: 'block', type: 'database', databaseView: 'board' } },
  { id: 'db-gallery', group: 'Database', label: 'Gallery view', icon: '▦', badge: 'Soon', disabled: true, keywords: 'database gallery cards', action: { kind: 'disabled' } },
  { id: 'db-list', group: 'Database', label: 'List view', icon: '≡', badge: 'Soon', disabled: true, keywords: 'database list view', action: { kind: 'disabled' } },
  { id: 'db-feed', group: 'Database', label: 'Feed view', icon: '▤', badge: 'Soon', disabled: true, keywords: 'database feed view', action: { kind: 'disabled' } },
  { id: 'db-dashboard', group: 'Database', label: 'Dashboard view', icon: '▦', badge: 'Soon', disabled: true, keywords: 'database dashboard', action: { kind: 'disabled' } },
  { id: 'db-calendar', group: 'Database', label: 'Calendar view', icon: '▣', keywords: 'database calendar dates', action: { kind: 'block', type: 'database', databaseView: 'calendar' } },
  { id: 'db-timeline', group: 'Database', label: 'Timeline view', icon: '▤', badge: 'Soon', disabled: true, keywords: 'database timeline gantt', action: { kind: 'disabled' } },
  { id: 'db-map', group: 'Database', label: 'Map view', icon: '⌖', badge: 'Soon', disabled: true, keywords: 'database map location', action: { kind: 'disabled' } },
  { id: 'db-bar-v', group: 'Database', label: 'Vertical bar chart', icon: '▥', badge: 'Soon', disabled: true, keywords: 'database chart vertical bar', action: { kind: 'disabled' } },
  { id: 'db-bar-h', group: 'Database', label: 'Horizontal bar chart', icon: '≡', badge: 'Soon', disabled: true, keywords: 'database chart horizontal bar', action: { kind: 'disabled' } },
  { id: 'db-line', group: 'Database', label: 'Line chart', icon: '⌁', badge: 'Soon', disabled: true, keywords: 'database line chart', action: { kind: 'disabled' } },
  { id: 'db-donut', group: 'Database', label: 'Donut chart', icon: '◉', badge: 'Soon', disabled: true, keywords: 'database donut pie chart', action: { kind: 'disabled' } },
  { id: 'db-number', group: 'Database', label: 'Number chart', icon: '#', badge: 'Soon', disabled: true, keywords: 'database number chart metric', action: { kind: 'disabled' } },
  { id: 'db-form', group: 'Database', label: 'Form', icon: '▤', badge: 'Soon', disabled: true, keywords: 'database form input', action: { kind: 'disabled' } },
  { id: 'db-inline', group: 'Database', label: 'Database · Inline', icon: '▦', keywords: 'database inline', action: { kind: 'block', type: 'database', databaseView: 'table' } },
  { id: 'db-full', group: 'Database', label: 'Database · Full page', icon: '▦', keywords: 'database full page', action: { kind: 'database-page' } },
  { id: 'db-linked', group: 'Database', label: 'Linked view of data source', icon: '↗', badge: 'Soon', disabled: true, keywords: 'database linked view relation source', action: { kind: 'disabled' } },

  { id: 'toc', group: 'Advanced blocks', label: 'Table of contents', icon: '☷', keywords: 'table contents toc headings', action: { kind: 'block', type: 'toc' } },
  { id: 'equation', group: 'Advanced blocks', label: 'Block equation', icon: 'Σ', keywords: 'equation math formula latex', action: { kind: 'block', type: 'equation' } },
  { id: 'button', group: 'Advanced blocks', label: 'Button', icon: '▣', keywords: 'button action link', action: { kind: 'block', type: 'button' } },
  { id: 'breadcrumb', group: 'Advanced blocks', label: 'Breadcrumb', icon: '▤', keywords: 'breadcrumb parents path', action: { kind: 'block', type: 'breadcrumb' } },
  { id: 'tabs', group: 'Advanced blocks', label: 'Tabs', icon: '▣', badge: 'Soon', disabled: true, keywords: 'tabs tabbed layout', action: { kind: 'disabled' } },
  { id: 'synced', group: 'Advanced blocks', label: 'Synced block', icon: '↻', badge: 'Soon', disabled: true, keywords: 'synced reusable block', action: { kind: 'disabled' } },
  { id: 'cols2', group: 'Advanced blocks', label: '2 columns', icon: '▥', keywords: 'columns layout two', action: { kind: 'block', type: 'columns', columnCount: 2 } },
  { id: 'cols3', group: 'Advanced blocks', label: '3 columns', icon: '▥', keywords: 'columns layout three', action: { kind: 'block', type: 'columns', columnCount: 3 } },
  { id: 'cols4', group: 'Advanced blocks', label: '4 columns', icon: '▥', keywords: 'columns layout four', action: { kind: 'block', type: 'columns', columnCount: 4 } },
  { id: 'cols5', group: 'Advanced blocks', label: '5 columns', icon: '▥', keywords: 'columns layout five', action: { kind: 'block', type: 'columns', columnCount: 5 } },
  { id: 'mermaid', group: 'Advanced blocks', label: 'Code · Mermaid', icon: '◇', keywords: 'mermaid diagram code', action: { kind: 'block', type: 'code' } },
  { id: 'ai-block', group: 'Advanced blocks', label: 'AI block', icon: '✦', badge: 'Soon', disabled: true, keywords: 'ai writing assistant', action: { kind: 'disabled' } },

  { id: 'mention-person', group: 'Inline', label: 'Mention a person', icon: '@', badge: 'Soon', disabled: true, keywords: 'mention person user', action: { kind: 'disabled' } },
  { id: 'mention-page', group: 'Inline', label: 'Mention a page or data source', icon: '▤', keywords: 'mention page database link', action: { kind: 'page-link' } },
  { id: 'date', group: 'Inline', label: 'Date or reminder', icon: '◷', keywords: 'date reminder today', action: { kind: 'insert-date' } },
  { id: 'emoji', group: 'Inline', label: 'Emoji', icon: '☺', keywords: 'emoji icon', action: { kind: 'insert-emoji' } },
  { id: 'inline-equation', group: 'Inline', label: 'Inline equation', icon: '√x', keywords: 'inline equation formula math', action: { kind: 'insert-inline-equation' } },

  { id: 'embed', group: 'Embeds', label: 'Embed', icon: '⌘', keywords: 'embed iframe website', action: { kind: 'block', type: 'embed' } },
  { id: 'html', group: 'Embeds', label: 'HTML', icon: '</>', badge: 'Soon', disabled: true, keywords: 'html embed code', action: { kind: 'disabled' } },
  { id: 'gdrive', group: 'Embeds', label: 'Google Drive', icon: '△', keywords: 'google drive embed link', action: { kind: 'block', type: 'bookmark' } },
  { id: 'github', group: 'Embeds', label: 'GitHub', icon: '◉', keywords: 'github repo issue pull request embed', action: { kind: 'block', type: 'bookmark' } },

  { id: 'import-csv', group: 'Import', label: 'CSV', icon: 'CSV', badge: 'Soon', disabled: true, keywords: 'import csv spreadsheet', action: { kind: 'disabled' } },
  { id: 'import-md', group: 'Import', label: 'Text and Markdown', icon: '≡', badge: 'Soon', disabled: true, keywords: 'import markdown text md', action: { kind: 'disabled' } },
  { id: 'import-docs', group: 'Import', label: 'Google Docs', icon: '▤', badge: 'Soon', disabled: true, keywords: 'import google docs', action: { kind: 'disabled' } },
  { id: 'import-word', group: 'Import', label: 'Word', icon: 'W', badge: 'Soon', disabled: true, keywords: 'import word docx', action: { kind: 'disabled' } },
  { id: 'import-pdf', group: 'Import', label: 'PDF', icon: 'PDF', badge: 'Soon', disabled: true, keywords: 'import pdf', action: { kind: 'disabled' } },
  { id: 'import-other', group: 'Import', label: 'Other services', icon: '↥', badge: 'Soon', disabled: true, keywords: 'asana confluence trello evernote monday quip zip workflowy dropbox', action: { kind: 'disabled' } },

  { id: 'action-copy', group: 'Actions', label: 'Copy link to block', icon: '↗', keywords: 'copy link block', action: { kind: 'copy-block-link' } },
  { id: 'action-duplicate', group: 'Actions', label: 'Duplicate', icon: '⧉', keywords: 'duplicate copy block', action: { kind: 'duplicate-block' } },
  { id: 'action-move', group: 'Actions', label: 'Move to', icon: '↪', keywords: 'move block page', action: { kind: 'move-block' } },
  { id: 'action-delete', group: 'Actions', label: 'Delete', icon: '⌫', keywords: 'delete remove block', action: { kind: 'delete-block' } },
  { id: 'action-ai', group: 'Actions', label: 'Ask AI', icon: '✦', badge: 'Soon', disabled: true, keywords: 'ai ask improve proofread explain', action: { kind: 'disabled' } },
]

const colorCommands: SlashCommand[] = [
  ...TONES.map(({ tone, label, swatch }) => ({
    id: `text-color-${tone}`,
    group: 'Text color',
    label: `${label} text`,
    icon: 'A',
    swatch,
    keywords: `text color ${label}`.toLowerCase(),
    action: { kind: 'text-color' as const, tone },
  })),
  ...TONES.map(({ tone, label, swatch }) => ({
    id: `bg-color-${tone}`,
    group: 'Background color',
    label: `${label} background`,
    icon: '■',
    swatch,
    keywords: `background color ${label}`.toLowerCase(),
    action: { kind: 'background-color' as const, tone },
  })),
]

const SLASH_COMMANDS: SlashCommand[] = [...coreCommands, ...colorCommands]

function makeBlock(type: BlockType = 'text', text = ''): Block {
  const block: Block = { id: crypto.randomUUID(), type, text }
  if (type === 'todo') block.checked = false
  if (type === 'database') block.database = makeDatabaseData()
  if (type === 'callout') block.emoji = '💡'
  if (type === 'toggle') { block.open = true; block.details = '' }
  if (type === 'table') block.table = Array.from({ length: 3 }, () => ['', '', ''])
  if (type === 'button') block.details = ''
  if (type === 'columns') block.columns = ['', '']
  return block
}

function makePage(title = 'Untitled', parentId: string | null = null): Page {
  const now = Date.now()
  return { id: crypto.randomUUID(), title, blocks: [makeBlock()], icon: '📄', parentId, createdAt: now, updatedAt: now }
}

function templatePage(kind: TemplateKind, parentId: string | null = null): Page {
  const page = makePage('Untitled', parentId)
  if (kind === 'study') {
    return { ...page, title: 'Study notes', icon: '📚', blocks: [
      makeBlock('heading1', 'Topic'), makeBlock('callout', 'Main goal for this study session'),
      makeBlock('heading2', 'Key ideas'), makeBlock('bullet', ''), makeBlock('heading2', 'Questions'), makeBlock('todo', ''),
    ] }
  }
  if (kind === 'tasks') {
    const database = makeDatabaseData(); database.title = 'Tasks'
    return { ...page, title: 'Task planner', icon: '✅', blocks: [{ ...makeBlock('database'), database }] }
  }
  const database = makeDatabaseData(); database.title = 'Project tracker'
  return { ...page, title: 'Project hub', icon: '🚀', blocks: [
    makeBlock('callout', 'Define what success looks like.'), makeBlock('heading2', 'Goal'), makeBlock('text', ''),
    makeBlock('heading2', 'Next steps'), makeBlock('todo', ''), { ...makeBlock('database'), database },
  ] }
}

function migrateBlocks(page: Partial<Page>): Block[] {
  if (Array.isArray(page.blocks) && page.blocks.length > 0) {
    return page.blocks.map((raw) => {
      const input = raw as Partial<Block>
      const type = BLOCK_TYPES.includes(input.type as BlockType) ? input.type as BlockType : 'text'
      const block = makeBlock(type, typeof input.text === 'string' ? input.text : '')
      return {
        ...block,
        id: input.id || crypto.randomUUID(),
        checked: type === 'todo' ? Boolean(input.checked) : undefined,
        database: type === 'database' ? normalizeDatabaseData(input.database) : undefined,
        emoji: type === 'callout' ? input.emoji || '💡' : undefined,
        details: ['toggle', 'button'].includes(type) ? input.details || '' : undefined,
        open: type === 'toggle' ? input.open !== false : undefined,
        columns: type === 'columns' && Array.isArray(input.columns) ? input.columns : block.columns,
        table: type === 'table' && Array.isArray(input.table) ? input.table : block.table,
        textColor: input.textColor || 'default',
        backgroundColor: input.backgroundColor || 'default',
      }
    })
  }
  if (typeof page.content === 'string' && page.content.length > 0) return page.content.split('\n').map((line) => makeBlock('text', line))
  return [makeBlock()]
}

function loadPages(): Page[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [makePage('Welcome to Lumo')]
    const parsed = JSON.parse(raw) as Partial<Page>[]
    if (!Array.isArray(parsed) || parsed.length === 0) return [makePage('Welcome to Lumo')]
    const migrated = parsed.map((page) => ({
      id: page.id || crypto.randomUUID(), title: page.title || 'Untitled', blocks: migrateBlocks(page), icon: page.icon || '📄',
      parentId: page.parentId ?? null, createdAt: page.createdAt || Date.now(), updatedAt: page.updatedAt || Date.now(),
      trashedAt: typeof page.trashedAt === 'number' ? page.trashedAt : undefined,
    }))
    return migrated.some((page) => !page.trashedAt) ? migrated : [...migrated, makePage()]
  } catch { return [makePage('Welcome to Lumo')] }
}

function loadTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : ''
  } catch { return '' }
}

function youtubeEmbed(value: string) {
  const safe = safeHttpUrl(value)
  if (!safe) return ''
  try {
    const url = new URL(safe)
    if (url.hostname.includes('youtu.be')) return `https://www.youtube.com/embed/${url.pathname.slice(1)}`
    if (url.hostname.includes('youtube.com')) {
      const id = url.searchParams.get('v')
      if (id) return `https://www.youtube.com/embed/${id}`
    }
  } catch { return '' }
  return ''
}

function blockSearchText(block: Block) {
  if (block.type === 'database') return databaseSearchText(block.database || makeDatabaseData())
  return `${block.text} ${block.details || ''} ${(block.columns || []).join(' ')} ${(block.table || []).flat().join(' ')}`
}

function blockToMarkdown(block: Block): string {
  switch (block.type) {
    case 'heading1': return `# ${block.text}`
    case 'heading2': return `## ${block.text}`
    case 'heading3': return `### ${block.text}`
    case 'heading4': return `#### ${block.text}`
    case 'bullet': return `- ${block.text}`
    case 'numbered': return `1. ${block.text}`
    case 'todo': return `- [${block.checked ? 'x' : ' '}] ${block.text}`
    case 'quote': return `> ${block.text}`
    case 'callout': return `> ${block.emoji || '💡'} ${block.text}`
    case 'toggle': return `<details>\n<summary>${block.text || 'Details'}</summary>\n\n${block.details || ''}\n\n</details>`
    case 'table': return (block.table || []).map((row) => `| ${row.join(' | ')} |`).join('\n')
    case 'divider': return '---'
    case 'bookmark': return block.text ? `[${block.text}](${block.text})` : ''
    case 'image': return block.text ? `![Image](${block.text})` : ''
    case 'video': return block.text ? `[Video](${block.text})` : ''
    case 'audio': return block.text ? `[Audio](${block.text})` : ''
    case 'file': return block.text ? `[File](${block.text})` : ''
    case 'embed': return block.text ? `[Embed](${block.text})` : ''
    case 'code': return `\`\`\`\n${block.text}\n\`\`\``
    case 'equation': return `$$${block.text}$$`
    case 'button': return block.details ? `[${block.text || 'Button'}](${block.details})` : block.text
    case 'columns': return (block.columns || []).join(' | ')
    case 'database': return databaseToMarkdown(block.database || makeDatabaseData())
    default: return block.text
  }
}

function placeholder(type: BlockType) {
  if (type.startsWith('heading')) return 'Heading'
  if (type === 'todo') return 'To-do'
  if (type === 'quote') return 'Quote'
  if (type === 'callout') return 'Type something important…'
  if (type === 'toggle') return 'Toggle title'
  if (type === 'bookmark' || type === 'image' || type === 'video' || type === 'audio' || type === 'file' || type === 'embed') return 'Paste a URL…'
  if (type === 'code') return 'Write some code…'
  if (type === 'equation') return 'E = mc²'
  if (type === 'button') return 'Button label'
  return "Type '/' for commands"
}

export default function AppV2() {
  const [pages, setPages] = useState<Page[]>(loadPages)
  const visiblePages = useMemo(() => pages.filter((page) => !page.trashedAt), [pages])
  const trashedPages = useMemo(() => pages.filter((page) => page.trashedAt), [pages])
  const [activeId, setActiveId] = useState(() => pages.find((page) => !page.trashedAt)?.id ?? '')
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [slashMenu, setSlashMenu] = useState<{ blockId: string; query: string } | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null)
  const [collapsedPages, setCollapsedPages] = useState<Set<string>>(new Set())
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [trashOpen, setTrashOpen] = useState(false)
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null)
  const blockRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const paletteInputRef = useRef<HTMLInputElement | null>(null)

  const activePage = visiblePages.find((page) => page.id === activeId) ?? visiblePages[0]

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(pages)) }, [pages])
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem(THEME_KEY, theme) }, [theme])
  useEffect(() => {
    if (!visiblePages.some((page) => page.id === activeId) && visiblePages[0]) setActiveId(visiblePages[0].id)
  }, [visiblePages, activeId])
  useEffect(() => { setSlashIndex(0) }, [slashMenu?.query, slashMenu?.blockId])
  useEffect(() => { if (paletteOpen) requestAnimationFrame(() => paletteInputRef.current?.focus()) }, [paletteOpen])
  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setPaletteOpen((open) => !open); setPaletteQuery('')
      }
      if (event.key === 'Escape') { setPaletteOpen(false); setTrashOpen(false); setSlashMenu(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const filteredPages = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return visiblePages
    return visiblePages.filter((page) => `${page.title} ${page.blocks.map(blockSearchText).join(' ')}`.toLowerCase().includes(needle))
  }, [visiblePages, query])

  const visibleCommands = useMemo(() => {
    const needle = slashMenu?.query.trim().toLowerCase() || ''
    if (!needle) return SLASH_COMMANDS
    return SLASH_COMMANDS.filter((command) => `${command.group} ${command.label} ${command.description || ''} ${command.keywords}`.toLowerCase().includes(needle))
  }, [slashMenu])
  const enabledCommands = useMemo(() => visibleCommands.filter((command) => !command.disabled), [visibleCommands])
  const selectedCommand = enabledCommands[Math.min(slashIndex, Math.max(enabledCommands.length - 1, 0))]

  const palettePages = useMemo(() => {
    const needle = paletteQuery.trim().toLowerCase()
    return (needle ? visiblePages.filter((page) => page.title.toLowerCase().includes(needle)) : visiblePages).slice(0, 7)
  }, [visiblePages, paletteQuery])

  const backlinks = useMemo(() => {
    if (!activePage?.title.trim()) return []
    const token = `[[${activePage.title.trim()}]]`.toLowerCase()
    return visiblePages.filter((page) => page.id !== activePage.id && page.blocks.some((block) => blockSearchText(block).toLowerCase().includes(token)))
  }, [visiblePages, activePage])

  function focusBlock(blockId: string) {
    requestAnimationFrame(() => {
      const element = blockRefs.current[blockId]
      element?.focus()
      if (element) { const end = element.value.length; element.setSelectionRange(end, end) }
    })
  }

  function resizeTextarea(element: HTMLTextAreaElement | null) {
    if (!element) return
    element.style.height = '0px'; element.style.height = `${Math.max(element.scrollHeight, 28)}px`
  }

  function addPage(parentId: string | null = null) {
    const page = makePage('Untitled', parentId)
    setPages((current) => [page, ...current]); setActiveId(page.id); setSlashMenu(null); setPaletteOpen(false)
    if (parentId) setCollapsedPages((current) => { const next = new Set(current); next.delete(parentId); return next })
    return page
  }

  function addTemplate(kind: TemplateKind) {
    const page = templatePage(kind)
    setPages((current) => [page, ...current]); setActiveId(page.id); setPaletteOpen(false); setSlashMenu(null)
  }

  function updateActivePage(patch: Partial<Pick<Page, 'title' | 'blocks' | 'icon' | 'parentId'>>) {
    if (!activePage) return
    setPages((current) => current.map((page) => page.id === activePage.id ? { ...page, ...patch, updatedAt: Date.now() } : page))
  }

  function changeBlocks(mutator: (blocks: Block[]) => Block[]) {
    if (!activePage) return
    setPages((current) => current.map((page) => page.id === activePage.id ? { ...page, blocks: mutator(page.blocks), updatedAt: Date.now() } : page))
  }

  function updateBlock(blockId: string, patch: Partial<Block>) {
    changeBlocks((blocks) => blocks.map((block) => block.id === blockId ? { ...block, ...patch } : block))
  }

  function handleBlockChange(blockId: string, text: string) {
    updateBlock(blockId, { text })
    if (text.startsWith('/') && !text.includes('\n')) setSlashMenu({ blockId, query: text.slice(1) })
    else if (slashMenu?.blockId === blockId) setSlashMenu(null)
  }

  function replaceBlock(blockId: string, type: BlockType, databaseView?: DatabaseData['view'], columnCount?: number) {
    const next = makeBlock(type)
    if (next.database && databaseView) next.database.view = databaseView
    if (type === 'columns') next.columns = Array.from({ length: columnCount || 2 }, () => '')
    updateBlock(blockId, next)
    setSlashMenu(null)
    if (!['database', 'divider', 'toc', 'breadcrumb', 'table', 'columns'].includes(type)) focusBlock(blockId)
  }

  function insertBlockAfter(blockId: string, type: BlockType = 'text') {
    const next = makeBlock(type)
    changeBlocks((blocks) => {
      const index = blocks.findIndex((block) => block.id === blockId)
      return index === -1 ? [...blocks, next] : [...blocks.slice(0, index + 1), next, ...blocks.slice(index + 1)]
    })
    if (!['database', 'divider', 'toc', 'breadcrumb', 'table', 'columns'].includes(type)) focusBlock(next.id)
  }

  function deleteBlock(blockId: string, fallbackIndex = 0) {
    if (!activePage) return
    if (activePage.blocks.length <= 1) { updateBlock(blockId, makeBlock()); setSlashMenu(null); return }
    const previous = activePage.blocks[Math.max(0, fallbackIndex - 1)]
    changeBlocks((blocks) => blocks.filter((block) => block.id !== blockId)); setSlashMenu(null)
    if (previous) focusBlock(previous.id)
  }

  function duplicateBlock(blockId: string) {
    if (!activePage) return
    changeBlocks((blocks) => {
      const index = blocks.findIndex((block) => block.id === blockId)
      if (index === -1) return blocks
      const copy = structuredClone(blocks[index]); copy.id = crypto.randomUUID(); copy.text = copy.text.startsWith('/') ? '' : copy.text
      if (copy.database) copy.database = normalizeDatabaseData({ ...copy.database, rows: copy.database.rows.map((row) => ({ ...row, id: crypto.randomUUID() })) })
      return [...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)]
    })
    setSlashMenu(null)
  }

  async function copyBlockLink(blockId: string) {
    const url = `${window.location.href.split('#')[0]}#block-${blockId}`
    try { await navigator.clipboard.writeText(url) } catch { window.prompt('Copy this block link', url) }
    updateBlock(blockId, { text: '' }); setSlashMenu(null)
  }

  function moveBlock(blockId: string) {
    if (!activePage) return
    const targetName = window.prompt('Move this block to which page?')
    if (!targetName) return
    const target = visiblePages.find((page) => page.id !== activePage.id && page.title.toLowerCase() === targetName.trim().toLowerCase())
    if (!target) { window.alert('No page with that exact title was found.'); return }
    const sourceId = activePage.id
    setPages((current) => {
      const source = current.find((page) => page.id === sourceId)
      const moving = source?.blocks.find((block) => block.id === blockId)
      if (!moving) return current
      return current.map((page) => {
        if (page.id === sourceId) {
          const remaining = page.blocks.filter((block) => block.id !== blockId)
          return { ...page, blocks: remaining.length ? remaining : [makeBlock()], updatedAt: Date.now() }
        }
        if (page.id === target.id) return { ...page, blocks: [...page.blocks, { ...moving, text: moving.text.startsWith('/') ? '' : moving.text }], updatedAt: Date.now() }
        return page
      })
    })
    setSlashMenu(null)
  }

  function createDatabasePage(blockId: string) {
    const page = makePage('Database')
    page.icon = '▦'; page.blocks = [makeBlock('database')]
    setPages((current) => [page, ...current]); setActiveId(page.id); setSlashMenu(null)
    if (activePage?.blocks.length === 1) updateBlock(blockId, { text: '' })
  }

  function runCommand(id: string) {
    if (!slashMenu) return
    const command = SLASH_COMMANDS.find((item) => item.id === id)
    if (!command || command.disabled) return
    const blockId = slashMenu.blockId
    switch (command.action.kind) {
      case 'block': replaceBlock(blockId, command.action.type, command.action.databaseView, command.action.columnCount); break
      case 'template': addTemplate(command.action.template); break
      case 'subpage': {
        const page = addPage(activePage?.id || null)
        setPages((current) => current.map((item) => item.id === activePage?.id ? { ...item, blocks: item.blocks.map((block) => block.id === blockId ? { ...makeBlock('text'), id: blockId, text: `[[${page.title}]]` } : block) } : item))
        break
      }
      case 'page-link': {
        const names = visiblePages.map((page) => page.title || 'Untitled').join('\n')
        const title = window.prompt(`Page title to link to:\n\n${names}`)
        if (title) updateBlock(blockId, { ...makeBlock('text'), id: blockId, text: `[[${title.trim()}]]` })
        setSlashMenu(null); break
      }
      case 'insert-date': updateBlock(blockId, { ...makeBlock('text'), id: blockId, text: `@${new Date().toISOString().slice(0, 10)}` }); setSlashMenu(null); focusBlock(blockId); break
      case 'insert-emoji': {
        const emoji = window.prompt('Choose an emoji', '✨')
        if (emoji !== null) updateBlock(blockId, { ...makeBlock('text'), id: blockId, text: emoji.trim().slice(0, 8) })
        setSlashMenu(null); focusBlock(blockId); break
      }
      case 'insert-inline-equation': updateBlock(blockId, { ...makeBlock('text'), id: blockId, text: '$x$' }); setSlashMenu(null); focusBlock(blockId); break
      case 'duplicate-block': duplicateBlock(blockId); break
      case 'delete-block': deleteBlock(blockId); break
      case 'copy-block-link': void copyBlockLink(blockId); break
      case 'move-block': moveBlock(blockId); break
      case 'text-color': updateBlock(blockId, { text: '', textColor: command.action.tone }); setSlashMenu(null); break
      case 'background-color': updateBlock(blockId, { text: '', backgroundColor: command.action.tone }); setSlashMenu(null); break
      case 'database-page': createDatabasePage(blockId); break
      case 'disabled': break
    }
  }

  function applyInlineFormat(blockId: string, prefix: string, suffix = prefix) {
    const element = blockRefs.current[blockId]
    const block = activePage?.blocks.find((candidate) => candidate.id === blockId)
    if (!element || !block) return
    const start = element.selectionStart; const end = element.selectionEnd; const selection = block.text.slice(start, end)
    updateBlock(blockId, { text: `${block.text.slice(0, start)}${prefix}${selection}${suffix}${block.text.slice(end)}` })
    requestAnimationFrame(() => { element.focus(); element.setSelectionRange(start + prefix.length, end + prefix.length) })
  }

  function handleBlockKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, block: Block, index: number) {
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const key = event.key.toLowerCase()
      if (key === 'b') { event.preventDefault(); applyInlineFormat(block.id, '**'); return }
      if (key === 'i') { event.preventDefault(); applyInlineFormat(block.id, '*'); return }
      if (key === 'e') { event.preventDefault(); applyInlineFormat(block.id, '`'); return }
      if (key === 's' && event.shiftKey) { event.preventDefault(); applyInlineFormat(block.id, '~~'); return }
    }
    if (slashMenu?.blockId === block.id) {
      if (event.key === 'Escape') { event.preventDefault(); setSlashMenu(null); return }
      if (event.key === 'ArrowDown' && enabledCommands.length) { event.preventDefault(); setSlashIndex((value) => (value + 1) % enabledCommands.length); return }
      if (event.key === 'ArrowUp' && enabledCommands.length) { event.preventDefault(); setSlashIndex((value) => (value - 1 + enabledCommands.length) % enabledCommands.length); return }
      if (event.key === 'Enter' && !event.shiftKey && selectedCommand) { event.preventDefault(); runCommand(selectedCommand.id); return }
    }
    if (event.key === 'Enter' && !event.shiftKey && !['code', 'equation'].includes(block.type)) {
      event.preventDefault()
      if (block.text.length === 0 && block.type !== 'text') { replaceBlock(block.id, 'text'); return }
      const continuation: BlockType = ['bullet', 'numbered', 'todo'].includes(block.type) ? block.type : 'text'
      insertBlockAfter(block.id, continuation); return
    }
    if (event.key === 'Backspace' && block.text.length === 0) {
      if (block.type !== 'text') { event.preventDefault(); replaceBlock(block.id, 'text'); return }
      if (activePage && activePage.blocks.length > 1) { event.preventDefault(); deleteBlock(block.id, index) }
    }
  }

  function reorderBlocks(fromId: string, toId: string) {
    if (fromId === toId) return
    changeBlocks((blocks) => {
      const from = blocks.findIndex((block) => block.id === fromId); const to = blocks.findIndex((block) => block.id === toId)
      if (from === -1 || to === -1) return blocks
      const next = [...blocks]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); return next
    })
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, targetId: string) {
    event.preventDefault(); if (draggedBlockId) reorderBlocks(draggedBlockId, targetId); setDraggedBlockId(null)
  }

  function collectDescendants(rootId: string, source: Page[]) {
    const ids = new Set<string>([rootId]); let changed = true
    while (changed) { changed = false; source.forEach((page) => { if (page.parentId && ids.has(page.parentId) && !ids.has(page.id)) { ids.add(page.id); changed = true } }) }
    return ids
  }

  function trashActive() {
    if (!activePage) return
    const deleting = collectDescendants(activePage.id, pages)
    if (!window.confirm(`Move “${activePage.title || 'Untitled'}”${deleting.size > 1 ? ' and its subpages' : ''} to Trash?`)) return
    const remaining = visiblePages.filter((page) => !deleting.has(page.id)); const fallback = remaining[0] || makePage()
    setPages((current) => {
      const next = current.map((page) => deleting.has(page.id) ? { ...page, trashedAt: Date.now() } : page)
      return remaining.length ? next : [fallback, ...next]
    }); setActiveId(fallback.id); setSlashMenu(null)
  }

  function restorePage(pageId: string) {
    const restoring = collectDescendants(pageId, pages)
    setPages((current) => current.map((page) => restoring.has(page.id) ? { ...page, trashedAt: undefined, updatedAt: Date.now() } : page))
    setActiveId(pageId); setTrashOpen(false)
  }

  function permanentlyDelete(pageId: string) {
    const deleting = collectDescendants(pageId, pages)
    if (!window.confirm('Permanently delete this page and its subpages?')) return
    setPages((current) => current.filter((page) => !deleting.has(page.id)))
  }

  function emptyTrash() {
    if (!trashedPages.length || !window.confirm(`Permanently delete ${trashedPages.length} trashed page${trashedPages.length === 1 ? '' : 's'}?`)) return
    setPages((current) => current.filter((page) => !page.trashedAt))
  }

  function exportMarkdown() {
    if (!activePage) return
    const title = activePage.title.trim() || 'Untitled'; const body = activePage.blocks.map(blockToMarkdown).filter(Boolean).join('\n\n')
    const blob = new Blob([`# ${title}\n\n${body}`], { type: 'text/markdown;charset=utf-8' }); const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `${title.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Untitled'}.md`; link.click(); URL.revokeObjectURL(url)
  }

  function changePageIcon() {
    if (!activePage) return
    const next = window.prompt('Choose an emoji or short icon', activePage.icon || '📄')
    if (next !== null) updateActivePage({ icon: next.trim().slice(0, 4) || '📄' })
  }

  function openPage(pageId: string) { setActiveId(pageId); setSlashMenu(null); setPaletteOpen(false) }
  function togglePageCollapsed(pageId: string) { setCollapsedPages((current) => { const next = new Set(current); next.has(pageId) ? next.delete(pageId) : next.add(pageId); return next }) }

  function renderPageTree(parentId: string | null, depth = 0): React.ReactNode {
    return visiblePages.filter((page) => page.parentId === parentId).map((page) => {
      const hasChildren = visiblePages.some((candidate) => candidate.parentId === page.id); const collapsed = collapsedPages.has(page.id)
      return <div key={page.id} className="page-tree-node">
        <div className={`page-row ${page.id === activePage?.id ? 'page-row--active' : ''}`} style={{ paddingLeft: `${4 + depth * 14}px` }}>
          <button className={`page-toggle ${hasChildren ? '' : 'page-toggle--empty'}`} onClick={() => hasChildren && togglePageCollapsed(page.id)}>{hasChildren ? (collapsed ? '›' : '⌄') : '·'}</button>
          <button className="page-item" onClick={() => openPage(page.id)}><span className="page-icon">{page.icon || '📄'}</span><span className="page-label">{page.title.trim() || 'Untitled'}</span></button>
          <button className="page-child-add" onClick={() => addPage(page.id)} title="Add subpage">+</button>
        </div>
        {hasChildren && !collapsed && renderPageTree(page.id, depth + 1)}
      </div>
    })
  }

  function renderTextArea(block: Block, index: number, className = '') {
    return <textarea
      ref={(element) => { blockRefs.current[block.id] = element; resizeTextarea(element) }}
      className={`block-input block-input--${block.type} ${block.checked ? 'block-input--checked' : ''} ${className}`}
      value={block.text} rows={1}
      onChange={(event) => { handleBlockChange(block.id, event.target.value); resizeTextarea(event.currentTarget) }}
      onKeyDown={(event) => handleBlockKeyDown(event, block, index)}
      onFocus={() => { setFocusedBlockId(block.id); if (block.text.startsWith('/')) setSlashMenu({ blockId: block.id, query: block.text.slice(1) }) }}
      placeholder={placeholder(block.type)} spellCheck={block.type !== 'code'}
    />
  }

  function renderSpecialBlock(block: Block, index: number) {
    const safe = safeHttpUrl(block.text); const yt = block.type === 'video' ? youtubeEmbed(block.text) : ''
    if (block.type === 'database') return <DatabaseBlock data={block.database || makeDatabaseData()} onChange={(database) => updateBlock(block.id, { database })} />
    if (block.type === 'divider') return <hr className="lumo-divider" />
    if (block.type === 'callout') return <div className="callout-block"><button onClick={() => { const emoji = window.prompt('Choose a callout emoji', block.emoji || '💡'); if (emoji !== null) updateBlock(block.id, { emoji: emoji.trim().slice(0, 4) || '💡' }) }}>{block.emoji || '💡'}</button>{renderTextArea(block, index, 'callout-input')}</div>
    if (block.type === 'toggle') return <div className="toggle-block"><button className="toggle-button" onClick={() => updateBlock(block.id, { open: !block.open })}>{block.open ? '⌄' : '›'}</button><div className="toggle-content">{renderTextArea(block, index, 'toggle-title-input')}{block.open && <textarea className="toggle-details-input" value={block.details || ''} onChange={(event) => updateBlock(block.id, { details: event.target.value })} placeholder="Hidden details…" rows={2} />}</div></div>
    if (block.type === 'table') return <div className="simple-table">{(block.table || []).map((row, r) => row.map((cell, c) => <input key={`${r}-${c}`} value={cell} onChange={(event) => { const next = (block.table || []).map((line) => [...line]); next[r][c] = event.target.value; updateBlock(block.id, { table: next }) }} placeholder={r === 0 ? 'Header' : ''} />))}</div>
    if (block.type === 'toc') {
      const headings = activePage?.blocks.filter((candidate) => candidate.type.startsWith('heading')) || []
      return <div className="toc-block"><strong>Table of contents</strong>{headings.length ? headings.map((heading) => <button key={heading.id} onClick={() => document.getElementById(`block-${heading.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>{heading.text || 'Untitled heading'}</button>) : <span>No headings yet.</span>}</div>
    }
    if (block.type === 'breadcrumb') {
      const chain: Page[] = []; let cursor = activePage?.parentId || null
      while (cursor) { const page = visiblePages.find((item) => item.id === cursor); if (!page) break; chain.unshift(page); cursor = page.parentId }
      return <div className="breadcrumb-block">{[...chain, ...(activePage ? [activePage] : [])].map((page, i, arr) => <span key={page.id}><button onClick={() => openPage(page.id)}>{page.icon} {page.title || 'Untitled'}</button>{i < arr.length - 1 && <b>›</b>}</span>)}</div>
    }
    if (block.type === 'columns') return <div className={`columns-block columns-block--${block.columns?.length || 2}`}>{(block.columns || ['', '']).map((value, columnIndex) => <textarea key={columnIndex} value={value} onChange={(event) => { const next = [...(block.columns || ['', ''])]; next[columnIndex] = event.target.value; updateBlock(block.id, { columns: next }) }} placeholder={`Column ${columnIndex + 1}`} rows={4} />)}</div>
    if (block.type === 'button') return <div className="lumo-button-block"><div>{renderTextArea(block, index)}<input value={block.details || ''} onChange={(event) => updateBlock(block.id, { details: event.target.value })} placeholder="https://…" /></div><button disabled={!safeHttpUrl(block.details || '')} onClick={() => window.open(safeHttpUrl(block.details || ''), '_blank')}>{block.text || 'Button'}</button></div>
    if (block.type === 'equation') return <div className="equation-block">{renderTextArea(block, index)}<div>{block.text || 'E = mc²'}</div></div>
    if (['bookmark', 'file'].includes(block.type)) return <div className="embed-block">{renderTextArea(block, index, 'embed-url-input')}{safe && <a className="bookmark-preview" href={safe} target="_blank" rel="noreferrer"><strong>{block.type === 'file' ? 'File' : safe}</strong><span>Open ↗</span></a>}</div>
    if (block.type === 'image') return <div className="embed-block">{renderTextArea(block, index, 'embed-url-input')}{safe && <img className="image-preview" src={safe} alt="Embedded" />}</div>
    if (block.type === 'video') return <div className="embed-block">{renderTextArea(block, index, 'embed-url-input')}{yt ? <iframe className="media-frame" src={yt} title="Video" allowFullScreen /> : safe && <video className="media-frame" src={safe} controls />}</div>
    if (block.type === 'audio') return <div className="embed-block">{renderTextArea(block, index, 'embed-url-input')}{safe && <audio className="audio-player" src={safe} controls />}</div>
    if (block.type === 'embed') return <div className="embed-block">{renderTextArea(block, index, 'embed-url-input')}{safe && <iframe className="embed-frame" src={safe} title="Embedded content" sandbox="allow-forms allow-popups allow-same-origin allow-scripts" />}</div>
    return null
  }

  const paletteNeedle = paletteQuery.trim().toLowerCase()
  const commandVisible = (words: string) => !paletteNeedle || words.includes(paletteNeedle)

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? '' : 'sidebar--closed'}`}>
      <div className="brand-row"><div className="brand-mark">L</div><div><strong>Lumo</strong><span>Local workspace</span></div></div>
      <button className="new-page" onClick={() => addPage(null)}><span>＋</span> New page</button>
      <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages" /></label>
      <nav className="page-list" aria-label="Pages">{query.trim() ? (filteredPages.length ? filteredPages.map((page) => <button key={page.id} className={`page-item page-item--search ${page.id === activePage?.id ? 'page-item--active' : ''}`} onClick={() => openPage(page.id)}><span className="page-icon">{page.icon}</span><span className="page-label">{page.title || 'Untitled'}</span></button>) : <div className="empty-search">No pages found.</div>) : renderPageTree(null)}</nav>
      <div className="sidebar-footer"><button className="palette-shortcut" onClick={() => setPaletteOpen(true)}><span>Command palette</span><kbd>Ctrl K</kbd></button><button onClick={() => setTrashOpen(true)}><span>🗑 Trash</span>{trashedPages.length > 0 && <span className="sidebar-count">{trashedPages.length}</span>}</button><button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}</button></div>
    </aside>

    <main className="workspace">
      <header className="topbar"><button className="icon-button" onClick={() => setSidebarOpen((open) => !open)}>☰</button><div className="topbar-title">{activePage?.icon} {activePage?.title.trim() || 'Untitled'}</div><div className="topbar-actions"><button className="command-button" onClick={() => setPaletteOpen(true)}><span>⌕</span><kbd>Ctrl K</kbd></button><button onClick={exportMarkdown}>Export .md</button><button className="danger-button" onClick={trashActive}>Trash</button></div></header>
      {activePage && <section className="editor-wrap" onClick={() => setSlashMenu(null)}>
        <div className="editor-meta"><span>Saved locally</span><span>•</span><span>{new Date(activePage.updatedAt).toLocaleString()}</span></div>
        <button className="page-hero-icon" onClick={changePageIcon}>{activePage.icon || '📄'}</button>
        <input className="title-input" value={activePage.title} onChange={(event) => updateActivePage({ title: event.target.value })} placeholder="Untitled" />

        {focusedBlockId && activePage.blocks.some((block) => block.id === focusedBlockId && !['database', 'divider', 'image', 'video', 'audio', 'embed', 'table', 'columns', 'toc', 'breadcrumb'].includes(block.type)) && <div className="inline-format-toolbar"><button onMouseDown={(event) => event.preventDefault()} onClick={() => applyInlineFormat(focusedBlockId, '**')}><strong>B</strong></button><button onMouseDown={(event) => event.preventDefault()} onClick={() => applyInlineFormat(focusedBlockId, '*')}><em>I</em></button><button onMouseDown={(event) => event.preventDefault()} onClick={() => applyInlineFormat(focusedBlockId, '~~')}><s>S</s></button><button onMouseDown={(event) => event.preventDefault()} onClick={() => applyInlineFormat(focusedBlockId, '`')}>{'</>'}</button><span>Markdown formatting</span></div>}

        <div className="block-editor" onClick={(event) => event.stopPropagation()}>
          {activePage.blocks.map((block, index) => {
            const staticBlock = ['database', 'divider', 'toc', 'breadcrumb', 'table', 'columns'].includes(block.type)
            const textTone = block.textColor && block.textColor !== 'default' ? `block-tone-text-${block.textColor}` : ''
            const bgTone = block.backgroundColor && block.backgroundColor !== 'default' ? `block-tone-bg-${block.backgroundColor}` : ''
            const special = renderSpecialBlock(block, index)
            return <div id={`block-${block.id}`} key={block.id} className={`block-row block-row--${block.type} ${textTone} ${bgTone} ${draggedBlockId === block.id ? 'block-row--dragging' : ''}`} draggable={!staticBlock} onDragStart={() => !staticBlock && setDraggedBlockId(block.id)} onDragEnd={() => setDraggedBlockId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, block.id)}>
              <div className="block-gutter" aria-hidden="true"><button className="block-add" onClick={() => insertBlockAfter(block.id)} tabIndex={-1}>+</button>{staticBlock ? <button className="block-add" onClick={() => deleteBlock(block.id, index)} tabIndex={-1}>×</button> : <span className="drag-handle">⋮⋮</span>}</div>
              <div className="block-main">
                {special || <>{block.type === 'bullet' && <span className="block-prefix">•</span>}{block.type === 'numbered' && <span className="block-prefix">{index + 1}.</span>}{block.type === 'todo' && <input className="todo-checkbox" type="checkbox" checked={Boolean(block.checked)} onChange={(event) => updateBlock(block.id, { checked: event.target.checked })} />}{renderTextArea(block, index)}</>}
                {slashMenu?.blockId === block.id && !staticBlock && <SlashMenu query={slashMenu.query} items={visibleCommands} selectedId={selectedCommand?.id} onSelect={runCommand} onHover={(id) => { const enabledIndex = enabledCommands.findIndex((command) => command.id === id); if (enabledIndex >= 0) setSlashIndex(enabledIndex) }} onClose={() => setSlashMenu(null)} />}
              </div>
            </div>
          })}
        </div>
        <button className="editor-add-block" onClick={() => insertBlockAfter(activePage.blocks.at(-1)?.id ?? '')}>+ Add block</button>
        {backlinks.length > 0 && <section className="backlinks-panel"><div><strong>Backlinks</strong><span>Pages that mention [[{activePage.title}]]</span></div>{backlinks.map((page) => <button key={page.id} onClick={() => openPage(page.id)}><span>{page.icon}</span>{page.title || 'Untitled'}</button>)}</section>}
      </section>}
    </main>

    {paletteOpen && <div className="palette-backdrop" onMouseDown={() => setPaletteOpen(false)}><div className="command-palette" onMouseDown={(event) => event.stopPropagation()}><div className="palette-search-row"><span>⌕</span><input ref={paletteInputRef} value={paletteQuery} onChange={(event) => setPaletteQuery(event.target.value)} placeholder="Search pages or run a command…" /><kbd>Esc</kbd></div><div className="palette-results">
      <div className="palette-section-title">Commands</div>
      {commandVisible('new page create') && <button onClick={() => addPage(null)}><span className="palette-icon">＋</span><span><strong>New page</strong><small>Create a blank page</small></span></button>}
      {commandVisible('database table board calendar') && activePage && <button onClick={() => { insertBlockAfter(activePage.blocks.at(-1)?.id ?? '', 'database'); setPaletteOpen(false) }}><span className="palette-icon">▦</span><span><strong>New database</strong><small>Add a database block</small></span></button>}
      {commandVisible('study template school') && <button onClick={() => addTemplate('study')}><span className="palette-icon">📚</span><span><strong>Study notes</strong><small>Start from a template</small></span></button>}
      {commandVisible('tasks template planner') && <button onClick={() => addTemplate('tasks')}><span className="palette-icon">✅</span><span><strong>Task planner</strong><small>Start from a database template</small></span></button>}
      {commandVisible('theme dark light') && <button onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setPaletteOpen(false) }}><span className="palette-icon">◐</span><span><strong>Toggle theme</strong><small>Switch appearance</small></span></button>}
      {commandVisible('trash deleted') && <button onClick={() => { setPaletteOpen(false); setTrashOpen(true) }}><span className="palette-icon">🗑</span><span><strong>Open Trash</strong><small>Restore deleted pages</small></span></button>}
      {palettePages.length > 0 && <div className="palette-section-title">Pages</div>}{palettePages.map((page) => <button key={page.id} onClick={() => openPage(page.id)}><span className="palette-icon">{page.icon}</span><span><strong>{page.title || 'Untitled'}</strong><small>Open page</small></span></button>)}
    </div></div></div>}

    {trashOpen && <div className="palette-backdrop" onMouseDown={() => setTrashOpen(false)}><div className="trash-modal" onMouseDown={(event) => event.stopPropagation()}><div className="trash-header"><div><strong>Trash</strong><span>Deleted pages stay here until you remove them permanently.</span></div><button onClick={emptyTrash} disabled={!trashedPages.length}>Empty trash</button></div><div className="trash-list">{trashedPages.length === 0 ? <div className="trash-empty">Trash is empty.</div> : trashedPages.map((page) => <div key={page.id} className="trash-item"><span className="trash-icon">{page.icon}</span><div><strong>{page.title || 'Untitled'}</strong><small>{page.trashedAt ? new Date(page.trashedAt).toLocaleString() : ''}</small></div><button onClick={() => restorePage(page.id)}>Restore</button><button className="danger-button" onClick={() => permanentlyDelete(page.id)}>Delete forever</button></div>)}</div></div></div>}
  </div>
}
