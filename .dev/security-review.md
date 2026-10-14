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
