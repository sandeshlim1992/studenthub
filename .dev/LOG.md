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
