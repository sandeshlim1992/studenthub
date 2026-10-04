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
- Servers are updated only with `script/studenthub/deploy.sh` (README → Deploying to the servers),
  never with a manual `git pull`; production gets the exact commit tested on the test server (`--ref`)
- Staff work in the new UI (`/desktop`; the login page lands everyone there) → new staff features go there first
- Feedback Collection is native (replaces the PHP `feedback.php` add-on); sends through a Zammad email
  channel; admin page in `/desktop/manage` (README → Feedback Collection)
- Ticket Approvals: the agent picks a specific manager; a manager is anyone with the Managers role;
  on/off switch in `/desktop/manage`; the ticket's own state never changes (README → Ticket Approvals)
- New UI design: Halo-style (mockup https://claude.ai/artifact/6H4uc22Wb4zTiUfy3PhXfj), application colour chosen
  by admins under Branding (default navy), staff top bar, ticket screen restyled but not restructured, student
  portal keeps Taxil's layout with the new look; built on branch `studenthub-newUI`, one local commit per step
- Student Hub migrations have no "new setup" guard; their records come from `lib/studenthub/*/setup.rb`,
  which spec support re-runs after the test DB reset (Zammad's seed list is fixed, so no seed files)

## Known issues
- Zammad's Claude hooks need pnpm → errors if Claude runs outside the container
  (switched off on the test server with `disableAllHooks` in `.claude/settings.local.json`)
- Test server: Elasticsearch isn't running → search index jobs fail and fill the log
- Test server: `/etc/zammad/zammad.env` is world-readable and holds the M365 client secret
  (check production too)
- `config/database/database.yml` has a leaked password → not yet fixed
- `.claude/ui-rules.md` describes the old navy/blue theme; current theme is emerald / dark slate
- Base is a July `develop` snapshot, not a stable Zammad release
- Review of Taxil's work (30 Sep), not fixed yet:
  - "Continue with Microsoft" button on `/desktop/login` does nothing → fixed on `studenthub-newUI` (sign-in redesign)
  - 8 `/manage` pages send saves without the CSRF token → all rejected (Translations, Sessions,
    Packages, Core Workflows, Monitoring, Data Privacy, Maintenance, API)
  - 10 `/manage` actions call API routes that don't exist (404), e.g. maintenance/API toggles,
    MS Graph + Facebook channel edit, `/api/v1/locales`, branding logo preview
  - Theme switch, "Continue to mobile" and login-page public links removed; `/manage` messages show "%s"
  - TypeScript errors: 74 then, 144 after Taxil's 3 Oct commit; 35 Zammad unit tests fail (all pass on original Zammad)
- Taxil's 3 Oct commit removed the `/api/v1/reports/analytics` and `/reports/export` routes, but the
  new UI's Reporting & Analytics page still calls them → probably broken
- Taxil's ticket wizard and ticket list call `/api/v1/ticket_wizard_metadata`, which doesn't exist (404)
- The new UI's `/manage` lacks 8 classic admin pages: Roles, Scheduler, Ticket States, Ticket Priorities,
  Tags, Public Links, BETA UI, KB Answer Generation (use the classic admin for these meanwhile)
- Work PC: the devcontainer currently runs the repo from the C: drive (9p mount), not `~/studenthub` →
  classic UI pages take 20–60 s and Vite misses file changes (restart `bin/dev` after frontend edits)

## In progress
- Work PC dev DB holds a restore of the test server (3 Oct dump; real student data; email channels,
  webhooks and LDAP switched off; fqdn = localhost:3000). Dump file is in git-ignored `tmp/`.
  Feedback Collection and Ticket Approvals are switched on there for testing (no channel can send);
  dev-only test users agent@, manager@ and student@example.com and `[TEST]` tickets #886839/#886840
- Work PC container: headless Google Chrome + Chrome DevTools MCP (user-level; redo after a rebuild)
- New UI redesign on `studenthub-newUI` (local): step 1 colour setting + navigation panel + top bar and step 2
  sign-in page are committed; next: 3 student portal, 4 agent ticket list, 5 ticket screen (restyle)
- Test server switched to this repo on 2 Oct (`develop` at `f8f9b99dc9`). The logo build fix is
  applied there by hand (uncommitted); nginx `/cable` + `/ws` now forward the Host header; old
  branding edits are in `git stash` and `~ticketadmi/server-branding/` (old `custom.css` in `disabled-live/`)

## Next steps
- [ ] Set up the same environment on the home PC (check data-protection rules before copying real data)
- [ ] Test server: stash the hand-applied logo fix, install the deploy script, run the first scripted deploy
- [ ] Rehearse the first production deploy on a fresh clone of the production VM, then do it
- [ ] Decide whether everyone goes from `/#…` to `/desktop` (now only per browser via the beta switch)
- [ ] Test server: start Elasticsearch; `chmod 600 /etc/zammad/zammad.env`
- [ ] Decide which review findings to fix, starting with the `/manage` saves
- [ ] Decide on `.claude/ui-rules.md` (update or drop)
- [ ] Fix the committed database password
- [ ] Feedback Collection go-live (README → Feedback Collection): pick the sending channel, give
      `it@studenthub.ac` Send As on `feedback@`, import `feedback_tokens.json`, remove the webhook action
      from trigger 40 and job 10, add the nginx redirect, delete the PHP files
- [ ] Ticket Approvals go-live (README → Ticket Approvals): give the Managers role read access to the agent
      groups, retire the old approval setup (auto-"Pending" workflow, old field, overview, trigger 65)
- [ ] Decide which missing `/manage` pages to build (suggested: Roles and Scheduler first)
- [ ] Fix the Reporting & Analytics routes and `ticket_wizard_metadata` (Taxil's code)
- [ ] Work PC: move the repo to the Ubuntu file system
- [ ] Finish the new UI redesign steps 3–5, then merge `studenthub-newUI` into `develop`

## Log
- 2026-09-29: Set up WSL/Ubuntu + Docker + devcontainer on work PC; updated README with Windows setup
- 2026-09-30: App running on work PC; restored test-server DB locally; read-only review of Taxil's changes
- 2026-10-02: Deploy key for test server; removed `auto_wizard.json` from repo; merged Taxil's reports/ticket-wizard commit (PR #2)
- 2026-10-02: Switched the test server to this repo; fixed the production build (logo paths only worked
  in dev); added `script/studenthub/deploy.sh` with tests
- 2026-10-03: Restored the 3 Oct test-server dump locally (outbound channels and webhooks off); merged
  Taxil's admin-parity commit (PR #3); built native Feedback Collection
- 2026-10-04: Built Ticket Approvals (classic + new UI); compared classic admin with `/manage` (8 pages
  missing); installed headless Chrome + Chrome DevTools MCP in the work-PC container
- 2026-10-04: Started the Halo-style new UI on `studenthub-newUI`: admin-selectable application colour,
  navigation panel + top bar, new sign-in page (Microsoft button now works)
