# Lumo

Lumo is an open-source, local-first workspace for notes, pages, databases and projects.

The goal is simple: build a powerful workspace without locking useful features behind a subscription.

## Current features

- Create, rename, duplicate, trash, restore and permanently delete pages
- Nested pages and collapsible page trees
- Custom page emoji/icons
- Page templates for study notes, tasks and project hubs
- Block-style editor with `/` commands
- Text, headings, bullets, numbered lists, to-dos, quotes and code blocks
- Callouts, toggles, dividers, bookmarks and image embeds
- Inline Markdown formatting shortcuts for bold, italic, strikethrough and inline code
- Drag and drop blocks
- Backlinks using `[[Page title]]` mentions
- Local autosave
- Search across page titles, content and databases
- `Ctrl+K` command palette
- Light and dark themes
- Markdown export

### Databases

- Table, Board and Calendar views
- Dynamic properties
- Property types: text, number, checkbox, select, multi-select, date and status
- Rename, add and remove properties
- Filter and sort controls
- Drag cards between Board status columns
- Drag Calendar items to another date
- Database data is included in local autosave, search and Markdown export

## Tech

The current prototype uses React, TypeScript and Vite. Lumo is currently local-first and browser-based. A Tauri desktop shell, SQLite persistence, accounts, sync and collaboration are future milestones.

GitHub Actions runs a TypeScript/Vite build check on every push to `main`.

## Run locally

```bash
git clone https://github.com/Sanderschxs/Lumo.git
cd Lumo
npm install
npm run dev
```

Then open the local address shown by Vite, usually `http://localhost:5173`.

## Updating an existing clone

```bash
git pull
npm install
npm run dev
```

## Status

Early development. Expect features and data structures to change quickly.

## License

MIT
