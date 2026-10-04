# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Service::FeedbackCollection::RequestFeedback, aggregate_failures: true, performs_jobs: true do
  subject(:service) { described_class.new(ticket:) }

  let(:group)    { create(:group) }
  let(:agent)    { create(:agent, firstname: 'Borice', groups: [group]) }
  let(:customer) { create(:customer, firstname: 'Jane', email: 'jane@example.com') }
  let(:ticket)   { create(:ticket, group:, owner: agent, customer:, state_name: 'closed', title: 'Password Reset Request') }
  let(:config)   { {} }

  before do
    Setting.set('feedback_collection', true)
    Setting.set('feedback_collection_config', FeedbackRequest::DEFAULT_CONFIG.merge(config))
  end

  it 'creates a pending request with a snapshot of the ticket and queues the email' do
    expect { service.execute }.to have_enqueued_job(FeedbackRequestSendJob)

    expect(FeedbackRequest.last).to have_attributes(
      ticket_id:      ticket.id,
      ticket_number:  ticket.number,
      ticket_title:   'Password Reset Request',
      customer_email: 'jane@example.com',
      customer_name:  'Jane',
      owner_name:     'Borice',
      group_name:     group.name,
      state:          'pending',
      source:         'native',
    )
  end

  context 'when the feature is off' do
    before { Setting.set('feedback_collection', false) }

    it 'does nothing' do
      expect { service.execute }.not_to change(FeedbackRequest, :count)
    end
  end

  context 'when the customer has no email address' do
    let(:customer) { create(:customer, email: '') }

    it 'does nothing' do
      expect { service.execute }.not_to change(FeedbackRequest, :count)
    end
  end

  context 'when no owner is set' do
    let(:ticket) { create(:ticket, group:, customer:, state_name: 'closed') }

    it 'skips the ticket while "owner must be set" is on' do
      expect { service.execute }.not_to change(FeedbackRequest, :count)
    end

    context 'with the owner rule turned off' do
      let(:config) { { require_owner: false } }

      it 'sends the request and leaves the agent name blank' do
        service.execute
        expect(FeedbackRequest.last.owner_name).to eq('')
      end
    end
  end

  context 'when the ticket has a skipped tag' do
    before { ticket.tag_add('spam', 1) }

    it 'does nothing' do
      expect { service.execute }.not_to change(FeedbackRequest, :count)
    end
  end

  context 'when only certain groups are selected' do
    let(:config) { { group_ids: [create(:group).id] } }

    it 'skips tickets from other groups' do
      expect { service.execute }.not_to change(FeedbackRequest, :count)
    end
  end

  context 'with a resend window' do
    let(:config) { { resend_after_days: 7 } }

    it 'skips a ticket that was asked within the window' do
      create(:feedback_request, ticket:, created_at: 2.days.ago)

      expect { service.execute }.not_to change(FeedbackRequest, :count)
    end

    it 'asks again after the window' do
      create(:feedback_request, ticket:, created_at: 10.days.ago)

      expect { service.execute }.to change(FeedbackRequest, :count).by(1)
    end
  end

  context 'without a resend window' do
    it 'asks every time the ticket is closed' do
      create(:feedback_request, ticket:, created_at: 1.hour.ago)

      expect { service.execute }.to change(FeedbackRequest, :count).by(1)
    end
  end
end
