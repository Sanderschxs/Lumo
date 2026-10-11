# Lumo

Lumo is an open-source, local-first workspace for notes, pages and ideas.

The goal is simple: make a fast, clean workspace that feels great to use without locking useful features behind a subscription.

## Current features

- Create, rename and delete pages
- Nested pages and collapsible page trees
- Custom page emoji/icons
- Block-style editor
- `/` command menu
- Text, headings, bullets, numbered lists, to-dos, quotes and code blocks
- Drag and drop blocks
- Local autosave
- Search across page titles and content
- `Ctrl+K` command palette
- Light and dark themes
- Markdown export
- Database blocks
- Editable database properties: name, status, tags and date
- Table view
- Kanban-style board view
- Calendar view
- Database data included in local autosave, search and Markdown export

## Tech

The current prototype uses React, TypeScript and Vite. A Tauri desktop shell and SQLite persistence are planned once the editor foundation is stable.

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

Very early development. Expect things to change quickly.

## License

MIT
