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
| **Base product** | Zammad **7.2.x (pre-release)**, a `develop` branch snapshot, _not_ a tagged release |
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

> **`auto_wizard.json` is for local development only.** The devcontainer creates the
> `admin@example.com` / `test` login from `contrib/auto_wizard_test.json`, copying it to
> `auto_wizard.json` in the repo root and deleting it after use. Never commit
> `auto_wizard.json`, and never put it on the test or production server: it creates logins
> with known passwords and turns on developer mode.

### Windows setup (home and work PCs)

Do this once on each PC. Ruby, Node, pnpm, PostgreSQL and Redis all come from the
devcontainer, so don't install them in Windows or Ubuntu.

```
Windows → WSL 2 → Ubuntu (repo lives here) → Docker → devcontainer (Ruby, Node, pnpm, Postgres, Redis)
```

1. **WSL + Ubuntu.** In a _normal_ (not admin) PowerShell:

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
   F1 → _Connect to WSL using Distro_ → Ubuntu → open `~/studenthub` →
   F1 → _Dev Containers: Reopen in Container_. The first build can take 10+ minutes.
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
  - Actions permissions: _Allow all actions and reusable workflows_
  - Workflow permissions: _Read and write_ + _Allow GitHub Actions to create and approve pull requests_
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

## Deploying to the servers

The test server (`172.20.72.4`) and production run Zammad from source in `/opt/zammad`.
Update them only with [`script/studenthub/deploy.sh`](script/studenthub/deploy.sh), not with
`git pull` and rake commands by hand. The first manual update of the test server (2 Oct 2026)
showed why: the frontend build failed, nobody noticed, the migrations and restart went ahead,
and the server kept serving the old UI.

### What the script does

| Step | Zammad | If the step fails |
|---|---|---|
| **Checks:** right remote, clean git tree, fast-forward only, Ruby/Node/pnpm versions, database, disk space | running | nothing was changed |
| **Build:** `git merge --ff-only`, `bundle install`, `pnpm install`, `assets:precompile`, then a check that every built file exists and nginx can read it | running (old version) | code and build are put back automatically; no restart, so users notice nothing |
| **Stop**, back up the database, switch the rvm default Ruby if the new code needs another one | stopped | the old version is put back and started again |
| **Migrations**, cache clear | stopped | Zammad stays stopped; the script prints the rollback command |
| **Start and check:** HTTP, `/desktop/login` serves the new build, both websockets connect, services stay up | running (new version) | the script prints the rollback command |

Every run keeps its database backup, state and log in `/var/backups/zammad-deploy/<date-time>/`.

### Installing it on a server (once, and after it changes)

It runs as root, so install a root-owned copy instead of running the file inside `/opt/zammad`:

```sh
sudo -u zammad -H git -C /opt/zammad fetch origin
sudo -u zammad -H git -C /opt/zammad show origin/develop:script/studenthub/deploy.sh \
  | sudo install -m 0755 -o root -g root /dev/stdin /usr/local/sbin/studenthub-deploy
```

### Using it

Run it inside `tmux`, so a dropped SSH connection can't stop it halfway.

| Command | What it does |
|---|---|
| `sudo studenthub-deploy --check` | Shows what would be deployed and any problems. Changes nothing |
| `sudo studenthub-deploy` | Deploys the newest commit on `origin/develop` |
| `sudo studenthub-deploy --ref <commit>` | Deploys exactly that commit, e.g. the one tested on the test server |
| `sudo studenthub-deploy --rollback` | Undoes the last deploy (code, Ruby, frontend build). The database stays as it is |
| `sudo studenthub-deploy --rollback --restore-db` | Also puts the database back to the backup taken during the deploy. Anything users changed since then is not in it. The replaced database is kept as `<name>_before_rollback_<time>`; drop it once all is well |

### First deploy to production (once)

Production still runs official Zammad (`2cefc4b5f6`). `--check` reports anything below that's
still missing.

1. **Rehearse** the whole list on a fresh clone of the production VM.
2. Take a **VM snapshot** of production.
3. Upgrade **Node to 24** and **pnpm to 11**. They are only used for builds, so this is safe while
   Zammad runs.
