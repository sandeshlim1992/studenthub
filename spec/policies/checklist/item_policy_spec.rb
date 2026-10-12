# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

describe Checklist::ItemPolicy do
  subject(:policy) { described_class.new(user, record) }

  let(:record) { build(:checklist_item, checklist: build(:checklist, ticket: ticket)) }
  let(:ticket) { create(:ticket) }
  let(:group)  { ticket.group }
  let(:user)   { create(:agent, groups: [group]) }

  context 'when user does not have access to the ticket' do
    let(:user) { create(:agent) }

    it { is_expected.to forbid_actions(:show, :create, :update, :destroy) }
  end

  context 'when user has read access to the ticket' do
    let(:user) { create(:agent) }

    before { user.user_groups.create! group: ticket.group, access: 'read' }

    it { is_expected.to forbid_actions(:create, :update, :destroy) }
    it { is_expected.to permit_actions(:show) }
  end

  # Student Hub: agents only tick items; adding and deleting them needs admin.checklist.
  context 'when user has full access to the ticket' do
    let(:user) { create(:agent, groups: [ticket.group]) }

    it { is_expected.to permit_actions(:show, :update) }
    it { is_expected.to forbid_actions(:create, :destroy) }

    context 'when the user is a checklist admin' do
      let(:user) { create(:checklist_admin_agent, groups: [ticket.group]) }

      it { is_expected.to permit_actions(:show, :create, :update, :destroy) }
    end

    context 'when checklist feature is disabled' do
      before do
        Setting.set('checklist', false)
      end

      it { is_expected.to forbid_actions(:show, :create, :update, :destroy) }
    end
  end

  context 'when user has access to the ticket by having customer access' do
    let(:user) { create(:customer) }

    before { ticket.update! customer: user }

    it { is_expected.to forbid_actions(:show, :create, :update, :destroy) }
  end
end
