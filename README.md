# Student Hub (customised Zammad helpdesk)

Student Hub is a branded support portal for students and staff, built on
[Zammad](https://zammad.org), an open-source helpdesk and ticketing system
(Ruby on Rails + Vue 3). The branding assets reference **LSST**, **UKBC** and **FSB**.

This repository is a private copy of
[taxilkath/zammad_ui](https://github.com/taxilkath/zammad_ui). That repo is a fork of the
official [zammad/zammad](https://github.com/zammad/zammad) with the Student Hub
UI work added on top.

---

## At a glance

| | |
|---|---|
| **Base product** | Zammad **7.2.x (pre-release)**, a `develop` branch snapshot, *not* a tagged release |
| **Forked from Zammad at** | commit `91916cb`, 17 Jul 2026 (between the `7.2.0-alpha` and `7.2.0` tags) |
| **Custom work** | 6 commits by Taxil Kathiriya, 21 Jul to 23 Sep 2026 (~53,000 lines) |
| **Main branch** | `develop` (default; the only branch we use) |
| **Licence** | GNU AGPLv3, inherited from Zammad (see [Licence](#licence)) |
| **Backend** | Ruby 3.4.9, Rails, PostgreSQL, Redis |
| **Frontend** | Vue 3 + TypeScript + Vite (new "desktop" UI), CoffeeScript (legacy UI) |
| **Package manager** | pnpm 11, Node 24 |

### Where this code came from

```
zammad/zammad (official)                 upstream, develop branch
   │  forked 17 Jul 2026 @ 91916cb
   ▼
taxilkath/zammad_ui                      Taxil's fork, 6 Student Hub commits
   │  mirrored 25 Sep 2026 (git push --mirror)
   ▼
sandeshlim1992/studenthub (this repo)    private, independent copy
```

As of 25 Sep 2026, Taxil's fork was **6 commits ahead** and **573 commits
behind** official Zammad. Zammad **7.2.0 stable** was released on 23 Sep 2026
(tag `7.2.0`, commit `9a69c6b`), and Zammad `develop` has since moved on to **7.3.x**.
None of those upstream fixes are in this repo yet.

---

## What was changed (Taxil's 6 commits)

| Date | Commit | Summary |
|---|---|---|
| 21 Jul 2026 | `a4995eb` | **Legacy UI theme.** 1,700-line custom SCSS theme plus redesigned dashboard stats widgets on the old (`/#dashboard`) interface |
| 12 Aug 2026 | `172eb95` | **New admin area + login.** ~14 Vue 3 admin pages under `/manage` (Users, Groups, Triggers, Macros, SLAs, Webhooks, Templates, Calendars…), UI primitives, redesigned Login / Signup / Password reset, college logos, new loading screen |
| 14 Sep 2026 | `c86011f` | **Student portal.** Two-column customer layout with persistent header and sidebar, restyled ticket list |
| 15 Sep 2026 | `19ca334` | **Staff sidebar.** Student Hub brand header, high-contrast navigation, improved tabs |
| 23 Sep 2026 | `c73c822` | **Admin area, part 2.** ~35 more `/manage` pages: AI (agents, providers, summary, writing assistant), all channels (Email, M365, Google, WhatsApp, Telegram, SMS, Facebook, Chat, Form, Web), Knowledge Base, Time Accounting, Reports, Security, System (API, Backup, Core Workflows, Objects, Packages, Translations…) |
| 23 Sep 2026 | `efe9ff5` | **Polish.** Emerald / dark-slate theme, customer personal-settings pages (incl. Microsoft 365 SSO security view), redesigned "Submit a Support Request" card, glass-style taskbar tabs |

### How the changes are structured

- **107 new files** (~49,200 lines): most of the work lives in files that don't exist in Zammad.
- **69 original Zammad files edited** (+3,651 / −777 lines). These cause **merge conflicts**
  when pulling in Zammad updates.
- **0 files deleted.**

#### New files (safe from upstream conflicts)

| Path | What it is |
|---|---|
| `app/frontend/apps/desktop/pages/manage/` | The whole new admin area (48 views + `routes.ts`), served at `/manage`. Zammad's new UI has no admin section yet, so this adds one rather than replacing anything; the original admin in the legacy UI is still there |
| `app/frontend/apps/desktop/components/ui/` | UI building blocks: button, card, dialog, dropdown-menu, input, select, tabs |
| `app/frontend/apps/desktop/components/Customer/` | Student portal header, sidebar and `useCustomerTickets.ts` |
| `app/frontend/apps/desktop/pages/personal-setting/components/CustomerPersonalSettingSidebar.vue` | Student settings sidebar |
| `app/frontend/apps/desktop/pages/ticket/components/TicketCreate/CustomerTicketCreateCard.vue` | "Submit a Support Request" card |
| `app/assets/stylesheets/zammad/theme/custom-theme.scss` | Legacy UI theme, loaded by one `@import` line at the end of `app/assets/stylesheets/zammad.scss` |
| `app/frontend/apps/desktop/styles/custom-theme.css` | New UI theme overrides |
| `app/frontend/apps/desktop/assets/images/`, `public/assets/images/branding/` | Student Hub, LSST, UKBC and FSB logos |
| `app/frontend/apps/desktop/initializer/assets/*.svg` | AI provider / integration icons |

#### Most-edited Zammad files (watch these when merging)

| File | Change |
|---|---|
| `app/frontend/apps/desktop/pages/dashboard/views/Dashboard.vue` | +704 / −5 |
| `app/frontend/apps/desktop/pages/ticket-overviews/components/TicketList.vue` | +489 / −1 |
| `app/frontend/apps/desktop/pages/authentication/views/Login.vue` | +375 / −135 |
| `app/frontend/apps/desktop/pages/personal-setting/views/PersonalSettingAvatar.vue` | +236 / −10 |
| `app/assets/javascripts/app/views/dashboard.jst.eco` | +188 / −14 |
| `app/frontend/apps/desktop/pages/ticket/components/TicketCreate/TicketCreateContent.vue` | +130 / −6 |
| `app/frontend/apps/desktop/components/layout/LayoutSidebar/LeftSidebar/LeftSidebarHeader.vue` | +107 / −15 |
| `app/assets/javascripts/app/controllers/dashboard.coffee` | +107 / −6 |
| `app/views/init/spinner-loading.html.erb` | +66 / −208 |
| `app/frontend/apps/desktop/components/layout/LayoutPage.vue` | +67 / −1 |

For the full list, run `git diff --stat 91916cb develop`.

#### Student vs staff views

Several original files now branch on the user's role:

```ts
const isCustomer = computed(() =>
  hasPermission('ticket.customer', perms) && !hasPermission('ticket.agent', perms))
```

```html
<div v-if="isCustomer"> … Student Hub customer layout … </div>
<div v-if="!isCustomer"> … Zammad's original (restyled) agent layout … </div>
```

Students (customers) get the new portal layout, and staff (agents/admins) get Zammad's
layout with the Student Hub styling. See `LayoutPage.vue` and `TicketList.vue`.

#### How the new admin pages talk to the backend

The `/manage` views call Zammad's **REST API** directly with `fetch('/api/v1/...')`.
They do **not** use the GraphQL layer that the rest of Zammad's new UI uses. They work,
but they bypass Zammad's caching, typing and authorisation helpers, and several files
are very large (up to ~2,500 lines). Much of this code appears to be AI-generated.

---

## Getting started (local development)

Zammad's own developer guide applies unchanged: see
[`doc/developer_manual/development_environment/getting-started.md`](doc/developer_manual/development_environment/getting-started.md).

> **Use Option A (devcontainer).** It's the preferred setup for this project: every
> tool comes pre-installed at the right version, and the home and work PCs end up
> identical. Only use Option B if Docker Desktop isn't available.

### Option A: Devcontainer (preferred)

Requirements: **Docker Desktop**, **VS Code** and the **Dev Containers** extension.
On Windows, follow [Windows setup](#windows-setup-home-and-work-pcs) below first.

1. `git clone https://github.com/sandeshlim1992/studenthub.git` (on Windows, clone
   inside WSL/Ubuntu, not on `C:`)
2. Open the folder in VS Code and click **Reopen in Container**. PostgreSQL, Redis and
   all other dependencies are set up for you.
3. In the container terminal, run `dev`.
4. Open <http://localhost:3000> and sign in with `admin@example.com` / `test`.

Variants exist in `.devcontainer/` for LDAP, a mail server, Ollama (local AI) and Selenium.

### Windows setup (home and work PCs)

Do this once on each PC. Ruby, Node, pnpm, PostgreSQL and Redis all come from the
devcontainer, so don't install them in Windows or Ubuntu.

```
Windows → WSL 2 → Ubuntu (repo lives here) → Docker → devcontainer (Ruby, Node, pnpm, Postgres, Redis)
```

1. **WSL + Ubuntu.** In a *normal* (not admin) PowerShell:
   ```powershell
   wsl --install -d Ubuntu
   wsl --set-default Ubuntu
   ```
   Check with `wsl -l -v`: Ubuntu should be VERSION 2 with a `*`. (`docker-desktop` in
   that list is Docker's internal distro; don't work in it.)
   On work PCs, don't use "Run as administrator": it can install Ubuntu under a
   different Windows account, where Docker Desktop can't see it.
2. **Docker Desktop.** Settings → Resources → WSL integration → enable **Ubuntu** →
   Apply & restart. Test in Ubuntu with `docker run hello-world`. If Ubuntu isn't listed,
   quit Docker Desktop from the tray, run `wsl --shutdown`, restart it and click
   **Refetch distros**.
3. **Clone inside Ubuntu** (in `~`, not under `/mnt/c`, which is much slower):
   ```sh
   sudo apt update && sudo apt install -y git gh
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"   # use your GitHub noreply address to keep your email private
   gh auth login        # GitHub.com → HTTPS → authenticate Git → browser
   cd ~ && gh repo clone sandeshlim1992/studenthub
   ```
4. **VS Code.** Install the **WSL** and **Dev Containers** extensions. Then
   F1 → *Connect to WSL using Distro* → Ubuntu → open `~/studenthub` →
   F1 → *Dev Containers: Reopen in Container*. The first build can take 10+ minutes.
5. **Claude Code** (in the container terminal; reinstall after a container rebuild):
   ```sh
   curl -fsSL https://claude.ai/install.sh | bash
   claude --rc          # continue the session from the Claude phone app
   ```
   Keep the PC awake (not just locked) while using it from your phone.

### Switching between PCs

- **Before you start:** `git pull`
- **Before you leave:** commit and `git push`. The other PC can't see unpushed work.
- Each PC has its own database inside its container, so test data (tickets, users)
  isn't shared. Only code travels through git.

### Option B: Manual setup (fallback only)

Only if Docker Desktop can't be used (for example, it's blocked on a work PC). You
install and version-match every tool yourself, on each PC.

See [`manual-setup.md`](doc/developer_manual/development_environment/manual-setup.md).
You'll need Ruby 3.4.9, Node 24, pnpm 11, PostgreSQL and Redis. Then:

```sh
bundle install
pnpm install
cp config/database/database.yml config/database.yml   # then set your own DB credentials
bin/dev                                              # starts Rails, Vite, websocket, worker, CSS
```

### Useful commands

| Command | Purpose |
|---|---|
| `bin/dev` / `pnpm dev` | Start all dev processes (`Procfile.dev`) |
| `pnpm lint` | TypeScript, JS, CSS and Markdown linting |
| `pnpm test` | Frontend unit tests (Vitest) |
| `bundle exec rspec` | Backend tests |
| `pnpm generate-graphql-api` | Regenerate GraphQL types after schema changes |

### Useful URLs (dev)

| URL | What |
|---|---|
| `http://localhost:3000/desktop` | New Vue 3 UI (Student Hub portal, dashboard) |
| `http://localhost:3000/desktop/manage` | New Student Hub admin area |
| `http://localhost:3000/#dashboard` | Legacy UI with the custom theme |

---

## Staying in sync with Taxil's repo

This repo is **not** a GitHub fork, so there is no "Sync fork" button. Updates from
`taxilkath/zammad_ui` arrive as **pull requests that need approval**.

- **Workflow:** `.github/workflows/sync-taxilkath.yml`
- **Schedule:** daily at ~07:17 UK time (06:17 UTC), plus **Actions → Sync from taxilkath → Run workflow** manually
- **What it does:** fetches Taxil's `develop`. If there are new commits, it pushes them to
  the branch `sync/taxilkath` and opens (or updates) a PR into `develop`
- **To approve:** review **Files changed**, then **Merge pull request** (merge commit)
- **To reject:** close the PR. Note that it will reopen the next day. To skip changes
  permanently, merge and then **Revert**

### Repository settings this relies on

- **Settings → Actions → General**
  - Actions permissions: *Allow all actions and reusable workflows*
  - Workflow permissions: *Read and write* + *Allow GitHub Actions to create and approve pull requests*
- **Settings → General → Pull Requests**: only **merge commits** allowed (squash and rebase
  turned off). Squash or rebase would rewrite Taxil's commits and break the sync.
- **Zammad's own workflows are disabled** in the Actions tab (`CI`, `docker-ci`,
  `docker-release`, `packager.io`). They are meant for Zammad's infrastructure. The files
  are left unchanged so they don't conflict with future syncs.

### Limitations

- GitHub pauses scheduled workflows after **60 days** without repo activity. Re-enable the
  workflow from the Actions tab if that happens.
- If Taxil changes anything in `.github/workflows/`, the automated push fails, because
  `GITHUB_TOKEN` can't modify workflows. Sync that update manually.

### Pulling in official Zammad updates (not set up yet)

To get upstream fixes (e.g. from `7.2.0` stable), add Zammad as a second remote:

```sh
git remote add zammad https://github.com/zammad/zammad.git
git fetch zammad
git merge 7.2.0            # or zammad/stable
```

Expect conflicts in the **69 edited files** listed above.

---

## Known issues and to-do

- [ ] **Database password committed.** `config/database/database.yml` contains a real-looking
      Postgres username and password (it was published in Taxil's public repo). Change that
      password on any server that uses it, restore the file to Zammad's commented-out
      sample, and keep real credentials in `config/database.yml` (git-ignored) or
      environment variables.
- [ ] **`auto_wizard.json` in the repo root.** This is Zammad's standard test set-up
      (`admin@example.com` / `agent1@example.com` with test passwords, developer mode on).
      Zammad runs it automatically on first start. That's fine for development, but it
      **must not be present on a production server**.
- [ ] **Not on a supported release.** The base is a mid-July `develop` snapshot. Consider
      moving the 6 Student Hub commits onto the `7.2.0` tag or the `stable` branch before
      going live.
- [ ] **No tests** were added for the ~53,000 new lines.
- [ ] **Conflicting Node versions.** Taxil added two tool-version files: `.mise.toml` pins
      Node 22.23.2, while `mise.toml` pins Node 24, and `package.json` requires Node **≥ 24**.
      Use Node 24 and delete `.mise.toml`.
- [ ] **Leftover branch.** `feature/student-hub-portal` (from Taxil) was 3 commits behind
      `develop` with nothing unique. It can be deleted.
- [ ] Admin pages use raw `fetch` calls instead of GraphQL, and several views are very large
      (1,000–2,500 lines). Consider refactoring if they grow further.

---

## AI assistant configuration in this repo

- `AGENTS.md`, `.claude/CLAUDE.md` and `.github/copilot-instructions.md` are Zammad's own coding guidelines for AI tools.
- `.claude/ui-rules.md` was added by Taxil and describes the legacy-UI theme rules (palette,
  typography, spacing). Its colours reflect the first theme pass (navy/blue). Later
  commits moved to emerald / dark slate.
- `.claude/settings.json` is Zammad's Claude Code config (permissions plus lint/regenerate
  hooks). Taxil added the `frontend-design` plugin to it.

---

## Licence

Zammad is licensed under the **GNU AGPLv3** (see `LICENSE`). This repo can stay
private, but if you run a modified version for other people (for example, students using the
portal), the AGPL requires that you make this modified source code available to those users.

## Upstream resources

- Zammad documentation: <https://docs.zammad.org>
- Zammad REST API: <https://docs.zammad.org/en/latest/api/intro.html>
- Developer manual (in this repo): [`doc/developer_manual/index.md`](doc/developer_manual/index.md)
- Official repo: <https://github.com/zammad/zammad>
- Taxil's fork: <https://github.com/taxilkath/zammad_ui>