4. Install **Ruby 3.4.9** with `sudo /usr/share/rvm/bin/rvm install ruby-3.4.9`, but **don't make it
   the default**. The running Zammad needs 3.4.7 until it's stopped; the script switches the
   default during the restart.
5. Point git at this repo: add a read-only deploy key, then
   `git remote set-url origin git@github.com:sandeshlim1992/studenthub.git` and set
   `core.sshCommand` to use the key (as on the test server).
6. Save the server's own edits (branding):
   `sudo -u zammad -H git -C /opt/zammad stash push -m "branding before Student Hub"`.
7. Move old CSS out of `app/assets/stylesheets/custom/`. It's built into the legacy UI on top of
   the Student Hub theme and clashes with it.
8. In nginx, add `proxy_set_header Host $http_host;` to the `/cable` and `/ws` blocks. Without it
   the new UI shows "Lost network connection" when opened by another name than the `fqdn` setting.
9. Install the script, run `--check`, then deploy with `--ref` set to the commit that was tested.

### Tests for the script

`script/studenthub/test/deploy_test.sh` runs the script against a throwaway git repository and
PostgreSQL cluster, with stubs for sudo, systemctl, rvm, bundle, pnpm and curl. It covers the
normal deploy, every failure-and-undo path, both kinds of rollback and the refusals. It needs
git, node, ruby and the PostgreSQL server binaries (`initdb`), which the test server has.

---

## New UI look (Halo-style)

The new UI (`/desktop`) follows the Halo-style design agreed in October 2026 (navigation panel in the
application colour, white top bar, Halo-style sign-in page). Work happens on the branch `studenthub-newUI`.

- **Application colour:** admins choose it under **Administration → Settings → Branding → Application colour**
  (setting `studenthub_app_color`, default navy `#14234b`). Presets or any hex colour; the server refuses colours
  too light for white text (below 4.5:1). It colours the navigation panel, the sign-in brand panel and the main
  buttons, via the CSS variable `--sh-app`.
- **Top bar (staff):** search with Zammad's quick results in a drop-down, the admin menu, **New ticket**,
  notifications and the avatar menu. The navigation panel keeps the logo, Overviews / Dashboard /
  Administration, recent tabs and the collapse button.
- **Loading screen:** the application colour with three dots in the college colours (LSST, UKBC, FSB) under
  "Student Hub" (`app/views/init/spinner-loading.html.erb`, used by the new UI and the mobile app).
- **Sign-in page:** brand panel in the application colour with the institution logos, sign-in on the right.
  "Continue with Microsoft" now really starts the Microsoft sign-in (it posts to `/auth/microsoft_office365`).
- **Ticket lists (staff overviews and search results):** white card with quiet rows, a "Views" panel tinted in the
  application colour, and these cells when an overview has the column: state as a coloured label, priority as bars
  (read from the "P1"–"P4" names), SLA deadline as time left (red when overdue, amber when "due soon"), campus with
  an LSST / UKBC / FSB badge. In every table of the new UI (ticket lists, search, admin lists; not tables inside
  messages) the header row is in the application colour with bold white column titles, the group labels (e.g. an
  agent's name in a list grouped by owner) and the page title are bold, and the dividers between column titles only
  appear on hover (they are the column resize handles).
- **Views panel in groups:** **Approval needed** (the Ticket Approvals overviews, first), **My views** (all overviews
  not listed elsewhere), **Teams** and **Institutions** (one view per organisation, e.g. LSST, UKBC and FSB: open tickets
  of that organisation's customers, Admin role only).
  **Teams** has one view per group with its open tickets, grouped by agent, and each agent sees the views of the
  groups they can read. Student Hub makes these views itself (links `studenthub_team_<group id>`) and keeps them in
  step with the groups: a new group gets one, a renamed one is renamed, an inactive one loses it (in the background, a
  few seconds after the change); the Managers group of Ticket Approvals never has one. Admin-made overviews of a
  single group (e.g. the old Service Desk view of new unassigned tickets) stay under My views for members of that
  group. The **Institutions** views work the same way with the organisations (links `studenthub_institution_<organisation
  id>`): every active organisation gets one, sorted by name; switch an organisation off to remove its view. Teams,
  Institutions and the two approval views are locked on the Overviews admin page ("Managed automatically"), and changes
  made to them elsewhere are undone by the background sync. "Overviews" is called **Tickets** in the
  new UI's navigation and tab title, and the top bar shows "Tickets / <view>" next to the search (the admin page for
  managing overviews keeps its name).
- **Group by and sorting, per agent:** every ticket view has a **Group by** menu (no grouping, Agent, Team, State,
  Priority, Customer, Organization, and the select fields of tickets such as Category or Campus, including ones admins
  add), and clicking a column title sorts by it. Both are remembered per agent and view in the agent's preferences, so
  they are the same on every device; **Reset** goes back to the view's own grouping and order. The server applies the
  choice where Zammad reads a view's grouping and order (the ticket query, the GraphQL overview type and its cache
  keys), so lists stay correct and an agent's choice never shows up for colleagues. In the Teams views, tickets without
  an owner always form the first group, **Unassigned tickets**, whatever the grouping (the server sorts them first).
