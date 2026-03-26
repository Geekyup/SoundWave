# Public Assets Architecture

`frontend/public` now uses a simple layered structure:

- `app.css` is the single public stylesheet entry loaded by `index.html`.
- `shared/` contains the global design foundation used by every page.
- `main/`, `uploader/`, `accounts/` contain domain-specific assets only.

## CSS rules

Each domain keeps one public entry file at `css/app.css`.

Inside every `css/` folder:

- `foundations/` stores tokens, reset/base styles, and theme aliases.
- `layout/` stores large structural blocks such as headers and page shells.
- `components/` stores reusable UI pieces local to that domain.
- `sections/` stores homepage or landing sections.
- `pages/` stores route-specific styling.
- `utilities/` stores responsive overrides and small cross-page helpers.

## JS rules

- Keep app-integrated scripts in `src/`, especially if they share API/auth/state logic with React.
- Reserve `public/` for truly standalone scripts that do not need to import app modules.
- If a script becomes legacy or reference-only, move it out of `public/` so it is not shipped by accident.

## Naming

- Use kebab-case for filenames.
- Keep only entry files in the root of `css/`.
- Put new shared tokens/components into `shared/` first, then extend them inside a domain if needed.
