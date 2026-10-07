# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Service::StudenthubMembers::List, aggregate_failures: true do
  subject(:members) { described_class.execute }

  let(:group) { create(:group, name: 'Service Desk Members Spec') }

  def sign_in(user, active_at: Time.zone.now)
    ActiveRecord::SessionStore::Session.create!(session_id: SecureRandom.hex(16), data: { 'user_id' => user.id }).tap do |session|
      session.update_columns(updated_at: active_at)
    end
  end

  def member(user)
    members.find { |row| row[:id] == user.id }
  end

  describe 'who is listed' do
    it 'lists active agents and admins, not customers, managers without another staff role or inactive users' do
      agent          = create(:agent)
      admin          = create(:admin)
      customer       = create(:customer)
      manager_only   = create_manager
      inactive_agent = create(:agent, active: false)

      ids = members.pluck(:id)

      expect(ids).to include(agent.id, admin.id)
      expect(ids).not_to include(customer.id, manager_only.id, inactive_agent.id, 1)
    end

    it 'lists managers who are also agents, with their role' do
      agent_manager = create_manager
      agent_manager.roles << Role.find_by(name: 'Agent')
      admin = create(:admin)
      agent = create(:agent)

      expect(member(agent_manager)[:role]).to eq('Agent & Manager')
      expect(member(admin)[:role]).to eq('Admin')
      expect(member(agent)[:role]).to eq('Agent')
    end

    it "shows each member's teams" do
      agent = create(:agent, groups: [group])

      expect(member(agent)[:teams]).to include('Service Desk Members Spec')
    end
  end

  describe 'online and last login' do
    let!(:agent) { create(:agent, firstname: 'Online', lastname: 'Agent') }

    it 'counts members active in the last few minutes as online' do
      session = sign_in(agent, active_at: 2.minutes.ago)

      expect(member(agent)).to include(online: true)
      expect(member(agent)[:last_active_at]).to be_within(1.second).of(session.updated_at)
    end

    it 'counts members whose session went quiet, or who have none, as offline' do
      quiet = create(:agent)
      sign_in(quiet, active_at: 20.minutes.ago)

      expect(member(quiet)).to include(online: false, last_active_at: nil)
      expect(member(agent)).to include(online: false)
    end

    it 'shows when each member last signed in' do
      agent.update!(last_login: 2.days.ago)

      expect(member(agent)[:last_login]).to be_within(1.second).of(2.days.ago)
    end

    it 'lists online members first, then the others by last login, most recent first' do
      never   = create(:agent, last_login: nil)
      earlier = create(:agent, last_login: 3.days.ago)
      later   = create(:agent, last_login: 1.hour.ago)
      sign_in(agent)

      ids = members.pluck(:id)

      expect(ids.first).to eq(agent.id)
      expect(ids.index(later.id)).to be < ids.index(earlier.id)
      expect(ids.index(earlier.id)).to be < ids.index(never.id)
    end
  end
end
