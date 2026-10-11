# New UI at `/`: every file changed, and how to undo it

On 11 Oct 2026 the new UI moved from Zammad's `/desktop` to the home address `/`. Before that, `/` served the classic UI
and the new UI lived under `/desktop/…`. The classic UI stays at `/app` (and `/init`). README → "The new UI is served
at /" describes how it works now.

## Restore point

- Git tag **`before-new-ui-at-root`** = commit `1df5ef110d`, the last commit before the move (pushed to GitHub).
- The move itself is one commit on `develop` (the one that adds this file; `git log -- .dev/new-ui-at-root.md`).

## How to undo it

All of it (the usual way, keeps history; `develop` takes merge commits only, a revert is fine):

```sh
git revert <commit that added .dev/new-ui-at-root.md>
```

then deploy as usual (`studenthub-deploy`). No migration was added, so the database needs nothing.

One file only (e.g. to put back Zammad's original):

```sh
git checkout before-new-ui-at-root -- <path>
```

After an undo:

- `/` is the classic UI again and `/desktop/…` the new UI. The `/desktop/…` → `/…` redirect was a 302, so browsers
  don't keep it.
- Links sent while the new UI was at `/` (`/tickets/1`, `/reset-password/verify/…`, `/signup/verify/…`, `/login?token=…`
  in emails) no longer exist and answer 404. Ask people to request a new password-reset or sign-up email.

## Files changed

### Which addresses open the new UI

| File | Before | After |
|---|---|---|
| `lib/studenthub/new_ui_at_root.rb` (new) | — | The server's own paths (`/api`, `/assets`, `/auth`, `/mobile`, `/help`…), the classic UI's pages (`/app`, `/init`), and safe sign-in returns |
| `config/routes.rb` | `root to: 'init#index'` (classic UI at `/`) | `root to: 'desktop#index'`; a catch-all before Zammad's 404 route sends every other page address (GET, HTML, not a server path) to the new UI |
| `config/routes/desktop.rb` | `/desktop` and `/desktop/*path` served the new UI | `/desktop(/*path)` redirects (302) to the same path and query without `/desktop` |
| `app/controllers/sessions_controller.rb` | After a Microsoft (or other) sign-in: `/desktop<redirect>` from the new UI, else `/#` (classic) | From `/app` or `/init`: `/app#` (classic); else the new UI's `redirect` parameter at `/` (only a path on this server, never `//other.site`), else `/` |

### Links the server builds

| File | Before | After |
|---|---|---|
| `app/services/service/user/password_reset/send.rb` | `…/desktop/reset-password/verify/<token>` | `…/reset-password/verify/<token>` |
| `app/services/service/user/signup.rb` | `…/desktop/signup/verify/…`, `…/desktop/reset-password/verify/…` | `…/signup/verify/…`, `…/reset-password/verify/…` |
| `app/services/service/auth/send_admin_token.rb` | `…/desktop/login?token=…` | `…/login?token=…` |
| `lib/studenthub/web_reply_notice.rb` | Notice email links to `…/desktop/tickets/<id>` | `…/tickets/<id>` (only for a newly created trigger: the test server's existing trigger keeps `/desktop/…`, which redirects) |
| `lib/studenthub/exchange_return.rb` | Back from Microsoft to `/desktop/manage/system/integrations/exchange` | `/manage/system/integrations/exchange` |
| `app/controllers/feedback_collection_controller.rb` | Comment: page under `/desktop/manage` | `/manage` (comment only) |

### The new UI (frontend)

| File | Before | After |
|---|---|---|
| `app/frontend/apps/desktop/router/index.ts` | Router base `desktop` | `/` |
| `app/frontend/shared/composables/useHtmlLinks.ts` | Links inside messages: prefix `/desktop` | Prefix `''` (served at `/`): a same-server link opens in the app when the router knows the page (old `/desktop/…` links too); attachments, the API and the like open normally |
| `app/frontend/apps/desktop/pages/ticket/components/TicketDetailView/ArticleBubble/ArticleBubbleBody.vue` | `useHtmlLinks('/desktop')` | `useHtmlLinks('')` |
| `app/frontend/apps/desktop/components/CommonInlineEdit/CommonInlineEdit.vue` | `useHtmlLinks('/desktop')` | `useHtmlLinks('')` |
| `app/frontend/shared/entities/ticket-article/action/plugins/articlePermalink.ts` | Permalink `…/desktop/tickets/<id>/<article>` | `…/tickets/<id>/<article>` |
| `app/frontend/apps/desktop/pages/ticket/components/TicketDetailView/TicketDetailTopBar/components/useTopBarHeader.ts` | Copied ticket link `…/desktop/tickets/<id>` | `…/tickets/<id>` |
| `app/frontend/apps/desktop/pages/user/components/UserDetailTopBar/useTopBarHeader.ts` | Copied user link `…/desktop/users/<id>` | `…/users/<id>` |
| `app/frontend/apps/desktop/pages/organization/components/OrganizationDetailTopBar/useTopBarHeader.ts` | Copied organization link `…/desktop/organizations/<id>` | `…/organizations/<id>` |
| `app/frontend/apps/desktop/pages/manage/views/Overviews.vue` | View tickets: `router.push('/desktop/ticket/view/…')` (opened "not found" even before) | `router.push('/ticket/view/…')` |
| `app/frontend/apps/desktop/components/BetaUi/composables/useBetaUi.ts` | "Back to the old UI" went to `/` | `/app` |

### Deploy script

| File | Before | After |
|---|---|---|
| `script/studenthub/deploy.sh` | Checked the build with `curl -s …/desktop/login` | `curl -sL` (follows the redirect to `/login`; still works after a rollback, when `/desktop/login` answers directly). Reinstall the script on each server (README → Installing it on a server) |

### Tests

| File | Change |
|---|---|
| `spec/requests/studenthub_new_ui_at_root_spec.rb` (new) | `/`, a page, `/app`, the `/desktop/…` redirect, server 404s, safe sign-in returns |
| `spec/requests/error_spec.rb` | Zammad's HTML 404 page is checked under `/api/…`; other unknown page addresses now open the new UI (its own "not found") |
| `spec/requests/session_spec.rb` | Sign-in returns to `/` (was `/#`); a sign-in from `/app` returns to `/app#` |
| `spec/support/capybara/common_actions.rb` | Browser tests open and check new UI pages without `/desktop` |
| `spec/system/apps/desktop/registration_spec.rb`, `…/ticket/edit_spec.rb`, `…/personal_setting/online_notifications_spec.rb` | Addresses without `/desktop` |
| `spec/graphql/gql/mutations/admin_password_auth_send_spec.rb`, `…/user/password_reset/send_spec.rb`, `…/user/signup_spec.rb`, `spec/services/service/user/password_reset/send_spec.rb`, `spec/services/service/user/signup_spec.rb`, `spec/lib/studenthub/web_reply_notice_spec.rb`, `spec/requests/studenthub_integrations_spec.rb` | Email and return links without `/desktop` |
| `app/frontend/tests/support/components/renderComponent.ts` | Test router base `/` (was `/desktop`) |
| `app/frontend/tests/support/components/visitView.ts` | Adds the leading `/` to addresses such as `tickets/view/…` (needed without a base) |
| `app/frontend/shared/composables/__tests__/useHtmlLinks.spec.ts` | Prefix `''`; old `/desktop/…` links; server links left to the browser |
| `app/frontend/apps/desktop/components/BetaUi/composables/__tests__/useBetaUi.spec.ts`, `…/components/layout/__tests__/LayoutPage.spec.ts` | "Back to the old UI" goes to `/app` |
| 19 more frontend tests (`CommonBreadcrumb`, `CommonAdvancedTable`, `StudenthubQuickSearchKnowledgeBase`, `UserTaskbarTabs`, `StudenthubNav`, `login-password-login`, `StudenthubDashboards`, `StudenthubManagerDashboard`, `StudenthubKnowledgeBase`, `organization-detail-view`, `ticket-overviews`, `TicketOverviewsSidebar`, `ChecklistBadgeList`, `TopBarHeaderFull`, `TicketSimpleTable`, `StudenthubTicketQueue`, `TicketSidebarInformationContent`, `user-detail-view`, `action-articlePermalink`) | Expected link addresses without `/desktop` |

### Documentation

| File | Change |
|---|---|
| `README.md` | Section "The new UI is served at /"; page addresses without `/desktop`; dev URLs |
| `.dev/new-ui-at-root.md` (new) | This file |

## Left as they were, on purpose

| File | Why |
|---|---|
| `app/graphql/gql/mutations/concerns/logout/handles_oidc_authorization.rb` | Sends OpenID Connect logouts back to `/desktop/login`, which must match the address registered at the provider; it now redirects to `/login` |
| `config/initializers/doorkeeper.rb`, `lib/omni_auth/strategies/saml_database.rb` | Their "not from `/desktop`" branch already lands on `/` (now the new UI) |
| `app/assets/javascripts/app/controllers/_plugin/desktop_beta_switch.coffee` | The classic UI's switch to the new UI goes to `/desktop/#…`, which redirects to `/` and keeps the `#…` |
| `app/frontend/apps/desktop/pages/manage/routes.ts`, `views/Manage.vue` | Mention `/desktop/settings` and `/desktop/system`; harmless, as the server redirects `/desktop/…` first |
| Zammad's email templates (`app/views/mailer/…`) | Link to `/#ticket/zoom/<id>`, which the new UI opens |
