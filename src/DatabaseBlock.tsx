import { useMemo, useState, type DragEvent } from 'react'
import './database.css'

export type DatabaseView = 'table' | 'board' | 'calendar'
export type DatabaseStatus = 'Not started' | 'In progress' | 'Done'
export type DatabasePropertyType =
  | 'text'
  | 'number'
  | 'checkbox'
  | 'select'
  | 'multi-select'
  | 'date'
  | 'status'

export type DatabaseValue = string | number | boolean | string[]

export type DatabaseProperty = {
  id: string
  name: string
  type: DatabasePropertyType
  options?: string[]
}

export type DatabaseRow = {
  id: string
  name: string
  values: Record<string, DatabaseValue>
  status?: DatabaseStatus
  tags?: string[]
  date?: string
}

export type DatabaseFilter = {
  propertyId: string
  query: string
}

export type DatabaseSort = {
  propertyId: string
  direction: 'asc' | 'desc'
}

export type DatabaseData = {
  title: string
  view: DatabaseView
  rows: DatabaseRow[]
  properties: DatabaseProperty[]
  filter?: DatabaseFilter
  sort?: DatabaseSort
}

const DEFAULT_STATUS_OPTIONS = ['Not started', 'In progress', 'Done']

function defaultProperties(): DatabaseProperty[] {
  return [
    { id: 'status', name: 'Status', type: 'status', options: [...DEFAULT_STATUS_OPTIONS] },
    { id: 'tags', name: 'Tags', type: 'multi-select' },
    { id: 'date', name: 'Date', type: 'date' },
  ]
}

function defaultValueForType(type: DatabasePropertyType): DatabaseValue {
  if (type === 'checkbox') return false
  if (type === 'number') return 0
  if (type === 'multi-select') return []
  if (type === 'status') return 'Not started'
  return ''
}

function normalizeOptions(options: unknown, type: DatabasePropertyType) {
  const parsed = Array.isArray(options)
    ? options.filter((option): option is string => typeof option === 'string' && option.trim().length > 0)
    : []

  if (type === 'status') return parsed.length > 0 ? parsed : [...DEFAULT_STATUS_OPTIONS]
  if (type === 'select') return parsed
  return undefined
}

function normalizeValue(value: unknown, type: DatabasePropertyType): DatabaseValue {
  if (type === 'checkbox') return Boolean(value)
  if (type === 'number') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (type === 'multi-select') {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : typeof value === 'string'
        ? normalizeTags(value)
        : []
  }
  if (typeof value === 'string') return value
  return String(value ?? '')
}

export function normalizeDatabaseData(input?: Partial<DatabaseData> & { rows?: Array<Partial<DatabaseRow>> }): DatabaseData {
  const properties = Array.isArray(input?.properties) && input.properties.length > 0
    ? input.properties.map((property) => ({
        id: property.id || crypto.randomUUID(),
        name: property.name || 'Property',
        type: property.type || 'text',
        options: normalizeOptions(property.options, property.type || 'text'),
      }))
    : defaultProperties()

  const rows = Array.isArray(input?.rows)
    ? input.rows.map((row) => {
        const values: Record<string, DatabaseValue> = {}
        properties.forEach((property) => {
          const legacyValue =
            property.id === 'status'
              ? row.status
              : property.id === 'tags'
                ? row.tags
                : property.id === 'date'
                  ? row.date
                  : undefined
          const sourceValue = row.values?.[property.id] ?? legacyValue
          values[property.id] = normalizeValue(sourceValue ?? defaultValueForType(property.type), property.type)
        })

        return {
          id: row.id || crypto.randomUUID(),
          name: row.name || '',
          values,
          status: String(values.status || 'Not started') as DatabaseStatus,
          tags: Array.isArray(values.tags) ? values.tags : [],
          date: typeof values.date === 'string' ? values.date : '',
        }
      })
    : []

  return {
    title: input?.title || 'Untitled database',
    view: input?.view === 'board' || input?.view === 'calendar' ? input.view : 'table',
    properties,
    rows: rows.length > 0 ? rows : [makeRow(properties)],
    filter: input?.filter?.propertyId
      ? { propertyId: input.filter.propertyId, query: input.filter.query || '' }
      : undefined,
    sort: input?.sort?.propertyId
      ? { propertyId: input.sort.propertyId, direction: input.sort.direction === 'desc' ? 'desc' : 'asc' }
      : undefined,
  }
}

