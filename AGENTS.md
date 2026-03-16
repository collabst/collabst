# AGENTS.md

## Setup commands
- Set up environment (.env file) `make setup`
- Start all services: `make start` (only use if explicitly asked)

## Code style
- Always use Svelte 5 Runes (https://svelte.dev/docs/svelte/overview)
- Always follow default Prettier for Svelte code formatting (https://github.com/sveltejs/prettier-plugin-svelte)
- Use `$state` for reactive variables
- Use `$derived` for computed values
- Use `$effect` for side effects
- Use `$props` for component properties
- Avoid legacy patterns (`export let`, `$:`, lifecycle imports) (https://svelte.dev/docs/svelte/v5-migration-guide)