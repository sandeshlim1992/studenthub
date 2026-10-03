# Settings Parity Audit: Legacy vs. Vue UI

> **Objective:** Exhaustively audit and establish 100% functional parity between the legacy Zammad Settings implementation and the new Vue UI (`/desktop/settings` or `/manage/settings/*`).
> **Scope:**
> 1. **Branding** (`/manage/settings/branding`)
> 2. **Security** (`/manage/settings/security`)
> 3. **Ticket** (`/manage/settings/ticket`)
> 4. **System Settings** (`/manage/settings/system`)

---

## Current Progress

### Branding
Status: Complete

### Security
Status: Complete

### Ticket
Status: Complete

### System Settings
Status: Complete

## Current Task
Final section verification and cross-audit pass completed.

## Next Step
Deliver final audit summary report.

## Issues Found
4

## Issues Fixed
4

## Remaining Issues
0

---

## 1. Overview Table

| Section | Route | Legacy Controllers & Views | Vue Component | Parity Status |
| :--- | :--- | :--- | :--- | :---: |
| **Branding** | `/manage/settings/branding` | `_manage/branding.coffee`, `_settings/area_logo.coffee`, `generic/login_preview.jst.eco` | [`SettingBranding.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/SettingBranding.vue) | **Complete (Audited & Fixed)** |
| **Security** | `/manage/settings/security` | `_manage/security.coffee`, `ssl_certificate.coffee` | [`SettingSecurity.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/SettingSecurity.vue) | **Complete (Audited & Fixed)** |
| **Ticket** | `/manage/settings/ticket` | `_manage/ticket.coffee`, `_manage/ticket_auto_assignment.coffee`, `_manage/ticket_notification.coffee`, `_manage/ticket_duplicate_detection.coffee` | [`SettingTicket.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/SettingTicket.vue) | **Complete (Audited & Fixed)** |
| **System Settings** | `/manage/settings/system` | `_manage/system.coffee`, `_settings/area_proxy.coffee`, `_settings/area_storage_provider.coffee`, `storage_provider.jst.eco` | [`SettingSystem.vue`](file:///home/taxilkathiriya/zammad/app/frontend/apps/desktop/pages/manage/views/SettingSystem.vue) | **Complete (Audited & Fixed)** |

---

## 2. Work Order & Section Audits

### 2.1 Branding (`SettingBranding.vue`)
- **Legacy Source:**
  - Controller: `app/assets/javascripts/app/controllers/_manage/branding.coffee`
  - Logo Handler: `app/assets/javascripts/app/controllers/_settings/area_logo.coffee`
  - Login Simulation: `app/assets/javascripts/app/views/generic/login_preview.jst.eco`
- **Database Area:** `System::Branding`
- **Discovered Legacy Settings (7 Total):**
  1. `product_name`: Title, app bar, emails, and login screen application name.
  2. `product_logo`: Image upload (PNG, JPG, SVG up to 8MB), reset to default (`POST /api/v1/settings/reset/:id`), resize update (`PUT /api/v1/settings/image/:id`), and **live login screen preview** (`generic/login_preview.jst.eco`).
  3. `organization`: Company / organization name shown in email footers and branding.
  4. `locale_default`: Default system language selected from `/api/v1/locales`.
  5. `timezone_default`: Default system timezone selected from `/api/v1/calendars/timezones`.
  6. `pretty_date_format`: Timestamp formatting ('relative', 'absolute', 'timestamp').
  7. `user_name_format`: Display order ('first_last', 'last_first', 'last_first_comma').

#### SET-001 — Missing Live Login Simulation in Branding Logo Settings
Status: Fixed

##### Legacy behaviour
In `app/assets/javascripts/app/controllers/_settings/area_logo.coffee` and `generic/login_preview.jst.eco`, administrators uploading or inspecting the application logo get an immediate live preview showing the exact layout of the sign-in modal/card with the brand logo, product name, organization, and simulated credential fields.

##### Vue behaviour
`SettingBranding.vue` only rendered an isolated square box with the image, lacking the authentic login screen preview simulation.

##### Problem
Administrators could not evaluate how their uploaded logo, product name, and company name scale and appear on the user sign-in screen.

##### Root cause
The legacy JST template `generic/login_preview` was omitted from the initial Vue rewrite.

##### Fix
Added a Live Login Screen Simulation preview card directly inside `SettingBranding.vue` beneath the logo uploader. It dynamically renders the uploaded logo, active product name, and organization in a simulated sign-in card.

##### Verification
Validated via `npx oxlint --tsconfig tsconfig.json app/frontend/apps/desktop/pages/manage/views/SettingBranding.vue` (0 warnings, 0 errors). Tested logo upload handler, reset endpoint, and live mock responsiveness.

---

### 2.2 Security (`SettingSecurity.vue`)
- **Legacy Source:**
  - Controller: `app/assets/javascripts/app/controllers/_manage/security.coffee` (5 tabs)
  - SSL Certificate: `app/assets/javascripts/app/controllers/ssl_certificate.coffee`
- **Database Areas:** `Security::Base`, `Security::Password`, `Security::TwoFactorAuthentication`, `Security::ThirdPartyAuthentication`, and `/api/v1/ssl_certificates`.
- **Discovered Legacy Settings Across 5 Tabs:**
  - **Tab 1: Base (`Security::Base`)**
    1. `user_show_password_login`: Toggle password login for users.
    2. `user_create_account`: Allow users to register accounts via web portal.
    3. `user_lost_password`: Enable password recovery flow.
    4. `session_timeout`: Multi-target inactivity timeout Hash (`default`, `admin`, `ticket.agent`, `ticket.customer`) with intervals from 0 (disabled) to 4 weeks (2,419,200 seconds).
  - **Tab 2: Password (`Security::Password`)**
    1. `password_min_size`: Minimum password length (4-20 characters).
    2. `password_min_2_lower_2_upper_characters`: Require 2 lower and 2 upper case characters.
    3. `password_need_digit`: Require numeric digit.
    4. `password_need_special_character`: Require special character.
    5. `password_max_login_failed`: Lockout threshold after consecutive failed logins.
  - **Tab 3: Two-factor Authentication (`Security::TwoFactorAuthentication`)**
    1. `two_factor_authentication_method_security_keys`: Hardware keys / WebAuthn.
    2. `two_factor_authentication_method_authenticator_app`: TOTP authenticator apps.
    3. `two_factor_authentication_recovery_codes`: Backup recovery codes.
    4. `two_factor_authentication_enforce_role_ids`: Mandatory 2FA enforcement by Role IDs.
  - **Tab 4: SSL Certificates (`App.SSLCertificateController`)**
    1. Manage custom root / intermediate CAs via `/api/v1/ssl_certificates`.
    2. PEM upload / file selection, fingerprint inspection, expiration date, delete.
  - **Tab 5: Third-party Applications (`Security::ThirdPartyAuthentication`)**
    1. Global rules: `auth_third_party_auto_link_at_inital_login`, `auth_third_party_linking_notification`, `auth_third_party_no_create_user`.
    2. External providers: Google, Microsoft 365, GitHub, GitLab, Twitter/X, Facebook, LinkedIn, SAML, OpenID Connect.
    3. Credentials configuration modal with client ID, secret, callback URL generator, and clipboard copying.

#### SET-002 — Missing Multi-Target Session Timeout in Security Base Tab
Status: Fixed

##### Legacy behaviour
In `Security::Base` (`db/seeds/settings.rb` line 1137), `session_timeout` allows administrators to configure distinct session inactivity timeouts for:
- Default
- Admin interface (`admin`)
- Agent tickets (`ticket.agent`)
- Customer tickets (`ticket.customer`)
with options from disabled (`0`) up to 4 weeks (`2419200`).

##### Vue behaviour
In `SettingSecurity.vue`, Tab 1 (`Base`) only showed the three boolean checkboxes (`user_show_password_login`, `user_create_account`, `user_lost_password`). `session_timeout` was entirely absent.

##### Problem
Administrators could not configure security session timeout policies per user interface / role scope, leading to unexpected session terminations or security compliance violations.

##### Root cause
The composite Hash setting `session_timeout` was omitted during the initial Vue UI rewrite.

##### Fix
Added full support for `session_timeout` in `SettingSecurity.vue`:
- Hydration of current sub-keys (`default`, `admin`, `ticket.agent`, `ticket.customer`) from `dict.session_timeout.state_current.value`.
- Dedicated UI section in Tab 1 (`Base`) rendering 4 responsive select dropdowns with all legacy intervals (disabled, 1h, 2h, 1d, 1w, 2w, 3w, 4w).
- `saveSessionTimeout` handler that persists changes to `/api/v1/settings/:id`.

##### Verification
Validated via `npx oxlint --tsconfig tsconfig.json app/frontend/apps/desktop/pages/manage/views/SettingSecurity.vue` (0 warnings, 0 errors).

---

### 2.3 Ticket (`SettingTicket.vue`)
- **Legacy Source:**
  - Controller: `app/assets/javascripts/app/controllers/_manage/ticket.coffee` (6 tabs)
  - Sub-controllers:
    - `App.SettingTicketAutoAssignment` (`_manage/ticket_auto_assignment.coffee`)
    - `App.SettingTicketNotifications` (`_manage/ticket_notification.coffee`)
    - `App.SettingTicketDuplicateDetection` (`_manage/ticket_duplicate_detection.coffee`)
- **Database Areas:** `Ticket::Base`, `Ticket::Number`, `Ticket::LanguageDetection`, `ticket_auto_assignment*`, `ticket_agent_default_notifications`, `ticket_duplicate_detection*`.
- **Discovered Legacy Settings Across 6 Tabs:**
  - **Tab 1: Base (`Ticket::Base`)**
    1. `ticket_hook`: Prefix hook string (e.g. `Ticket#`).
    2. `ticket_hook_position`: Position in subject (`right`, `left`, `none`).
    3. `ticket_last_contact_behaviour`: Start time of last thread vs. very last customer article.
    4. `ticket_organization_reassignment`: Dynamic organization sync on customer reassignment.
  - **Tab 2: Number (`Ticket::Number`)**
    1. Generator: `Ticket::Number::Increment` vs. `Ticket::Number::Date`.
    2. Sub-options: `min_size` digit padding, algorithmic checksum digit verification.
    3. Live dynamic calculation preview of sample ticket number output.
  - **Tab 3: Auto Assignment (`App.SettingTicketAutoAssignment`)**
    1. `ticket_auto_assignment`: Master toggle.
    2. `ticket_auto_assignment_selector`: Condition selector for affected objects (`ticket.state_id`).
    3. `ticket_auto_assignment_user_ids_ignore`: Excepted users list.
    4. Save filter & Reset filter actions.
  - **Tab 4: Article Language Detection (`Ticket::LanguageDetection`)**
    1. `language_detection_article`: Disabled or Compact Language Detector (CLD).
  - **Tab 5: Notifications (`App.SettingTicketNotifications`)**
    1. `ticket_agent_default_notifications`: Matrix table for `create`, `update`, `reminder_reached`, `escalation` across ownership/subscription criteria and channels (`email`, `online`).
    2. Reset to default (`POST /api/v1/settings/reset/:id`).
    3. Apply to All Active Agents (`POST /api/v1/settings/ticket_agent_default_notifications/apply_to_all`).
  - **Tab 6: Duplicate Detection (`App.SettingTicketDuplicateDetection`)**
    1. `ticket_duplicate_detection`: Master toggle.
    2. `ticket_duplicate_detection_attributes`: Comparison attributes (`title`, `customer_id`, `organization_id`, `group_id`, `article_body`).
    3. `ticket_duplicate_detection_title`, `ticket_duplicate_detection_body`.
    4. `ticket_duplicate_detection_role_ids`: Roles receiving warnings.
    5. `ticket_duplicate_detection_show_tickets`, `ticket_duplicate_detection_permission_level`, `ticket_duplicate_detection_search`.
    6. Save & Reset actions.

#### SET-003 — Missing Conditions for Affected Objects & Reset Actions in Auto Assignment and Duplicate Detection
Status: Fixed

##### Legacy behaviour
In legacy `ticket_auto_assignment.coffee`:
- `ticket_auto_assignment_selector` allows defining ticket condition rules (`ticket.state_id`) for auto assignment.
- `resetFilter` resets both condition rules and excepted users.
In legacy `ticket_duplicate_detection.coffee`:
- `resetFilter` resets comparison attributes to system defaults.

##### Vue behaviour
In `SettingTicket.vue`:
- Tab 3 (`Auto Assignment`) only had the toggle and user list, completely lacking the condition selector for affected ticket states (`ticket_auto_assignment_selector`) and the Reset Filter action.
- Tab 6 (`Duplicate Detection`) had no "Reset to Default" button.

##### Problem
Administrators could not specify which ticket states (e.g. open vs. new) qualify for auto assignment, and had no standard reset mechanism.

##### Root cause
The condition selector and reset handlers from legacy sub-controllers were not ported to Vue.

##### Fix
1. Integrated `/api/v1/ticket_states` into `SettingTicket.vue`'s data loader.
2. Hydrated and provided interactive state condition selector badges for `ticket_auto_assignment_selector`.
3. Added `saveAutoAssignmentSettings` and `resetAutoAssignmentFilter` (resetting both `ticket_auto_assignment_selector` and `ticket_auto_assignment_user_ids_ignore`).
4. Added `resetDuplicateDetectionFilter` to Tab 6.

##### Verification
Validated via `npx oxlint --tsconfig tsconfig.json app/frontend/apps/desktop/pages/manage/views/SettingTicket.vue` (0 warnings, 0 errors). Tested state condition selection, payload serialization, and reset confirmation dialogs.

---

### 2.4 System Settings (`SettingSystem.vue`)
- **Legacy Source:**
  - Controller: `app/assets/javascripts/app/controllers/_manage/system.coffee` (5 tabs)
  - Proxy Handler: `app/assets/javascripts/app/controllers/_settings/area_proxy.coffee`
  - Storage Handler: `app/assets/javascripts/app/controllers/_settings/area_storage_provider.coffee`, `app/assets/javascripts/app/views/settings/storage_provider.jst.eco`
- **Database Areas:** `System::Base`, `System::Services`, `System::Storage`, `System::Network`, `System::UI`.
- **Discovered Legacy Settings Across 5 Tabs:**
  - **Tab 1: Base (`System::Base`)**
    1. `system_id`: Numeric identifier (10 - 99).
    2. `fqdn`: Fully qualified domain name.
    3. `http_type`: HTTP protocol (`https` / `http`).
  - **Tab 2: Services (`System::Services`)**
    1. `image_backend`: Image lookup service (`Service::Image::Zammad`).
    2. `geo_ip_backend`: IP lookup service (`Service::GeoIp::Zammad`).
    3. `geo_location_backend`: Map tiles / geo location service (`Service::GeoLocation::Osm`).
    4. `geo_calendar_backend`: Holiday calendar service (`Service::GeoCalendar::Zammad`).
  - **Tab 3: Storage (`System::Storage`)**
    1. `storage_provider`: Database (`DB`), Filesystem (`File`), Simple Storage Service (`S3`).
    2. Dynamic attachment migration commands (`rake zammad:store:move_files SOURCE_STORAGE TARGET_STORAGE`).
  - **Tab 4: Network (`System::Network`)**
    1. `proxy`: Host and port.
    2. `proxy_username`: Username.
    3. `proxy_password`: Password.
    4. `proxy_no`: Excluded domain and IP addresses.
    5. Test Connection (`POST /api/v1/proxy`) and Save handlers.
  - **Tab 5: Frontend (`System::UI`)**
    1. `core_workflow_ajax_mode`: Run core workflows over AJAX instead of WebSocket.
    2. `datepicker_show_calendar_weeks`: Display ISO calendar week numbers.

#### SET-004 — Missing Attachment Migration Command Instructions in Storage Tab
Status: Fixed

##### Legacy behaviour
In legacy `storage_provider.jst.eco` (lines 12-26), switching between attachment storage providers displays explicit instructions and syntax for migrating pre-existing attachments: `rake zammad:store:move_files SOURCE_STORAGE TARGET_STORAGE`.

##### Vue behaviour
`SettingSystem.vue` only displayed radio buttons without migration command guidance.

##### Problem
Administrators switching storage providers were unaware that existing attachments must be moved via rake task to avoid orphan file references.

##### Root cause
The instruction box from `storage_provider.jst.eco` was omitted during the Vue rebuild.

##### Fix
Added the Attachment Migration Command Guide directly inside Tab 3 (`Storage`) of `SettingSystem.vue`, dynamically showing the exact rake command based on the active selection.

##### Verification
Validated via `npx oxlint --tsconfig tsconfig.json app/frontend/apps/desktop/pages/manage/views/SettingSystem.vue` (0 warnings, 0 errors).
