# Lumo

Lumo is an open-source, local-first workspace for notes, pages and ideas.

The goal is simple: make a fast, clean workspace that feels great to use without locking useful features behind a subscription.

## What works already

- Create, rename and delete pages
- Clean sidebar navigation and page search
- Local autosave with browser storage
- Light and dark themes
- Markdown export
- Block-style editor
- `/` command menu
- Text blocks
- Heading 1, 2 and 3
- Bulleted and numbered lists
- To-do blocks with checkboxes
- Quotes
- Code blocks
- Drag blocks to reorder them
- Add and remove blocks with the keyboard

## Editor shortcuts

Type `/` in an empty block to open the block menu. Press Enter to choose the first matching command, Escape to close the menu, and Enter in a normal block to create the next block. Shift+Enter keeps a line break inside a block. Code blocks accept normal multi-line input.

## Tech

The first version uses React, TypeScript and Vite. A Tauri desktop shell and SQLite persistence are planned once the editor foundation is stable.

## Run locally

```bash
npm install
npm run dev
```

## Status

Very early development. Expect things to change quickly.

## License

MIT