- **Recent (staff):** keeps tickets, customer / organisation / search tabs and New ticket drafts saved with **Save
  draft**. Leaving a New ticket screen with nothing typed closes its tab; with something typed the agent is asked to
  **Save draft** or **Discard** (closing the question stays on the page). Untouched New ticket tabs left from before
  were closed once by a migration.
- **Ticket list colours:** admins choose them under **Administration → Settings → Branding → Ticket list colours**:
  a colour per ticket state from a fixed palette (every colour passes WCAG AA), and how long before the deadline
  "due soon" starts (default 1 hour). Settings `studenthub_ticket_state_colors` (state ID → colour) and
  `studenthub_escalation_warning_minutes`. The first values are guessed from the state names, because Zammad files
  "Assigned", "In Progress", "Awaiting user Response" and "Resolved" all under the type "open"; states added later
  get their type's colour until an admin picks one.
- **Ticket screen (staff):** two columns. On the left, the ticket sidebar with **Details** as a read-only list (user
  with campus badge, email, team, agent, category › sub-category, every other field on the ticket form, including the
  ones admins add, then source and opened; state and priority are next to the title instead). Mandatory fields that
  are empty say **Required**, and changes not saved yet get an amber dot. **Edit** shows Zammad's form, **Done** goes
  back to the list; the form also opens by itself when Update is refused because of a missing field. Below it, the
  **SLA** card: first response (Met / Missed, or the time left), next update, resolution due with a bar of the time
  used, and the time left (the bar uses clock time; Zammad counts SLA time in business hours). In the middle, the
  conversation. The sidebar icons are on the right edge (no Ticket icon: that panel is always open on the left);
  Customer, Organization, Checklist, Approval and the other panels open on the right and close with × or their icon.
  The header shows the ticket number, campus badge, title with the state label and priority bars next to it, and the
  actions **Reply** (replies to the latest customer message), **Add note**, **Assign**, **Change status**, **Merge**
  and **Close**. Assign and Change status fill the form's fields; like any other change they are saved with
  **Update**. **Close** sets the closed state and saves at once (like Update, it opens Details when a required field
  is empty). Messages keep their sides and are labelled Internal note / Reply / Email / Phone…; internal notes are
  amber. The top bar shows "Tickets / Ticket#…". Students see the same screen with only **Reply** in the header, no
  actions on messages (no visibility, split, forward or copy) and a reply box without its title row.
  Look (minimal Swiss style, from the UI/UX Pro Max skill): Zammad's accent colour (links, tags, switches, + buttons,
  focus rings) is the application colour on this screen; the sidebar sections have a white icon in a solid square of
  the application colour, and Details is a card like the SLA card, also while editing (white fields with a fine
  outline, red asterisks for required fields, **Done** filled); the header, panel and message toolbar icons are in the
  application colour; tags are chips in a light tint; **Close** is green; customer
  messages are on a light tint of the application colour with their channel (Phone, Email…) as a solid label, staff
  replies white, internal notes amber; message text keeps a readable line length (75 characters).
