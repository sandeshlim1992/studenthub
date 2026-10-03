# Users Management: Legacy vs Vue Parity Audit

- **Section**: Administration → Users Management
- **URL**: `http://localhost:3000/desktop/manage/users`
- **Legacy Source of Truth**:
  - Controller: [`app/assets/javascripts/app/controllers/user.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/user.coffee)
  - Generic Index: [`app/assets/javascripts/app/controllers/_application_controller/_generic_index.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/_application_controller/_generic_index.coffee)
  - Edit Modal: [`app/assets/javascripts/app/controllers/_application_controller/_modal_generic_edit.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/_application_controller/_modal_generic_edit.coffee)
  - New Modal: [`app/assets/javascripts/app/controllers/_application_controller/_modal_generic_new.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/_application_controller/_modal_generic_new.coffee)
  - Import Widgets: [`app/assets/javascripts/app/controllers/widget/import.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/widget/import.coffee), `import_try_result.coffee`, `import_result.coffee`
  - Two-Factor Management: [`app/assets/javascripts/app/controllers/user/manage_two_factor.coffee`](file:///home/taxilkathiriya/zammad/app/assets/javascripts/app/controllers/user/manage_two_factor.coffee)
- **Vue Implementation**:
  - Page View: [`app/frontend/apps/desktop/pages/manage/views/Users.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/Users.vue)
  - Edit Composable: [`app/frontend/apps/desktop/entities/user/composables/useUserEdit.ts`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/entities/user/composables/useUserEdit.ts)
  - Create Composable: [`app/frontend/apps/desktop/entities/user/composables/useUserCreate.ts`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/entities/user/composables/useUserCreate.ts)

---

## 1. Discovered Legacy Capabilities

### 1.1 List & Table Display
1. **Search**: Instant server-side search (`/api/v1/users/search`) across login, firstname, lastname, email, organization.
2. **Role Filtering**: Dynamic filter tabs based on active roles (`App.Role.findAllByAttribute('active', true)`).
3. **Sorting**: Sortable columns (login, firstname, lastname, organization, active, created_at) with ASC/DESC toggle.
4. **Pagination**: Server-side pagination (default 50 per page).
5. **Account Lock Indicator**:
   - In legacy `user.coffee` (`callbackLoginAttribute`), when `object.maxLoginFailedReached()` is true (exceeds `password_max_login_failed` config), a lock icon and tooltip `"This user is currently blocked because of too many failed login attempts."` is displayed.

### 1.2 User Actions
1. **Row Click / Edit Action**:
   - Opens user edit form.
   - Legacy preloads user and secondary organizations before rendering edit form.
2. **View from User's Perspective (`switchTo`)**:
   - Only available for active users (`available: (user) -> user.active`).
   - Calls `/api/v1/sessions/switch/:id` and reloads session.
3. **Two-Factor Authentication Management (`manageTwoFactor`)**:
   - Only displayed if user has active 2FA (`!!user.preferences?.two_factor_authentication?.default`).
   - Lists enabled 2FA methods, allows individual removal or removing all methods.
4. **Unlock User (`unlock`)**:
   - Only displayed if user account is locked (`user.maxLoginFailedReached()`).
   - Calls `PUT /api/v1/users/unlock/:id` to reset failed login counter to 0.
5. **Delete User (`delete`)**:
   - In legacy, redirects to `#system/data_privacy/:id` to prevent foreign key errors when tickets exist.

### 1.3 Create & Edit Dialogs
1. **New User**:
   - Opens create form flyout with all required/optional attributes, roles, and group permissions.
2. **Edit User Inactive Guard**:
   - When user is inactive, group permissions cannot be changed:
     `"You cannot view or change the group permissions of an inactive user. Activate them first to manage their permissions."`
   - Omit `group_ids` from submission so inactive status is preserved cleanly without erasing permissions.
3. **Organization Change Warning**:
   - When changing organization, warns user if `ticket_organization_reassignment` is enabled:
     `"Attention! Changing the organization will update the user's most recent tickets to the new organization."`

### 1.4 CSV Import
1. **Two-Stage Workflow**:
   - Step 1: Upload CSV file or paste raw text. Calls `POST /api/v1/users/import?try=true`.
   - Step 2: Test run result modal displays preview of changes: `stats.created`, `stats.updated`, `stats.deleted`.
   - Step 3: Admin confirms with button "Yes, start real import." (`try=false`), then summary of imported records is displayed.
2. **Download Example CSV**:
   - Provides sample file via `GET /api/v1/users/import_example`.

---

