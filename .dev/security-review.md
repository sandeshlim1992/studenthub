# Security reviews

What each security review of this repo found, what was decided about each finding, and why, so the reason stays in
the repo and not in someone's head. Each review is a section, newest at the end: add a new one there (no need to read
the whole file), and update a finding's row when it is fixed, accepted or ignored.

- **Context:** no Zammad update is coming (`.dev/DECISIONS.md`), so fixes go into Zammad's own files, marked
  with a `Student Hub:` comment, and dependencies are updated here.

Verdicts:

- **Fixed:** changed in the code. Snyk may still show it, because it matches patterns and doesn't recognise the
  check that was added.
- **By design:** the code does what the feature needs; the risk Snyk describes is limited by permissions or
  checks elsewhere.
- **False positive:** the pattern Snyk matched isn't a risk here.

## Snyk (12 Oct)

- **Tool:** Snyk VS Code extension (Open Source, Code Security, Infrastructure as Code)
- **Reviewed:** 12 Oct 2026, on `develop` at `8bada37a44`
- **Line numbers** are as of that scan; they move as the files change.

### Code Security

| File:line | Snyk says | Verdict | Why | Commit |
|---|---|---|---|---|
| `app/controllers/long_polling_controller.rb:36` | Code Injection | Fixed | The event name picks a class; `Sessions::Event.run` now only runs subclasses of `Sessions::Event::Base`, and each event checks its own permissions | `8bada37a44` |
| `app/controllers/external_credentials_controller.rb:29`, `:37` | Unsafe Reflection | Fixed | `ExternalCredential.load_backend` now only returns the provider classes directly in `ExternalCredential::` (not `Base::ChannelXoauth2` or helpers) | `8bada37a44` |
| `app/controllers/sessions_controller.rb:121` | Unsafe Reflection | Fixed | `Authorization.create_from_hash` now only builds subclasses of `Authorization::Provider`; the name comes from the sign-in provider's reply, not from typed input | `8bada37a44` |
| `app/controllers/recent_view_controller.rb:69` | Unsafe Reflection | Fixed | `RecentView.access` resolved any top-level class name (e.g. `Logger`); now only `ApplicationModel` subclasses | `8bada37a44` |
| `app/controllers/channels_sms_controller.rb:48` | Unsafe Reflection | Fixed | Test, create and update only accept the adapters of Zammad's three SMS drivers (`channels_config`), otherwise 422; admins only | `8bada37a44` |
| `app/frontend/apps/desktop/pages/manage/views/Users.vue:300` | Open Redirect | Fixed | "Switch to user" only follows addresses on this site (starting with `/`, not `//`); Zammad sends an empty address, so it goes to `/` | `8bada37a44` |
| `app/controllers/packages_controller.rb:20`, `:27`, `:38`, `:51` | Path Traversal | By design | Installing add-on packages is admin-only (`admin.package`) and installs code by purpose; `Package.allowed_file_path?` already refuses `..` and `%2e%2e`, and files are written under the app root | n/a |
| `app/controllers/external_credentials_controller.rb:42` | Open Redirect | By design | Sends the browser to Microsoft / Google / Facebook to sign in; the address comes from the provider's settings. That redirect is how OAuth works | n/a |
| `app/controllers/webhooks_controller.rb:10`, `:11` | Unsafe Reflection | False positive | The class name is the type of a ticket / article record from the database (`TriggerWebhookJob::RecordPayload::Ticket`), not user input | n/a |
| `app/controllers/core_workflows_controller.rb:31` | Deserialization of Untrusted Data | False positive | `CoreWorkflow::Result` uses `Marshal.load(Marshal.dump(x))` to deep-copy data already in memory; nothing from outside is deserialised | n/a |
| `app/views/knowledge_base/public/answers/show.html.erb:33` | Cross-site Scripting | False positive | A tag link built with `link_to` and a route helper: Rails escapes the text and the path segments | n/a |
| `app/models/application_model/can_associations.rb:363`, `can_cleanup_param.rb:28` | Improperly Controlled Modification of Object Attributes | By design | Zammad's generic save code takes a hash of fields (`permit!`) and filters it in `param_cleanup`; changing it means rewriting Zammad's REST layer | n/a |
| `app/frontend/apps/desktop/pages/manage/views/AiWritingAssistant.vue:344` | DOM-based XSS | False positive | Downloads a report from our own server through a `blob:` link with `download`; no page content is built from it | n/a |
| `app/frontend/apps/desktop/pages/manage/views/SystemVersion.vue:56` | DOM-based XSS | False positive | Sets a hidden input's `value` to copy the version text; setting `value` can't run script | n/a |
| `app/controllers/first_steps_controller.rb:210` | Use of Hardcoded Credentials (info) | False positive | Looks up the demo user by email address; no password or token | n/a |
| `app/controllers/tests_controller.rb:12` | SQL Injection (info) | False positive | A template lookup (`lookup_context.exists?`), not a database query; the route doesn't exist in production (`config/routes/test.rb`) | n/a |
| `app/frontend/apps/mobile/sw/sw.ts:9` | Insufficient postMessage Validation (info) | False positive | The service worker's message handler only activates a waiting update (`SKIP_WAITING`) | n/a |

