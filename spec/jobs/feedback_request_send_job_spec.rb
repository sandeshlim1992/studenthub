# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe FeedbackRequestSendJob, aggregate_failures: true, type: :job do
  let(:service) { Service::FeedbackCollection::DeliverRequest }

  before do
    allow(service).to receive(:execute)
  end

  it 'sends pending requests' do
    described_class.perform_now(create(:feedback_request, state: 'pending').id)

    expect(service).to have_received(:execute)
  end

  it 'retries failed requests' do
    described_class.perform_now(create(:feedback_request, state: 'failed').id)

    expect(service).to have_received(:execute)
  end

  it 'never resends a request that was already sent or answered' do
    described_class.perform_now(create(:feedback_request, state: 'sent').id)
    described_class.perform_now(create(:feedback_request, :submitted).id)

    expect(service).not_to have_received(:execute)
  end

  it 'ignores deleted requests' do
    expect { described_class.perform_now(0) }.not_to raise_error
  end
end
