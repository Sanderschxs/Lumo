import { useMemo, useState } from 'react'
import './database.css'

export type DatabaseView = 'table' | 'board' | 'calendar'
export type DatabaseStatus = 'Not started' | 'In progress' | 'Done'

export type DatabaseRow = {
  id: string
  name: string
  status: DatabaseStatus
  tags: string[]
  date: string
}

export type DatabaseData = {
  title: string
  view: DatabaseView
  rows: DatabaseRow[]
}

const STATUSES: DatabaseStatus[] = ['Not started', 'In progress', 'Done']

export function makeDatabaseData(): DatabaseData {
  return {
    title: 'Untitled database',
    view: 'table',
    rows: [
      {
        id: crypto.randomUUID(),
        name: 'First item',
        status: 'Not started',
        tags: [],
        date: '',
      },
    ],
  }
}

function makeRow(): DatabaseRow {
  return {
    id: crypto.randomUUID(),
    name: '',
    status: 'Not started',
    tags: [],
    date: '',
  }
}

function normalizeTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8)
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

type Props = {
  data: DatabaseData
  onChange: (next: DatabaseData) => void
}

export default function DatabaseBlock({ data, onChange }: Props) {
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())

  function updateRow(rowId: string, patch: Partial<DatabaseRow>) {
    onChange({
      ...data,
      rows: data.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    })
  }

  function addRow(patch: Partial<DatabaseRow> = {}) {
    onChange({ ...data, rows: [...data.rows, { ...makeRow(), ...patch }] })
  }

  function deleteRow(rowId: string) {
    onChange({ ...data, rows: data.rows.filter((row) => row.id !== rowId) })
  }

  const calendarDays = useMemo(() => {
    const start = startOfCalendarMonth(calendarMonth)
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      return date
    })
  }, [calendarMonth])

  return (
    <div className="database-block" onClick={(event) => event.stopPropagation()}>
      <div className="database-header">
        <input
          className="database-title"
          value={data.title}
          onChange={(event) => onChange({ ...data, title: event.target.value })}
          placeholder="Untitled database"
          aria-label="Database title"
        />
        <button className="database-add-row" onClick={() => addRow()}>＋ New</button>
      </div>

      <div className="database-toolbar">
        <div className="database-view-tabs" role="tablist" aria-label="Database view">
          {(['table', 'board', 'calendar'] as DatabaseView[]).map((view) => (
            <button
              key={view}
              className={data.view === view ? 'database-tab database-tab--active' : 'database-tab'}
              onClick={() => onChange({ ...data, view })}
            >
              {view === 'table' ? '▦ Table' : view === 'board' ? '▥ Board' : '▣ Calendar'}
            </button>
          ))}
        </div>
        <span className="database-count">{data.rows.length} item{data.rows.length === 1 ? '' : 's'}</span>
      </div>

      {data.view === 'table' && (
        <div className="database-table-wrap">
          <table className="database-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Tags</th>
                <th>Date</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input value={row.name} onChange={(event) => updateRow(row.id, { name: event.target.value })} placeholder="Untitled" />
                  </td>
                  <td>
                    <select value={row.status} onChange={(event) => updateRow(row.id, { status: event.target.value as DatabaseStatus })}>
                      {STATUSES.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      value={row.tags.join(', ')}
                      onChange={(event) => updateRow(row.id, { tags: normalizeTags(event.target.value) })}
                      placeholder="school, idea"
                    />
                  </td>
                  <td>
                    <input type="date" value={row.date} onChange={(event) => updateRow(row.id, { date: event.target.value })} />
                  </td>
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
        <div className="database-board">
          {STATUSES.map((status) => {
            const rows = data.rows.filter((row) => row.status === status)
            return (
              <section key={status} className="database-board-column">
                <div className="database-board-heading">
                  <span className={`status-dot status-dot--${status.toLowerCase().replace(/ /g, '-')}`} />
                  <strong>{status}</strong>
                  <span>{rows.length}</span>
                </div>
                <div className="database-cards">
                  {rows.map((row) => (
                    <article key={row.id} className="database-card">
                      <input className="database-card-title" value={row.name} onChange={(event) => updateRow(row.id, { name: event.target.value })} placeholder="Untitled" />
                      {row.tags.length > 0 && (
                        <div className="database-tags">
                          {row.tags.map((tag) => <span key={tag}>{tag}</span>)}
                        </div>
                      )}
                      <div className="database-card-footer">
                        <select value={row.status} onChange={(event) => updateRow(row.id, { status: event.target.value as DatabaseStatus })} aria-label="Status">
                          {STATUSES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                        <input type="date" value={row.date} onChange={(event) => updateRow(row.id, { date: event.target.value })} aria-label="Date" />
                        <button onClick={() => deleteRow(row.id)} title="Delete card">×</button>
                      </div>
                    </article>
                  ))}
                  <button className="database-board-new" onClick={() => addRow({ status })}>＋ New</button>
                </div>
              </section>
            )
          })}
        </div>
      )}

      {data.view === 'calendar' && (
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
              const rows = data.rows.filter((row) => row.date === key)
              const inMonth = date.getMonth() === calendarMonth.getMonth()
              const today = key === dateKey(new Date())
              return (
                <div key={key} className={`calendar-day ${inMonth ? '' : 'calendar-day--muted'} ${today ? 'calendar-day--today' : ''}`}>
                  <div className="calendar-day-number">
                    <span>{date.getDate()}</span>
                    <button onClick={() => addRow({ date: key })} title="Add item">＋</button>
                  </div>
                  <div className="calendar-items">
                    {rows.slice(0, 4).map((row) => (
                      <button key={row.id} className={`calendar-item calendar-item--${row.status.toLowerCase().replace(/ /g, '-')}`} onClick={() => {
                        const next = window.prompt('Item name', row.name)
                        if (next !== null) updateRow(row.id, { name: next })
                      }}>
                        {row.name || 'Untitled'}
                      </button>
                    ))}
                    {rows.length > 4 && <span className="calendar-more">+{rows.length - 4} more</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
