# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::TicketViews::Institutions, aggregate_failures: true do
  let!(:lsst)      { create(:organization, name: 'LSST') }
  let(:admin_role) { Role.find_by(name: 'Admin') }

  def view(organization)
    Overview.find_by(link: described_class.link(organization))
  end

  it 'makes a view per active organisation with its open tickets, for the Admin role only' do
    described_class.sync!

    expect(view(lsst)).to have_attributes(name: 'LSST', active: true, role_ids: [admin_role.id])
    expect(view(lsst).condition.dig('ticket.organization_id', 'value')).to eq([lsst.id.to_s])
    expect(view(lsst).condition.dig('ticket.state_id', 'value')).to match_array(Studenthub::TicketViews::Setup.open_state_ids)
  end

  it "lists the organisation's open tickets" do
    described_class.sync!
    group    = create(:group)
    admin    = create(:admin, groups: [group])
    customer = create(:customer, organization: lsst)
    open     = create(:ticket, group: group, customer: customer, state_name: 'open')
    create(:ticket, group: group, customer: customer, state_name: 'closed')
    create(:ticket, group: group, state_name: 'open')

    expect(Ticket::Overviews.tickets_for_overview(view(lsst), admin).to_a).to eq([open])
  end

  it 'follows the organisations: renamed, deactivated, and removes the old campus views' do
    old = create(:overview, name: 'LSST (campus)', link: 'studenthub_institution_lsst', roles: [admin_role])
    described_class.sync!
    expect(Overview.exists?(old.id)).to be(false)

    lsst.update!(name: 'London School of Science & Technology')
    described_class.sync!
    expect(view(lsst).name).to eq('London School of Science & Technology')

    lsst.update!(active: false)
    described_class.sync!
    expect(view(lsst)).to be_nil
  end

  it 'puts back changes made by hand' do
    described_class.sync!
    view(lsst).update!(active: false, role_ids: [Role.find_by(name: 'Agent').id], name: 'Mine')

    described_class.sync!

    expect(view(lsst)).to have_attributes(name: 'LSST', active: true, role_ids: [admin_role.id])
  end

  it 'syncs in the background when an organisation is added or renamed, not on a member change', performs_jobs: true do
    ActiveJobLock.destroy_all
    expect { create(:organization) }.to have_enqueued_job(StudenthubTeamViewsSyncJob)

    ActiveJobLock.destroy_all
    clear_jobs
    expect { lsst.update!(name: 'LSST London') }.to have_enqueued_job(StudenthubTeamViewsSyncJob)

    ActiveJobLock.destroy_all
    clear_jobs
    expect { lsst.touch }.not_to have_enqueued_job(StudenthubTeamViewsSyncJob)
  end
end
