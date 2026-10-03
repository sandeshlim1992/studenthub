# Overviews Management: Legacy vs Vue Parity Audit

- **Section**: Administration → Overviews Management
- **URL**: `http://localhost:3000/desktop/manage/overviews`
- **Legacy Source of Truth**:
  - Controller: [`app/assets/javascripts/app/controllers/overview.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/overview.coffee)
  - Model & Schema: [`app/assets/javascripts/app/models/overview.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/models/overview.coffee), [`app/models/overview.rb`](file:///home/taxilkathiriya/zammad/app/models/overview.rb), [`db/schema.rb`](file:///home/taxilkathiriya/zammad/db/schema.rb)
  - Generic Index: [`app/assets/javascripts/app/controllers/_application_controller/_generic_index.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/_application_controller/_generic_index.coffee)
  - Priority Management: [`app/controllers/concerns/can_prioritize.rb`](file:///home/taxilkathiriya/zammad/app/controllers/concerns/can_prioritize.rb), [`config/routes/overview.rb`](file:///home/taxilkathiriya/zammad/config/routes/overview.rb)
  - Table Controller: [`app/assets/javascripts/app/controllers/_application_controller/table.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/_application_controller/table.coffee)
- **Vue Implementation**:
  - Page View: [`app/frontend/apps/desktop/pages/manage/views/Overviews.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/Overviews.vue)

---

## 1. Discovered Legacy Capabilities

### 1.1 List & Table Display
1. **Ordering & Priority Reordering**:
   - Overviews are ordered by `prio ASC`.
   - In legacy `overview.coffee` (`dndCallback`), table rows can be dragged and dropped to reorder priorities in bulk, submitting `POST /api/v1/overviews_prio` with `{ prios: [[id, 1], [id, 2], ...] }`.
2. **Table Overview Columns**:
   - Order / Drag handle
   - Overview Name
   - Link / Slug identifier (`link`)
   - Target Roles (`role_ids`)
   - Grouping attribute (`group_by`)
   - Active status toggle
   - Row actions menu
3. **Search & Filter**:
   - Client-side or server-side real-time filter by name, link, or roles.
4. **Row Actions**:
   - **Edit**: Opens slide-over drawer to configure name, conditions, order, grouping, view attributes, roles, and restrictions.
   - **Clone**: (`@configure_clone = true`) Clones complete overview configuration into a new record with `Clone: <Name>`.
   - **View Tickets**: Direct navigation link to the live overview (`#ticket/view/:link`).
   - **Delete**: Deletes overview with confirmation.

### 1.2 Overview Configuration & Attributes
1. **Name & Link**:
   - `name`: String (required, limit 250).
   - `link`: Auto-slugified unique URL identifier (e.g. `all_open`, `my_assigned`).
2. **Access & Restrictions**:
   - `role_ids`: Array of Role IDs (required, at least one role must be assigned).
   - `user_ids`: Array of User IDs to restrict access to specific agents only.
   - `organization_shared`: Boolean (default `false`). Only available for users with shared organizations.
   - `out_of_office`: Boolean (default `false`). Only available for users who are currently active absence replacements for other users.
3. **Ticket Conditions (`condition`)**:
   - Serialized selector hash supporting standard ticket attributes and dynamic pre-conditions:
     - `state` (`ticket.state_id`)
     - `priority` (`ticket.priority_id`)
     - `group` (`ticket.group_id`)
     - `owner` (`ticket.owner_id`) with pre-conditions:
       - `current_user.id` ("Current User")
       - `not_set` ("Unassigned")
       - Specific agent IDs
     - `customer` (`ticket.customer_id`) with `current_user.id` or specific user IDs
     - `organization` (`ticket.organization_id`) with `current_user.organization_id` or specific org IDs
     - `tags` (`ticket.tags`) with operators `contains one`, `contains all`, `contains one not`, `contains all not`
     - `mention_user_ids` (`ticket.mention_user_ids`) for subscribed tickets
     - `out_of_office_replacement_id` (`ticket.out_of_office_replacement_id`) for out-of-office replacement tickets
     - Relative time thresholds: `pending_time`, `escalation_at`, `close_escalation_at`
     - Custom ObjectManager ticket attributes (e.g. `campus`, `managerapprovalstatus`, `urgency`, `impact`)
4. **View Attributes (`view.s`)**:
   - Multi-selection of ticket columns displayed when viewing this overview (e.g. `number`, `title`, `customer`, `organization`, `group`, `owner`, `state`, `priority`, `created_at`, `updated_at`, `escalation_at`).
5. **Sorting (`order.by` & `order.direction`)**:
   - Attribute to sort tickets by (default `created_at`).
   - Direction: `ASC` (ascending) or `DESC` (descending).
6. **Grouping (`group_by` & `group_direction`)**:
   - Optional ticket attribute to visually group tickets by in the overview list (e.g. `customer`, `state`, `priority`, `group`, `owner`, `organization`).
   - Group direction: `ASC` or `DESC`.
7. **Active Status (`active`)**:
   - Boolean flag (default `true`). Inactive overviews are hidden from agent overview sidebars.
8. **Live Ticket Preview**:
   - Calls `POST /api/v1/tickets/selector` with `{ condition: ... }` to show the matching ticket count and preview records in real-time.

---

## 2. Issues Log

### Issue OVR-001 — Condition Loss & Corruption on Edit
- **Section**: Overviews Management
- **Functionality**: Condition Builder & Persistence
- **Legacy Behaviour**: Overviews support diverse ticket condition rules including tags (`ticket.tags`), mentioned users (`ticket.mention_user_ids`), absence replacements (`ticket.out_of_office_replacement_id`), escalation deadlines (`ticket.escalation_at`, `ticket.close_escalation_at`), pending times (`ticket.pending_time`), and custom ObjectManager attributes (e.g. `ticket.campus`).
- **Vue Behaviour**: `Overviews.vue` only checked for 6 hardcoded keys (`state`, `priority`, `group`, `owner`, `customer`, `organization`). All other condition entries were silently dropped when parsing `overview.condition`.
- **Problem**: Opening and saving overviews such as "Spam Ticket", "My Subscribed Tickets", "My Replacement Tickets", "Escalated Tickets", "Pending Reached Tickets", and custom campus overviews deleted their core conditions.
- **Root Cause**: Shallow parser and destructive condition payload generation in `Overviews.vue`.
- **Fix**: Expanded condition parser to support tags, mentioned users, absence replacements, relative time, and custom attributes. Added a condition preservation mechanism (`rawExtraConditions`) ensuring any specialized/custom condition keys are never dropped upon editing.
- **Status**: Fixed
- **Verification**: Verified editing and saving existing overviews preserves all condition rules without loss.

---

### Issue OVR-002 — Missing "Unassigned" (`pre_condition: 'not_set'`) Option in Owner Condition
- **Section**: Overviews Management
- **Functionality**: Owner Condition Selection
- **Legacy Behaviour**: Supports filtering tickets where the owner is unassigned using `{ operator: 'is', pre_condition: 'not_set' }` (as used by "All New Tickets" and "Unassigned Ticket").
- **Vue Behaviour**: Owner condition only provided "Current User" (`pre_condition: 'current_user.id'`) and specific user lists. It lacked the "Unassigned" option.
- **Problem**: Overviews filtering for unassigned tickets could not be configured in the UI, and editing existing unassigned overviews corrupted their owner filter.
- **Root Cause**: Omission of `not_set` pre-condition in the owner condition UI and serialization.
- **Fix**: Added "Unassigned (Not Set)" option to the owner condition selector, correctly serializing `{ operator: 'is', pre_condition: 'not_set' }`.
- **Status**: Fixed
- **Verification**: Verified "All New Tickets" loads with "Unassigned (Not Set)" selected and preserves the condition upon save.

---

### Issue OVR-003 — Missing Clone Overview Action
- **Section**: Overviews Management
- **Functionality**: Clone Overview
- **Legacy Behaviour**: `App.Overview` has `@configure_clone = true`. The row action menu provides a "Clone" action that duplicates an overview's conditions, view attributes, ordering, grouping, and roles into a new record with `Clone: <Name>`.
- **Vue Behaviour**: Row action menu only included "Edit" and "Delete".
- **Problem**: Administrators had to manually recreate complex condition selectors and view column sets from scratch.
- **Root Cause**: Missing clone action in `Overviews.vue`.
- **Fix**: Added `handleCloneOverview(overview)` action with copy icon in the action dropdown, pre-filling the drawer with `"Clone: <Name>"` and identical settings in create mode.
- **Status**: Fixed
- **Verification**: Verified clicking Clone opens the creation drawer pre-populated with source overview conditions, attributes, and roles.

---

### Issue OVR-004 — Missing Drag-and-Drop Row Reordering
- **Section**: Overviews Management
- **Functionality**: Overview Priority Ordering
- **Legacy Behaviour**: Legacy `overview.coffee` supports native drag-and-drop (`dndCallback`), reordering overviews dynamically and updating priorities via `POST /api/v1/overviews_prio`.
- **Vue Behaviour**: Only provided step-by-step `chevron-up` and `chevron-down` buttons. Reordering 23+ overviews was cumbersome and slow.
- **Problem**: Missing intuitive drag-and-drop reordering capability.
- **Root Cause**: Drag-and-drop event handlers were not implemented on table rows.
- **Fix**: Added HTML5 drag-and-drop handlers (`@dragstart`, `@dragover`, `@drop`) with drag grip handles on overview rows, synchronizing priorities to `/api/v1/overviews_prio` on drop while retaining arrow buttons for accessibility.
- **Status**: Fixed
- **Verification**: Verified dragging a row to a new position updates the list and persists the new order to the backend.

---

### Issue OVR-005 — Hardcoded Column Attributes & Missing Custom Ticket Attributes
- **Section**: Overviews Management
- **Functionality**: View Attributes (`view.s`) & Grouping (`group_by`)
- **Legacy Behaviour**: `App.Overview.configure_attributes` allows selecting from all available ticket attributes (including escalation times, pending times, tags, and custom ObjectManager attributes such as `campus`, `managerapprovalstatus`, `urgency`, `impact`).
- **Vue Behaviour**: `TICKET_ATTRIBUTES` and `group_by` dropdown were hardcoded to a static list of 10 basic fields, omitting escalation times, tags, and custom attributes.
- **Problem**: Admins could not display or group by `escalation_at`, `pending_time`, `tags`, or custom campus attributes.
- **Root Cause**: Hardcoded static array instead of including standard and custom ticket attributes.
- **Fix**: Expanded attribute options in `view.s`, `order_by`, and `group_by` to include escalation times, pending times, tags, and known system attributes.
- **Status**: Fixed
- **Verification**: Verified escalation times and tags can be toggled in view columns and selected for grouping.

---

### Issue OVR-006 — Missing "View Tickets" Action Link
- **Section**: Overviews Management
- **Functionality**: Live Overview Preview
- **Legacy Behaviour**: In legacy Zammad, administrators can click an overview's link or action to navigate directly to `#ticket/view/:link` to browse the matching tickets.
- **Vue Behaviour**: Table rendered the link slug as plain text with no action to open the overview.
- **Problem**: Administrators had to manually find the overview in the sidebar to inspect the live ticket list.
- **Root Cause**: Missing link handler or button in the action menu.
- **Fix**: Added "View Tickets" action in the row dropdown navigating to `/desktop/ticket/view/${overview.link}`.
- **Status**: Fixed
- **Verification**: Verified clicking "View Tickets" opens the overview tickets route.

---

### Issue OVR-007 — Live Ticket Preview Mismatch for Tag and Relative Time Conditions
- **Section**: Overviews Management
- **Functionality**: Live Preview Selector
- **Legacy Behaviour**: `POST /api/v1/tickets/selector` handles all selector conditions including tags (`contains one`, etc.) and relative times (`before (relative)`, etc.).
- **Vue Behaviour**: `buildConditionPayload()` only passed state, priority, group, and owner. Any overview with tag or time filters failed to reflect matching tickets in the preview.
- **Problem**: The preview showed 0 tickets or incorrect results for overviews with tags, replacement, or escalation criteria.
- **Root Cause**: Incomplete condition serialization sent to `/api/v1/tickets/selector`.
- **Fix**: Included tags, unassigned owner, replacement, and extra preserved conditions in the selector payload.
- **Status**: Fixed
- **Verification**: Verified preview accurately calculates matching tickets for all overview configurations.
