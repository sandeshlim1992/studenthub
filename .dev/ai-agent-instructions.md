# Codebase guide

Student Hub runs on a Zammad `develop` snapshot from July 2026. No Zammad updates are coming: fixes go straight into
Zammad's files. The project rules are in `CLAUDE.md` at the repository root; this file says how the code is laid out
and how to run things. It is also read as `AGENTS.md`, `.claude/CLAUDE.md` and `.github/copilot-instructions.md`.

## Stack

- **Backend:** Ruby on Rails with PostgreSQL, Redis (live updates over ActionCable and GraphQL subscriptions) and
  Elasticsearch (search, Reporting).
- **New UI:** Vue 3 + TypeScript, built with Vite and pnpm, served at `/`. Staff and students use it.
- **Classic UI:** CoffeeScript (Spine + jQuery) at `/app`, still maintained.
- **API:** GraphQL between the new UI and Rails; REST for the classic UI and for Student Hub's own endpoints
  (`/api/v1/studenthub/…`).

```text
Classic UI (CoffeeScript, /app) ──→ REST controllers ─────────────→ Rails ──→ PostgreSQL
                                                                      ↑
New UI (Vue 3, /) ──→ GraphQL API, REST /api/v1/studenthub/… ─────────┘
```

## Where things are

Student Hub's own code (README → each feature lists its files):

- `lib/studenthub/`: feature logic (ticket approvals, ticket views, request forms, checklists, manager sites, theme)
- `app/controllers/studenthub_*`, `app/policies/controllers/studenthub_*`, `config/routes/studenthub_*.rb`: REST
  endpoints and who may call them
- `app/services/service/studenthub_*/`, `ticket_approval/`, `feedback_collection/`: service objects
- `config/initializers/studenthub_*.rb`: additions to Zammad's classes (prepends and includes), so those files
  stay unedited
- `db/migrate/*studenthub*`: records for seeded systems; new databases get them from `Studenthub::Setup` after
  `db:seed`
- `app/frontend/apps/desktop/`: `Studenthub*` components and the `/manage` admin pages
- `e2e/`: Playwright browser tests, with their own packages
- `script/studenthub/deploy.sh`: the deploy script for the test and production servers

Zammad's layout:

- `app/services/service/`: service objects with the business logic
- `app/graphql/gql/`: GraphQL schema, types, mutations, subscriptions
- `app/policies/`: authorization (Pundit)
- `app/frontend/apps/desktop/`: the new UI; `app/frontend/shared/`: shared components, composables, stores,
  GraphQL types, the form system; `app/frontend/apps/mobile/`: the mobile app (Student Hub doesn't use it)
- `app/assets/javascripts/`: the classic UI
- `lib/`: library code, with as little Rails coupling as possible

## Commands

Use pnpm for everything on the frontend.

```bash
bin/dev                                                                     # start the dev app (Rails, Vite, workers)
RAILS_ENV=test VITE_TEST_MODE=1 bundle exec rspec spec/path/to/file_spec.rb  # backend tests
bundle exec rubocop app/path/to/file.rb                                     # Ruby lint
pnpm test app/frontend/path/to/file.spec.ts                                 # frontend tests (Vitest)
pnpm exec eslint app/frontend/path/to/file.vue                              # lint the files you changed (NOTES → eslint --fix)
pnpm exec oxfmt app/frontend/path/to/file.vue                               # format
pnpm lint:ts 2>&1 | grep -c 'error TS'                                      # type check: count the errors (old count: NOTES)
pnpm generate-graphql-api                                                   # after changing the GraphQL schema
pnpm generate-setting-types                                                 # after changing settings
cd e2e && pnpm test                                                         # browser tests against the running app
```

## Conventions

- Never edit the translation files (`i18n/*.po`) by hand.
- A new setting goes into both its migration and `db/seeds/settings.rb`.

## Reference docs

Before working in one of these areas, read its guide (not all of them upfront):

- `.dev/agent_docs/graphql_patterns.md`: GraphQL types, mutations, queries and subscriptions
- `.dev/agent_docs/frontend_patterns.md`: Vue components, composables, routing and the form system
- `.dev/agent_docs/testing.md`: writing and running backend and frontend tests
- `.dev/agent_docs/service_patterns.md`: service objects
- `.dev/agent_docs/database_migrations.md`: migrations and seeds
