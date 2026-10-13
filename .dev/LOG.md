# Log

What was done, one line per change, newest at the bottom. Not loaded into the AI context;
the current state is in `.dev/NOTES.md`.

- 2026-09-29: Set up WSL/Ubuntu + Docker + devcontainer on work PC; updated README with Windows setup
- 2026-09-30: App running on work PC; restored test-server DB locally; read-only review of Taxil's changes
- 2026-10-02: Deploy key for test server; removed `auto_wizard.json` from repo; merged Taxil's reports/ticket-wizard
  commit (PR #2)
- 2026-10-02: Switched the test server to this repo; fixed the production build (logo paths only worked
  in dev); added `script/studenthub/deploy.sh` with tests
- 2026-10-03: Restored the 3 Oct test-server dump locally (outbound channels and webhooks off); merged
  Taxil's admin-parity commit (PR #3); built native Feedback Collection
- 2026-10-04: Built Ticket Approvals (classic + new UI); compared classic admin with `/manage` (8 pages
  missing); installed headless Chrome + Chrome DevTools MCP in the work-PC container
- 2026-10-04: Started the Halo-style new UI on `studenthub-newUI`: admin-selectable application colour,
  navigation panel + top bar, new sign-in page (Microsoft button now works)
- 2026-10-05: New UI ticket lists, ticket screen and New ticket screen; manager dashboard and views;
  loading screen
- 2026-10-06: Approvals: waiting group, only the chosen manager sees it, SLA pause; Teams views with per-agent
  grouping; Recent without ghost tabs; student ticket view; colours and icons from UI/UX Pro Max;
  pushed `studenthub-newUI`
- 2026-10-06: Teams only for the agent's own groups, none for managers, all for admins; Overviews admin page:
  on/off switch, table fixes, Teams views locked; merged `studenthub-newUI` into `develop`
- 2026-10-06: Top bar shows "Tickets / `<group>` / Ticket#…" on ticket pages (group links to its Teams view);
  a page leaving no longer clears the next page's breadcrumbs
- 2026-10-06: Approval overviews managed by the system (follow the Ticket Approvals switch, locked on the
  Overviews page, hand changes undone); dev DB: switched back on
- 2026-10-06: Ticket screen: no compact header sliding in at the top while scrolling (the top bar has the ticket number)
- 2026-10-06: Institutions views by organisation (every active one), managed by the system; dev DB migrated
- 2026-10-06: Institutions views renamed **Sites** in the UI and docs (code, links and keys keep "institution")
- 2026-10-06: Sign-in page: logo, text and supported institutions centred in the brand panel
- 2026-10-06: Group by menu no longer offers Approval (it broke the view); saved groupings no longer offered fall back
  to the view's own
- 2026-10-07: Manager New ticket and sites, Members page, top bar crumbs, no self-registration, silent
  notifications, Dashboard in production, small-screen scrolling; moved Knowledge Base (+ search), Scheduler,
  Roles, LDAP, feedback panel, Public Links, Ticket States / Priorities and Tags to the new UI
- 2026-10-08: Navigation icons (Tickets, Dashboard, Reporting), Dashboard first; student ticket column (close,
  reopen, rate, files); feedback admin-only; new agent Briefing and admin Team overview dashboards; owl logo,
  Exchange / S/MIME / PGP pages, visible text rebranded to Student Hub
- 2026-10-08: Manager dashboard redesigned (3C-5): queue + request card with Approve / Deny, All caught up and month
  in review when empty; dashboard API returns the waiting requests and month figures. Not yet checked in a browser
- 2026-10-08: Fixed new databases (devcontainer setup failed: Ticket Approvals migration created the Managers role
  before user #1 existed); Student Hub records now come after `db:seed` there
- 2026-10-08: Fixed the new UI's stylesheet: the merge `ed514cb3a7` dropped a `}` in `studenthub-halo.css`, so
  Tailwind failed on `main.css` (new UI unstyled in dev, frontend build failed)
- 2026-10-08: Agent dashboard: "Unassigned in your teams" (a card per team with its unassigned open tickets, overdue
  count, the three waiting longest, link to the Teams view). Not yet checked in a browser
- 2026-10-08: Recent lists the newest tab on top (Zammad's order flipped); the unassigned team cards share the full
  width when there are only one or two
- 2026-10-08: Staff land on the Dashboard after signing in (and on `/`); students keep their ticket list
- 2026-10-08: "Sent for approval" no longer goes to the Admin role (agents keep it)
- 2026-10-08: Fixed "View team" on the Dashboard (Zammad bug when returning to Tickets with another view)
- 2026-10-08: Dashboard switch has Approvals for managers who also have another dashboard (up to three views).
  Not yet checked in a browser
- 2026-10-08: Staff ticket screen: queue of a view beside the ticket (option B), panels in one column on the right,
  next ticket after closing
- 2026-10-09: Option B's conversation and right column too: compact header, docked reply bar, panel tabs Ticket /
  Student / Checklist / Approval; a long panel no longer stretches the screen under the Update bar; Update moved to the
  foot of the panel column (save area with unsaved note, After update, Update). Checked in a browser (headless
  Chromium in this container, 1280 and 1440 px)
- 2026-10-09: Messages lose their Reply / Follow up for staff (the reply bar answers the student); four reply box
  designs on a board, not chosen yet
- 2026-10-09: Reply box option A built: text box with Reply / Internal note at rest, Zammad's editor in the same box
  while writing (amber for notes, Send = Update, Ctrl + Enter, Reply all moved in from the messages). Not yet
  checked in a browser (no headless browser in this container)
- 2026-10-09: New ticket failed to load (500): old core workflow 58 pre-selects the removed "Manager Approval Status"
  field. Switched 55 and 58 off in this dev DB; README go-live step 2 now says to switch them off before hiding the field
- 2026-10-09: Navigation design C: rail + panel (ticket views and Recent in the panel, role on top, BETA UI switch at the
  foot); the Tickets page's views column removed. Not yet checked in a browser
- 2026-10-09: Maroon (#7e0707) replaces the Cobalt preset of the application colour; Dashboard breadcrumb names the
  chosen dashboard; Dashboard panel: dashboard switch, Needs attention and who is online (instead of Recent)
- 2026-10-09: Members panel: Show / Roles / Teams filters with online counts instead of Recent; the page groups by role,
  Sort by Name / Last active, names the filters in use with Clear filters. Not yet checked in a browser
- 2026-10-09: README and NOTES no longer loaded into every AI request (CLAUDE.md points to them); the log moved
  from NOTES to `.dev/LOG.md`; Zammad's Claude hooks switched off in this container
- 2026-10-09: Recent in the navigation panel starts collapsed after each sign-in; opened or closed, it stays so until
  signing out (session storage of the tab). Not yet checked in a browser
- 2026-10-09: Knowledge Base panel: title filter and category tree instead of Recent (Recent from the rail); New
  category and language above the page while the panel shows; the page's own column only while the panel is hidden.
  Not yet checked in a browser
- 2026-10-09: No navigation panel on Administration and Reporting (it only held Recent); Recent from the rail there.
  Not yet checked in a browser
- 2026-10-09: Rail icons all the same size: outline icons for KB, Members and Admin in the style of Dashboard,
  Tickets and Reports (Zammad's filled book, people and gear stay elsewhere)
- 2026-10-09: Request forms: admins attach extra ticket fields to a Category › Sub-category (draft / publish,
  preview, who it is for); the student wizard shows them, every other ticket form gets them by core workflow
- 2026-10-09: Students reply in the docked reply box under the messages with the compact header; Subscribers
  listed with avatar and full name
- 2026-10-10: Staff reply box redesigned (option 1 of <https://claude.ai/artifact/3JzJfNe582BUwGe1knpdLc>): Reply /
  Internal note / Phone call as tabs above the text (Phone call new, light blue, Save call), the box in the mode's
  colour, Zammad's channel row and "Text" label hidden, the editor flat with its toolbar under the text and trimmed to
  the common tools (the rest under ⋮). Not yet checked in a browser
- 2026-10-10: Zammad's New ticket, ticket screen and Tickets page specs rewritten for the Student Hub screens (50
  tests that failed on their own: new labels, panels, Recent, the reply box, the student Tickets page)
- 2026-10-10: Discarding a reply no longer undoes unsaved ticket field changes (a whole-form reset added on 30 Sep put
  them back; caught by Zammad's spec)
- 2026-10-10: Request forms: headings and notes between the fields (a form is now an ordered list of items; today's
  form converted by migration); the preview draws headings and notes alone too
- 2026-10-10: Request forms: the server writes a Request details block (the form's headings and answers) at the top of
  a ticket's first message and records the form version; mail-channel emails are left as they are
- 2026-10-10: Request forms: a form's own questions (label, type, options, help, required), made in the editor's New
  question panel; answers go with the first message, are checked on the server and saved by Student Hub, so
  publishing needs no restart. Student wizard checked in a browser with a test form (nothing written); the admin
  editor not yet
- 2026-10-10: Dashboards: the Refresh button uses the new arrow-clockwise icon (Bootstrap), which also gives the
  Overviews page's Refresh button its missing icon
- 2026-10-10: Ticket screen: agents send a reply by Email (default) or Web, picked next to Send; Email is greyed out
  without an address. A web reply emails the student a notice with a link (new trigger, Studenthub::WebReplyNotice)
- 2026-10-10: Student wizard Details step: a Your request card (steps taken, Change) beside the form; with a request
  form the Subject is at its top and the Description is gone. The admin preview matches
- 2026-10-10: Request forms: a question or field can be Half width (two side by side where the form is wide enough);
  the student's form lays its items out in a grid
- 2026-10-10: Navigation panel: the group headers (Views, My views, Teams, Sites, Show, Recent…) are bold
- 2026-10-11: Student's own ticket screen in the portal's green (#15803d) instead of the application colour
  (`.sh-student-ticket` on TicketDetailViewContent)
- 2026-10-11: Administration → Manage → Departments: departments with a name, locations (Campus field values) and one
  email address (`studenthub_departments`, permission `admin.departments`)
- 2026-10-11: Devcontainer: Elasticsearch heap 1 GB → 512 MB, container capped at 2 GB RAM and 2 CPUs
- 2026-10-11: Removed `.claude/SKILL.md` (copy of the generic frontend-design skill, never loaded), the
  `frontend-design` plugin from `.claude/settings.json` and `.claude/ui-rules.md` (old navy/blue classic-UI theme)
- 2026-10-11: Branding → Sign-in page: admins set the sign-in panel's heading, tagline and description
  (`studenthub_login_panel`); the sign-in heading reads "Sign in to <Product Name>"
- 2026-10-11: Sign-in page: "Welcome back" and "Use your work or school account."; person and lock icons in the
  Admin / Local Login fields
- 2026-10-11: Departments: on/off switch (`studenthub_departments`, off by default) on the admin page; students see
  "Talk to Student Support" only while it is on
- 2026-10-11: Fix: the Teams / Sites / manager-site views sync no longer renumbers every other overview when it moves
  a view, which made it run without end after any change of order (work PC: puma near 100% CPU, no live updates)
- 2026-10-11: Checklists added automatically: admins assign checklists to Category › Sub-category on the Checklists
  page; the migration turned the four webhook triggers into assignments (they keep their tag action)
- 2026-10-11: Sign-in page: the local login fields keep their whole focus glow, have no blue outline, stay white when
  the browser fills them in, and their icons take the application colour while typing
- 2026-10-11: Faster dashboard: the Team overview counts online staff without building the Members list, the Members
  list is fetched once for all parts shown together, and it looks up everyone's teams at once
- 2026-10-11: Reporting shows Zammad's real reports again: asks with the CSRF token (was refused), no made-up
  "database mode" figures, says why when Elasticsearch or report profiles are missing, real ticket states, icons
- 2026-10-11: Ticket sidebar: Subscribers is now Contributors, a list only (no "Subscribe me" toggle; people are added
  by @mentions)
- 2026-10-11: Confirmation dialogs redesigned: icon badge beside a bold title, the message under it, "Keep editing" /
  "Discard changes" on a footer band, main button in the application colour
- 2026-10-11: Ticket sidebar: Contributors right below SLA, no Accounted time section; the editor's "Mention user"
  button is now "Add contributor" (staff only)
- 2026-10-11: The new UI is served at `/` instead of `/desktop` (old `/desktop/…` links redirect, the classic UI is at
  `/app`); restore tag `before-new-ui-at-root`, every changed file in `.dev/new-ui-at-root.md`
- 2026-10-12: Devcontainer: Elasticsearch gets 3 CPUs and a 1 GB heap (was 2 CPUs and 512 MB; the cap stays 2 GB)
- 2026-10-12: Reporting redesigned (design A, "filter column"): report profiles in one list with their counts, the
  measure and the period (‹ › steps) on the left; figures, a created / closed chart with the backlog change and the
  tickets behind each series (Show more, Download Excel) on the right
- 2026-10-12: Dashboard: Approvals sits in the same frame as Team overview and My work (up to 1440 px wide, the same
  margins, a 24 px heading)
- 2026-10-12: Approval tab redesigned (design B): a state chip, a timeline of every request and decision (newest
  first) with Withdraw or Approve / Deny on the waiting step, "Send for approval again", white fields and buttons in
  the application colour; the approval API returns each request's team
- 2026-10-12: Ticket lists (concept 1 "Quiet table"): group headers with the agent's avatar, a count chip and
  "N overdue", the Unassigned group tinted with a dashed circle; quieter column headings (small capitals on a light
  rule); the overview list query also returns the owner's names and photo for the avatar
- 2026-10-12: Checklist tab: "No checklist assigned to this ticket." when there is none, and "Add <name> checklist"
  when the ticket's Category › Sub-category has one (tickets that were there before the assignment);
  `GET /api/v1/studenthub/checklist_assignments/ticket/:ticket_id` for agents who can see the ticket
- 2026-10-12: Triggers, Macros, Templates, SLAs, Report Profiles and the Time Accounting selector keep what their
  editor doesn't show (emails, webhooks, tags, notes, other conditions) when saved, and list it; before, a save
  deleted it. Expert-mode conditions are left as they are
- 2026-10-12: Triggers, Macros, SLAs, Report Profiles and the Time Accounting selector use the Scheduler's condition
  and action editor: trigger fields (Action, the message, Customer is VIP, "has changed"), expert-mode AND/OR groups
  (Scheduler too), Set title and Set customer; the choices API also gives message senders and types and is open to
  admins of those areas
- 2026-10-12: `/manage`: 12 actions that called missing API routes now work: Maintenance (both switches, the login
  message, the broadcast through Zammad's `message_send`), API (both access switches; the page's saves now send the
  CSRF token, as Maintenance's do), Facebook page edit (POST), MS Graph inbound edit (probe, then verify) and group
  change, the Knowledge Base and Branding language lists (new `GET /api/v1/studenthub/locales`), the Branding logo
  preview and the Checklists on/off switch (settings saved by id)
- 2026-10-12: The student wizard, the students' ticket list and the managers' New ticket read their categories,
  sub-categories and campuses from the new `GET /api/v1/studenthub/ticket_wizard_metadata` (the route they called
  didn't exist); sub-categories per category follow the core workflows, as on the staff form
- 2026-10-12: `/manage/knowledge_base`: the Languages tab and Public Menu show the knowledge base's languages, links and
  titles (the page read Zammad's data under the wrong names, so they were always empty), and removing a saved menu
  link works (Zammad wants every saved link listed, removed ones marked to be destroyed)
- 2026-10-12: Security (Snyk Code findings): names from requests that Zammad turns into classes only reach the
  classes meant for them (session events, external-credential providers, sign-in providers, recent views' models,
  SMS drivers; an unknown SMS adapter is now a 422); `/manage/users` "switch to user" only follows addresses on
  this site
- 2026-10-12: Security updates (Snyk Open Source): Rails 8.0.5 → 8.0.5.1, json 2.21.1 → 2.21.2, graphql 2.6.5 →
  2.6.11 (patch versions only); the editor (all @tiptap packages) 3.27.4 → 3.30.5, with overrides in
  `pnpm-workspace.yaml` so there is one copy of @tiptap/core and of prosemirror-model. GraphQL schema unchanged;
  GraphQL specs and the editor's specs give the same results as before
- 2026-10-12: `.dev/security-review.md`: every Snyk finding with its verdict (fixed / by design / false positive) and
  the reason; `.dcignore` keeps `spec/`, `contrib/` and `.dev/` out of Snyk Code (test passwords made ~420 findings)
- 2026-10-12: `/manage` pages, avatar menu and keyboard shortcuts: 198 icon names that don't exist in Zammad's icon
  set (Taxil's, e.g. `close`, `copy`, `clipboard`, `alert-triangle`, `edit`) replaced by existing ones (`x-lg`,
  `files`, `clipboard2`, `exclamation-triangle`, `pencil`); they showed as blank spaces
- 2026-10-12: Editor: the toolbar appears once tiptap has created the editor (no "Invalid prop: editor" warning)
- 2026-10-13: Tickets page: Zammad's row of view tabs above the list on small screens is gone; staff pick the view in
  the navigation panel on every screen size
- 2026-10-13: Checklists: agents only tick and untick items (server-enforced for the new UI, classic UI and API;
  `admin.checklist` keeps full control) and may add only the checklist assigned to the ticket's sub-category. The
  Checklist tab is now design B: a state chip, the steps on a timeline with Next + Mark done, who ticked each and when;
  with no checklist, only the assigned one is offered (with its first items)
- 2026-10-13: Signing out no longer throws errors in the console (Teleport target, `emitsOptions`, 403s for customer
  feedback and the Dashboard, "Authentication required" for the ticket list): the signed-in layout shows nothing
  while no one is signed in, so every page, the tabs kept alive in the background too, closes before it can ask the
  server again
- 2026-10-13: Browser tests with Playwright in `e2e/` (own packages, Chrome from the container): a student raises,
  follows, answers and closes a ticket over the web while staff answer through the API, can't see others' tickets,
  the Dashboard or Administration, and signs out without errors. They caught the dev Customer role having
  `admin.request_forms` (removed)
- 2026-10-13: Admin pages send Zammad's current security token with their saves (`getCSRFToken()`): Core Workflows
  and Monitoring sent none (always refused), about 40 others the one from page load (refused after signing out and
  in again without a reload)
- 2026-10-13: Browser tests for agents (`e2e/tests/agent-journey.spec.ts`): team view, queue, web reply, internal
  note, Assign to me + status + Update, the student's answer live, Close, what an agent can't open, signing out.
  They caught two bugs, fixed: leaving a ticket before its edit form had loaded mounted the form in the hidden tab
  (Teleport warnings, form parts not placed; the form's Teleports now wait while the tab is hidden), and closing a
  ticket could write an empty tab list into Apollo's cache ("Missing field 'userCurrentTaskbarItemList'")
- 2026-10-13: Bell notifications whose ticket was deleted no longer fail the whole list on sign-in ("Couldn't find
  Ticket"); they show as "You can no longer see the ticket." (`OnlineNotification#related_object` returns nil for a
  deleted object). Removed the 68 such notifications from the work PC dev DB (from the browser tests and the test server copy)
- 2026-10-13: Security review of Student Hub's server code, three fixes: old `/desktop/…` links can no longer send
  people to another site (`/desktop/%2Fevil.example`); the Exchange password mask no longer sends the stored password
  to a changed server or user; assigning sites to managers needs full `admin` (was `admin.ticket_approval`)
- 2026-10-13: New rule in `CLAUDE.md`: a security review of the changes before every commit, findings recorded in
  `.dev/security-review.md`
- 2026-10-13: ZAP baseline scan of the dev app as an agent (results in `.dev/security-review.md`). It found this dev
  database's Customer role still had `admin.request_forms`; a migration now takes `admin.*` permissions off
  customer-only roles on every server (`Studenthub::CustomerRoles`), run here
- 2026-10-14: Deleted 22 frontend files nothing in the app used (1,140 lines): Taxil's `AgentTicketCreateCard.vue`
  and 21 unused `components/ui` parts (badge, card, dialog, dropdown menu, input, select, tabs); `Button.vue` stays
