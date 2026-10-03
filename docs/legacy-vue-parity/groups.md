# Groups Management: Legacy vs Vue Parity Audit

- **Section**: Administration → Groups Management
- **URL**: `http://localhost:3000/desktop/manage/groups`
- **Legacy Source of Truth**:
  - Controller: [`app/assets/javascripts/app/controllers/group.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/group.coffee)
  - Model & Schema: [`app/assets/javascripts/app/models/group.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/models/group.coffee), [`app/models/group.rb`](file:///home/taxilkathiriya/zammad/app/models/group.rb), [`db/schema.rb`](file:///home/taxilkathiriya/zammad/db/schema.rb)
  - Generic Index: [`app/assets/javascripts/app/controllers/_application_controller/_generic_index.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/_application_controller/_generic_index.coffee)
  - Edit Modal: [`app/assets/javascripts/app/controllers/_application_controller/_modal_generic_edit.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/_application_controller/_modal_generic_edit.coffee)
  - New Modal: [`app/assets/javascripts/app/controllers/_application_controller/_modal_generic_new.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/_application_controller/_modal_generic_new.coffee)
  - Table Controller: [`app/assets/javascripts/app/controllers/_application_controller/table.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/_application_controller/table.coffee)
- **Vue Implementation**:
  - Page View: [`app/frontend/apps/desktop/pages/manage/views/Groups.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/Groups.vue)

---

## 1. Discovered Legacy Capabilities

### 1.1 List & Table Display
1. **Name & Hierarchy Formatting**:
   - In legacy `group.coffee` and `App.Group.displayName()`, nested parent groups (`::` delimiter) are rendered formatted as breadcrumb hierarchies (`Parent › Subgroup`) or indented tree levels.
2. **Key Attributes Display**:
   - Table displays Name, Sending Email Address (`email_address_id`), Signature (`signature_id`), Assignment Timeout, Follow-up Possible policy, Note, and Active status.
3. **Search & Filter**:
   - Real-time search across group name, notes, and associated channel bindings.
4. **Row Actions Menu**:
   - **Edit**: Opens full edit drawer/modal.
   - **Clone**: (`@configure_clone = true`) Copies group configurations into a new group with `Clone: <Name>`.
   - **Delete**: Subject to backend reference integrity checks (`model_references_check(Group, params)`).

### 1.2 Group Configuration & Attributes
1. **Sending Email Address (`email_address_id`)**:
   - Groups bind directly to an `EmailAddress` record.
   - Outbound agent communication uses this assigned email address for ticket correspondence.
2. **Signature & Inactive Warning (`signature_id`)**:
   - Groups bind to a `Signature` record.
   - In legacy `group.coffee` (`display_warn: true`), if an assigned signature is inactive (`signature.active === false`), a contextual warning alert is shown:
     `"This signature is inactive, it won't be included in the reply."`
3. **Follow-Up Possible Modes (`follow_up_possible`)**:
   - Supported backend enum values:
     - `'yes'`: Reopens the closed ticket upon incoming customer follow-up.
     - `'new_ticket'`: Keeps the existing ticket closed and generates a new ticket.
     - `'new_ticket_after_certain_time'`: Reopens if within threshold; otherwise creates a new ticket.
4. **Reopening Time in Days (`reopen_time_in_days`)**:
   - When `follow_up_possible == 'new_ticket_after_certain_time'`, the threshold number of days must be specified.
5. **Assign Follow-Ups (`follow_up_assignment`)**:
   - Boolean flag (default `true`). When enabled, assigns follow-ups back to the last working agent.
6. **Shared Drafts (`shared_drafts`)**:
   - Boolean flag (default `true`). When enabled, ticket drafts can be viewed and taken over by other agents in the group.
7. **Summary Generation (`summary_generation`)**:
   - AI summary generation setting with options `global_default`, `enabled`, `disabled`.
8. **Parent Hierarchy & Depth Constraint**:
   - Nested group hierarchy up to 10 levels (`Group.max_depth = 10`). Groups at depth >= 9 cannot be selected as parents (`Group.unselectable_as_parent`). Groups cannot be moved into themselves or their own descendants.

---

## 2. Issues Log

### Issue GRP-001 — Missing Sending Email Address Selection
- **Section**: Groups Management
- **Functionality**: Group Email Address Association
- **Legacy Behaviour**: `email_address_id` is a core dropdown relation (`EmailAddress`) on Group. Whenever tickets are created or replied to in a group, outbound communication resolves the sender from this binding.
- **Vue Behaviour**: `email_address_id` was absent from form state, drawer UI, and save payload.
- **Problem**: Administrators could not assign or inspect which outbound email address is linked to which group.
- **Root Cause**: Incomplete porting of `App.Group.configure_attributes` relation fields into `Groups.vue`.
- **Fix**: Fetched `/api/v1/email_addresses`, bound `email_address_id` to the form state, added a select dropdown with active address details, rendered in table, and added to the REST save payload.
- **Status**: Fixed
- **Verification**: Verified email addresses load, select dropdown binds `email_address_id`, and payloads submit properly on create and edit.

---

### Issue GRP-002 — Missing Signature Selection and Inactive Warning
- **Section**: Groups Management
- **Functionality**: Group Signature Association & Inactive Notice
- **Legacy Behaviour**: `signature_id` is a core dropdown relation (`Signature`). If the selected signature has `active: false`, legacy warns: `"This signature is inactive, it won't be included in the reply."`
- **Vue Behaviour**: `signature_id` was completely absent from form state, drawer UI, and save payload.
- **Problem**: Administrators could not assign signatures to groups, nor receive warning notices when an inactive signature was selected.
- **Root Cause**: Incomplete attribute mapping in `Groups.vue`.
- **Fix**: Fetched `/api/v1/signatures`, added signature select dropdown, implemented reactive inactive warning alert (`isSelectedSignatureInactive`), rendered signature in table, and included `signature_id` in REST payload.
- **Status**: Fixed
- **Verification**: Verified signatures populate in select, selecting an inactive signature displays the amber warning alert, and updates persist to the backend.

---

### Issue GRP-003 — Invalid `follow_up_possible` Enum Values & Missing `reopen_time_in_days`
- **Section**: Groups Management
- **Functionality**: Follow-up Policy Configuration
- **Legacy Behaviour**: Backend `follow_up_possible` enum requires `'yes'`, `'new_ticket'`, or `'new_ticket_after_certain_time'`. When `'new_ticket_after_certain_time'` is selected, the `reopen_time_in_days` field is conditionally presented.
- **Vue Behaviour**: Vue template had hardcoded `<option value="yes">`, `<option value="no">`, and `<option value="new ticket">` (with space). It lacked `'new_ticket_after_certain_time'` and the `reopen_time_in_days` input.
- **Problem**:
  1. Existing groups configured with `'new_ticket'` (such as Feedback group) failed to match `"new ticket"`, rendering a blank selection.
  2. Saving `"new ticket"` or `"no"` passed invalid values to the Rails backend, breaking email filter processing in `Channel::Filter::FollowUpPossibleCheck`.
  3. Admins could not configure time-based reopening thresholds.
- **Root Cause**: Typo and incomplete enumeration of options from `App.Group.configure_attributes`.
- **Fix**: Standardized enum options to `'yes'`, `'new_ticket'`, and `'new_ticket_after_certain_time'`. Added conditional `reopen_time_in_days` input when `'new_ticket_after_certain_time'` is chosen.
- **Status**: Fixed
- **Verification**: Verified correct enum values match existing database records and conditional days threshold renders and persists properly.

---

### Issue GRP-004 — Missing `follow_up_assignment` Toggle
- **Section**: Groups Management
- **Functionality**: Follow-up Agent Reassignment
- **Legacy Behaviour**: Provides "Assign follow-ups" (`follow_up_assignment`, boolean default true) with help text: `"Assign follow-up to latest agent again."`
- **Vue Behaviour**: Field existed on TypeScript interface but was not in `form`, drawer template, or save payload.
- **Problem**: Admins could not toggle whether reopened tickets return to the previous agent or get unassigned.
- **Root Cause**: Missing form control in drawer template.
- **Fix**: Added `follow_up_assignment` checkbox and description to drawer and included in save payload.
- **Status**: Fixed
- **Verification**: Verified checkbox toggles and persists boolean value to Rails API.

---

### Issue GRP-005 — Missing `shared_drafts` Toggle
- **Section**: Groups Management
- **Functionality**: Ticket Draft Collaboration
- **Legacy Behaviour**: Provides "Shared Drafts" (`shared_drafts`, boolean default true) enabling agents within the group to view and collaborate on ticket article drafts.
- **Vue Behaviour**: Completely omitted from `Groups.vue`.
- **Problem**: Admins could not toggle shared drafts for specific groups.
- **Root Cause**: Omitted during initial component creation.
- **Fix**: Added `shared_drafts` checkbox and helper note to drawer and included in save payload.
- **Status**: Fixed
- **Verification**: Verified `shared_drafts` persists to backend and defaults to true.

---

### Issue GRP-006 — Missing `summary_generation` Setting
- **Section**: Groups Management
- **Functionality**: AI Summary Generation Control
- **Legacy / Backend**: `summary_generation` attribute (`global_default`, `enabled`, `disabled`) controls group-level AI ticket summary generation.
- **Vue Behaviour**: Missing from form and save payload.
- **Problem**: Group-level override for AI summary generation could not be managed.
- **Root Cause**: Missing select control in drawer.
- **Fix**: Added `summary_generation` select dropdown in drawer and included in save payload.
- **Status**: Fixed
- **Verification**: Verified select options render and update correctly.

---

### Issue GRP-007 — Missing Clone Group Action
- **Section**: Groups Management
- **Functionality**: Clone Group
- **Legacy Behaviour**: `App.Group` has `@configure_clone = true`. The row action menu includes a "Clone" action that opens the create modal pre-filled with the source group's attributes and name prefixed with `"Clone: <Name>"`.
- **Vue Behaviour**: Action menu only contained "Edit" and "Delete".
- **Problem**: Admins had to manually re-type all configuration when creating similar groups.
- **Root Cause**: Missing clone action handler in `Groups.vue`.
- **Fix**: Implemented `handleCloneGroup(group)` row action with icon `copy` that preloads source attributes and opens drawer in create mode.
- **Status**: Fixed
- **Verification**: Verified clicking Clone opens the drawer pre-filled with "Clone: <Name>" and identical settings.

---

### Issue GRP-008 — Group Name Hierarchy Display & Depth Guard
- **Section**: Groups Management
- **Functionality**: Name Formatting and Parent Depth Validation
- **Legacy Behaviour**:
  1. Displays group hierarchy as `Parent › Subgroup` instead of raw `Parent::Subgroup`.
  2. Enforces maximum nesting depth of 10 levels, excluding groups at depth >= 9 from being chosen as parent.
- **Vue Behaviour**: Rendered raw `group.name` with double colons and permitted selecting any parent regardless of nesting depth.
- **Problem**: Poor visual hierarchy and risk of hitting Rails depth validation exceptions on save.
- **Root Cause**: Missing display formatter and depth boundary checks.
- **Fix**: Formatted table names with breadcrumb hierarchy badges and filtered `parentGroupOptions` to exclude groups exceeding depth limits.
- **Status**: Fixed
- **Verification**: Verified nested groups display with clear breadcrumbs and depth guards prevent invalid selections.

---

### Issue GRP-009 — Shallow Group Hydration on Edit
- **Section**: Groups Management
- **Functionality**: Group Edit Form Initialization
- **Legacy Behaviour**: Preloads complete model record before opening edit form.
- **Vue Behaviour**: Copied shallow table row object directly into `form.value`.
- **Problem**: If list endpoint omitted attributes or cached old data, edit form would overwrite missing attributes with null or default values.
- **Root Cause**: Missing full record hydration call.
- **Fix**: Immediately populated form with row data for responsiveness, then fetched `GET /api/v1/groups/:id` to guarantee all attributes are fully hydrated.
- **Status**: Fixed
- **Verification**: Verified edit drawer hydrations perform full record fetch and populate all relations accurately.
