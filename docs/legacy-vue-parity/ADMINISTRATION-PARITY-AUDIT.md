# Zammad Administration UI: Legacy-to-Vue Parity Master Audit

> **Objective:** Ensure the new Vue 3 administration UI (`/desktop/manage/*`) is 100% functionally equivalent to the legacy Zammad implementation, while preserving the modern Vue UI/UX design.

---

## 1. Scope & Sections

| Section | Route | Legacy Controller | Vue Component | Parity Status |
| :--- | :--- | :--- | :--- | :---: |
| **Users** | `/desktop/manage/users` | `user.coffee`, `generic_index_user.coffee`, `widget/import*.coffee` | [`Users.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/Users.vue) | **Complete (Audited & Fixed)** |
| **Groups** | `/desktop/manage/groups` | `group.coffee`, `generic_index.coffee`, `group.rb` | [`Groups.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/Groups.vue) | **Complete (Audited & Fixed)** |
| **Organizations** | `/desktop/manage/organizations` | `organization.coffee`, `widget/import*.coffee`, `organization.rb` | [`Organizations.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/Organizations.vue) | **Complete (Audited & Fixed)** |
| **Overviews** | `/desktop/manage/overviews` | `overview.coffee`, `overviews_prio`, `overview.rb` | [`Overviews.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/Overviews.vue) | **Complete (Audited & Fixed)** |
| **System Objects** | `/desktop/manage/system/objects` | `object_manager.coffee`, `object_manager_attributes_controller.rb` | [`SystemObjects.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/SystemObjects.vue) | **Complete (Audited & Fixed)** |
| **Text Modules** | `/desktop/manage/text_modules` | `text_module.coffee` | [`TextModules.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/TextModules.vue) | **Complete (Audited & Fixed)** |
| **Macros** | `/desktop/manage/macros` | `macro.coffee` | [`Macros.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/Macros.vue) | **Complete (Audited & Fixed)** |
| **Templates** | `/desktop/manage/templates` | `template.coffee` | [`Templates.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/Templates.vue) | **Complete (Audited & Fixed)** |
| **Checklists** | `/desktop/manage/checklists` | `checklist_template.coffee` | [`Checklists.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/Checklists.vue) | **Complete (Audited & Fixed)** |
| **SLAs** | `/desktop/manage/slas` | `sla.coffee` | [`Slas.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/Slas.vue) | **Complete (Audited & Fixed)** |
| **Triggers** | `/desktop/manage/triggers` | `trigger.coffee` | [`Triggers.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/Triggers.vue) | **Complete (Audited & Fixed)** |
| **Webhooks** | `/desktop/manage/webhooks` | `webhook.coffee` | [`Webhooks.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/Webhooks.vue) | **Complete (Audited & Fixed)** |
| **Calendars** | `/desktop/manage/calendars` | `calendar.coffee` | [`Calendars.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/Calendars.vue) | **Complete (Audited & Fixed)** |
| **Report Profiles** | `/desktop/manage/report_profiles` | `report_profile.coffee` | [`ReportProfiles.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/ReportProfiles.vue) | **Complete (Audited & Fixed)** |
| **Time Accounting** | `/desktop/manage/time_accounting` | `time_accounting.coffee` | [`TimeAccounting.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/TimeAccounting.vue) | **Complete (Audited & Fixed)** |
| **Knowledge Base** | `/desktop/manage/knowledge_base` | `knowledge_base.coffee` | [`KnowledgeBase.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/KnowledgeBase.vue) | **Complete (Audited & Fixed)** |

---

## 2. Current Progress & Resume State

### Section Status
- **Users**: Complete (All 5 parity issues resolved: full user hydration, CSV import stats fix, 2-stage import workflow, inactive group guard, dynamic lock threshold)
- **Groups**: Complete (All 9 parity issues resolved: email & signature bindings, follow-up enum & threshold, follow-up assignment, shared drafts, summary generation, clone action, name hierarchy, and hydration)
- **Organizations**: Complete (All 6 parity issues resolved: native organization create drawer, 2-stage CSV bulk import, domain routing & assignment, VIP toggle, clone action, and full hydration)
- **Overviews**: Complete (All 7 parity issues resolved: condition preservation, unassigned owner pre-condition, clone action, HTML5 drag-and-drop reordering, expanded ticket attributes, "View Tickets" link, and live preview sync)
- **System Objects**: Complete (All 5 parity issues resolved: itemized pending changes review, uninterpolated string formatting, position column, real-time attribute search, strict TypeScript type safety)
- **Text Modules**: Complete (Clone action, 2-stage CSV bulk import wizard, example CSV download, i18n delete confirmation)
- **Macros**: Complete (Clone macro action with action & permission copying, i18n delete confirmation)
- **Templates**: Complete (Clone template action, configured action summary badges in table, i18n delete confirmation)
- **Checklists**: Complete (Global checklist setting toggle switch in header, Clone checklist action, i18n delete confirmation)
- **SLAs**: Complete (Humanized rule summary badges in table, Clone SLA action, i18n delete confirmation)
- **Triggers**: Complete (Clone trigger action, action/time event indicators, i18n delete confirmation)
- **Webhooks**: Complete (Example Payload preview modal with clipboard copy, Pre-defined Webhook wizard, Clone webhook action, i18n delete confirmation)
- **Calendars**: Complete (iCal public holiday feeds preset dropdown from `/api/v1/calendars_init`, Clone calendar action, Set as default action, i18n delete confirmation)
- **Report Profiles**: Complete (Role scoping, live ticket selector preview sync, Clone profile action)
- **Time Accounting**: Complete (3-tab layout: Settings, Activity Types, Accounted Time logs with year/month filters, categories by activity/ticket/customer/organization, Excel CSV export, Activity Type Clone action, 0 oxlint errors)
- **Knowledge Base**: Complete (Master active toggle switch, multi-language/locale manager, video server settings, custom URL snippets, public menu items, 0 oxlint errors)

