# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Creates what Ticket Approvals needs: permissions, the Managers role, the on/off setting,
# the two overviews and the ticket field definitions. Idempotent. Used by the
# 20261004090000 migration and by the test suite, which empties all tables between runs.
module Studenthub::TicketApproval::Setup # rubocop:disable Metrics/ModuleLength -- mostly record definitions
  OVERVIEW_LINKS = %w[awaiting_my_approval approval_decisions].freeze

  def self.ensure!
    create_permissions
    ensure_manager_role
    create_setting
    register_ticket_attributes
    create_overviews
  end

  def self.remove!
    Overview.where(link: OVERVIEW_LINKS).destroy_all
    ObjectManager::Attribute.where(object_lookup_id: ObjectLookup.by_name('Ticket'), name: Studenthub::TicketApproval::COLUMNS).destroy_all
    Setting.find_by(name: 'ticket_approval')&.destroy
    Permission.where(name: [Studenthub::TicketApproval::APPROVER_PERMISSION, 'admin.ticket_approval']).destroy_all
  end

  def self.create_permissions
    Permission.create_if_not_exists(
      name:        Studenthub::TicketApproval::APPROVER_PERMISSION,
      label:       __('Approve tickets'),
      description: __('Receive tickets that agents send for approval and approve or deny them.'),
      preferences: { prio: 1560 }
    )
    Permission.create_if_not_exists(
      name:        'admin.ticket_approval',
      label:       __('Ticket Approvals'),
      description: __('Turn ticket approvals on or off.'),
      preferences: { prio: 1146 }
    )
  end

  def self.ensure_manager_role
    role = Role.find_by(name: Studenthub::TicketApproval::MANAGER_ROLE)
    if !role
      role = Role.create!(
        name:              Studenthub::TicketApproval::MANAGER_ROLE,
        note:              __('Approve or deny tickets that agents send for approval.'),
        default_at_signup: false,
        preferences:       {},
        updated_by_id:     1,
        created_by_id:     1
      )
      role.permission_grant('ticket.agent')
      role.permission_grant('user_preferences')
    end
    role.permission_grant(Studenthub::TicketApproval::APPROVER_PERMISSION)
    role
  end

  def self.create_setting
    Setting.create_if_not_exists(
      title:       __('Ticket Approvals'),
      name:        'ticket_approval',
      area:        'Ticket::Approval',
      description: __('Lets agents send tickets to a manager for approval.'),
      options:     { form: [{ display: '', null: true, name: 'ticket_approval', tag: 'boolean', options: { true => 'yes', false => 'no' } }] },
      state:       false,
      preferences: { permission: ['admin.ticket_approval'], authentication: true },
      frontend:    true
    )
  end

  def self.register_ticket_attributes
    common = {
      force:         true,
      object:        'Ticket',
      editable:      false,
      active:        true,
      screens:       {},
      created_by_id: 1,
      updated_by_id: 1,
    }

    ObjectManager::Attribute.add(common.merge(
                                   name:        'approval_state',
                                   display:     __('Approval'),
                                   data_type:   'select',
                                   data_option: {
                                     options:    { 'pending' => __('Waiting for approval'), 'approved' => __('Approved'), 'denied' => __('Denied') },
                                     default:    '',
                                     null:       true,
                                     nulloption: true,
                                     multiple:   false,
                                     translate:  true,
                                     maxlength:  20,
                                   },
                                   position:    1600,
                                 ))

    { 'approval_approver_id' => __('Approver'), 'approval_requested_by_id' => __('Approval requested by') }.each_with_index do |(name, display), index|
      ObjectManager::Attribute.add(common.merge(
                                     name:        name,
                                     display:     display,
                                     data_type:   'autocompletion_ajax',
                                     data_option: { relation: 'User', null: true, nulloption: true, multiple: false },
                                     position:    1601 + index,
                                   ))
    end
  end

  def self.create_overviews
    manager_role = Role.find_by(name: Studenthub::TicketApproval::MANAGER_ROLE)
    agent_roles  = Role.with_permissions('ticket.agent').where(active: true)
    active       = Studenthub::TicketApproval.enabled?

    Overview.create_if_not_exists(
      name:          __('Awaiting my approval'),
      link:          'awaiting_my_approval',
      prio:          1005,
      role_ids:      [manager_role&.id].compact,
      condition:     {
        'ticket.approval_state'       => { operator: 'is', value: ['pending'] },
        'ticket.approval_approver_id' => { operator: 'is', pre_condition: 'current_user.id', value: [] },
      },
      order:         { by: 'updated_at', direction: 'ASC' },
      view:          {
        d:                 %w[number title customer group owner updated_at],
        s:                 %w[number title customer group owner updated_at],
        m:                 %w[number title customer group owner updated_at],
        view_mode_default: 's',
      },
      active:        active,
      updated_by_id: 1,
      created_by_id: 1,
    )

    Overview.create_if_not_exists(
      name:          __('Approval decisions'),
      link:          'approval_decisions',
      prio:          1006,
      role_ids:      agent_roles.pluck(:id),
      condition:     {
        'ticket.approval_state'           => { operator: 'is', value: %w[approved denied] },
        'ticket.approval_requested_by_id' => { operator: 'is', pre_condition: 'current_user.id', value: [] },
        'ticket.state_id'                 => { operator: 'is', value: Ticket::State.by_category_ids(:open) },
      },
      order:         { by: 'updated_at', direction: 'DESC' },
      view:          {
        d:                 %w[number title customer approval_state approval_approver_id updated_at],
        s:                 %w[number title customer approval_state approval_approver_id updated_at],
        m:                 %w[number title customer approval_state approval_approver_id updated_at],
        view_mode_default: 's',
      },
      active:        active,
      updated_by_id: 1,
      created_by_id: 1,
    )
  end

  # The overviews only make sense while the feature is on.
  def self.sync_overviews(active)
    Overview.where(link: OVERVIEW_LINKS).find_each { |overview| overview.update!(active: active) }
  end
end
