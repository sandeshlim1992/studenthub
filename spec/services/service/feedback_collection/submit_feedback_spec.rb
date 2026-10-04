# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Service::FeedbackCollection::SubmitFeedback, aggregate_failures: true do
  let(:ticket)           { create(:ticket, state_name: 'closed') }
  let(:feedback_request) { create(:feedback_request, ticket:) }
  let(:config)           { {} }

  before do
    Setting.set('feedback_collection_config', FeedbackRequest::DEFAULT_CONFIG.merge(config))
  end

  def submit(rating: 4, comments: 'Quick fix')
    described_class.new(feedback_request:, rating:, comments:).execute
  end

  it 'stores the rating and comment' do
    submit(rating: '4', comments: "  Quick fix\n")

    expect(feedback_request.reload).to have_attributes(state: 'submitted', rating: 4, comments: 'Quick fix', rated_at: be_present)
  end

  it 'stores no comment when none is given' do
    submit(comments: '   ')

    expect(feedback_request.reload.comments).to be_nil
  end

  it 'rejects ratings outside 1 to 5' do
    expect { submit(rating: 6) }.to raise_error(described_class::InvalidRatingError)
    expect { submit(rating: 'x') }.to raise_error(described_class::InvalidRatingError)
    expect(feedback_request.reload.state).to eq('sent')
  end

  it 'accepts only one submission' do
    submit

    expect { submit(rating: 1) }.to raise_error(described_class::AlreadySubmittedError)
    expect(feedback_request.reload.rating).to eq(4)
  end

  describe 'internal note' do
    it 'adds an escaped internal note without reopening the ticket' do
      expect { submit(comments: 'Fixed <script>x</script>') }.to change { ticket.articles.count }.by(1)

      note = ticket.articles.last
      expect(note).to have_attributes(internal: true, subject: 'Customer feedback')
      expect(note.sender.name).to eq('System')
      expect(note.body).to include('★★★★☆ (4/5)').and(include('&lt;script&gt;'))
      expect(ticket.reload.state.name).to eq('closed')
    end

    context 'when turned off' do
      let(:config) { { add_internal_note: false } }

      it 'adds no note' do
        expect { submit }.not_to change { ticket.articles.count }
      end
    end
  end

  describe 'notification email' do
    let(:channel) { create(:email_channel) }
    let(:config)  { { notify_email: 'team@example.com', channel_id: channel.id, from_email: 'feedback@example.com' } }

    before do
      allow(Channel).to receive(:find_by).and_call_original
      allow(Channel).to receive(:find_by).with(id: channel.id).and_return(channel)
      allow(channel).to receive(:deliver)
    end

    it 'sends a plain-text summary with the customer as reply-to' do
      submit(rating: 5)

      expect(channel).to have_received(:deliver).with(
        hash_including(
          to:           'team@example.com',
          reply_to:     'student@example.com',
          subject:      "Ticket ##{feedback_request.ticket_number}: 5-Star Feedback",
          content_type: 'text/plain',
          body:         include('Rating: 5/5'),
        ),
        true
      )
    end
  end
end
