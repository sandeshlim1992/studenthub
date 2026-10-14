# Working notes

Short, current state of the project. Update at the end of each session, then commit.
Setup steps live in README.md; agent rules live in CLAUDE.md; decisions live in DECISIONS.md; what was done lives
in the git log. Don't duplicate them here.
Never put passwords, tokens or keys in this file.

## Environment

- Windows 11 → WSL 2 → Ubuntu → Docker Desktop → devcontainer
- Repo lives in Ubuntu at `~/studenthub` (not on C:)
- All work happens **inside the devcontainer** (Ruby, Node 24, pnpm, Postgres, Redis)
- Claude Code runs in the container terminal; `claude --rc` for phone access
- Two PCs (home + work), each with its own container and its own dev database

## Tests that already fail

- Type check: `pnpm lint:ts` has 40 old errors (14 Oct); count them with `pnpm lint:ts 2>&1 | grep -c 'error TS'`
- Zammad's SMS driver specs (Twilio, MessageBird, Massenversand: 3 examples) fail in the container: they expect
  errors from the real SMS services
- Running all of `pages/ticket` and `pages/ticket-overviews` at once, about 15 tests fail under load, nearly all by
  timing out at 5 s (e.g. the a11y, history and merge specs); every spec there passes when run on its own, except
  `ticket-detail-view-hint-note` (3) and `ticket-detail-view-live-users` (5), which fail on their own too (13 Oct).
  `studenthub-talk-to-student-support` ("opens the ticket wizard") and `ticket-detail-view-studenthub-queue` fail now
  and then even on their own (timing; seen on 14 Oct on the code before and after the lint tidy)
- `spec/lib/studenthub/checklist_assignments/webhook_triggers_spec.rb` fails (4 examples, also on its own): it adds
  the `subcategory` ticket field without its database column, so Zammad refuses the trigger's condition ("Invalid
  object selector conditions"). The migration code it tests is fine; the spec needs fixing
- The mobile app's `pages/ticket` specs: about 10 of 73 fail even on their own (which files varies between runs);
  Student Hub doesn't use the mobile app. `continue-to-mobile.spec.ts` (2) fails since Taxil removed that menu entry
- Zammad's drawer specs (`left-sidebar.spec.ts` width handling ×6) fail by design since design C
- Vitest's module cache (`node_modules/.experimental-vitest-cache`) keeps old `import.meta.glob` results: after adding a
  page (`routes.ts`) or a plugin, tests still see the old list (e.g. the rail without KB, Members, Reporting). Delete the
  folder; it is rebuilt
- `knowledgeBaseBody.spec.ts` "gives images that were there their cid back…" fails in Vitest (jsdom has no
  `Blob.stream`), also on the code before the Knowledge Base panel
- 15 of Zammad's 1,382 `spec/graphql` examples fail since Student Hub added ticket fields (e.g. `approval_*`): the
  ticket create (4) and update (7) mutations and the frontend attributes query (2) return the extra fields, and the
  record loader's query counts (2) are higher. Same 15 before and after the 12 Oct gem updates
- Backend specs share Redis with the dev server (`redis://redis:6379`), and some Zammad specs set the 5-minute
  "restart required" key (`zammad_restart_required_timestamp`): while it is set, every `bin/dev` process stops itself
  in a loop (12 Oct). Don't run specs while `bin/dev` runs (or wait 5 minutes, then restart it); fix: a separate
  Redis database for tests
- Three ticket-overviews specs (`studenthub-talk-to-student-support`, `ticket-overviews-empty-states`,
  `ticket-overviews-polling`) sometimes fail when the whole `pages/ticket-overviews` folder runs together with the
  table specs (route stays `TicketOverview`, polling times out); they pass on their own, with or without the 12 Oct
  group header change. On the home PC (13 Oct) one test each in the first two fails even on its own, also on the code
  of 12 Oct: opening New ticket takes longer than `waitFor`'s 1 s; with a 10 s timeout they pass

## Known issues

