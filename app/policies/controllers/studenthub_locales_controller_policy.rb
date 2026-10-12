# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# The admin pages that pick a language: Knowledge Base and Branding.
class Controllers::StudenthubLocalesControllerPolicy < Controllers::ApplicationControllerPolicy
  default_permit!(['admin.knowledge_base', 'admin.branding'])
end