export function makeDatabaseData(): DatabaseData {
  const properties = defaultProperties()
  return {
    title: 'Untitled database',
    view: 'table',
    properties,
    rows: [makeRow(properties)],
  }
}

function makeRow(properties: DatabaseProperty[], patch: Partial<DatabaseRow> = {}): DatabaseRow {
  const values: Record<string, DatabaseValue> = {}
  properties.forEach((property) => {
    values[property.id] = defaultValueForType(property.type)
  })

  Object.entries(patch.values || {}).forEach(([key, value]) => {
    values[key] = value
  })

  const row: DatabaseRow = {
    id: patch.id || crypto.randomUUID(),
    name: patch.name || '',
    values,
  }
  syncLegacyFields(row)
  return row
}

function syncLegacyFields(row: DatabaseRow) {
  row.status = String(row.values.status || 'Not started') as DatabaseStatus
  row.tags = Array.isArray(row.values.tags) ? row.values.tags : []
  row.date = typeof row.values.date === 'string' ? row.values.date : ''
}

function normalizeTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20)
}

function valueToText(value: DatabaseValue | undefined) {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value ?? '')
}

export function databaseSearchText(data: DatabaseData) {
  const normalized = normalizeDatabaseData(data)
  return [
    normalized.title,
    ...normalized.properties.map((property) => property.name),
    ...normalized.rows.flatMap((row) => [row.name, ...normalized.properties.map((property) => valueToText(row.values[property.id]))]),
  ].join(' ')
}

