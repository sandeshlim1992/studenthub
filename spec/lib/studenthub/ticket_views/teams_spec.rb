# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::TicketViews::Teams, aggregate_failures: true do
  let!(:service_desk) { create(:group, name: 'Service Desk') }

  def team_view(group)
    Overview.find_by(link: described_class.link(group))
  end

  it "makes a view per group with its open tickets, grouped by agent, for the agents' roles" do
    described_class.sync!

    view = team_view(service_desk)
    expect(view).to have_attributes(name: 'Service Desk', group_by: 'owner', active: true)
    expect(view.condition.dig('ticket.group_id', 'value')).to eq([service_desk.id.to_s])
    expect(view.condition.dig('ticket.state_id', 'value')).to match_array(Studenthub::TicketViews::Setup.open_state_ids)
    expect(view.role_ids).to include(Role.find_by(name: 'Agent').id)
  end

  it 'follows the groups: renamed, deactivated, and never the Managers group' do
    waiting = Studenthub::TicketApproval::WaitingGroup.ensure!
    described_class.sync!

    service_desk.update!(name: 'IT Service Desk')
    described_class.sync!
    expect(team_view(service_desk).name).to eq('IT Service Desk')

    service_desk.update!(active: false)
    described_class.sync!
    expect(team_view(service_desk)).to be_nil
    expect(team_view(waiting)).to be_nil
  end

  it 'gives the Admin role agent permission and full access to every team group' do
    vle = create(:group, name: 'VLE')
    described_class.sync!

    admin_role = Role.find_by(name: 'Admin')
    expect(admin_role.with_permission?('ticket.agent')).to be(true)
    expect(admin_role.group_ids_access('full')).to include(service_desk.id, vle.id)
    expect(team_view(vle).role_ids).to include(admin_role.id)
  end

  it 'syncs in the background when a group changes', performs_jobs: true do
    # The group above already queued one; a waiting job is never queued twice.
    ActiveJobLock.destroy_all

    expect { create(:group) }.to have_enqueued_job(StudenthubTeamViewsSyncJob)
  end

  it 'lists unassigned tickets first, whatever the grouping' do
    described_class.sync!
    view  = team_view(service_desk)
    agent = create(:agent, groups: [service_desk])
    assigned   = create(:ticket, group: service_desk, owner: agent, state_name: 'new', created_at: 1.hour.ago)
    unassigned = create(:ticket, group: service_desk, state_name: 'open', created_at: 2.hours.ago)
    Studenthub::TicketViews::Choice.save!(agent, view, group_by: 'state')

    tickets = Ticket::Overviews.tickets_for_overview(view, agent.reload).to_a

    expect(tickets.index(unassigned)).to be < tickets.index(assigned)
  end

  it 'keeps the grouping an admin chose' do
    described_class.sync!
    team_view(service_desk).update!(group_by: 'state')

    described_class.sync!

    expect(team_view(service_desk).group_by).to eq('state')
  end
end
