# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::ManagerSites, aggregate_failures: true do
  let(:group)        { create(:group) }
  let(:site)         { create(:organization, name: 'FSB Spec Site') }
  let(:other_site)   { create(:organization, name: 'LSST Spec Site') }
  let(:manager)      { create_manager }
  let(:site_ticket)  { create(:ticket, group:, customer: create(:customer, organization: site), organization: site) }
  let(:other_ticket) { create(:ticket, group:, customer: create(:customer, organization: other_site), organization: other_site) }

  describe 'assigning sites' do
    it 'keeps exactly the given sites of a manager' do
      described_class.assign!(manager, [site.id, other_site.id])
      described_class.assign!(manager, [other_site.id])

      expect(described_class.organization_ids_for(manager)).to eq([other_site.id])
    end

    it 'refuses users who are not managers' do
      expect { described_class.assign!(create(:agent), [site.id]) }.to raise_error(ArgumentError)
    end

    it 'leaves out inactive sites, and managers who lost the Managers role' do
      described_class.assign!(manager, [site.id, other_site.id])
      other_site.update!(active: false)

      expect(described_class.organization_ids_for(manager)).to eq([site.id])

      manager.update!(roles: [Role.find_by(name: 'Agent')])
      expect(described_class.organization_ids_for(manager)).to be_empty
    end
  end

  describe 'ticket access' do
    before { described_class.assign!(manager, [site.id]) }

    it "lets a manager read their sites' tickets, but not change them" do
      expect(TicketPolicy.new(manager, site_ticket)).to be_show
      expect(TicketPolicy.new(manager, site_ticket)).not_to be_update
      expect(TicketPolicy.new(manager, other_ticket)).not_to be_show
    end

    it "lists their sites' tickets in the read and overview scopes only" do
      expect(TicketPolicy::ReadScope.new(manager).resolve).to include(site_ticket)
      expect(TicketPolicy::OverviewScope.new(manager).resolve).to include(site_ticket)
      expect(TicketPolicy::ReadScope.new(manager).resolve).not_to include(other_ticket)
      expect(TicketPolicy::ChangeScope.new(manager).resolve).not_to include(site_ticket)
    end
  end

  describe 'site views' do
    it 'gives each site with managers a view of its open tickets, for those managers only' do
      other_manager = create_manager
      described_class.assign!(manager, [site.id])
      described_class.assign!(other_manager, [site.id])
      Studenthub::TicketViews::ManagerSites.sync!

      overview = Overview.find_by(link: Studenthub::TicketViews::ManagerSites.link(site))

      expect(overview.name).to eq('FSB Spec Site')
      expect(overview.user_ids).to contain_exactly(manager.id, other_manager.id)
      expect(overview.role_ids).to eq([Role.find_by(name: 'Managers').id])
      expect(overview.condition['ticket.organization_id']['value']).to eq([site.id.to_s])
    end

    it 'removes the view once no manager has the site' do
      described_class.assign!(manager, [site.id])
      Studenthub::TicketViews::ManagerSites.sync!
      described_class.assign!(manager, [])
      Studenthub::TicketViews::ManagerSites.sync!

      expect(Overview.find_by(link: Studenthub::TicketViews::ManagerSites.link(site))).to be_nil
    end

    it "lists the view under Sites in the manager's views panel, with its tickets" do
      described_class.assign!(manager, [site.id])
      Studenthub::TicketViews::ManagerSites.sync!
      overview = Overview.find_by(link: Studenthub::TicketViews::ManagerSites.link(site))

      expect(Studenthub::TicketViews.sections_for(manager)[:institution_overview_ids]).to include(overview.id)
      expect(Studenthub::TicketViews.sections_for(create_manager)[:institution_overview_ids]).not_to include(overview.id)
    end
  end
end
