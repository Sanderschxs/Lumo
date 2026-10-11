import './slashMenu.css'

export type SlashMenuItem = {
  id: string
  group: string
  label: string
  description?: string
  icon: string
  badge?: string
  disabled?: boolean
  swatch?: string
}

type Props = {
  query: string
  items: SlashMenuItem[]
  selectedId?: string
  onSelect: (id: string) => void
  onHover: (id: string) => void
  onClose: () => void
}

export default function SlashMenu({ query, items, selectedId, onSelect, onHover, onClose }: Props) {
  const groups = Array.from(new Set(items.map((item) => item.group)))

  return (
    <div className="lumo-slash-menu" role="menu" aria-label="Insert block or run command">
      <div className="lumo-slash-search">
        <span className="lumo-slash-search-mark">/</span>
        <span className={query ? 'lumo-slash-query' : 'lumo-slash-placeholder'}>
          {query || 'Type to search'}
        </span>
      </div>

      <div className="lumo-slash-scroll">
        {items.length === 0 ? (
          <div className="lumo-slash-empty">No matching commands.</div>
        ) : groups.map((group) => (
          <section key={group} className="lumo-slash-group">
            <div className="lumo-slash-group-title">{group}</div>
            {items.filter((item) => item.group === group).map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={`lumo-slash-item ${selectedId === item.id ? 'lumo-slash-item--selected' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => onHover(item.id)}
                onClick={() => !item.disabled && onSelect(item.id)}
              >
                <span className="lumo-slash-icon" aria-hidden="true">
                  {item.swatch ? <span className="lumo-color-swatch" style={{ background: item.swatch }} /> : item.icon}
                </span>
                <span className="lumo-slash-copy">
                  <span className="lumo-slash-label-row">
                    <strong>{item.label}</strong>
                    {item.badge && <small className="lumo-slash-badge">{item.badge}</small>}
                  </span>
                  {item.description && <small>{item.description}</small>}
                </span>
              </button>
            ))}
          </section>
        ))}
      </div>

      <button type="button" className="lumo-slash-footer" onMouseDown={(event) => event.preventDefault()} onClick={onClose}>
        <span>Close menu</span><kbd>Esc</kbd>
      </button>
    </div>
  )
}
