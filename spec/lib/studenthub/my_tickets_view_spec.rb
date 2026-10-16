# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::MyTicketsView, aggregate_failures: true do
  let(:overview)    { Overview.find_by(link: 'my_tickets') }
  let(:customer)    { create(:customer) }
  let(:in_progress) { create(:ticket_state, name: '3. In Progress', state_type: Ticket::StateType.find_by(name: 'open')) }

  let!(:tickets) do
    {
      new:         create(:ticket, customer:, state: Ticket::State.find_by(name: 'new')),
      in_progress: create(:ticket, customer:, state: in_progress),
      closed:      create(:ticket, customer:, state: Ticket::State.find_by(name: 'closed')),
      merged:      create(:ticket, customer:, state: Ticket::State.find_by(name: 'merged')),
      others:      create(:ticket, customer: create(:customer, organization: customer.organization), state: Ticket::State.find_by(name: 'new')),
    }
  end

  def listed
    Ticket::Overviews.tickets_for_overview(overview.reload, customer).to_a
  end

  it "lists the customer's own tickets in every state but merged, also states added after Zammad's seeds" do
    expect(listed).not_to include(tickets[:in_progress])

    described_class.ensure!

    expect(listed).to contain_exactly(tickets[:new], tickets[:in_progress], tickets[:closed])
  end

  it 'keeps the other conditions and changes the view only once' do
    customer_condition = overview.condition['ticket.customer_id']

    described_class.ensure!
    updated_at = overview.reload.updated_at
    described_class.ensure!

    expect(overview.reload.condition['ticket.customer_id']).to eq(customer_condition)
    expect(overview.condition['ticket.state_id']).to eq('operator' => 'is not', 'value' => Ticket::State.by_category_ids(:merged).map(&:to_s))
    expect(overview.updated_at).to eq(updated_at)
  end
end
