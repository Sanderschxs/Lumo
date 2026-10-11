import { useEffect } from 'react'
import AppV3 from './AppV3'
import './appV4.css'

const RICH_SELECTOR = [
  'textarea.block-input',
  ':not(.block-input--code)',
  ':not(.block-input--equation)',
  ':not(.embed-url-input)',
].join('')

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function markdownToHtml(markdown: string) {
  let html = escapeHtml(markdown)
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>')
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
  html = html.replaceAll('\n', '<br>')
  return html
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''
  if (!(node instanceof HTMLElement)) return ''

  const inner = Array.from(node.childNodes).map(nodeToMarkdown).join('')
  switch (node.tagName) {
    case 'BR': return '\n'
    case 'B':
    case 'STRONG': return `**${inner}**`
    case 'I':
    case 'EM': return `*${inner}*`
    case 'S':
    case 'STRIKE':
    case 'DEL': return `~~${inner}~~`
    case 'CODE': return `\`${inner.replaceAll('`', '')}\``
    case 'A': {
      const href = node.getAttribute('href') || ''
      return href ? `[${inner}](${href})` : inner
    }
    case 'DIV':
    case 'P': return `${inner}\n`
    default: return inner
  }
}

function editorToMarkdown(editor: HTMLElement) {
  return Array.from(editor.childNodes)
    .map(nodeToMarkdown)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n$/, '')
}

function setReactTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  if (setter) setter.call(textarea, value)
  else textarea.value = value
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

function placeCaretAtEnd(element: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(false)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function syncEditorToSource(editor: HTMLElement) {
  const textarea = editor.previousElementSibling
  if (!(textarea instanceof HTMLTextAreaElement)) return
  const markdown = editorToMarkdown(editor)
  editor.dataset.markdown = markdown
  setReactTextareaValue(textarea, markdown)
}

function applyCodeFormatting(editor: HTMLElement) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return
  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return

  const code = document.createElement('code')
  try {
    range.surroundContents(code)
  } catch {
    const contents = range.extractContents()
    code.append(contents)
    range.insertNode(code)
  }

  selection.removeAllRanges()
  const nextRange = document.createRange()
  nextRange.selectNodeContents(code)
  selection.addRange(nextRange)
}

