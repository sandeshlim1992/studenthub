# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Transaction::FeedbackCollection, aggregate_failures: true, performs_jobs: true do
  let(:group)    { create(:group) }
  let(:agent)    { create(:agent, groups: [group]) }
  let(:customer) { create(:customer, email: 'jane@example.com') }
  let(:ticket)   { create(:ticket, group:, owner: agent, customer:, state_name: 'open') }

  before do
    Setting.set('feedback_collection', true)
    Setting.set('feedback_collection_config', FeedbackRequest::DEFAULT_CONFIG)
    allow(FeedbackRequestSendJob).to receive(:perform_later)
  end

  def close(target, state_name: 'closed')
    target.update!(state: Ticket::State.lookup(name: state_name))
    TransactionDispatcher.commit
    perform_enqueued_jobs(only: TransactionJob)
  end

  it 'is registered as an async transaction backend' do
    expect(Setting.where(area: 'Transaction::Backend::Async').map { |setting| Setting.get(setting.name) }).to include(described_class.name)
  end

  it 'asks for feedback when a ticket is closed' do
    ticket
    TransactionDispatcher.commit
    perform_enqueued_jobs(only: TransactionJob)

    expect { close(ticket) }.to change(FeedbackRequest, :count).by(1)
    expect(FeedbackRequestSendJob).to have_received(:perform_later).with(FeedbackRequest.last.id)
  end

  it 'does nothing for other state changes' do
    ticket
    TransactionDispatcher.commit
    perform_enqueued_jobs(only: TransactionJob)

    expect { close(ticket, state_name: 'pending reminder') }.not_to change(FeedbackRequest, :count)
  end

  it 'does nothing while the feature is off' do
    Setting.set('feedback_collection', false)
    ticket
    TransactionDispatcher.commit
    perform_enqueued_jobs(only: TransactionJob)

    expect { close(ticket) }.not_to change(FeedbackRequest, :count)
  end

  it 'ignores ticket creation, even as closed' do
    expect do
      create(:ticket, group:, owner: agent, customer:, state_name: 'closed')
      TransactionDispatcher.commit
      perform_enqueued_jobs(only: TransactionJob)
    end.not_to change(FeedbackRequest, :count)
  end
end
