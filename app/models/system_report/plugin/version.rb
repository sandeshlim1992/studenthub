# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

class SystemReport::Plugin::Version < SystemReport::Plugin
  DESCRIPTION = __('Student Hub version').freeze

  def fetch
    ::Version.get
  end
end