- **New ticket (staff):** a page bar with the title (the summary once typed), **Cancel** (discards, with a confirm if
  anything was typed), **Save draft** (keeps the unfinished ticket under Recent) and **Create ticket**. Main column:
  **Start from a template** (Zammad's Apply template: a list that opens downwards, with a search on top and about 20
  templates visible, the rest scrolls), **Who is it for?** (customer, campus,
  the customer's email as read-only "Reply-to email", organisation, how it came in: received call / outbound call /
  email, plus CC for emails), **What is the issue?** (summary, category › sub-category, details, attachments) and
  **More details** (every other field of the create screen, including the ones admins add). Side column: **Triage**
  (priority as buttons, without "None"; team, assign to, state), **SLA for this priority** (the SLA the ticket would
  get, from `GET /api/v1/studenthub/sla_preview`; your SLAs only set a resolution time) and **Approval**. Fields are
  white with a fine outline, a ring in the application colour on focus and a red asterisk when required. Each panel
  title has a white icon in a solid square of the application colour, field icons (customer search, add customer,
  how it came in) are in the colour, "Start from a template" is tinted, and the file drop area takes the colour on
  hover.
  With Ticket Approvals on, **Approval** (off by default) sends the new ticket for approval: choose a manager (every
  manager is listed) and give a reason; the request is sent right after the ticket is created (if that fails, a
  message says so and it can be sent from the Approval tab). Managers without another staff role don't get the
  Approval panel. Customer and the other panels open from the icons on the right edge. Students keep Taxil's wizard.
  Note: the triggers "Auto Select Priority (New) - P1…P4" set priority, ITIL type, impact and urgency from the
  sub-category right after a ticket is created, so for those sub-categories the priority chosen here (and the SLA
  shown) is replaced.
  Before staff use it on production, switch off these core workflows (they make the form fail to load in the new
  UI): "First ticket goes to Unassigned Tickets" (staff now pick the group themselves), and the old approval ones
  "Manager: Status pending for new ticket" and "Manager: Approval state make it readonly" (see Ticket Approvals).

