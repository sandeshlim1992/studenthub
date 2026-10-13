# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::CustomerRoles, :aggregate_failures do
  let(:customer_role) { Role.find_by(name: 'Customer') }
  let(:agent_role)    { Role.find_by(name: 'Agent') }

  before do
    customer_role.permission_grant('admin.calendar')
    agent_role.permission_grant('admin.text_module')
  end

  it 'takes admin permissions off customer-only roles and leaves staff roles alone' do
    expect(described_class.remove_admin_permissions!).to eq('Customer' => ['admin.calendar'])

    expect(customer_role.reload.permissions.pluck(:name)).to include('ticket.customer')
    expect(customer_role.permissions.pluck(:name)).not_to include('admin.calendar')
    expect(agent_role.reload.permissions.pluck(:name)).to include('admin.text_module')
    expect(create(:customer).permissions?('admin.calendar')).to be(false)
  end

  it 'leaves a role alone that is for customers and staff' do
    customer_role.permission_grant('ticket.agent')

    expect(described_class.remove_admin_permissions!).to eq({})
    expect(customer_role.reload.permissions.pluck(:name)).to include('admin.calendar')
  end

  it 'changes nothing the second time' do
    described_class.remove_admin_permissions!

    expect(described_class.remove_admin_permissions!).to eq({})
  end

  describe StudenthubCustomerRolesWithoutAdmin, type: :db_migration do
    it 'takes the admin permissions off the Customer role' do
      migrate

      expect(customer_role.reload.permissions.pluck(:name)).not_to include('admin.calendar')
    end
  end
end