export default function AppV4() {
  useEffect(() => {
    let activeEditor: HTMLElement | null = null

    const enhanceTextarea = (textarea: HTMLTextAreaElement) => {
      if (textarea.dataset.lumoRich === 'true') return
      textarea.dataset.lumoRich = 'true'
      textarea.classList.add('lumo-rich-source')

      const editor = document.createElement('div')
      editor.contentEditable = 'true'
      editor.spellcheck = textarea.spellcheck
      editor.dataset.placeholder = textarea.placeholder
      editor.dataset.markdown = textarea.value
      editor.className = `${textarea.className.replace('lumo-rich-source', '')} lumo-rich-editor`
      editor.innerHTML = markdownToHtml(textarea.value)
      textarea.insertAdjacentElement('afterend', editor)

      const syncClasses = () => {
        editor.className = `${textarea.className.replace('lumo-rich-source', '').trim()} lumo-rich-editor`
        editor.dataset.placeholder = textarea.placeholder
      }

      editor.addEventListener('focus', () => {
        activeEditor = editor
        textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
      })

      editor.addEventListener('blur', () => {
        syncEditorToSource(editor)
        editor.innerHTML = markdownToHtml(textarea.value)
        editor.dataset.markdown = textarea.value
      })

      editor.addEventListener('input', () => syncEditorToSource(editor))

      editor.addEventListener('paste', (event) => {
        event.preventDefault()
        const text = event.clipboardData?.getData('text/plain') || ''
        document.execCommand('insertText', false, text)
      })

      editor.addEventListener('keydown', (event) => {
        const modifier = event.ctrlKey || event.metaKey
        if (modifier && !event.altKey) {
          const key = event.key.toLowerCase()
          if (key === 'b' || key === 'i' || (key === 's' && event.shiftKey) || key === 'e') {
            event.preventDefault()
            if (key === 'b') document.execCommand('bold')
            else if (key === 'i') document.execCommand('italic')
            else if (key === 's') document.execCommand('strikeThrough')
            else applyCodeFormatting(editor)
            syncEditorToSource(editor)
            return
          }
        }

        const slashActive = textarea.value.startsWith('/')
        const shouldForward =
          (event.key === 'Enter' && !event.shiftKey) ||
          (event.key === 'Backspace' && (editor.textContent || '').length === 0) ||
          (slashActive && ['ArrowDown', 'ArrowUp', 'Escape'].includes(event.key))

        if (!shouldForward) return

        event.preventDefault()
        textarea.dispatchEvent(new KeyboardEvent('keydown', {
          key: event.key,
          code: event.code,
          shiftKey: event.shiftKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          bubbles: true,
          cancelable: true,
        }))
      })

      textarea.addEventListener('focus', () => {
        requestAnimationFrame(() => {
          editor.focus()
          placeCaretAtEnd(editor)
        })
      })

      syncClasses()
      if (document.activeElement === textarea) {
        requestAnimationFrame(() => {
          editor.focus()
          placeCaretAtEnd(editor)
        })
      }
    }

    const addDeleteControl = (row: HTMLElement) => {
      const gutter = row.querySelector<HTMLElement>('.block-gutter')
      if (!gutter || gutter.querySelector('.lumo-block-delete')) return

      const nativeDelete = Array.from(gutter.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === '×')
      if (nativeDelete) {
        nativeDelete.classList.add('lumo-block-delete')
        nativeDelete.title = 'Delete block'
        nativeDelete.setAttribute('aria-label', 'Delete block')
        return
      }

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'block-add lumo-block-delete'
      button.textContent = '×'
      button.title = 'Delete block'
      button.setAttribute('aria-label', 'Delete block')
      button.tabIndex = -1
      button.addEventListener('mousedown', (event) => event.preventDefault())
      button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()

        const textarea = row.querySelector<HTMLTextAreaElement>('textarea.block-input')
        if (!textarea) return

        setReactTextareaValue(textarea, '/delete')
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const deleteItem = Array.from(row.querySelectorAll<HTMLButtonElement>('.lumo-slash-item'))
              .find((item) => item.textContent?.toLowerCase().includes('delete'))
            if (deleteItem) {
              deleteItem.click()
              return
            }
            textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }))
          })
        })
      })
      gutter.append(button)
    }

    const enhanceAll = () => {
      document.querySelectorAll<HTMLTextAreaElement>(RICH_SELECTOR).forEach(enhanceTextarea)
      document.querySelectorAll<HTMLElement>('.block-row').forEach(addDeleteControl)

      document.querySelectorAll<HTMLTextAreaElement>('textarea[data-lumo-rich="true"]').forEach((textarea) => {
        const editor = textarea.nextElementSibling
        if (!(editor instanceof HTMLElement) || !editor.classList.contains('lumo-rich-editor')) return
        editor.className = `${textarea.className.replace('lumo-rich-source', '').trim()} lumo-rich-editor`
        editor.dataset.placeholder = textarea.placeholder
        if (document.activeElement !== editor && editor.dataset.markdown !== textarea.value) {
          editor.innerHTML = markdownToHtml(textarea.value)
          editor.dataset.markdown = textarea.value
        }
      })
    }

    const observer = new MutationObserver(enhanceAll)
    observer.observe(document.body, { childList: true, subtree: true })
    enhanceAll()
    const syncTimer = window.setInterval(enhanceAll, 180)

    const toolbarMouseDown = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>('.inline-format-toolbar button')
      if (!button || !activeEditor || !document.body.contains(activeEditor)) return
      event.preventDefault()
      event.stopPropagation()
      activeEditor.focus()
      const label = button.textContent?.trim() || ''
      if (label === 'B') document.execCommand('bold')
      else if (label === 'I') document.execCommand('italic')
      else if (label === 'S') document.execCommand('strikeThrough')
      else applyCodeFormatting(activeEditor)
      syncEditorToSource(activeEditor)
    }

    const suppressToolbarClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest('.inline-format-toolbar button')
      if (!button || !activeEditor) return
      event.preventDefault()
      event.stopPropagation()
    }

    document.addEventListener('mousedown', toolbarMouseDown, true)
    document.addEventListener('click', suppressToolbarClick, true)

    return () => {
      observer.disconnect()
      window.clearInterval(syncTimer)
      document.removeEventListener('mousedown', toolbarMouseDown, true)
      document.removeEventListener('click', suppressToolbarClick, true)
    }
  }, [])

  return <AppV3 />
}