| File(s) | Purpose |
|---|---|
| `app/frontend/apps/desktop/styles/studenthub-halo.css` (imported by `custom-theme.css`) | Colour tokens and the navigation panel |
| `app/frontend/apps/desktop/components/layout/StudenthubTopBar/` | Top bar (used by `LayoutPage.vue`) |
| `app/frontend/apps/desktop/utils/studenthubAppColor.ts`, `composables/useStudenthubAppColor.ts` | Applies the admin colour (called in `AppDesktop.vue`) |
| `app/frontend/apps/desktop/pages/manage/components/Branding/StudenthubAppColorSetting.vue` | Colour picker on the Branding page |
| `lib/studenthub/theme/setup.rb`, `app/models/setting/validation/studenthub_app_color.rb`, `db/migrate/20261004160000_studenthub_app_color.rb` | Setting and its server-side check |
| `app/frontend/apps/desktop/components/Ticket/StudenthubTicketCells/` (used by `TicketListTable.vue`), `utils/studenthubTicketList.ts` | State, priority, SLA and campus cells; palette and rules |
| `app/frontend/apps/desktop/pages/manage/components/Branding/StudenthubTicketListSetting.vue` | Ticket list colours on the Branding page |
| `lib/studenthub/ticket_views.rb`, `app/controllers/studenthub_ticket_views_controller.rb` (`GET /api/v1/studenthub/ticket_views`), `pages/ticket-overviews/composables/useStudenthubTicketViews.ts` | Sorting the views panel into Approval needed / My views / Teams / Institutions |
| `lib/studenthub/ticket_views/teams.rb`, `app/jobs/studenthub_team_views_sync_job.rb`, `db/migrate/20261006100000_studenthub_team_views.rb` | The Teams views, kept in step with the groups |
| `lib/studenthub/ticket_views/choice.rb`, `config/initializers/studenthub_ticket_views.rb`, `GET/PUT/DELETE /api/v1/studenthub/ticket_views/:overview_id/choice`, `pages/ticket-overviews/components/StudenthubViewGroupBy.vue`, `composables/studenthubViewChoice.ts` | Each agent's grouping and order of a view |
| `lib/studenthub/ticket_views/institutions.rb`, `db/migrate/20261006120000_studenthub_institution_views_by_organization.rb` | The Institutions views, kept in step with the organisations |
| `lib/studenthub/theme/ticket_list_setup.rb`, `app/models/setting/validation/studenthub_{ticket_state_colors,escalation_warning_minutes}.rb`, `db/migrate/20261004180000_studenthub_ticket_list_colors.rb` | Settings, first guess per state, server-side checks |
| `pages/ticket/components/TicketDetailView/TicketDetailTopBar/components/StudenthubTicketHeaderActions.vue`, `StudenthubHeaderMenuButton.vue`; edits in `TopBarHeaderFull.vue`, `TicketInformationBadgeList.vue` | Ticket header: number, state and priority next to the title, actions |
| `pages/ticket/components/TicketSidebar/TicketSidebarInformation/TicketSidebarInformationContent/StudenthubTicketDetailsList.vue`, `StudenthubTicketSlaBox.vue`, `pages/ticket/composables/useStudenthubTicketDetailsMode.ts`, `utils/studenthubTicketDetails.ts`; edit in `TicketSidebarInformationContent.vue` | Details list with Edit / Done, SLA card |
| `components/layout/LayoutContent.vue` (`sidebarPosition` prop), `TicketDetailViewContent.vue` | Ticket sidebar on the left |
| `pages/ticket/components/TicketSidebar/StudenthubTicketSideRail.vue`, `studenthubSidePanel.ts`; edits in `TicketSidebar.vue`, `TicketSidebarWrapper.vue`, `TicketDetailViewContent.vue` | Sidebar icons and other panels on the right |
| `pages/ticket/components/TicketCreate/StudenthubCreatePanel.vue`, `StudenthubPriorityButtons.vue`, `StudenthubSlaPreview.vue`, `StudenthubCustomerEmail.vue`, `StudenthubTemplatePicker.vue`, `db/migrate/20261006110000_studenthub_close_ghost_create_tabs.rb`; edits in `TicketCreateContent.vue`, `TicketSidebar.vue` | New ticket screen (Taxil's `AgentTicketCreateCard.vue` is no longer used) |
| `lib/studenthub/sla_preview.rb`, `app/controllers/studenthub_sla_previews_controller.rb` | SLA a new ticket would get |
| `ArticleBubble/StudenthubArticleKind.vue`; edits in `ArticleBubbleBody.vue`, `useBubbleStyleGuide.ts`, `SystemMessage.vue` | Message labels and colours |

Zammad's own unit tests that expect the notification bell, the quick search or the avatar in the sidebar
(`LeftSidebarHeader.spec.ts` ×2, `LayoutPage.spec.ts` "expands search…", and `LeftSidebarFooterMenu.spec.ts` ×2,
which already failed after Taxil's changes) fail by design since these moved to the top bar;
`StudenthubTopBar.spec.ts` covers them there.

---

## Feedback Collection

Replaces the PHP add-on (`/assets/feedback.php`) that production used for customer ratings.
Admins manage it under **Administration → Manage → Feedback Collection** (`/desktop/manage/feedback-collection`,
permission `admin.feedback_collection`).

**How it works:** when a ticket changes to a _closed_ state (by an agent or a scheduler), a background step checks
the rules on the admin page (groups, owner set, tags to skip, resend window) and emails the customer five star links
through the Zammad email channel chosen there. A link opens `/feedback/<token>` with that star pre-selected; nothing
is saved until the customer presses Submit (mail scanners open every link). The rating is stored, added to the ticket
as an internal note, and shown to agents in a "Customer feedback" panel in the classic ticket sidebar.
Only a SHA-256 hash of each token is stored.

| File(s) | Purpose |
|---|---|
| `db/migrate/20261003120000_studenthub_feedback_collection.rb`, `lib/studenthub/feedback_collection/setup.rb` | Table, permission, settings, transaction backend |
| `app/models/feedback_request.rb`, `app/models/transaction/feedback_collection.rb`, `app/jobs/feedback_request_send_job.rb` | Data, close detection, sending |
| `app/services/service/feedback_collection/` | Rules, email rendering, delivery, submit, report, CSV, import |
| `app/controllers/feedback_controller.rb`, `app/views/feedback/`, `app/views/layouts/feedback.html.erb` | Public feedback page |
| `app/controllers/feedback_collection_controller.rb` | Admin API (`/api/v1/feedback_collection/*`) |
| `app/frontend/apps/desktop/pages/manage/…/FeedbackCollection*` | Admin page (route in `routes.ts`, card in `Manage.vue`) |
| `app/assets/javascripts/app/controllers/ticket_zoom/sidebar_studenthub_feedback.coffee` | Classic ticket sidebar panel |
| `lib/studenthub/feedback_collection/default_email_template.html` | Default email template |

**Going live on production (once):**

1. Deploy, then in the admin page pick the sending channel (the Microsoft 365 / Graph channel), set the From
   address, paste the old `email_template.html` if wanted, and send a test email. The channel's mailbox
   (`it@studenthub.ac`) needs **Send As** rights on `feedback@studenthub.ac`.
2. Import the history: `rails "studenthub:feedback:import[/path/to/feedback_tokens.json]"` (safe to run twice).
3. Turn the feature on, then remove the **webhook** action from trigger 40 ("Ticket Closed: Email Notification
   sent to the Customer") and job 10 ("Change Resolved ticket to Closed and Survey Email"). Keep their emails and tags.
4. Keep old email links working with an nginx redirect in the Zammad server block:

   ```nginx
   location = /assets/feedback.php {
       if ($arg_token !~ "^[A-Za-z0-9]+$") { return 410; }
       return 302 /feedback/$arg_token?rating=$arg_rating;
   }
   ```

5. Delete the PHP files and `feedback_tokens.json` from the web root; they were publicly downloadable.

---

## Ticket Approvals

Agents send a ticket to a manager for approval; the manager approves or denies it and the result goes back to
the agent. Admins turn it on or off under **Administration → Manage → Ticket Approvals**
(`/desktop/manage/ticket-approvals`, permission `admin.ticket_approval`).

- **Managers** are everyone with the **Managers** role. The role carries the `ticket.approver` permission (created
  by the migration, together with the role itself if it doesn't exist).
- **Agents** use the **Approval** tab in the ticket sidebar (new UI and classic UI): choose a manager (every
  manager is listed, whatever the team), give a reason, send. They can withdraw a request while it waits, and send
  again after a denial. Their requests wait in the **Sent for approval** overview until the manager decides.
- **While a ticket waits** it is in the **Managers** group, a system group of Ticket Approvals that nobody has
  access to (so nobody can pick it as a team). Only the chosen manager and the agent who asked can open it, read-only;
  the team doesn't see it meanwhile, and replies from the customer only reach those two. The decision (or
  withdrawing it) sends the ticket back to its team and owner; the manager can still read tickets they decided on.
  This is an extension of Zammad's ticket access rules (`TicketAccess`), not group access, so search with
  Elasticsearch doesn't find waiting tickets: managers use **Awaiting my approval**. Turning the feature on sets the
  group up (it takes over an existing "Managers" group, removes all access to it and sends tickets from the old
  approval process back to the team their history shows); turning it off sends waiting tickets back to their teams.
- **SLA pause** (on by default, switch on the admin page): while a ticket waits, its SLA stops, as in Zammad's pending
  states. After the decision the deadlines are worked out again without the waiting time (in business hours). Each
  request records whether it paused the SLA, so switching later doesn't move past deadlines. The ticket's SLA card
  says "Paused, waiting for approval".
- **The two approval overviews** (**Awaiting my approval** for the Managers role, **Sent for approval** for every
  agent role) are managed by Student Hub: on while Ticket Approvals is on, hidden while it is off. They are locked
  on `/desktop/manage/overviews`, and changes made elsewhere (classic admin, API) or a new agent role are put right
  in the background a few seconds later.
- **Managers** see the ticket in the **Awaiting my approval** overview until they decide. In the new UI's views panel
  both overviews are listed first, under **Approval needed**. In the new UI the request appears as a card
  under the last message, with **Approve** / **Deny** (a comment is required to deny); the Approval tab offers the same.
  Admins can decide too, in the tab. Managers who have no other staff role (no Agent or Admin role) get no sidebar
  icons on the ticket screen at all, only the card (`GET /api/v1/ticket_approval/viewer` tells the UI), and their
  own **dashboard** instead of the agent one: requests waiting for them (amber after a day), their decisions in the
  last 30 days with the approval rate, tickets they approved over 3 days ago that are still open, and their last five
  decisions (`GET /api/v1/ticket_approval/dashboard`, `ticket.approver` permission).
- The agent who asked (and the ticket owner) are notified in the bell and by email. The ticket leaves both approval
  overviews and is back in its team with its owner; its state never changes.
- Every request and decision is added to the ticket as an internal note. The ticket fields `approval_state`,
  `approval_approver_id` and `approval_requested_by_id` can be used in triggers (e.g. a Teams alert) and reports,
  but can only be changed through the approval workflow.

| File(s) | Purpose |
|---|---|
| `db/migrate/20261004090000_studenthub_ticket_approval.rb`, `db/migrate/20261005090000_studenthub_sent_for_approval.rb`, `db/migrate/20261006090000_studenthub_approval_waiting_group.rb`, `lib/studenthub/ticket_approval*` | Table, ticket fields, role, permissions, settings, overviews, field guard |
| `lib/studenthub/ticket_approval/waiting_group.rb`, `ticket_access.rb`, `sla_pause.rb` | Managers group where tickets wait; who can read a waiting ticket; SLA pause |
| `config/initializers/studenthub_ticket_approval.rb` | Adds the field guard, the access rules and the SLA pause to Zammad's `Ticket`, `TicketPolicy` and `Escalation` without editing them |
| `app/models/ticket_approval.rb`, `app/services/service/ticket_approval/` | Approval rounds; request, decide, withdraw, notify |
| `app/controllers/ticket_approvals_controller.rb` | API (`/api/v1/tickets/:id/approval`, `/api/v1/ticket_approval/{settings,viewer,dashboard,managers}`) |
| `app/frontend/apps/desktop/pages/ticket/components/TicketCreate/useStudenthubCreateApproval.ts` | "Send for approval" on the New ticket screen |
| `app/frontend/apps/desktop/pages/ticket/components/TicketSidebar/plugins/studenthub-approval.ts`, `…/TicketSidebarStudenthubApproval/` | Approval tab in the new UI's ticket sidebar (picked up automatically from the plugins folder) |
| `…/TicketSidebarStudenthubApproval/StudenthubApprovalDecisionCard.vue` (shown by `ArticleList.vue`), `app/frontend/apps/desktop/composables/useStudenthubApprovalViewer.ts` | Decision card under the messages; managers-only check for the sidebar icons |
| `app/services/service/ticket_approval/dashboard.rb`, `app/frontend/apps/desktop/pages/dashboard/components/StudenthubManagerDashboard.vue` (shown by `Dashboard.vue`) | Manager dashboard |
| `app/assets/javascripts/app/controllers/ticket_zoom/sidebar_studenthub_approval.coffee` | Approval tab in the classic ticket sidebar |
| `app/views/mailer/ticket_approval_*` | Notification emails |
| `app/frontend/apps/desktop/pages/manage/views/TicketApproval.vue` | Admin page |

**Going live on production (once):**

1. Turn the feature on in the admin page. This takes over the "Managers" group: everyone's access to it is removed,
   and tickets in it go back to the team their history shows (tickets created directly in it stay, and are listed in
   the log; move them by hand). Managers need no access to the teams.
2. Retire the old approval setup: deactivate core workflows "Manager: Status pending for new ticket",
   "Manager: Approval state make it readonly" and 57 "Assign right Member - Manager", hide the "Manager Approval
   Status" field (its data is kept), and deactivate the "Managers Approval" overview and trigger 65 (Managers-group
   Teams alert). To keep a Teams alert, point a trigger at "Approval is Waiting for approval" instead.
3. Check the triggers that react to a team change (e.g. the Teams alerts 31, 32 and 35): a ticket changes team twice
   during an approval (into Managers and back).

---

## Known issues and to-do

- [ ] **Database password committed.** `config/database/database.yml` contains a real-looking
      Postgres username and password (it was published in Taxil's public repo). Change that
      password on any server that uses it, restore the file to Zammad's commented-out
      sample, and keep real credentials in `config/database.yml` (git-ignored) or
      environment variables.
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
