# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

# Student Hub: a notification whose ticket was deleted (a notification job that wrote it just as
# the ticket went) shows as one the user can no longer see; the rest of the list still loads.
RSpec.describe Gql::Queries::OnlineNotifications, authenticated_as: :user, type: :graphql do
  let(:user)           { create(:agent, groups: [ticket.group, deleted_ticket.group]) }
  let(:ticket)         { create(:ticket) }
  let(:deleted_ticket) { create(:ticket) }
  let(:notification)   { create(:online_notification, user:, o: ticket) }
  let(:orphan)         { create(:online_notification, user:, o: deleted_ticket) }

  let(:query) do
    <<~QUERY
      query onlineNotifications {
        onlineNotifications {
          edges {
            node {
              id
              seen
              metaObject {
                ... on Ticket {
                  id
                }
              }
            }
          }
        }
      }
    QUERY
  end

  before do
    notification
    orphan
    # The ticket goes without its notifications, as when the notification job wrote them late.
    Ticket.where(id: deleted_ticket.id).delete_all
  end

  it 'lists the notification without its ticket' do
    gql.execute(query)

    expect(gql.result.nodes).to contain_exactly(
      include('id' => gql.id(notification), 'metaObject' => include('id' => gql.id(ticket))),
      include('id' => gql.id(orphan), 'metaObject' => nil),
    )
  end
end
