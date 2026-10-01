# Healthy Lifestyle
Vite + React + TS + three.js (@react-three/fiber). All data in localStorage (`healthy-lifestyle.v1`).
- Dev: `npm run dev -- --host` (port 5173) · Build: `npm run build` · Preview: `npm run preview -- --host` (port 4173)
- Accent colour: single CSS var `--accent` (+ `--accent-rgb`) at top of `src/styles.css`.
- Seed data: `src/data/*.json` copied from ../ (`npm run sync-data` refreshes). Filters (swallows, tuna, fresh fish) in `src/lib/seed.ts`.
- Re-seeding never overwrites user edits: seeded ids are tracked in `meta`, so edited/deleted foods stay as the user left them.
