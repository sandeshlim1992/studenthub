# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::TicketViews::Choice, aggregate_failures: true do
  let(:group)     { create(:group) }
  let(:agent)     { create(:agent, groups: [group]) }
  let(:colleague) { create(:agent, groups: [group]) }
  let(:overview) do
    create(:overview, roles: [Role.find_by(name: 'Agent')], group_by: 'owner', order: { by: 'created_at', direction: 'DESC' },
                      condition: { 'ticket.group_id' => { operator: 'is', value: [group.id.to_s] } })
  end

  it "uses the view's own grouping and order until the agent chooses" do
    expect(described_class.group_by(agent, overview)).to eq('owner')
    expect(described_class.order_by(agent, overview)).to eq('created_at')

    described_class.save!(agent, overview, group_by: 'state', order_by: 'number', order_direction: 'ASC')

    expect(described_class.group_by(agent.reload, overview)).to eq('state')
    expect(described_class.order_by(agent, overview)).to eq('number')
    expect(described_class.order_direction(agent, overview)).to eq('ASC')
    expect(described_class.group_by(colleague, overview)).to eq('owner')
  end

  it 'can turn grouping off and go back to the defaults' do
    described_class.save!(agent, overview, group_by: '')
    expect(described_class.group_by(agent.reload, overview)).to be_nil

    described_class.reset!(agent, overview)
    expect(described_class.group_by(agent.reload, overview)).to eq('owner')
  end

  it 'refuses unknown groupings and directions' do
    expect { described_class.save!(agent, overview, group_by: 'password') }.to raise_error(ArgumentError)
    expect { described_class.save!(agent, overview, order_direction: 'SIDEWAYS') }.to raise_error(ArgumentError)
  end

  it 'groups the ticket query by the agent choice' do
    ticket_new  = create(:ticket, group:, state_name: 'new', created_at: 2.hours.ago)
    ticket_open = create(:ticket, group:, state_name: 'open', created_at: 1.hour.ago)
    described_class.save!(agent, overview, group_by: 'state', order_by: 'created_at', order_direction: 'DESC')

    tickets = Ticket::Overviews.tickets_for_overview(overview, agent.reload).to_a

    # Grouped by state first: "new" before "open", whatever the creation order.
    expect(tickets.index(ticket_new)).to be < tickets.index(ticket_open)
  end

  it "keeps an agent's cached lists apart from colleagues with the same groups" do
    expect(described_class.cache_key_part(agent, overview)).to be_nil

    described_class.save!(agent, overview, group_by: 'state')

    expect(described_class.cache_key_part(agent.reload, overview)).to include("studenthubChoice:#{agent.id}:state")
  end
end