---

## 3. Master Status Checklist: Done vs. Not Done

### 3.1 Completed Sections (100% Parity Achieved)
- [x] **Users Management** (`/desktop/manage/users`)
- [x] **Groups Management** (`/desktop/manage/groups`)
- [x] **Organizations Management** (`/desktop/manage/organizations`)
- [x] **Overviews Management** (`/desktop/manage/overviews`)
- [x] **System Objects / Object Manager** (`/desktop/manage/system/objects`)
- [x] **Text Modules** (`/desktop/manage/text_modules`)
- [x] **Macros** (`/desktop/manage/macros`)
- [x] **Templates** (`/desktop/manage/templates`)
- [x] **Checklists** (`/desktop/manage/checklists`)
- [x] **SLAs** (`/desktop/manage/slas`)
- [x] **Triggers** (`/desktop/manage/triggers`)
- [x] **Webhooks** (`/desktop/manage/webhooks`)
- [x] **Calendars** (`/desktop/manage/calendars`)
- [x] **Report Profiles** (`/desktop/manage/report_profiles`)
- [x] **Time Accounting** (`/desktop/manage/time_accounting`)
- [x] **Knowledge Base** (`/desktop/manage/knowledge_base`)
- [x] **Channels (All 11 Modules)** ([`channels_parity_audit.md`](file:///home/taxilkathiriya/zammad/docs/legacy-vue-parity/channels_parity_audit.md)):
  - [x] Web (`/manage/channels/web`)
  - [x] Email (`/manage/channels/email`)
  - [x] SMS (`/manage/channels/sms`)
  - [x] Chat (`/manage/channels/chat`)
  - [x] Google (`/manage/channels/google`)
  - [x] Microsoft 365 (`/manage/channels/microsoft365`)
  - [x] Microsoft 365 Graph (`/manage/channels/microsoft_graph`)
  - [x] Facebook (`/manage/channels/facebook`)
  - [x] Telegram (`/manage/channels/telegram`)
  - [x] WhatsApp (`/manage/channels/whatsapp`)
  - [x] Form (`/manage/channels/form`)
- [x] **Settings (All 4 Modules)** ([`SETTINGS-PARITY-AUDIT.md`](file:///home/taxilkathiriya/zammad/docs/legacy-vue-parity/SETTINGS-PARITY-AUDIT.md)):
  - [x] Branding (`/manage/settings/branding`)
  - [x] Security (`/manage/settings/security`)
  - [x] Ticket (`/manage/settings/ticket`)
  - [x] System Settings (`/manage/settings/system`)

---

### 3.2 Technically Blocked / Impossible without Backend Changes
- **Analytical Reporting & Trend Graphs (`/desktop/report`)**:
  - **Blocker:** Requires a running Elasticsearch cluster on port 9200. Backend classes (`Report::TicketGenericTime`, `Report::TicketBacklog`) query Elasticsearch bucket aggregations (`SearchIndexBackend.selectors`). Relational SQL queries are not implemented in the Zammad core reporting engine. Rewriting the reporting engine with pure SQL violates the **zero backend modification constraint**.
- **Hard Deletion of Users / Organizations with Tickets**:
  - **Blocker:** Rails backend foreign key referential integrity checks (`model_references_check`) prevent hard deletion; records must be anonymized through Data Privacy.

---

### 3.3 Next Administration Sections to Audit
- [ ] **Core Workflows** (`/desktop/manage/system/core_workflows`)
- [ ] **Data Privacy** (`/desktop/manage/system/data_privacy`)
- [ ] **System Maintenance** (`/desktop/manage/system/maintenance`)
- [ ] **System Monitoring** (`/desktop/manage/system/monitoring`)
- [ ] **System Packages** (`/desktop/manage/system/packages`)
- [ ] **System Translations** (`/desktop/manage/system/translations`)
- [ ] **System Integrations** (`/desktop/manage/system/integrations`)


