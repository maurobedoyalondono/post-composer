# post-composer

Browser-based photography composition tool. No build step, no Node, no dependencies.

## Running

Open with any live server:
- VS Code: Live Server extension → right-click `index.html` → Open with Live Server
- Python: `python -m http.server 5500` → open `http://localhost:5500`

## Tests

Open `tests/runner.html` in browser to run unit tests.
Open `tests/integration.html` in browser for integration smoke test.

## Structure

- `core/`    — state, events, router, storage
- `editor/`  — canvas renderer and editor view (Plan 2)
- `manager/` — project manager view (Plan 4)
- `shared/`  — validator, fonts, visual-analysis
- `ui/`      — stateless UI components
- `styles/`  — CSS
- `tests/`   — browser-based tests
- `docs/`    — specs and plans

## Plans

- Plan 1 (this): Core architecture + JSON contract ✓
- Plan 2: Editor view — renderer, layers, visual analysis, export
- Plan 3: AI pipeline skills redesign
- Plan 4: Project Manager view — brief wizard, package export
