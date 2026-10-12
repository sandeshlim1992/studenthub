# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Controllers::ChecklistItemsControllerPolicy, current_user_id: 1 do
  subject { described_class.new(user, record) }

  let(:ticket)       { create(:ticket) }
  let(:checklist)    { create(:checklist, ticket:) }
  let(:record_class) { ChecklistItemsController }
  let(:record) do
    rec        = record_class.new
    rec.params = params
    rec
  end

  context 'when checklists are enabled' do
    # Student Hub: agents only tick items; adding, deleting and changing their text needs admin.checklist.
    context 'when user has agent access to ticket' do
      let(:user) { create(:agent, groups: [ticket.group]) }

      context 'when checklist is given' do
        let(:params) { { checklist_id: checklist.id } }

        it { is_expected.to forbid_actions(:create, :create_bulk) }
      end

      context 'when checklist item is given' do
        let(:item)   { create(:checklist_item, checklist:) }
        let(:params) { { id: item.id, checked: true } }

        it { is_expected.to permit_actions(:show, :update) }
        it { is_expected.to forbid_actions(:destroy) }

        context 'when the text is changed' do
          let(:params) { { id: item.id, text: "#{item.text} changed" } }

          it { is_expected.to forbid_actions(:update) }
        end
      end
    end

    context 'when user is a checklist admin with agent access to ticket' do
      let(:user) { create(:checklist_admin_agent, groups: [ticket.group]) }

      context 'when checklist is given' do
        let(:params) { { checklist_id: checklist.id } }

        it { is_expected.to permit_actions(:create, :create_bulk) }
      end

      context 'when ticket is given' do
        let(:params) { { ticket_id: ticket.id } }

        it { is_expected.to permit_actions(:create, :create_bulk) }
      end

      context 'when checklist item is given' do
        let(:params) { { id: create(:checklist_item, checklist:).id, text: 'Changed' } }

        it { is_expected.to permit_actions(:show, :update, :destroy) }
      end
    end

    context 'when user no agent access to ticket' do
      let(:user) { create(:agent, groups: []) }

      context 'when checklist is given' do
        let(:params) { { checklist_id: checklist.id } }

        it { is_expected.to forbid_actions(:create, :create_bulk) }
      end

      context 'when ticket is given' do
        let(:params) { { ticket_id: ticket.id } }

        it { is_expected.to forbid_actions(:create, :create_bulk) }
      end

      context 'when checklist item is given' do
        let(:params) { { id: create(:checklist_item, checklist:).id } }

        it { is_expected.to forbid_actions(:show, :update, :destroy) }
      end
    end

    context 'when user has read-only access to ticket' do
      let(:user) { create(:agent).tap { it.user_groups.create!(group: ticket.group, access: 'read') } }

      context 'when checklist is given' do
        let(:params) { { checklist_id: checklist.id } }

        it { is_expected.to forbid_actions(:create, :create_bulk) }
      end

      context 'when ticket is given' do
        let(:params) { { ticket_id: ticket.id } }

        it { is_expected.to forbid_actions(:create, :create_bulk) }
      end

      context 'when checklist item is given' do
        let(:params) { { id: create(:checklist_item, checklist:).id } }

        it { is_expected.to permit_only_actions(:show) }
      end
    end
  end

  context 'when checklists are disabled' do
    let(:user)   { create(:agent, groups: [ticket.group]) }
    let(:params) { {} }

    it { is_expected.to forbid_all_actions }
  end
end