#### Excluded from Code Security

Listed in `.dcignore`, because they aren't part of the running app:

| Folder | What Snyk found there |
|---|---|
| `spec/` | ~417 "hard-coded password / credential" findings: the test users' passwords (e.g. `test`), plus `spec/support/authenticated_as.rb:55` |
| `contrib/` | `edit-icon-license-list.php:187` XSS: a developer script, not served |
| `.dev/` | Developer tooling and notes |

### Open Source (dependencies)

| Package | Problem | Status |
|---|---|---|
| rails / activestorage 8.0.5 | Files or directories accessible to external parties | Fixed: 8.0.5.1 (12 Oct, in the commit that added this file) |
| json 2.21.1 | Use after free | Fixed: 2.21.2 (12 Oct, in the commit that added this file) |
| graphql 2.6.5 | Missing authorization | Fixed: 2.6.11 (12 Oct, in the commit that added this file) |
| @tiptap/core 3.28.0 (editor) | ReDoS, prototype pollution | Fixed: all `@tiptap` packages 3.30.5, one copy of core and of prosemirror-model (overrides in `pnpm-workspace.yaml`) (12 Oct, in the commit that added this file) |
| qs 6.15.3 | Resource exhaustion, uncaught exception | Open: 6.16.0 fixes |
| ws 8.20.0, nanoid 3.3.12, tmp 0.2.5, esbuild 0.27.7, postcss 8.5.19, brace-expansion 5.0.5 | Various (resource exhaustion, directory traversal, insecure download, ReDoS) | Open: come in through other packages; need a refresh within their ranges or overrides in `pnpm-workspace.yaml` (the `resolutions` in `package.json` are ignored by pnpm 11) |
| brace-expansion, degit, js-yaml, sprintf-js in `.dev/hygen/package.json` | Various | Accepted: a developer code generator, not part of the app |

Infrastructure as Code: no findings.

### Ignoring a finding in Snyk

1. Make sure it has a row above with its verdict and reason.
2. In VS Code, hover the finding, click the lightbulb and choose Snyk's "Ignore" option; Snyk adds its own
   `deepcode ignore` comment to the line. Put the reason there in a few words.
3. Note "ignored in Snyk" in the row's Why column.

## Manual review of Student Hub's server code (13 Oct)

A review with Claude Code of the code Student Hub added on the server: the `/api/v1/studenthub` endpoints, their
policies, services and models, `lib/studenthub`, Ticket Approvals, Feedback Collection (including the public
`/feedback/:token` page), the checklist rules and `script/studenthub/deploy.sh`. The Claude Security plugin's scan
needs Claude Code workflows, which this account doesn't have, so it wasn't used. The rest was found sound: ticket
access checks, approval rules, per-user overview caches, request form escaping, the checklist "agents only tick"
rule, feedback tokens (stored hashed, one use) and how the deploy script runs commands.

| File | Problem | Verdict | Why | Commit |
|---|---|---|---|---|
| `lib/studenthub/new_ui_at_root.rb` (`without_desktop`) | Open redirect: `/desktop/%2Fevil.example` went to `https://evil.example` (Rails decodes `%2F`; nginx passes it on) | Fixed | Leading slashes and backslashes are dropped, so the target is always a path on this site; `%5C` no longer gives a 500 | the commit that added this section |
| `lib/studenthub/exchange_stored_password.rb`, `app/services/service/studenthub_exchange/settings.rb` | The password mask was swapped for the stored Exchange password whatever server or user was named, so someone with only `admin.integration.exchange` could send it to their own server | Fixed | The mask stands for the stored password only with the stored server address and user name; otherwise the password must be typed again | the commit that added this section |
| `app/policies/controllers/studenthub_manager_sites_controller_policy.rb` | `admin.ticket_approval` could assign sites, which gives managers read access to all of a site's tickets; a manager with it could give themselves every site | Fixed | Assigning sites needs full `admin`; the card is hidden on the Ticket Approvals page for everyone else | the commit that added this section |

