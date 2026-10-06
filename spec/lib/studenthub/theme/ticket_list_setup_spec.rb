# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::Theme::TicketListSetup, aggregate_failures: true do
  describe '.guess_state_color' do
    it 'tells the Student Hub states apart by name, although most are of type "open"' do
      {
        ['1. New', 'new']                             => 'blue',
        ['2. Assigned', 'open']                       => 'purple',
        ['3. In Progress', 'open']                    => 'purple',
        ['4. Awaiting user Response', 'open']         => 'amber',
        ['4.1 Pending / On Hold', 'pending reminder'] => 'amber',
        ['5. Resolved', 'open']                       => 'green',
        ['6. Closed', 'closed']                       => 'grey',
        %w[merged merged]                             => 'grey',
      }.each do |(name, type), color|
        expect(described_class.guess_state_color(name, type)).to eq(color), "#{name} → #{color}"
      end
    end

    it 'falls back to the type for names it does not know' do
      expect(described_class.guess_state_color('Escalated to supplier', 'open')).to eq('purple')
      expect(described_class.guess_state_color('Parked', 'pending action')).to eq('amber')
      expect(described_class.guess_state_color('Something', 'unknown')).to eq('grey')
    end

    it 'does not read "new" inside other words' do
      expect(described_class.guess_state_color('Renewal', 'open')).to eq('purple')
    end
  end

  describe '.ensure!' do
    before { described_class.remove! }

    it 'creates both settings once and keeps admin changes' do
      described_class.ensure!
      Setting.set('studenthub_escalation_warning_minutes', 15)
      described_class.ensure!

      expect(Setting.get('studenthub_escalation_warning_minutes')).to eq(15)
      expect(Setting.get('studenthub_ticket_state_colors')).to include(Ticket::State.find_by(name: 'new').id.to_s => 'blue')
    end
  end
end
