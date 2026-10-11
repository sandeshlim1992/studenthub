# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::WebReplyNotice, aggregate_failures: true do
  let(:agent)    { create(:agent) }
  let(:customer) { create(:customer, firstname: 'Ada', email: 'ada@student.example') }
  let(:group)    { create(:group, email_address: create(:email_address)) }
  let(:ticket)   { create(:ticket, group:, customer:, title: 'Lost my ID card') }
  let(:notice)   { Trigger.find_by(name: described_class::TRIGGER_NAME) }

  before do
    described_class.ensure!
    ticket
    TransactionDispatcher.commit
  end

  def add_article(type:, sender: 'Agent', internal: false)
    create(:ticket_article, ticket:, type_name: type, sender_name: sender, internal:, created_by: agent, updated_by: agent)
    TransactionDispatcher.commit
  end

  # Zammad's own triggers (auto reply…) may add messages too; only ours are counted.
  def notices
    ticket.articles.reload.select { |article| article.subject.to_s.include?('New reply to your request') }
  end

  describe '.ensure!' do
    it 'creates the trigger once and keeps an admin’s changes' do
      notice.update!(active: false)

      expect { described_class.ensure! }.not_to change(Trigger, :count)
      expect(notice.reload.active).to be(false)
    end
  end

  describe 'the trigger' do
    it 'emails the student a notice with a link when an agent replies on the web' do
      add_article(type: 'web')

      expect(notices.size).to eq(1)
      expect(notices.first).to have_attributes(internal: true, to: 'ada@student.example')
      expect(notices.first.subject).to eq('New reply to your request: Lost my ID card')
      expect(notices.first.body).to include('Hi Ada', "/tickets/#{ticket.id}")
    end

    it 'leaves email replies, internal web messages and the student’s own messages alone' do
      add_article(type: 'email')
      add_article(type: 'web', internal: true)
      add_article(type: 'web', sender: 'Customer')

      expect(notices).to be_empty
    end
  end
end
