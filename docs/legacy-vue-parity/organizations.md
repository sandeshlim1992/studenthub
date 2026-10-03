# Organizations Management: Legacy vs Vue Parity Audit

- **Section**: Administration → Organizations Management
- **URL**: `http://localhost:3000/desktop/manage/organizations`
- **Legacy Source of Truth**:
  - Controller: [`app/assets/javascripts/app/controllers/organization.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/organization.coffee)
  - Model & Schema: [`app/assets/javascripts/app/models/organization.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/models/organization.coffee), [`app/models/organization.rb`](file:///home/taxilkathiriya/zammad/app/models/organization.rb), [`db/schema.rb`](file:///home/taxilkathiriya/zammad/db/schema.rb)
  - Generic Index: [`app/assets/javascripts/app/controllers/_application_controller/_generic_index.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/_application_controller/_generic_index.coffee)
  - Import Widgets: [`app/assets/javascripts/app/controllers/widget/import.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/widget/import.coffee), `import_try_result.coffee`, `import_result.coffee`
  - Table Controller: [`app/assets/javascripts/app/controllers/_application_controller/table.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/_application_controller/table.coffee)
- **Vue Implementation**:
  - Page View: [`app/frontend/apps/desktop/pages/manage/views/Organizations.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/Organizations.vue)
  - Edit Composable: [`app/frontend/apps/desktop/entities/organization/composables/useOrganizationEdit.ts`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/entities/organization/composables/useOrganizationEdit.ts)

---

## 1. Discovered Legacy Capabilities

### 1.1 List & Table Display
1. **Search & Filter**:
   - Server-side search (`/api/v1/organizations/search?query=*`) across organization name, domain, and note.
2. **Pagination**:
   - Server-side pagination (`limit=50&offset=...&with_total_count=true`) with page navigation controls.
3. **Table Columns**:
   - Organization Name
   - Domain & Domain Assignment indicator
   - VIP badge indicator
   - Shared Organization indicator
   - Active status indicator
   - Note
4. **Row Actions Menu**:
   - **Edit**: Opens organization edit flyout/drawer with hydrated attributes.
   - **Clone**: (`@configure_clone = true`) Copies organization configuration into a new record with `Clone: <Name>`.
   - **Delete**: Calls `DELETE /api/v1/organizations/:id` with foreign key and reference validation (`model_references_check`).

### 1.2 Organization Attributes & Configuration
1. **Name**:
   - String (required, unique case-insensitive, limit 150).
2. **Shared Organization (`shared`)**:
   - Boolean flag (default `true`). When enabled, customers belonging to this organization can view and collaborate on tickets created by colleagues.
3. **Domain (`domain`)**:
   - Email domain associated with the organization (e.g. `lsst.ac`, `fairfield.ac`). Auto-cleans leading `@` symbols and whitespaces.
4. **Domain-Based Assignment (`domain_assignment`)**:
   - Boolean flag (default `false`). When enabled, newly registered users or incoming email senders with this email domain are automatically assigned to this organization. Requires a valid domain.
5. **VIP (`vip`)**:
   - Boolean flag (default `false`). Distinguishes high-priority organizations throughout ticket views and overviews.
6. **Note (`note`)**:
   - Internal text note visible only to agents and administrators (limit 5000 chars).
7. **Active (`active`)**:
   - Boolean flag (default `true`). Inactive organizations cannot be selected for new tickets or customer assignments.

### 1.3 CSV Bulk Import
1. **Two-Stage Workflow**:
   - Step 1: Upload CSV file or paste raw text. Custom column separator selection (`,`, `;`, tab). Dry run via `POST /api/v1/organizations/import?try=true`.
   - Step 2: Test run result dialog displaying preview of operations: `stats.created`, `stats.updated`, `stats.total`.
   - Step 3: Admin confirms "Yes, start real import." (`try=false`), executing import and displaying final summary.
2. **Download Example CSV**:
   - Direct download endpoint: `GET /api/v1/organizations/import_example`.

---

## 2. Issues Log

### Issue ORG-001 — Missing "New Organization" Action & Creation Flow
- **Section**: Organizations Management
- **Functionality**: Organization Creation
- **Legacy Behaviour**: Header provides green "New Organization" button (`buttons: [ { name: __('New Organization'), 'data-type': 'new', class: 'btn--success' } ]`) which opens the creation modal.
- **Vue Behaviour**: Vue page completely lacked a "New Organization" button, displaying only a static "Single-Brand Organization" badge.
- **Problem**: Administrators had no way to create new organizations in the Vue interface.
- **Root Cause**: Left as a placeholder during initial portal customization.
- **Fix**: Added "New Organization" button in the top action bar and implemented a native creation slide-over drawer with full attribute validation submitting to `POST /api/v1/organizations`.
- **Status**: Fixed
- **Verification**: Verified button renders, opens creation drawer, validates required name, and successfully persists new organizations.

---

### Issue ORG-002 — Missing Two-Stage CSV Import & Example Download Workflow
- **Section**: Organizations Management
- **Functionality**: CSV Bulk Import
- **Legacy Behaviour**: Header contains "Import" button triggering the standard 2-step import wizard (dry-run preview followed by confirmed execution) and link to download `organization-example.csv`.
- **Vue Behaviour**: No CSV import capability existed in `Organizations.vue`.
- **Problem**: Bulk creation/updating of organizations via CSV was impossible in the new UI.
- **Root Cause**: Incomplete porting of `App.Import` widget for organizations.
- **Fix**: Built a 3-stage import modal in `Organizations.vue` (Upload/Paste -> Dry Run Preview -> Complete Summary) targeting `POST /api/v1/organizations/import` and connected the `import_example` download button.
- **Status**: Fixed
- **Verification**: Verified CSV import modal opens, reads file/text, correctly previews test statistics, and executes import.

---

### Issue ORG-003 — Missing Domain, Domain-Based Assignment, and VIP Controls
- **Section**: Organizations Management
- **Functionality**: Domain Routing & VIP Classification
- **Legacy Behaviour**: Organizations support `domain`, `domain_assignment` (auto-assign customers by email domain), and `vip` status.
- **Vue Behaviour**: Overview table and form controls ignored `domain`, `domain_assignment`, and `vip`.
- **Problem**: Administrators could not configure or view domain-based user assignments or flag VIP organizations.
- **Root Cause**: Incomplete attribute mapping in `Organizations.vue` template and interface.
- **Fix**: Added `domain`, `domain_assignment`, and `vip` fields to the drawer form, added domain and VIP badges to the table overview, and included domain presence validation when domain assignment is enabled.
- **Status**: Fixed
- **Verification**: Verified domain and VIP badges render in table and can be toggled/saved in the drawer.

---

### Issue ORG-004 — Missing Clone Organization Action
- **Section**: Organizations Management
- **Functionality**: Organization Cloning
- **Legacy Behaviour**: `App.Organization` has `@configure_clone = true`. The table row action menu provides "Clone" to duplicate organization settings into a new record.
- **Vue Behaviour**: Row dropdown only offered "Edit" and "Delete".
- **Problem**: Admins could not clone organization configurations.
- **Root Cause**: Missing clone action handler in `Organizations.vue`.
- **Fix**: Added `handleCloneOrganization(org)` row action with copy icon that pre-fills the creation drawer with `"Clone: <Name>"` and identical settings.
- **Status**: Fixed
- **Verification**: Verified clicking Clone opens drawer in create mode pre-populated with source organization attributes.

---

### Issue ORG-005 — Shallow Record Passing to Edit Flow
- **Section**: Organizations Management
- **Functionality**: Organization Edit Drawer Initialization
- **Legacy Behaviour**: Preloads full organization model record prior to opening edit view.
- **Vue Behaviour**: Passed shallow search row object directly into edit flow without fetching full record.
- **Problem**: Attributes omitted from search summaries (e.g. detailed notes or custom attributes) were lost or empty.
- **Root Cause**: Lack of full record hydration before opening edit form.
- **Fix**: Implemented full `GET /api/v1/organizations/:id` hydration before populating form fields.
- **Status**: Fixed
- **Verification**: Verified edit drawer fetches complete record and populates all fields accurately.

---

### Issue ORG-006 — Domain Cleaning & Validation
- **Section**: Organizations Management
- **Functionality**: Domain Sanitization
- **Legacy / Backend**: `Organization#domain_cleanup` strips `@`, whitespaces, and downcases the domain string. Backend validation enforces domain presence if `domain_assignment` is true.
- **Vue Behaviour**: No client-side domain sanitization or validation was present.
- **Problem**: Submitting invalid domains (e.g. `@example.com` with space) caused backend validation errors or formatting issues.
- **Root Cause**: Missing client-side sanitization.
- **Fix**: Added auto-cleaning of `@` prefixes and spaces on input and client validation requiring domain when domain assignment is active.
- **Status**: Fixed
- **Verification**: Verified entering `@domain.com` auto-cleans to `domain.com` and prevents saving empty domain when domain assignment is enabled.
