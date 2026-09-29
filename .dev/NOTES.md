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

## Known issues
- Zammad's Claude hooks need pnpm → errors if Claude runs outside the container
- `config/database/database.yml` has a leaked password → not yet fixed
- `.claude/ui-rules.md` describes the old navy/blue theme; current theme is emerald / dark slate
- Base is a July `develop` snapshot, not a stable Zammad release

## In progress
- Getting the app running in the devcontainer (`dev` → http://localhost:3000)

## Next steps
- [ ] Confirm app runs locally and log in works
- [ ] Set up the same environment on the other PC
- [ ] Decide on `.claude/ui-rules.md` (update or drop)
- [ ] Fix the committed database password

## Log
- 2026-09-29: Set up WSL/Ubuntu + Docker + devcontainer on work PC; updated README with Windows setup