## 2. Issues Log

### Issue USR-001 — Edit User Flyout Opens with Incomplete Attributes
- **Section**: Users Management
- **Functionality**: User Edit Flyout
- **Legacy Behaviour**: Preloads full record and all secondary organizations before opening edit modal.
- **Vue Behaviour**: `handleEditUser(user)` passed the search table row directly into `openUserEditFlyout`. The search row only contains shallow table columns (`login`, `firstname`, `lastname`, `organization`). It lacked `email`, `phone`, `mobile`, `fax`, `department`, `street`, `zip`, `city`, `country`, `web`, `vip`, `note`, `role_ids`, `group_ids`, and custom object attributes.
- **Problem**: Opening edit flyout showed blank inputs for email and all other attributes. Saving could clear existing attributes.
- **Root Cause**: Shallow object passing instead of querying full GraphQL `UserDocument` or REST user record.
- **Fix**: In `handleEditUser(user)`, fetch the full GraphQL user using Apollo client `UserDocument` query before opening `openUserEditFlyout`.
- **Status**: Fixed
- **Verification**: Verified full user attributes are requested via Apollo client `UserDocument` (or REST show fallback) prior to flyout opening.

---

### Issue USR-002 — CSV Import Statistics Key Mismatch
- **Section**: Users Management
- **Functionality**: CSV Import Feedback
- **Legacy Behaviour**: Backend `User.csv_import` returns `{ result: 'success', stats: { created: X, updated: Y, total: Z } }`.
- **Vue Behaviour**: Vue template looked for `importResult.created_count` and `importResult.updated_count`.
- **Problem**: Result stats always displayed `0` created / `0` updated even after successful imports.
- **Root Cause**: Mismatch between Vue code assumptions and actual Rails `User.csv_import` return payload schema.
- **Fix**: Updated Vue template and handlers to read `importResult.stats?.created`, `importResult.stats?.updated`, and `importResult.stats?.total`.
- **Status**: Fixed
- **Verification**: Verified stats keys now map directly to `stats.created`, `stats.updated`, `stats.deleted`, and `stats.total`.

---

### Issue USR-003 — Missing Two-Stage CSV Import Confirmation Flow
- **Section**: Users Management
- **Functionality**: CSV Import
- **Legacy Behaviour**: Flow is 2-step: First run test import (`try: true`), show test stats preview dialog ("The test run was successful. X will be created, Y will be updated"), then user clicks "Yes, start real import".
- **Vue Behaviour**: Dry run simply displayed text at bottom of same form without distinct transition or confirmation dialog.
- **Problem**: Deviated from legacy UX where user can clearly verify test results before executing permanent import.
- **Root Cause**: Incomplete porting of `App.ImportTryResult` and `App.ImportResult`.
- **Fix**: Implemented explicit 3-stage wizard in `Users.vue`: (1) Input & Dry Run -> (2) Test Results Verification Modal -> (3) Real Import Execution & Final Summary.
- **Status**: Fixed
- **Verification**: Verified UI transitions through `input`, `preview`, and `complete` stages with appropriate actions.

---

### Issue USR-004 — Inactive User Group Permissions Guard
- **Section**: Users Management
- **Functionality**: User Edit Permissions
- **Legacy Behaviour**: When editing an inactive user, group permissions are locked and notice `"You cannot view or change the group permissions of an inactive user. Activate them first to manage their permissions."` is shown.
- **Vue Behaviour**: Form rendered group permissions identically regardless of user active state.
- **Problem**: Inactive users could have permissions erroneously toggled or cleared.
- **Root Cause**: Missing inactive state condition in `useUserEdit.ts`.
- **Fix**: Added active check and dynamic notice in `useUserEdit.ts` for field `active`.
- **Status**: Fixed
- **Verification**: Verified `formChangeFields.active.help` displays notice when inactive and clears on reactivate.

---

### Issue USR-005 — Hardcoded Failed Login Threshold
- **Section**: Users Management
- **Functionality**: User Lock Status
- **Legacy Behaviour**: Checks `user.login_failed > parseInt(App.Config.get('password_max_login_failed'))`.
- **Vue Behaviour**: Hardcoded to `user.login_failed >= 5`.
- **Problem**: Did not respect custom system configuration for maximum login attempts.
- **Root Cause**: Missing integration with `useApplicationStore().config.password_max_login_failed`.
- **Fix**: Check `application.config.password_max_login_failed` (defaulting to 5 if not configured).
- **Status**: Fixed
- **Verification**: Verified `isUserLocked` dynamically evaluates using application store config.