export function databaseToMarkdown(data: DatabaseData) {
  const normalized = normalizeDatabaseData(data)
  const headers = ['Name', ...normalized.properties.map((property) => property.name)]
  const escape = (value: string) => value.replace(/\|/g, '\\|').replace(/\n/g, ' ')
  const head = `### ${normalized.title || 'Database'}\n\n| ${headers.map(escape).join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |`
  const rows = normalized.rows.map((row) => {
    const cells = [row.name, ...normalized.properties.map((property) => valueToText(row.values[property.id]))]
    return `| ${cells.map((cell) => escape(cell)).join(' | ')} |`
  })
  return [head, ...rows].join('\n')
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfCalendarMonth(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const day = (first.getDay() + 6) % 7
  return new Date(date.getFullYear(), date.getMonth(), 1 - day)
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

type Props = {
  data: DatabaseData
  onChange: (next: DatabaseData) => void
}

export default function DatabaseBlock({ data: rawData, onChange }: Props) {
  const data = useMemo(() => normalizeDatabaseData(rawData), [rawData])
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [propertyPanelOpen, setPropertyPanelOpen] = useState(false)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null)

  const statusProperty = data.properties.find((property) => property.type === 'status')
  const dateProperty = data.properties.find((property) => property.type === 'date')

  function commit(next: DatabaseData) {
    onChange(normalizeDatabaseData(next))
  }

  function updateRow(rowId: string, patch: Partial<DatabaseRow>) {
    commit({
      ...data,
      rows: data.rows.map((row) => {
        if (row.id !== rowId) return row
        const next = { ...row, ...patch, values: { ...row.values, ...(patch.values || {}) } }
        syncLegacyFields(next)
        return next
      }),
    })
  }

  function setRowValue(rowId: string, property: DatabaseProperty, value: DatabaseValue) {
    updateRow(rowId, { values: { [property.id]: normalizeValue(value, property.type) } })
  }

  function addRow(values: Record<string, DatabaseValue> = {}) {
    commit({ ...data, rows: [...data.rows, makeRow(data.properties, { values })] })
  }

  function deleteRow(rowId: string) {
    commit({ ...data, rows: data.rows.filter((row) => row.id !== rowId) })
  }

  function addProperty() {
    const property: DatabaseProperty = {
      id: crypto.randomUUID(),
      name: 'New property',
      type: 'text',
    }
    commit({
      ...data,
      properties: [...data.properties, property],
      rows: data.rows.map((row) => ({
        ...row,
        values: { ...row.values, [property.id]: '' },
      })),
    })
  }

  function updateProperty(propertyId: string, patch: Partial<DatabaseProperty>) {
    const previous = data.properties.find((property) => property.id === propertyId)
    if (!previous) return
    const nextProperty = { ...previous, ...patch }
    if (patch.type && patch.type !== previous.type) {
      nextProperty.options = normalizeOptions(nextProperty.options, patch.type)
    }

    commit({
      ...data,
      properties: data.properties.map((property) => property.id === propertyId ? nextProperty : property),
      rows: data.rows.map((row) => ({
        ...row,
        values: {
          ...row.values,
          [propertyId]: patch.type && patch.type !== previous.type
            ? defaultValueForType(patch.type)
            : row.values[propertyId],
        },
      })),
    })
  }

  function deleteProperty(propertyId: string) {
    commit({
      ...data,
      properties: data.properties.filter((property) => property.id !== propertyId),
      rows: data.rows.map((row) => {
        const values = { ...row.values }
        delete values[propertyId]
        const next = { ...row, values }
        syncLegacyFields(next)
        return next
      }),
      filter: data.filter?.propertyId === propertyId ? undefined : data.filter,
      sort: data.sort?.propertyId === propertyId ? undefined : data.sort,
    })
  }

  const visibleRows = useMemo(() => {
    let rows = [...data.rows]
    const filter = data.filter
    if (filter?.query.trim()) {
      const needle = filter.query.trim().toLowerCase()
      rows = rows.filter((row) => {
        const value = filter.propertyId === 'name'
          ? row.name
          : valueToText(row.values[filter.propertyId])
        return value.toLowerCase().includes(needle)
      })
    }

    const sort = data.sort
    if (sort?.propertyId) {
      rows.sort((a, b) => {
        const aValue = sort.propertyId === 'name' ? a.name : valueToText(a.values[sort.propertyId])
        const bValue = sort.propertyId === 'name' ? b.name : valueToText(b.values[sort.propertyId])
        const result = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' })
        return sort.direction === 'desc' ? -result : result
      })
    }
    return rows
  }, [data])

  const calendarDays = useMemo(() => {
    const start = startOfCalendarMonth(calendarMonth)
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      return date
    })
  }, [calendarMonth])

  function renderPropertyEditor(row: DatabaseRow, property: DatabaseProperty) {
    const value = row.values[property.id] ?? defaultValueForType(property.type)

    if (property.type === 'checkbox') {
      return (
        <label className="database-checkbox-cell">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => setRowValue(row.id, property, event.target.checked)}
          />
        </label>
      )
    }

    if (property.type === 'status' || property.type === 'select') {
      const options = property.options || (property.type === 'status' ? DEFAULT_STATUS_OPTIONS : [])
      return (
        <select
          value={String(value)}
          onChange={(event) => setRowValue(row.id, property, event.target.value)}
        >
          {property.type === 'select' && <option value="">None</option>}
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      )
    }

    if (property.type === 'multi-select') {
      return (
        <input
          value={Array.isArray(value) ? value.join(', ') : ''}
          onChange={(event) => setRowValue(row.id, property, normalizeTags(event.target.value))}
          placeholder="tag, tag"
        />
      )
    }

    if (property.type === 'date') {
      return (
        <input
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => setRowValue(row.id, property, event.target.value)}
        />
      )
    }

    if (property.type === 'number') {
      return (
        <input
          type="number"
          value={typeof value === 'number' ? value : Number(value) || 0}
          onChange={(event) => setRowValue(row.id, property, event.target.valueAsNumber || 0)}
        />
      )
    }

    return (
      <input
        value={String(value)}
        onChange={(event) => setRowValue(row.id, property, event.target.value)}
        placeholder="Empty"
      />
    )
  }

  function handleBoardDrop(event: DragEvent<HTMLElement>, status: string) {
    event.preventDefault()
    if (!draggedRowId || !statusProperty) return
    setRowValue(draggedRowId, statusProperty, status)
    setDraggedRowId(null)
  }

  function handleCalendarDrop(event: DragEvent<HTMLDivElement>, date: string) {
    event.preventDefault()
    if (!draggedRowId || !dateProperty) return
    setRowValue(draggedRowId, dateProperty, date)
    setDraggedRowId(null)
  }

  const statusOptions = statusProperty?.options?.length
    ? statusProperty.options
    : DEFAULT_STATUS_OPTIONS

  return (
    <div className="database-block" onClick={(event) => event.stopPropagation()}>
      <div className="database-header">
        <input
          className="database-title"
          value={data.title}
          onChange={(event) => commit({ ...data, title: event.target.value })}
          placeholder="Untitled database"
          aria-label="Database title"
        />
        <button className="database-secondary-button" onClick={() => setControlsOpen((open) => !open)}>Filter / Sort</button>
        <button className="database-secondary-button" onClick={() => setPropertyPanelOpen((open) => !open)}>Properties</button>
        <button className="database-add-row" onClick={() => addRow()}>＋ New</button>
      </div>

      <div className="database-toolbar">
        <div className="database-view-tabs" role="tablist" aria-label="Database view">
          {(['table', 'board', 'calendar'] as DatabaseView[]).map((view) => (
            <button
              key={view}
              className={data.view === view ? 'database-tab database-tab--active' : 'database-tab'}
              onClick={() => commit({ ...data, view })}
            >
              {view === 'table' ? '▦ Table' : view === 'board' ? '▥ Board' : '▣ Calendar'}
            </button>
          ))}
        </div>
        <span className="database-count">{visibleRows.length}/{data.rows.length} items</span>
      </div>

      {controlsOpen && (
        <div className="database-controls-panel">
          <div className="database-control-group">
            <strong>Filter</strong>
            <select
              value={data.filter?.propertyId || 'name'}
              onChange={(event) => commit({ ...data, filter: { propertyId: event.target.value, query: data.filter?.query || '' } })}
            >
              <option value="name">Name</option>
              {data.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
            </select>
            <input
              value={data.filter?.query || ''}
              onChange={(event) => commit({ ...data, filter: { propertyId: data.filter?.propertyId || 'name', query: event.target.value } })}
              placeholder="Contains…"
            />
            <button onClick={() => commit({ ...data, filter: undefined })}>Clear</button>
          </div>
          <div className="database-control-group">
            <strong>Sort</strong>
            <select
              value={data.sort?.propertyId || ''}
              onChange={(event) => commit({
                ...data,
                sort: event.target.value ? { propertyId: event.target.value, direction: data.sort?.direction || 'asc' } : undefined,
              })}
            >
              <option value="">None</option>
              <option value="name">Name</option>
              {data.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
            </select>
            <button
              disabled={!data.sort}
              onClick={() => data.sort && commit({ ...data, sort: { ...data.sort, direction: data.sort.direction === 'asc' ? 'desc' : 'asc' } })}
            >
              {data.sort?.direction === 'desc' ? '↓ Desc' : '↑ Asc'}
            </button>
          </div>
        </div>
      )}

      {propertyPanelOpen && (
        <div className="database-properties-panel">
          <div className="database-properties-heading">
            <strong>Properties</strong>
            <button onClick={addProperty}>＋ Add property</button>
          </div>
          {data.properties.map((property) => (
            <div key={property.id} className="database-property-row">
              <input
                value={property.name}
                onChange={(event) => updateProperty(property.id, { name: event.target.value })}
                aria-label="Property name"
              />
              <select
                value={property.type}
                onChange={(event) => updateProperty(property.id, { type: event.target.value as DatabasePropertyType })}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="checkbox">Checkbox</option>
                <option value="select">Select</option>
                <option value="multi-select">Multi-select</option>
                <option value="date">Date</option>
                <option value="status">Status</option>
              </select>
              {(property.type === 'select' || property.type === 'status') && (
                <input
                  value={(property.options || []).join(', ')}
                  onChange={(event) => updateProperty(property.id, { options: normalizeTags(event.target.value) })}
                  placeholder="Options, separated by commas"
                />
              )}
              <button className="database-property-delete" onClick={() => deleteProperty(property.id)}>×</button>
            </div>
          ))}
        </div>
      )}

      {data.view === 'table' && (
        <div className="database-table-wrap">
          <table className="database-table">
            <thead>
              <tr>
                <th>Name</th>
                {data.properties.map((property) => <th key={property.id}>{property.name}</th>)}
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input value={row.name} onChange={(event) => updateRow(row.id, { name: event.target.value })} placeholder="Untitled" />
                  </td>
                  {data.properties.map((property) => (
                    <td key={property.id}>{renderPropertyEditor(row, property)}</td>
                  ))}
                  <td>
                    <button className="database-delete-row" onClick={() => deleteRow(row.id)} title="Delete row">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="database-table-new" onClick={() => addRow()}>＋ New row</button>
        </div>
      )}

      {data.view === 'board' && (
        statusProperty ? (
          <div className="database-board" style={{ gridTemplateColumns: `repeat(${Math.max(statusOptions.length, 1)}, minmax(220px, 1fr))` }}>
            {statusOptions.map((status) => {
              const rows = visibleRows.filter((row) => String(row.values[statusProperty.id] || '') === status)
              return (
                <section
                  key={status}
                  className="database-board-column"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleBoardDrop(event, status)}
                >
                  <div className="database-board-heading">
                    <span className={`status-dot status-dot--${slug(status)}`} />
                    <strong>{status}</strong>
                    <span>{rows.length}</span>
                  </div>
                  <div className="database-cards">
                    {rows.map((row) => (
                      <article
                        key={row.id}
                        className="database-card"
                        draggable
                        onDragStart={() => setDraggedRowId(row.id)}
                        onDragEnd={() => setDraggedRowId(null)}
                      >
                        <input className="database-card-title" value={row.name} onChange={(event) => updateRow(row.id, { name: event.target.value })} placeholder="Untitled" />
                        <div className="database-card-properties">
                          {data.properties.filter((property) => property.id !== statusProperty.id).slice(0, 4).map((property) => {
                            const text = valueToText(row.values[property.id])
                            return text ? <span key={property.id}><small>{property.name}</small>{text}</span> : null
                          })}
                        </div>
                        <div className="database-card-footer">
                          <select value={String(row.values[statusProperty.id] || '')} onChange={(event) => setRowValue(row.id, statusProperty, event.target.value)} aria-label="Status">
                            {statusOptions.map((option) => <option key={option}>{option}</option>)}
                          </select>
                          <button onClick={() => deleteRow(row.id)} title="Delete card">×</button>
                        </div>
                      </article>
                    ))}
                    <button className="database-board-new" onClick={() => addRow({ [statusProperty.id]: status })}>＋ New</button>
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div className="database-empty-view">Add a <strong>Status</strong> property to use Board view.</div>
        )
      )}

      {data.view === 'calendar' && (
        dateProperty ? (
          <div className="database-calendar">
            <div className="calendar-toolbar">
              <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>‹</button>
              <strong>{calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
              <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>›</button>
              <button className="calendar-today" onClick={() => setCalendarMonth(new Date())}>Today</button>
            </div>
            <div className="calendar-weekdays">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="calendar-grid">
              {calendarDays.map((date) => {
                const key = dateKey(date)
                const rows = visibleRows.filter((row) => row.values[dateProperty.id] === key)
                const inMonth = date.getMonth() === calendarMonth.getMonth()
                const today = key === dateKey(new Date())
                return (
                  <div
                    key={key}
                    className={`calendar-day ${inMonth ? '' : 'calendar-day--muted'} ${today ? 'calendar-day--today' : ''}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleCalendarDrop(event, key)}
                  >
                    <div className="calendar-day-number">
                      <span>{date.getDate()}</span>
                      <button onClick={() => addRow({ [dateProperty.id]: key })} title="Add item">＋</button>
                    </div>
                    <div className="calendar-items">
                      {rows.slice(0, 5).map((row) => (
                        <button
                          key={row.id}
                          draggable
                          onDragStart={() => setDraggedRowId(row.id)}
                          onDragEnd={() => setDraggedRowId(null)}
                          className="calendar-item"
                          onClick={() => {
                            const next = window.prompt('Item name', row.name)
                            if (next !== null) updateRow(row.id, { name: next })
                          }}
                        >
                          {row.name || 'Untitled'}
                        </button>
                      ))}
                      {rows.length > 5 && <span className="calendar-more">+{rows.length - 5} more</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="database-empty-view">Add a <strong>Date</strong> property to use Calendar view.</div>
        )
      )}
    </div>
  )
}
