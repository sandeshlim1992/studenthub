# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Setting::Validation::StudenthubTicketStateColors, aggregate_failures: true do
  let(:setting_name) { 'studenthub_ticket_state_colors' }

  it 'starts with a colour for every existing state' do
    expect(Setting.get(setting_name).keys).to match_array(Ticket::State.pluck(:id).map(&:to_s))
    expect(Setting.get(setting_name).values).to all(be_in(Studenthub::Theme::TicketListSetup::STATE_COLORS))
  end

  it 'accepts palette colours for states' do
    value = { '1' => 'blue', '2' => 'teal', '4' => 'grey' }

    expect { Setting.set(setting_name, value) }.not_to raise_error
    expect(Setting.get(setting_name)).to eq(value)
  end

  it 'accepts an empty map, so every state falls back to its type colour' do
    expect { Setting.set(setting_name, {}) }.not_to raise_error
  end

  it 'refuses colours outside the palette' do
    ['#ff0000', 'pink', '', nil].each do |color|
      expect { Setting.set(setting_name, { '1' => color }) }.to raise_error(ActiveRecord::RecordInvalid, %r{not one of the available colours})
    end
  end

  it 'refuses keys that are not state IDs' do
    ['new', '0', '-1', '1.5'].each do |key|
      expect { Setting.set(setting_name, { key => 'blue' }) }.to raise_error(ActiveRecord::RecordInvalid, %r{invalid state})
    end
  end

  it 'refuses values that are not a map' do
    ['blue', %w[blue green], 3].each do |value|
      expect { Setting.set(setting_name, value) }.to raise_error(ActiveRecord::RecordInvalid, %r{list of states and colours})
    end
  end
end