- Test server: Elasticsearch isn't running → search index jobs fail and fill the log, and Reporting only says
  "Elasticsearch needs to be configured!" (Zammad's reports need it)
- Test server: `/etc/zammad/zammad.env` is world-readable and holds the M365 client secret
  (check production too)
- Base is a July `develop` snapshot, not a stable Zammad release
- No longer used by the Checklist tab (13 Oct), left in place: Zammad's `ChecklistItems.vue`, `ChecklistItem.vue`,
  `ChecklistTemplates.vue`, `ChecklistEmptyTemplates.vue`, `useChecklistTemplates.ts` (their own specs still pass)
- The first sign-in in a fresh browser can fail with "Security token verification failed"; the page reloads and the
  second try works (seen in headless Chrome, 13 Oct; the browser tests retry once)
- Dev server: after Rails (puma) restarts, a browser tab that reconnects at once (the live connection `/cable` plus
  several GraphQL requests together) can leave every request hanging (seen four times on 13 Oct). Fix: kill puma
  (`forego` starts it again), wait until it answers, then open the app
- A bell notification can outlive its ticket: Zammad's notification job can write it just as the ticket is deleted
  (the browser tests' cleanup did twice, 13 Oct). It shows as "You can no longer see the ticket." (it failed the
  whole bell list in the new UI until 13 Oct); Zammad removes read ones after 8 hours, unread ones after 9 months.
  The test server copy had 50 unread ones from 7 March for staff (removed from the work PC dev DB only)
- Review of Taxil's work (30 Sep), not fixed yet:
  - "Continue with Microsoft" button on `/desktop/login` does nothing → fixed on `studenthub-newUI` (sign-in redesign)
  - Theme switch removed (login-page public links are back since 7 Oct); "Continue to mobile" stays removed for
    now (14 Oct)
  - TypeScript errors: 74 then, 144 after Taxil's 3 Oct commit; 35 Zammad unit tests fail (all pass on original Zammad)
- Still only in the classic UI: BETA UI and KB Answer Generation admin pages, the live chat console and the
  phone (CTI) log (both unused), Clearbit's field mapping, Scheduler jobs on users or organisations, the fields of a
  template other than title, state, priority, team and owner (kept on save), and conditions or actions the shared
  editor doesn't know, e.g. "has reached" of time-based triggers (kept on save) (README → Moved from the classic UI
  lists what moved)
- Home PC: the devcontainer runs the repo from `C:\dev` (9p mount), not `~/studenthub` → file reads ~150× slower
  than the Linux disk, classic UI pages take 20–60 s, Vite and Rails miss file changes (restart `bin/dev` after
  edits). The first page load after a restart takes minutes and the app may show "Loading failed" meanwhile
  (reload). The work PC was reported fast on 6 Oct; check whether it already runs from Ubuntu
- Sorting the Sent for approval view by its Approval column fails: `approval_state` has no historical options,
  so Zammad sorts it as a number (removed from the Group by menu for the same reason)
- Search with Elasticsearch doesn't find tickets waiting for approval (access isn't group-based); managers use
  "Awaiting my approval"
