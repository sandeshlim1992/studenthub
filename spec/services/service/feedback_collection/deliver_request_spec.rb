# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Service::FeedbackCollection::DeliverRequest, aggregate_failures: true do
  subject(:service) { described_class.new(feedback_request:) }

  let(:channel)          { create(:email_channel) }
  let(:feedback_request) { create(:feedback_request, state: 'pending', customer_name: 'Jane', ticket_title: 'Password <Reset>') }

  before do
    Setting.set('fqdn', 'ticket.example.com')
    Setting.set('http_type', 'https')
    Setting.set('feedback_collection_config', FeedbackRequest::DEFAULT_CONFIG.merge(
                                                channel_id: channel.id,
                                                from_name:  'Student Hub Feedback',
                                                from_email: 'feedback@example.com',
                                                reply_to:   'feedback@example.com',
                                              ))
    allow(Channel).to receive(:find_by).and_call_original
    allow(Channel).to receive(:find_by).with(id: channel.id).and_return(channel)
  end

  context 'when sending works' do
    let(:sent) { [] }

    # Records each delivery so the examples can inspect the rendered email.
    before do
      allow(channel).to receive(:deliver) { |params, notification| sent << [params, notification] } # rubocop:disable RSpec/ExpectInHook
    end

    it 'sends one email through the selected channel and marks the request as sent' do
      service.execute

      params, notification = sent.sole
      expect(params).to include(
        from:         'Student Hub Feedback <feedback@example.com>',
        to:           'student@example.com',
        reply_to:     'feedback@example.com',
        subject:      "Service Feedback Request: Ticket ##{feedback_request.ticket_number}",
        content_type: 'text/html',
      )
      expect(notification).to be(true)
      expect(feedback_request.reload).to have_attributes(state: 'sent', error: nil, sent_at: be_present)
    end

    it 'links all five ratings to a token that finds this request' do
      service.execute

      links = sent.sole.first[:body].scan(%r{https://ticket\.example\.com/feedback/([a-f0-9]{64})\?rating=(\d)})
      expect(links.map(&:last)).to eq(%w[1 2 3 4 5])
      expect(FeedbackRequest.lookup_by_token(links.first.first)).to eq(feedback_request)
    end

    it 'escapes ticket values in the HTML body' do
      service.execute

      expect(sent.sole.first[:body]).to include('Password &lt;Reset&gt;').and(include('Hello Jane'))
    end
  end

  context 'when sending fails' do
    before do
      allow(channel).to receive(:deliver).and_raise(StandardError, 'Authentication failed')
    end

    it 'marks the request as failed and re-raises so the job retries' do
      expect { service.execute }.to raise_error(StandardError, 'Authentication failed')
      expect(feedback_request.reload).to have_attributes(state: 'failed', error: 'Authentication failed')
    end
  end

  context 'when the channel is inactive' do
    before { channel.update!(active: false) }

    it 'fails with a clear message' do
      expect { service.execute }.to raise_error(described_class::DeliveryError, %r{not active})
      expect(feedback_request.reload.state).to eq('failed')
    end
  end
end
