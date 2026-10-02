# Working notes

Short, current state of the project. Update at the end of each session, then commit.
Setup steps live in README.md; agent rules live in CLAUDE.md. Don't duplicate them here.
Never put passwords, tokens or keys in this file.

## Environment
- Windows 11 → WSL 2 → Ubuntu → Docker Desktop → devcontainer
- Repo lives in Ubuntu at `~/studenthub` (not on C:)
- All work happens **inside the devcontainer** (Ruby, Node 24, pnpm, Postgres, Redis)
- Claude Code runs in the container terminal; `claude --rc` for phone access
- Two PCs (home + work), each with its own container and its own dev database

## Decisions
- Devcontainer (Option A) is the standard setup; manual setup is fallback only
- `develop` is the only branch; merge commits only (no squash/rebase) — keeps Taxil sync working
- Prefer new files over editing Zammad's originals (fewer upstream merge conflicts)
- Don't edit `.github/workflows/` or Zammad's `.claude/CLAUDE.md`
- Use Node 24 (ignore `.mise.toml`)
- AI agents propose changes and wait for approval before editing code (rule in CLAUDE.md)
- `auto_wizard.json` is dev-only: removed from the repo, never on test/production servers
- Test server pulls from this repo (read-only deploy key), not from Taxil's

## Known issues
- Zammad's Claude hooks need pnpm → errors if Claude runs outside the container
- `config/database/database.yml` has a leaked password → not yet fixed
- `.claude/ui-rules.md` describes the old navy/blue theme; current theme is emerald / dark slate
- Base is a July `develop` snapshot, not a stable Zammad release
- Review of Taxil's work (30 Sep), not fixed yet:
  - "Continue with Microsoft" button on `/desktop/login` does nothing (legacy `/#login` still works)
  - 8 `/manage` pages send saves without the CSRF token → all rejected (Translations, Sessions,
    Packages, Core Workflows, Monitoring, Data Privacy, Maintenance, API)
  - 10 `/manage` actions call API routes that don't exist (404), e.g. maintenance/API toggles,
    MS Graph + Facebook channel edit, `/api/v1/locales`, branding logo preview
  - Theme switch, "Continue to mobile" and login-page public links removed; `/manage` messages show "%s"
  - 74 TypeScript errors, 35 Zammad unit tests now fail (all pass on original Zammad)

## In progress
- Work PC dev DB holds a restore of the test server (real student data; email channels,
  webhooks and LDAP switched off; fqdn = localhost:3000). Dump file is in git-ignored `tmp/`
- Switching test server (`/opt/zammad`, source install) from Taxil's repo to this one. Deploy key works;
  remote not changed yet (repo owned by another user). Server has uncommitted branding edits
  (login page, logo, favicon, custom CSS) that must be saved first

## Next steps
- [ ] Set up the same environment on the home PC (check data-protection rules before copying real data)
- [ ] Finish switching the test server to this repo
- [ ] Decide which review findings to fix, starting with Microsoft login and `/manage` saves
- [ ] Decide on `.claude/ui-rules.md` (update or drop)
- [ ] Fix the committed database password

## Log
- 2026-09-29: Set up WSL/Ubuntu + Docker + devcontainer on work PC; updated README with Windows setup
- 2026-09-30: App running on work PC; restored test-server DB locally; read-only review of Taxil's changes
- 2026-10-02: Deploy key for test server; removed `auto_wizard.json` from repo; merged Taxil's reports/ticket-wizard commit (PR #2)