- Tickets created directly in the old Managers group have no team to go back to (dev: #885944) → invisible
  until moved by hand
- The triggers "Auto Select Priority (New) - P1…P4" replace the priority chosen on the New ticket screen
- Patched a Zammad bug in `TicketList.vue` (onActivated): coming back to the kept-alive Tickets page with another
  view refetched the old one at the same time, so the tickets query went out without an overview (error on
  "View team" from the Dashboard). Keep the patch when merging Zammad updates unless they fixed it
- The student New ticket wizard (Taxil's `CustomerTicketCreateWizard.vue`, the default for students) has no tests;
  Zammad's create spec covers the students' full form (`?mode=form`) only
- The staff ticket layout edits more Zammad files (`TicketDetailViewContent.vue`, `TicketSidebar.vue`,
  `TicketSidebarWrapper.vue`, `TicketSidebarContent.vue`, `ArticleReply.vue`, `TopBarHeaderFull.vue`, `LayoutContent.vue`,
  `useResizeGridColumns.ts`): expect conflicts when merging Zammad
- Request forms edit one line of Zammad's `useTicketCreate.ts` (the answers go with the first message): expect a
  conflict there when merging Zammad
- `eslint --fix` on whole folders rewrites other people's files: Zammad's translatable-string autofix wraps object
  keys in `__()`, which broke the wizard's category tables once (10 Oct, restored). Only fix files you changed.
  Not behaviour-safe either: `vue/attributes-order` (the order of `v-model`, handlers and `v-bind` objects decides
  which runs first and which wins), `import/order` (CSS and side-effect imports) and `zammad-tailwind-ltr`. Turning a
  rule off with `--rule … off` while fixing makes ESLint delete that rule's `eslint-disable` comments as unused.
  The 14 Oct tidy used only `arrow-body-style`, `prefer-template` and the copyright header
- Taxil's wizard writes its own "Category: … / Campus: …" lines into the description, under the Request details
  block (to tidy with request forms step 4)
- Queue: Mine / Unassigned only filter the tickets loaded so far (30 per page)
- `/manage/overviews`: 45 old accessibility lint errors in Taxil's edit drawer (labels not linked to fields)
- This container picks up Node 22 from `.mise.toml` (project needs 24): pnpm warns "Unsupported engine"
- Customers (students, and managers who are also customers) are offered every active group on New ticket while
  `customer_ticket_create_group_ids` is empty, including the Managers group where approvals wait (nobody sees
  tickets created there) → set that setting to the real teams (suggested: Unassigned Tickets only). Core workflow 21
  ("First ticket goes to Unassigned Tickets") did that before; the staff form loads fine with it on (checked 7 Oct),
  so the production step to switch it off needs rethinking
- Student ticket wizard fails silently when a required field (Group, Sub-Category) is empty
- `package.json` → `resolutions` (loader-utils, postcss, stylelint-config-recommended) does nothing: pnpm 11 only reads
  overrides from `pnpm-workspace.yaml`. postcss is still 8.5.19, which Snyk flags
- Staff get Zammad's "New desktop BETA UI … not ready for production use" pop-up once per browser after signing in
  (`useBetaUiDisclaimer.ts`), although the new UI is now the main one at `/`; not decided yet whether to drop or
  reword it

## In progress

- Request forms rework (see DECISIONS.md): steps 1–3 built on 10 Oct (headings and notes, Request details block, the
  form's own questions), step 4 too (Subject at the top of the form, no Description while a form applies). Next:
  step 5 the agents' Request details panel on New ticket, step 6 file uploads and conditions. The admin editor is not
  yet checked in a browser (`admin@example.com` signs in with the dev password since 13 Oct)
- Ticket sidebar's Subscribers panel is called Contributors and has no "Subscribe me" toggle (11 Oct): people get on
  the list only through @mentions and can't take themselves off in the new UI (the classic UI still can). It sits
  right below the SLA card; the Accounted time section is gone from the sidebar (time accounting itself still works).
  The editor's @ button reads "Add contributor" (staff only; the mobile app's button still says "Mention user")
- Confirmation dialogs (Unsaved changes, Delete object, Yes/Cancel; 11 Oct): Student Hub layout with an icon badge
  (amber unsaved, red delete, application colour otherwise), "Keep editing" / "Discard changes", main button in the
  application colour. Other dialogs keep Zammad's look. Not yet checked in a browser
- New UI at `/` (11 Oct; README → The new UI is served at /): `/` and its pages open it, `/desktop/…` redirects (302),
  unknown page addresses show the new UI's own "not found" (only the server's paths such as `/api` keep the 404).
  OpenID Connect logouts still return to `/desktop/login` (must match the provider's registered address; redirects).
  Not yet checked in a browser or deployed
- Departments (admin section, 11 Oct): name, locations (values of the ticket's Campus field) and one email address;
  on/off switch (off by default) that also shows students "Talk to Student Support" (still opens the ticket wizard);
  what departments and that button do comes next (README → Departments)
- Reporting redesign (design A, 12 Oct): replaces Taxil's page. Not yet checked in a browser: in this container only
  `admin@example.com` may open Reporting (it signs in with the dev password since 13 Oct)
- Approval tab redesign (design B, 12 Oct): checked in headless Chromium as agent@ on #886840 (approved) and a ticket
  without requests; the waiting states (Withdraw, Approve / Deny) only in tests, as the dev data has no waiting request
- Work PC dev DB holds a restore of the test server (3 Oct dump; real student data; email channels,
  webhooks and LDAP switched off; fqdn = localhost:3000). Dump file is in git-ignored `tmp/`.
  Feedback Collection and Ticket Approvals are switched on there for testing (no channel can send);
  dev-only test users agent@, manager@ and <student@example.com> and `[TEST]` tickets #886839/#886840
- Work PC container: headless Google Chrome + Chrome DevTools MCP (user-level; redo after a rebuild)
- Home PC container: Debian's `chromium` (apt) for browser checks with playwright-core outside the repo (redo after a
  rebuild); dev reached from Windows through VS Code's port forwarding (the `studenthub-port-relay` container is gone).
  Chrome DevTools MCP works here too (12 Oct), and `admin@example.com` signs in (only refused on the work PC)
- New UI redesign from `studenthub-newUI`, merged into `develop` on 6 Oct (not yet deployed): colour setting, navigation
  panel, top bar,
  sign-in page, ticket lists (Teams views, Group by, colours), ticket screen, New ticket screen, manager
  dashboard, loading screen, approvals rework. Dev DB: core workflows 21, 58 and 55 switched off (New ticket
  form failed to load); Managers role given overview access before the waiting-group change.
  Overviews admin page reworked (on/off switch, reorder keeps order numbers, locked Teams views) — not yet
  checked in a browser
- Dev DB (this container, 6 Oct): branch migrations run; Admin role is now an agent role (Teams sync);
  dev-only test users agent@ (Agent : Service Desk), manager@ (Managers), <student@example.com>, password `test`.
  9 Oct: core workflows 55 and 58 (old approval) switched off, 21 stays on; the old "Manager Approval Status" field
  doesn't exist in this DB, so 58 made every New ticket form fail to load (500 on `formUpdater`)
- Dev DB (this container, 12 Oct): `es_url` points at the devcontainer's Elasticsearch (`http://elasticsearch:9200`)
  and the search index is rebuilt, so search and Reporting work here. After restoring a test-server dump, set it again,
  wait until the background jobs are done (`Delayed::Job.count` is 0; a rebuild alongside them failed), then run
  `bundle exec rake zammad:searchindex:rebuild`
- Home PC (7 Oct), merged into `develop`, not yet deployed: New ticket for managers, top bar crumbs, role under the
  logo, Members page, no self-registration, silent in-app notifications, manager sites, Dashboard in production
  builds, scrolling on small screens fixed, and the classic features moved to the new UI (Knowledge Base + search,
  Scheduler, Roles, LDAP, feedback panel, Public Links, Ticket States / Priorities, Tags; checked in a browser on the
  dev data except a real LDAP connection). Dev DB (home PC): manager@ has FSB; test tickets #886850 (Service Desk)
  and #886851 (Unassigned Tickets); #886852 (closed, rated 4, reopened) and #886853 (wizard) from testing the
  student column; add_internal_note switched off. Dev reachable on Windows via the `studenthub-port-relay` container
- Test server switched to this repo on 2 Oct (`develop` at `f8f9b99dc9`). The logo build fix is
  applied there by hand (uncommitted); nginx `/cable` + `/ws` now forward the Host header; old
  branding edits are in `git stash` and `~ticketadmi/server-branding/` (old `custom.css` in `disabled-live/`)
- Ticket list group headers (12 Oct, concept 1 "Quiet table" from the ticket list design canvas): the agent's avatar,
  a count chip and "N overdue" (loaded tickets only), Unassigned tinted with a dashed circle; quieter column headings
  in every ticket list. Columns stay as the overview's admin settings; the concept's filter chips, Columns button,
  two-line ticket cell and subtitle were left out on purpose. Not yet checked in a browser
- Checklist tab redesign (design B, 13 Oct): steps timeline, state chip, Next + Mark done, who ticked; tick-only for
  agents. Not yet checked in a browser (no dev ticket has a checklist; add one to a `[TEST]` ticket's sub-category).
  The classic UI still shows its add / edit buttons for checklists; the server refuses them for agents
- Triggers, Macros, SLAs, Report Profiles and the Time Accounting selector use the Scheduler's condition and action
  editor (12 Oct): trigger fields (Action, the message, Customer is VIP, "has changed"), expert-mode groups (also in
  the Scheduler), Set title and Set customer. Templates still edit only some fields and keep the rest. Before, those
  editors saved only their few fields and Zammad replaced the whole set (emails, webhooks, tags, notes and other
  conditions were deleted). Not yet checked in a browser (`admin@example.com` signs in since 13 Oct)

## Next steps

- [ ] Test and production servers: the next deploy runs the 20261013120000 migration, which takes `admin.*`
      permissions off customer-only roles; check its output ("Customer: removed …") to see whether students had any.
      Other dev databases get it with `bin/rails db:migrate`
- [ ] Set up the same environment on the home PC (check data-protection rules before copying real data)
- [ ] Test server: stash the hand-applied logo fix, install the deploy script, run the first scripted deploy
- [ ] Rehearse the first production deploy on a fresh clone of the production VM, then do it
- [ ] New UI at `/`: reinstall the deploy script on the test server (it now follows `/desktop/login` → `/login`) and
      run `script/studenthub/test/deploy_test.sh` there (needs `initdb`, missing in the container); after deploying,
      check `/` signed out and in, an old `/desktop/…` link, a `/#ticket/zoom/<id>` email link, Microsoft sign-in, a
      password-reset email, `/app` and a phone
- [ ] Test server: start Elasticsearch; `chmod 600 /etc/zammad/zammad.env`
- [ ] Decide on the theme switch Taxil removed (review findings: `/manage` saves fixed 13 Oct, "%s" messages 14 Oct)
- [ ] Remaining Snyk Open Source findings (JavaScript): qs (direct; 6.16.0 fixes), and ws, nanoid, tmp, esbuild,
      postcss, brace-expansion through other packages (a refresh within their ranges, or overrides in
      `pnpm-workspace.yaml`)
- [ ] Check the reply box in a browser after the 12 Oct tiptap update (3.27.4 → 3.30.5): bold, links, lists,
      tables, @mentions, pasted images
- [ ] Templates editor: all the New ticket fields (message text, Category, …) instead of five; it keeps the rest
      for now
- [ ] Test and production servers: check that Postgres doesn't use Zammad's default password (Taxil committed it in
      `config/database/database.yml` and his public repo; the sample is back to Zammad's, 14 Oct); change it if it does
- [ ] Feedback Collection go-live (README → Feedback Collection): pick the sending channel, give
      `it@studenthub.ac` Send As on `feedback@`, import `feedback_tokens.json`, remove the webhook action
      from trigger 40 and job 10, add the nginx redirect, delete the PHP files
- [ ] Ticket Approvals go-live (README → Ticket Approvals): turn it on (takes over the Managers group), retire
      the old approval setup (auto-"Pending" workflow, workflow 57, old field, overview, trigger 65), check the
      team-change triggers 31/32/35
- [ ] Production: switch off the two old approval core workflows (before hiding their field, or New ticket breaks);
      decide on "First ticket goes to Unassigned Tickets" vs the `customer_ticket_create_group_ids` setting
- [ ] Decide: should "5. Resolved" count as open on the dashboards
- [ ] Decide: the Teams views' first group "Unassigned tickets" clashes with the team "Unassigned Tickets"; rename
      the label (suggested: Needs an agent, Not yet assigned) or the team
- [ ] Decide: keep or change the Auto Select Priority triggers
- [ ] Test server: check the moved pages with real data, and the LDAP wizard against the real directory (trial run
      first; dev has no LDAP server)
- [ ] Check the Sub-Category core workflows on the test server: since 12 Oct the student wizard follows them like the
      staff form, and in the home PC dev data "Sub-Category : Service request" (45) also offers VPN Access, Wi-Fi
      Access, MS Office Suite and 7 more that Taxil's wizard had only under Software / Hardware
- [ ] Reporting needs Elasticsearch on the servers: set it up on the test server and check production has it
- [ ] Home PC (and the work PC if it's still on C:): move the repo to the Ubuntu file system
- [ ] New UI: student portal look still to do; check the Overviews admin page in a browser
- [ ] Check the manager dashboard in a browser as manager@ with a waiting request (without one: checked 12 Oct, in
      the same frame as Team overview and My work); decide whether to commit `PRODUCT.md`
- [ ] Check Close moving on to the next ticket in a browser (not tried on the dev data; covered by unit tests)
- [ ] Check the navigation (design C) in a browser: rail labels fit, panel on Tickets / ticket screens / Dashboard,
      Hide / Show panel, Recent from the rail while hidden, BETA UI switch, the light Recent tabs, a 1280 px ticket
      screen with queue + panel, the Dashboard panel (views, Needs attention, who is online) and the Members panel
      (filters, role groups, Sort by, Clear filters), the Knowledge Base panel (filter, tree, New category above the
      page), Recent collapsed after signing in, no panel on Administration and Reporting
- [ ] Check the reply box (option 1) in a browser: typing a first character, switching Reply / Internal note /
      Phone call with text, the box colours, Zammad's channel row and "Text" label gone, the toolbar under the text
      (⋮ for the rest), Reply all on an email with Cc, Ctrl + Enter, Esc, and that the box stops at half the window
- [ ] Check the Email / Web choice in a browser: Email by default, Web posts in the portal only and the student gets
      the notice email, switching keeps the text, Reply all only with Email, Email greyed out for a student without
      an address; run `bin/rails db:migrate` first (creates the trigger)
- [ ] Ask Taxil whether the whole-form reset he added to discarding a reply (30 Sep, removed 10 Oct because it
      undid unsaved ticket field changes) fixed something; if so, find another way
- [ ] Check Request forms in a browser as an admin: add a question, a heading and a note, publish, then raise a ticket
      under it as student@ and look at the Request details block and the saved answers
- [ ] Run `bin/rails db:migrate` (the departments table, permission and on/off setting), then check Administration →
      Manage → Departments in a browser: new, edit, delete, a taken name, a wrong email address (the on/off switch
      and the student button were checked with headless Chrome on 11 Oct, also live on an open student page)
- [ ] After deploying the checklist assignments: read the migration's output on the test server and production (one
      line per converted "Checklist : …" trigger; a trigger it couldn't convert is left as it was), then raise an
      Onboarding ticket and check it gets one checklist and the `checklist-checd` tag
- [ ] Check Branding → Sign-in page in a browser as an admin (the section itself; the sign-in page was checked with
      headless Chrome on 11 Oct): editing, the preview, Save, Use the default texts, a refused text
- [ ] Check the confirmation dialogs in a browser (light and dark): Unsaved changes (leave a ticket with a draft),
      Delete object, a Yes/Cancel one; then the ticket sidebar order (Details, SLA, Contributors, Tags…) and the
      "Add contributor" button and its search box
- [ ] Check the new Details step in a browser as student@: the Your request card and its Change buttons, Subject at the
      top of the form, no Description with a form (and the message still reads well), stacking on a phone
- [ ] Check Reporting in a browser as an admin (light, dark and narrow): the profile list, its counts and Find a
      profile, each measure, every period and ‹ ›, the chart's readout and backlog row, the ticket tabs, Show more,
      Download Excel and Live
- [ ] Check the Approval tab while a request waits: Withdraw as the agent who asked (and its confirmation), Comment
      and Approve / Deny as the manager, the "Waiting · …" chip, dark mode
- [ ] `lucide-vue-next` is no longer imported anywhere (its only users, unused `components/ui` parts, were deleted
      on 14 Oct): remove it from `package.json`
- [ ] Decide: uninstall the claude-security plugin? It adds about 780 tokens to every Claude Code request, and its
      scans need workflows this account doesn't have (security reviews are done by hand instead)
