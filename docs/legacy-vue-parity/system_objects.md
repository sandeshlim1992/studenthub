# System Objects (Object Manager): Legacy vs Vue Parity Audit

- **Section**: Administration → System → Objects (Object Manager)
- **URL**: `http://localhost:3000/desktop/manage/system/objects`
- **Legacy Source of Truth**:
  - Controller: [`app/assets/javascripts/app/controllers/object_manager.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/object_manager.coffee)
  - UI Element: [`app/assets/javascripts/app/controllers/_ui_element/object_manager_attribute.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/_ui_element/object_manager_attribute.coffee)
  - View Template: [`app/assets/javascripts/app/views/object_manager/index.jst.eco`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/views/object_manager/index.jst.eco)
  - Model: [`app/assets/javascripts/app/models/object_manager_attribute.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/models/object_manager_attribute.coffee)
  - Backend Controller: [`app/controllers/object_manager_attributes_controller.rb`](file:///home/taxilkathiriya/zammad/app/controllers/object_manager_attributes_controller.rb)
- **Vue Implementation**:
  - Page View: [`app/frontend/apps/desktop/pages/manage/views/SystemObjects.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/SystemObjects.vue)

---

## 1. Discovered Legacy Capabilities

### 1.1 List & Table Display
1. **Dynamic Object Tabs**:
   - Objects are fetched dynamically via `GET /api/v1/object_manager_attributes_list`, supporting `Ticket`, `User`, `Organization`, and `Group`.
2. **Table Overview Columns**:
   - Display Name (with `System` badge if `!editable`)
   - Identifier / Name (`name`)
   - Data Type (`data_type`)
   - Position (`position` order)
   - Status (Active, Disabled, Pending Create, Pending Delete, Pending Update)
   - Row Actions (Edit, Delete, and Manage links for system attributes like `priority_id` and `state_id`)
3. **Pending Schema Migration Warning Banner**:
   - Detects attributes with `to_create`, `to_delete`, `to_migrate`, or `to_config`.
   - In legacy `index.jst.eco`, displays the itemized list of impending schema mutations:
     - `Create: <object>.<name> (<type>)`
     - `Delete: <object>.<name> (<type>)`
     - `Changed: <object>.<name> (<type>)`
   - Actions:
     - **Discard Changes**: `POST /api/v1/object_manager_attributes_discard_changes`
     - **Update Database**: `POST /api/v1/object_manager_attributes_execute_migrations`
4. **Attribute Search & Filter**:
   - Instant search across attribute name, display label, and format within the selected object.

### 1.2 Object Attribute Configuration & Formats
1. **Field Formats (`data_type`)**:
   - `input`: Text, phone, email, url, max length, link templates (`https://example.com/?q=#{object.attr}`)
   - `textarea`: Multi-line text, max length, row count
   - `boolean`: Yes/No options with customizable default
   - `integer`: Min, max, default number value
   - `date`: Past/future date allowances, relative diffs
   - `datetime`: Past/future timestamp allowances, relative diffs
   - `select` / `multiselect`: Key-value options dictionary, translation toggle
   - `tree_select` / `multi_tree_select`: Hierarchical option lists
2. **Permissions & Screen Visibility Matrix (`screens`)**:
   - Role-by-screen access mapping:
     - `Ticket`: `ticket.customer` and `ticket.agent` for `create_middle` and `edit`.
     - `User`: `ticket.customer` (create, view, signup), `ticket.agent` (create, edit, view, invite_customer), `admin.user` (create, edit, view).
     - `Organization`: `ticket.customer` (view), `ticket.agent` (create, edit, view), `admin.organization` (create, edit, view).
     - `Group`: `admin.group` (create, edit, view).
   - Toggles: `shown` (boolean) and `required` (boolean, sets `data_option.null = false`).
3. **Read-only Constraints on Edit**:
   - In edit mode, `name` and `data_type` are immutable to maintain schema consistency.

---

## 2. Issues Log

### Issue OBJ-001 — Uninterpolated String Formatting in Pending Changes Banner
- **Section**: System Objects
- **Functionality**: Migration Banner Counter
- **Legacy Behaviour**: Renders translated string with dynamic count of uncommitted changes.
- **Vue Behaviour**: Template used `__('You have %s uncommitted database changes', pendingChanges.length)`, displaying literal `%s`.
- **Root Cause**: Translation function `__()` does not replace `%s` unless interpolated or chained with `.replace('%s', count)`.
- **Fix**: Updated to `__('You have %s uncommitted database changes').replace('%s', String(pendingChanges.length))`.
- **Status**: Fixed

---

### Issue OBJ-002 — Missing Itemized Pending Changes List
- **Section**: System Objects
- **Functionality**: Database Migration Review
- **Legacy Behaviour**: Legacy `object_manager/index.jst.eco` itemizes each pending change before the administrator commits database migrations (e.g. `Create: Ticket.field (input)`, `Delete: Ticket.old (text)`).
- **Vue Behaviour**: Only displayed the count without revealing which attributes will be created, modified, or dropped.
- **Root Cause**: Missing iteration over `pendingChanges` in the warning banner.
- **Fix**: Rendered an itemized list with badges for `Create`, `Delete`, and `Changed` items.
- **Status**: Fixed

---

### Issue OBJ-003 — Missing Position Column in Attribute Table
- **Section**: System Objects
- **Functionality**: Attribute Sorting & Ordering
- **Legacy Behaviour**: Table includes a distinct `Position` column showing the attribute's integer priority.
- **Vue Behaviour**: Position column was missing from the table header and body.
- **Root Cause**: Omitted from table template during initial layout.
- **Fix**: Added `Position` column displaying `attr.position` with centered monospace formatting.
- **Status**: Fixed

---

### Issue OBJ-004 — Missing Attribute Search / Filter
- **Section**: System Objects
- **Functionality**: Attribute Discovery
- **Legacy / Desktop Requirement**: Large object models (especially Ticket and User) have dozens of system and custom attributes.
- **Vue Behaviour**: No search or filter capability existed; users had to manually scan the full table.
- **Root Cause**: Missing search filter input.
- **Fix**: Added real-time attribute search input with empty state feedback.
- **Status**: Fixed

---

### Issue OBJ-005 — TypeScript Typing Violations in Attribute Options & Screens
- **Section**: System Objects
- **Functionality**: Code Quality & Type Safety
- **Legacy / Vue Behaviour**: Strict TypeScript type checking flagged 9 `no-explicit-any` errors in `SystemObjects.vue`.
- **Root Cause**: Usage of `any` in `defaultVal`, `data_option_new`, `flattenTree`, and `screensPayload`.
- **Fix**: Replaced all `any` usages with type-safe `unknown`, `Record<string, unknown>`, and explicit interface assertions.
- **Status**: Fixed