## ZAP baseline (13 Oct)

OWASP ZAP (Docker image `ghcr.io/zaproxy/zaproxy:stable`, Automation Framework) against the dev app at
`http://localhost:3000`, signed in as the dev agent through a temporary API token (deleted afterwards). Passive only:
about 50 requested pages and endpoints (the agent's own and 22 it must be refused), a 5-minute crawl from `/` (188
URLs) with form submission and sign-out off, so no data changed. To reach the dev server, the ZAP container shares
the devcontainer's network (`docker run --network container:<devcontainer id>`).

| Where | ZAP / check says | Verdict | Why | Commit |
|---|---|---|---|---|
| Customer role (database) | `GET /api/v1/studenthub/request_forms` answered the agent with 200; every other admin endpoint was refused | Fixed | The dev database's Customer role still had `admin.request_forms`, so every student could manage request forms. The 20261013120000 migration takes `admin.*` off customer-only roles on every server | the commit that added this section |
| Pages (`/`, `/login`, `/ticket/…`, `/feedback/…`) | Content Security Policy header not set (Medium) | By design (dev) | In development Zammad sends the policy as report-only (`config/initializers/content_security_policy.rb`); production enforces it. Production allows `unsafe-eval` in scripts, Zammad's own setting | n/a |
| `/api/v1/*` | Cross-domain misconfiguration, `Access-Control-Allow-Origin: *` (Medium) | By design | Zammad's own API header (`ApplicationController::SetsHeaders`); without `Allow-Credentials` other sites can't read responses for signed-in users | n/a |
| `/api/v1/signshow`, `/app`, `/help/…` | Unix timestamps in responses (Low) | False positive | Build and setting timestamps, nothing sensitive | n/a |
| `/favicon.ico`, `/apple-touch-icon.png` | `X-Content-Type-Options` missing (Low) | By design (dev) | Rails serves these files in development; nginx serves them in production | n/a |

## Check of the 14 Oct changes before committing

`git diff HEAD` before the four commits of 14 Oct (Claude settings, database sample, admin messages, three admin fixes).
No server code changed, so no full review.

