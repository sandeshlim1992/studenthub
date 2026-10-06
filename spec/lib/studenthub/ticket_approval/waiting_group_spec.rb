# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::TicketApproval::WaitingGroup, aggregate_failures: true do
  describe '.ensure!' do
    it 'creates the Managers group, where nobody has access' do
      group = described_class.ensure!

      expect(group).to have_attributes(name: 'Managers', active: true)
      expect(Setting.get('ticket_approval_group_id')).to eq(group.id)
    end

    context 'with the Managers group of the old approval process' do
      let!(:managers) { create(:group, name: 'Managers', active: false) }
      let(:team)      { create(:group, name: 'Service Desk') }
      let(:role)      { create(:role, :agent, groups: [managers]) }
      let!(:old_ticket) do
        ticket = create(:ticket, group: team, state_name: 'closed')
        ticket.update!(group: managers)
        ticket
      end

      it 'takes it over, removes all access and returns old tickets to their team' do
        role
        create(:agent, groups: [managers])

        group = described_class.ensure!

        expect(group).to have_attributes(id: managers.id, active: true)
        expect(RoleGroup.where(group_id: managers.id)).to be_empty
        expect(UserGroup.where(group_id: managers.id)).to be_empty
        expect(old_ticket.reload.group_id).to eq(team.id)
      end
    end
  end

  describe 'the Team list' do
    it 'never offers the Managers group' do
      group = described_class.ensure!
      admin = create(:admin)

      expect(admin.group_ids_access('create')).not_to include(group.id)
    end
  end
end
