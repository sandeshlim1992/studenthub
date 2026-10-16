# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::MobileApp, aggregate_failures: true do
  describe '.ensure!' do
    before { described_class.remove! }

    it 'creates the permission and an empty list of quick links once, and keeps admin changes' do
      described_class.ensure!

      expect(Permission.find_by(name: 'admin.mobile_app')).to be_present
      expect(Setting.get('studenthub_mobile_quick_links')).to eq([])

      links = [{ 'label' => 'Moodle', 'url' => 'https://moodle.example.ac.uk' }]
      Setting.set('studenthub_mobile_quick_links', links)
      described_class.ensure!

      expect(Setting.get('studenthub_mobile_quick_links')).to eq(links)
    end
  end
end
