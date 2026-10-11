# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::Theme::LoginPanelSetup, aggregate_failures: true do
  describe '.ensure!' do
    before { described_class.remove! }

    it 'creates the setting once and keeps admin changes' do
      described_class.ensure!
      expect(Setting.get('studenthub_login_panel')).to eq(described_class::DEFAULTS)

      texts = described_class::DEFAULTS.merge('heading' => 'IT Service Desk')
      Setting.set('studenthub_login_panel', texts)
      described_class.ensure!

      expect(Setting.get('studenthub_login_panel')).to eq(texts)
    end
  end
end