| File | Problem | Verdict | Why | Commit |
|---|---|---|---|---|
| `config/database/database.yml` | Zammad's default Postgres user and password were committed (also in Taxil's public repo) | Fixed in the repo | Back to Zammad's commented-out sample; the servers still need checking (NOTES → Next steps) | `fix(security): database sample …` |
| `.claude/settings.json` | Claude may stage files and run the type check, ESLint and oxfmt without asking | Accepted | Local commands that change nothing outside the working copy; commits and pushes still need the user | `chore(claude): …` |
| 20 `/manage` views | Names admins typed (workflows, triggers, users' email addresses) now go into messages and labels | No problem | Shown as text only (`{{ }}`, `aria-label`, `confirm()`); none goes through `v-html` or Zammad's HTML notifications | `fix(manage): admin messages …` |
| `SystemDataPrivacy.vue`, `ChannelForm.vue`, `AvatarMenu.vue` | User search, embed code and tab links work again | No problem | The search term is URL-encoded and the server's permission check is unchanged; the embed code is shown as text in a `<pre>`; menu links use the ticket's internal id | `fix(manage): Data Privacy …` |

## Check of the type fixes before committing (14 Oct)

`git diff HEAD` for the commit that took the type check from 31 errors to 0: frontend only, no server code.

| File | Problem | Verdict | Why | Commit |
|---|---|---|---|---|
| 14 frontend files (admin pages, profile settings, New ticket, message actions, `Form.vue`, three specs) | Type fixes could drop a check | No problem | No permission check, validation or error handling was removed; the only new code is guards (an icon shown only when there is one, no form lookup without an id). New ticket still sends the same customer and attachments | the commit that added this section |

## npm dependency fixes and a browser check of the editor (15 Oct)

`pnpm audit --prod` listed 19 advisories in 10 packages (12 high). Each package was refreshed within the range its
parents already allow (`pnpm update <name>`), with no new overrides. The `resolutions` in `package.json`, which
pnpm 11 ignores, are gone, and `vite-bundle-visualizer` moved to `devDependencies`. Afterwards `pnpm audit --prod`
lists 1 (low). `.github/dependabot.yml` sets Dependabot up for security fixes only.

| Package | Problem | Verdict | Why |
|---|---|---|---|
| prosemirror-view 1.42.0 (the editor) | XSS in paste handling | Fixed: 1.42.6 | Runs in every staff and student browser |
| vue 3.5.39 (with `@vue/server-renderer`, `@vue/runtime-core`, `@vue/compiler-dom`) | XSS in attribute names (server renderer) | Fixed: 3.5.44 | Student Hub doesn't render on the server; Vue's packages move together |
| qs 6.15.3 | Array-limit bypass | Fixed: 6.16.0 | Parses the search page's filters |
| ws, nanoid, source-map-js, postcss, brace-expansion, tmp | Denial of service, path traversal | Fixed: 8.22.0, 3.3.20, 1.2.2, 8.5.30, 5.0.12, 0.2.7 | Build tools and Node-only code; fixed so new findings stand out |
| esbuild 0.27.7 | File read through esbuild's own development server | Accepted | Vite doesn't use esbuild's server, and esbuild never runs on the servers. The older Vite inside `@sa11y/vitest` (Vitest 3) keeps it at 0.27; Student Hub's Vite 8 accepts 0.28 |
| 71 advisories in development tools (`pnpm audit` without `--prod`, 4 critical: Vitest 3 inside `@sa11y/vitest`, GraphQL codegen, stylelint, markdownlint-cli2, …) | Various | Open | Developer machines only, never in the app (NOTES → Next steps) |

A browser test of the reply editor after the update (Playwright, not kept): bold, lists, a pasted link and table,
table editing and the `@@` mention list work. It also found:

| File | Problem | Verdict | Why |
|---|---|---|---|
| `app/frontend/shared/utils/htmlCleanup.ts` (Zammad's, unchanged by Student Hub) | Pasted HTML runs its scripts: `htmlCleanup` parses it with `innerHTML` on an element of the live page, so `<img src=… onerror=…>` runs while the HTML is cleaned. In the browser the script ran through `htmlCleanup` alone and not through ProseMirror's own paste (which parses in a detached document). Every HTML paste into the editor goes through it, as do text modules, Knowledge Base suggestions and signatures | Open | Someone has to paste HTML an attacker prepared (a web page decides what copying from it puts on the clipboard); the script then acts as the signed-in user. Fix: parse in an inert document (`document.implementation.createHTMLDocument`). Probably also in current Zammad: report to `security@zammad.com` (SECURITY.md) |

## Check of the pasted-HTML fix before committing (15 Oct)

`git diff HEAD`: frontend only, one Zammad file. No permission check, validation or error handling changed.

| File | Problem | Verdict | Why | Commit |
|---|---|---|---|---|
| `app/frontend/shared/utils/htmlCleanup.ts` | Pasted HTML ran its scripts (the open row above) | Fixed | It now parses in a document without a window (`createHTMLDocument`), where nothing loads or runs, and builds the paragraphs it makes from line breaks there too. Same clean-up and output: Zammad's 19 `htmlCleanup` specs and the editor specs pass. `studenthubHtmlCleanup.spec.ts` and the browser test "Pasting into a reply" (`agent-journey.spec.ts`) fail on the old code | the commit that added this section |
| `app/assets/javascripts/app/lib/app_post/utils.coffee` (classic UI at `/app`, `App.Utils.htmlCleanup` → `_checkTypeOf`) | The same in the classic UI: pasted HTML is parsed with jQuery's `$(html)` in the live page, and a browser check (15 Oct) saw the pasted `<img onerror>` run | Open | Agents can still reply at `/app`. Fix: give jQuery an inert document to parse in; to report to Zammad with the other | — |

## Rails 8.1 (15 Oct)

`git diff HEAD`: `Gemfile` and `Gemfile.lock` only. All new versions come from rubygems.org; the gems from git
(`delayed_job`, `delayed_job_active_record`, `autodiscover`) are unchanged.

| Finding | Problem | Verdict | Why | Commit |
|---|---|---|---|---|
| Brakeman: "Support for Rails 8.0.5.1 ended on 2026-10-07" | No more security fixes for Rails 8.0 | Fixed: Rails 8.1.4 | Brakeman finds nothing on 8.1.4. 15 shared gems moved with it (e.g. `net-imap` 0.6.8, `rack` 3.2.7). The full backend suite shows no failure caused by the update (NOTES → Tests that already fail), the browser tests pass, and the production asset build works | the commit that added this section |

## Classic-only automation features in the new UI (15 Oct)

`git diff HEAD`: the automation options endpoint (service, controller comment, policy), the condition and action
editors, the Scheduler, Triggers and Templates pages, their specs. Records are still saved through Zammad's own APIs
(`/api/v1/jobs`, `/triggers`, `/templates`) with their own permission checks; nothing new writes data.

| Finding | Problem | Verdict | Why | Commit |
|---|---|---|---|---|
| Options endpoint now also for `admin.template` | Template admins can read the names of states, priorities, teams, agents, organisations, webhooks, roles and calendars | Accepted | Read-only names and ids, no settings or secrets; a template needs the agents, teams and select fields anyway (the page loaded `/api/v1/users?per_page=500`, groups, states and priorities before). Agents without an admin permission still get 403 (spec) | — |
| New `attributes` in the options | Field definitions of tickets, users and organisations could carry more than labels | No problem | Only name, display, type, active, relation and the option labels are sent. External data source fields (whose options hold a search URL and credentials) and passwords are left out (`FIELD_TYPES`, spec "leaves out passwords and lists of ids") | — |
| User jobs: "Add a data privacy deletion task" | A scheduled job can delete users and their tickets | Accepted | The same action as the classic Scheduler, for `admin.scheduler` only (Zammad's jobs API and `Job` validation); the editor warns that it cannot be undone. Request spec runs such a job | — |
| Regular-expression conditions | The setting `ticket_conditions_allow_regular_expression_operators` is checked by the UI only | Accepted | Zammad's own design: the server never checks it (no Ruby code reads the setting), the classic UI hid the operators the same way; only trigger admins can save conditions | — |
| User and organisation match counts | `/api/v1/users/selector` and `/organizations/selector` count records | No problem | Zammad's `SelectorsController`, `admin.*` only, unchanged | — |
| Template message text in the rich-text editor | Stored HTML shown in an editor | No problem | Shown only inside Zammad's editor field (as in the Knowledge Base page); the template list shows field names, not the HTML; texts elsewhere are interpolated, never `v-html` | — |

## Links to classic addresses (15 Oct)

`git diff HEAD`: mail templates (the invitation and four translations), Zammad's older email services
(`Service::User::PasswordReset::Deprecated::Send`, `Service::Auth::Deprecated::SendAdminToken`,
`Service::User::Deprecated::Signup`), the Delete action on a user's page, the Data Privacy page and route, the
AI-suggested Knowledge Base answers, a redirect for old Knowledge Base addresses, specs.

| Finding | Problem | Verdict | Why | Commit |
|---|---|---|---|---|
| Email links built from settings | Could a link point elsewhere? | No problem | Unchanged way of building: `http_type`, `fqdn` and the token, as Zammad's current services do; only the path after the host changed. The tokens, their one-day validity and the pages that check them are Zammad's, unchanged | — |
| Old `#…` sign-in addresses no longer sent | A signed-out visitor never reached a working page | Fixed | Invitations, signup and admin sign-in emails now open pages that work without signing in | — |
| `/manage/system/data_privacy/<userId>` | The page loads a user by id from the address | No problem | Admin page (`admin.data_privacy` or another admin permission, as before); the user is read with `GET /api/v1/users/<id>` (Zammad's own permission check) and only preselected: the deletion still needs "DELETE" typed and Zammad's `DataPrivacyTask` checks. `userId` must be digits (route pattern) | — |
| Redirect for `/knowledge_base/…` | Open redirect? | No problem | The target is always `/knowledge-base/…` on this site; the parameters must be `category`/`answer`, digits and `edit` (route pattern) | — |

## Classic UI switched off (15 Oct)

`git diff HEAD`: `config/routes.rb` (`/app`, `/init` → 302 to `/`), its request spec, docs.

| Finding | Problem | Verdict | Why | Commit |
|---|---|---|---|---|
| New redirects | Open redirect? | No problem | Fixed target `/`; nothing from the request goes into it | — |
| Classic UI no longer served | Its known pasted-HTML issue (15 Oct) | Out of reach | The classic app isn't served once a server runs this; its code goes in the delete step | — |

## BETA switch and the sign-in return to /app removed (16 Oct)

`git diff HEAD`: deletions in the new UI (BETA switch, usage tracking, the "New BETA UI" setting) and their tests, the
generated GraphQL types, `sessions_controller.rb` and `Studenthub::NewUiAtRoot` (the return to `/app#`), specs, docs.

| Finding | Problem | Verdict | Why | Commit |
|---|---|---|---|---|
| Sign-in return after OmniAuth (Microsoft) | Where a sign-in sends people back to | No problem | One branch less: `/mobile…` or `Studenthub::NewUiAtRoot.local_path`, which keeps the return on this server (spec "keeps sign-in returns on this server"); no new input used | — |
| Notifications with classic `#…` links | Navigation from a notification | No problem | `router.push` inside the app (the old code set `window.location` to the same `/#…` address); the routes decide what opens, permissions apply as before | — |
| Removed code | Did a permission check or validation go with it? | No problem | Only the switch, its feedback dialog and usage tracking went; the server-side feedback mutation keeps its own checks and is no longer called | — |

## Mobile app: "Powered by Zammad" removed, design option 5 in a light theme (16 Oct)

`git diff HEAD`: the mobile sign-in page, its header and third-party buttons, the home page and its new tiles, the bottom
menu, a new stylesheet, the mobile page and layout views, the manifest colours in `MobileController`, the application
colour helper moved from the new UI to shared code, specs, docs.

| Finding | Problem | Verdict | Why | Commit |
|---|---|---|---|---|
| Username and password behind "Admin / local login" | Could anyone be locked out, or the password sign-in be reached when it is switched off? | No problem | Only whether the form is shown changed; it opens from the start when no third-party sign-in is on, and stays hidden when `user_show_password_login` is off with a provider on, as before. Sign-in, two-factor and the server's checks are unchanged | — |
| Third-party sign-in buttons moved first | Forms and tokens | No problem | Same forms: same action URLs and CSRF token, only their place and label changed | — |
| Knowledge Base tile | Links to a page the person may not open? | No problem | Shown only with `knowledge_base.reader` or `.editor` (display only); a fixed address (`/knowledge-base`), and the new UI and server check the permission as before | — |
| Application colour in the mobile CSS | CSS injection through the setting | No problem | `applyStudenthubAppColor` sets `--sh-app` only for a `#rrggbb` colour dark enough for white text (unchanged helper, now shared); the server validates the setting too | — |
| Manifest and page colours, app name | Server output | No problem | Fixed values; no user input | — |
| Phones sent to the mobile app | Open redirect | No problem | The address is built only from fixed paths: `/mobile/` plus the current address's own `#…`, `/mobile/login`, or `/mobile/tickets/` and digits; nothing from a query reaches it, so it can't leave this server | — |
| Staff on a phone sent to the new UI | Permissions | No problem | Display only: decided from the signed-in person's own `ticket.agent` permission, and the fixed address `/` or `/tickets/` and digits; nothing about access changes | — |
| Customer role for staff (proposed, not done) | Access to other people's tickets | Rejected | 33 of 38 staff belong to a shared college organisation (LSST 1,203 members, FSB 744, UKBC 31); the Customer role would let them read all its students' tickets, in every app and the API | — |
| Opening `/mobile` clears "Continue to desktop" | Permissions | No problem | Only a display choice in the browser's own storage; sign-in and permissions are the same in both apps | — |
| Mobile Playground removed | Removed code | No problem | A developer page any signed-in user could open by its address; nothing else used it (its imports all have other users) | — |
| Version section removed from the account page | Removed code | No problem | It showed admins the Zammad version; only the display and its query went, no check. Showing less is no risk | — |

## Mobile app: Home and Tickets tab in design C1 (16 Oct)

`git diff HEAD`: the mobile Home page, a new header, the latest ticket card, the bottom menu, a new Tickets tab
(`/mobile/tickets`) with its route, a helper for where a ticket stands, specs, docs. Frontend only; no server change.

| Finding | Problem | Verdict | Why | Commit |
|---|---|---|---|---|
| Tickets tab and latest ticket | Could a student see others' tickets? | No problem | Read through Zammad's `ticketsByOverview` for the "My Tickets" view, whose condition the server applies (customer is the current user); the shared organisations' tickets aren't asked for. Search and filters only narrow what came back | — |
| New `/tickets` route | Permissions | No problem | `requiredPermission: ['ticket.customer']`; the server checks the overview's roles and conditions anyway | — |
| Help articles link | Links to a page the person may not open? | No problem | A fixed address (`/help`), shown while the Knowledge Base is on; the help center shows only published answers | — |
| Removed Home tiles and quick action | Removed code | No problem | Display only; New request, Tickets and Notifications are in the bottom menu and header, with the same permission checks (`useTicketCreateView`, `ticket.customer` / `ticket.agent`) | — |

## Mobile app: "My Tickets" in every state, quick links and their admin page (16 Oct)

`git diff HEAD`: a migration and `Studenthub::MyTicketsView` changing the "My Tickets" view's state condition; a new
permission `admin.mobile_app`, the setting `studenthub_mobile_quick_links` and its validation
(`Setting::Validation::StudenthubMobileQuickLinks`); the new UI's Mobile app admin page; the quick links on the mobile
app's Home; sorting on the Tickets tab; specs, docs. Full review: the server change touches permissions, settings and
web addresses people open.

| Finding | Problem | Verdict | Why | Commit |
|---|---|---|---|---|
| "My Tickets" now lists every state but merged | Could a student see more than their own tickets? | No problem | Only the state condition changed; "customer is the current user" stays and is applied by the server. The tickets that now appear are the student's own, which they could already open (spec "lists the customer's own tickets in every state but merged") | — |
| Quick link addresses | `javascript:`, `data:` or relative links run in the app or mislead | No problem | The server accepts only `http`/`https` with a host (URI parse; spec covers `javascript:`, `data:`, relative, no host, spaces, too long); the mobile app shows only links that pass the same check and binds them as `href`, never as HTML. Labels are shown as text | — |
| Links open other sites | Tab-nabbing, referrer leak | No problem | `target="_blank"` with `rel="noopener noreferrer"` | — |
| Misleading addresses (`https://lsst.ac@evil.example`) | A link that looks like the college's | No problem | The card shows the address's real host (`evil.example`), worked out by the browser's URL parser; only admins can set links | — |
| Who can change the quick links | Permissions | No problem | Zammad's settings API: `admin.*` plus the setting's own `admin.mobile_app` (`SettingPolicy`); specs: admin and an agent with only `admin.mobile_app` can, an agent without it gets 403 | — |
| Who gets the quick links | Data to signed-out visitors | No problem | `authentication: true`: only signed-in users get them with the app config (spec checks signed out) | — |
| Settings without their own permission (existing, found while checking `admin.mobile_app`) | Anyone with any `admin.…` permission can read and change 86 settings that have no permission of their own, e.g. `system_bcc` (copy of all outgoing email), `developer_mode`, `import_mode`; checked with an agent holding only `admin.mobile_app` (200, value changed) | Let the user decide | Zammad's `SettingsControllerPolicy` / `SettingPolicy` design, not new: the same holds for `admin.departments`, `admin.request_forms` and Zammad's own sub-permissions. It matters only if a role gets one of them without full admin. Fix option: in `SettingPolicy`, require `admin` (or `admin.setting_system`) for settings without a permission | — |

## Mobile app: students' chat on the ticket screen (16 Oct)

`git diff HEAD`: a new endpoint `POST /api/v1/studenthub/customer_tickets/:id/reply` and its service
`Service::StudenthubCustomerTicket::Reply`; `Reopen`'s message HTML made a class method for it; the mobile app's chat
header, chat box and "Did this solve your problem?" card; `studenthubApi` and the student ticket types moved to
`app/frontend/shared/utils/` (imports only); specs, docs. Full review: the server change takes user input and checks
permissions.

| Finding | Problem | Verdict | Why | Commit |
|---|---|---|---|---|
| Who may call `reply` | Agents or other students posting into a ticket | No problem | The controller policy allows `ticket.customer` only; the controller authorizes `show?` on the ticket; the service then needs `update?` (open requests) or Reopen's `follow_up?` (resolved, closed). Specs: another student gets 403 and no message is added; an agent without the customer role gets 403 | — |
| Students of a shared organisation | A student replying on another student's ticket in the same shared organisation | No problem (not new) | Zammad's `update?` gives customers of a shared organisation the same access to its tickets through its own ticket form and GraphQL; Close and Reopen already follow it. Whether the college organisations should be shared is a separate, existing question (see the staff Customer role decision, 16 Oct) | — |
| Message text | HTML or script in the message | No problem | Escaped with `ERB::Util.html_escape`, newlines become `<br>`, cut at 10,000 characters (Reopen's code, now shared); spec checks `<b>` arrives escaped. The bubble shows it through Zammad's article rendering | — |
| Message type | A student making an internal note or another channel's message | No problem | Type `web` and `internal: false` are fixed in the service; nothing from the request picks them | — |
| Closed requests the team doesn't reopen | Reopening through the chat box | No problem | Resolved and closed requests go through `Reopen`, which refuses merged tickets and groups with "new ticket" follow-ups (spec "refuses", no message added) | — |
| CSRF | A third-party page posting a message as the student | No problem | Zammad's session check for JSON requests needs `X-CSRF-Token`; `studenthubApi` sends it (unchanged code, only moved) | — |
| Message flood | Many messages in a row | Not addressed | Same as Zammad's own customer form (no limit per ticket); the box is disabled while a message is sending | — |

## Mobile app: Popular answers chosen by admins (17 Oct)

`git diff HEAD`: a second Mobile app setting (`studenthub_mobile_popular_answers`, Knowledge Base answer IDs) and its
validation, two endpoints (`GET /api/v1/studenthub/mobile_app/answer_choices`, `…/popular_answers`) with their
policy, a migration, the admin page's section and the list on the mobile app's Home, specs, docs. Full review: new
endpoints that read the Knowledge Base, where internal answers must never reach students.

| Finding | Problem | Verdict | Why | Commit |
|---|---|---|---|---|
| Internal answers and drafts | Could a student see a staff-only answer or its title? | No problem | Both endpoints read only `KnowledgeBase::Answer.published` in the active Knowledge Base (published is what the help center shows anyone); the setting accepts only published IDs, and Home asks again each time, so an answer made internal later drops off (specs cover internal, draft, archived and unpublished-after-choosing) | — |
| Who may list the answers to choose from | Permissions | No problem | `answer_choices` needs `admin.mobile_app` (agents and students get 403, spec); it lists published answers only | — |
| Who may read Home's answers | Permissions | No problem | `popular_answers` needs `ticket.customer` or `ticket.agent`; signed out gets 403. It gives the title and the help center path, both public | — |
| Who may change the setting | Permissions | No problem | Zammad's settings API with the setting's `admin.mobile_app` (spec: an admin saves published, an internal answer is refused with 422) | — |
| Links on Home | Open redirect, script in links | No problem | The paths are built by the server with Rails' route helper (`/help/<locale>/<category>/<answer>`) from the records, never from input; the app binds them as `href`, titles as text | — |
| Input | Injection | No problem | No parameters are read; the IDs come from the setting and go to Active Record `where(id:)` | — |

## Mobile app: New request as a chat (17 Oct)

`git diff HEAD`: the students' request chat in the mobile app (a route, its view and two composables), the bottom
menu's + and the closed-request link pointing to it, specs, docs. Frontend only: the ticket goes through Zammad's
ticket create mutation, files through Zammad's upload cache.

| Finding | Problem | Verdict | Why | Commit |
|---|---|---|---|---|
| Ticket creation | Could a student create a ticket they may not, or for someone else? | No problem | Zammad's `ticketCreate` mutation with the server's customer rules (customer = the student, `customer_ticket_create`, groups); no customer is sent. The group is one Zammad's ticket form offers the student | — |
| Message body | HTML or script from the student in the first message | No problem | The student's text goes through `textToHtml` (linkify escapes it; spec checks `<b>` arrives as `&lt;b&gt;`), the category and campus through an escape; the server sanitizes article HTML as well | — |
| Request form answers and fields | Bypassing the form's checks | No problem | Sent as the new UI's wizard sends them; the server cleans the answers (`Questions.clean_answers`), refuses missing required ones and checks the fields through the core workflow | — |
| Files | Uploads | No problem | Zammad's own upload cache mutations with the chat's form ID, the same checks as Zammad's file field | — |
| Search and choices | Data exposure | No problem | Read from the new UI wizard's endpoints, which students already use; the search runs in the browser on that list | — |
