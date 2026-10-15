# Classic UI removal: what was switched off, how to undo it, what goes next

The classic UI (CoffeeScript, Zammad's original interface) was served at `/app` (and `/init`) after the new UI moved
to `/` on 11 Oct (`.dev/new-ui-at-root.md`). Everything only it could do moved to the new UI by 15 Oct (README →
Moved from the classic UI); the rest was dropped on purpose (DECISIONS.md, 15 Oct). It goes in two steps:

1. **Switched off** (15 Oct): `/app` and `/init` send people to `/`. Its code is still there.
2. **Deleted** (later, after a week or two without `/app` requests on production): its code, in commits by area.

## Step 1: switched off

| File | Before | After |
|---|---|---|
| `config/routes.rb` | `/app`, `/init` → `InitController` (the classic UI) | `/app`, `/init` → 302 to `/` |
| `spec/requests/studenthub_new_ui_at_root_spec.rb` | "keeps the classic UI at /app" | "sends the classic UI addresses to the new UI" |

Browsers keep the `#…` part through the redirect, so old bookmarks and links (`/app#ticket/zoom/5`) open the same page
in the new UI, which turns `#…` addresses into its own once someone is signed in.

### Restore point and undo

- Git tag **`before-classic-ui-off`** = commit `b9cb4ef854`, the last commit before the switch (pushed to GitHub).
- The switch is one commit on `develop` (the one that adds this file; `git log -- .dev/classic-ui-removal.md`).

```sh
git revert <commit that added .dev/classic-ui-removal.md>
```

then deploy as usual (`studenthub-deploy`). No migration, so the database needs nothing. The redirect was a 302, so
browsers don't keep it.

### Checking on the servers

After deploying: `/app` and an old `/app#ticket/zoom/<id>` link land in the new UI. Then, for a week or two, whether
anyone still opens `/app` (in Zammad's directory on the server):

```sh
grep -c 'Started GET "/app' log/production.log
```

## Step 2: what the delete removes, and what it keeps

Removes:

- The classic app: `app/assets/javascripts/app/` and `application.js`; the stylesheets only it uses
  (`application*.css`, `zammad.scss`, `print.scss` and the other classic CSS, `custom/studenthub_approval.css`,
  `custom/studenthub_feedback.css`); `app/views/init/`, `layouts/application.html.erb`, `InitController` and the
  `/app` and `/init` routes (then a 404 or the new UI's catch-all instead of the redirect, to be decided then)
- Its QUnit test pages: `app/views/tests/`, `layouts/tests.html.erb`, `public/assets/tests/`, the tests controller and
  its routes, `spec/system/js`
- Its Capybara system tests (most of `spec/system`; keep `apps/desktop`, `knowledge_base_public` and the widgets')
- Student Hub's classic sidebars (`ticket_zoom/sidebar_studenthub_approval`, `…_feedback`: the new UI has both)
- In the new UI: the BETA switch (`components/BetaUi/`, its places in `AppDesktop.vue`, `LeftSidebarFooterMenu.vue`,
  `Login.vue`, the personal setting "New BETA UI"); in the server: the sign-in return to `/app#`
  (`sessions_controller.rb`, `Studenthub::NewUiAtRoot.classic_origin?`, `CLASSIC_PATHS`)
- Then the build: the CSS watcher's classic part in `Procfile.dev`, and the `coffee-rails` and `eco` gems if the help
  centre doesn't need them; regenerate the translation catalog with the generator (never edit `i18n/*.po` by hand)

Keeps (they live next to the classic UI but aren't part of it):

- The public help centre (`/help`): `app/assets/javascripts/knowledge_base_public*`, `knowledge_base*.scss`,
  `custom_knowledge_base_public/`, `font.css`, `svg-dimensions.css`, `layouts/knowledge_base.html.erb`
- `public/assets/` images, logos, sounds and fonts (emails and the new UI use them)
- The web form and chat widgets (`public/assets/form/`, `…/chat/`) while a website embeds them
- The REST API (the `/manage` pages save through it) and the mail templates
- `lib/sessions` and the websocket server (they still carry maintenance messages; a later, separate job)
