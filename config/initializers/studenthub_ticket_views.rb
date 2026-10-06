# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub ticket views, added to Zammad's classes without editing them: each agent's own
# grouping and order of a view (Studenthub::TicketViews::Choice), the Teams views that follow
# the groups (Studenthub::TicketViews::Teams) and the Institutions views that follow the
# organisations (Studenthub::TicketViews::Institutions).
Rails.application.config.to_prepare do
  choice = Studenthub::TicketViews::Choice

  Ticket::Overviews.singleton_class.prepend(choice::Overviews) if Ticket::Overviews.singleton_class.ancestors.exclude?(choice::Overviews)
  Gql::Types::OverviewType.prepend(choice::OverviewType) if Gql::Types::OverviewType.ancestors.exclude?(choice::OverviewType)
  [Gql::Types::OverviewType, Gql::Queries::Tickets::Cached::ByOverview].each do |klass|
    klass.prepend(choice::OverviewCaching) if klass.ancestors.exclude?(choice::OverviewCaching)
  end

  [Group, Role, Ticket::State].each do |klass|
    klass.include(Studenthub::TicketViews::Teams::Sync) if klass.ancestors.exclude?(Studenthub::TicketViews::Teams::Sync)
  end

  institutions = Studenthub::TicketViews::Institutions
  Organization.include(institutions::Sync) if Organization.ancestors.exclude?(institutions::Sync)
  Overview.include(institutions::OverviewSync) if Overview.ancestors.exclude?(institutions::OverviewSync)
end
