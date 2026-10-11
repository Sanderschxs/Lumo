import { useEffect } from 'react'
import AppV4 from './AppV4'
import './appV5.css'

function setReactTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  if (setter) setter.call(textarea, value)
  else textarea.value = value
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

export default function AppV5() {
  useEffect(() => {
    const addDeleteButton = (row: HTMLElement) => {
      if (row.querySelector(':scope > .lumo-floating-delete')) return

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'lumo-floating-delete'
      button.textContent = '×'
      button.title = 'Delete block'
      button.setAttribute('aria-label', 'Delete block')

      button.addEventListener('mousedown', (event) => {
        event.preventDefault()
        event.stopPropagation()
      })

      button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()

        const nativeDelete = Array.from(row.querySelectorAll<HTMLButtonElement>('.block-gutter button'))
          .find((candidate) => candidate.textContent?.trim() === '×')

        if (nativeDelete) {
          nativeDelete.click()
          return
        }

        const textarea = row.querySelector<HTMLTextAreaElement>('textarea.block-input')
        if (!textarea) return

        setReactTextareaValue(textarea, '/delete')

        requestAnimationFrame(() => {
          const deleteItem = Array.from(row.querySelectorAll<HTMLButtonElement>('.lumo-slash-item'))
            .find((candidate) => candidate.textContent?.toLowerCase().includes('delete'))

          if (deleteItem) {
            deleteItem.click()
            return
          }

          requestAnimationFrame(() => {
            const retry = Array.from(row.querySelectorAll<HTMLButtonElement>('.lumo-slash-item'))
              .find((candidate) => candidate.textContent?.toLowerCase().includes('delete'))
            retry?.click()
          })
        })
      })

      row.append(button)
    }

    const enhance = () => {
      document.querySelectorAll<HTMLElement>('.block-row').forEach(addDeleteButton)
    }

    const observer = new MutationObserver(enhance)
    observer.observe(document.body, { childList: true, subtree: true })
    enhance()

    return () => observer.disconnect()
  }, [])

  return <AppV4 />
}
