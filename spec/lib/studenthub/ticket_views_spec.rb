# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::TicketViews, aggregate_failures: true do
  let(:service_desk)       { create(:group, name: 'Service Desk') }
  let(:vle)                { create(:group, name: 'VLE') }
  let(:agent)              { create(:agent, groups: [service_desk]) }
  let(:agent_role)         { Role.find_by(name: 'Agent') }
  let!(:service_desk_view) { overview('Service Desk', { 'ticket.group_id' => { operator: 'is', value: [service_desk.id.to_s] } }) }
  let!(:vle_view)          { overview('VLE Desk', { 'ticket.group_id' => { operator: 'is', value: [vle.id.to_s] } }) }
  let!(:my_service_desk)   do
    overview('My Service Desk tickets', {
               'ticket.group_id' => { operator: 'is', value: [service_desk.id.to_s] },
               'ticket.owner_id' => { operator: 'is', pre_condition: 'current_user.id' },
             })
  end
  let!(:two_groups) { overview('Both desks', { 'ticket.group_id' => { operator: 'is', value: [service_desk.id.to_s, vle.id.to_s] } }) }

  def overview(name, condition)
    create(:overview, name: name, roles: [agent_role], condition: condition)
  end

  describe '.team_group_id' do
    it 'recognises overviews of exactly one group' do
      expect(described_class.team_group_id(service_desk_view)).to eq(service_desk.id)
      expect(described_class.team_group_id(vle_view)).to eq(vle.id)
    end

    it 'leaves personal and multi-group overviews alone' do
      expect(described_class.team_group_id(my_service_desk)).to be_nil
      expect(described_class.team_group_id(two_groups)).to be_nil
    end
  end

  describe '.sections_for' do
    it "lists the Teams views of the agent's groups and hides the others" do
      Studenthub::TicketViews::Teams.sync!
      service_desk_team = Overview.find_by(link: Studenthub::TicketViews::Teams.link(service_desk))
      vle_team          = Overview.find_by(link: Studenthub::TicketViews::Teams.link(vle))

      sections = described_class.sections_for(agent)

      expect(sections[:teams]).to include({ overview_id: service_desk_team.id, group_id: service_desk.id })
      expect(sections[:teams].pluck(:overview_id)).not_to include(vle_team.id)
      expect(sections[:hidden_overview_ids]).to include(vle_team.id)
    end

    it 'lists every Teams view for admins and none for managers, unless they are admins too' do
      Studenthub::TicketViews::Teams.sync!
      team_ids = [service_desk, vle].map { |group| Overview.find_by(link: Studenthub::TicketViews::Teams.link(group)).id }
      manager  = create_manager(groups: [service_desk])
      manager.roles << agent_role
      admin_manager = create(:admin)
      admin_manager.roles << Role.find_by(name: Studenthub::TicketApproval::MANAGER_ROLE)

      expect(described_class.sections_for(create(:admin))[:teams].pluck(:overview_id)).to include(*team_ids)
      expect(described_class.sections_for(admin_manager)[:teams].pluck(:overview_id)).to include(*team_ids)
      expect(described_class.sections_for(manager)[:teams]).to be_empty
      expect(described_class.sections_for(manager)[:hidden_overview_ids]).to include(*team_ids)
    end

    it "keeps admins' one-group overviews under My views for members and hides them for others" do
      sections = described_class.sections_for(agent)

      expect(sections[:teams].pluck(:overview_id)).not_to include(service_desk_view.id, vle_view.id, my_service_desk.id, two_groups.id)
      expect(sections[:hidden_overview_ids]).to include(vle_view.id)
      expect(sections[:hidden_overview_ids]).not_to include(service_desk_view.id, my_service_desk.id, two_groups.id)
    end

    it 'puts the approval views under Approval needed' do
      Setting.set('ticket_approval', true)
      Studenthub::TicketApproval::Setup.sync_overviews(true)
      manager = create_manager(groups: [service_desk])

      expect(described_class.sections_for(agent)[:approval_overview_ids])
        .to eq([Overview.find_by(link: 'sent_for_approval').id])
      expect(described_class.sections_for(manager)[:approval_overview_ids])
        .to eq([Overview.find_by(link: 'awaiting_my_approval').id])
    end
  end

  describe 'institution views' do
    it 'lists them for admins only' do
      create(:organization, name: 'LSST')
      Studenthub::TicketViews::Institutions.sync!

      expect(described_class.sections_for(create(:admin))[:institution_overview_ids]).not_to be_empty
      expect(described_class.sections_for(agent)[:institution_overview_ids]).to be_empty
    end
  end
end
