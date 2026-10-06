# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Creates what Ticket Approvals needs: permissions, the Managers role, the on/off setting,
# the two overviews and the ticket field definitions. Idempotent. Used by the
# 20261004090000 migration and by the test suite, which empties all tables between runs.
module Studenthub::TicketApproval::Setup # rubocop:disable Metrics/ModuleLength -- mostly record definitions
  OVERVIEW_LINKS = %w[awaiting_my_approval sent_for_approval].freeze
  # Until 5 Oct 2026 the agents' view was "Approval decisions" (decided requests only).
  PREVIOUS_AGENT_OVERVIEW_LINK = 'approval_decisions'.freeze

  def self.ensure!
    create_permissions
    ensure_manager_role
    create_setting
    register_ticket_attributes
    create_overviews
  end

  def self.remove!
    Overview.where(link: OVERVIEW_LINKS + [PREVIOUS_AGENT_OVERVIEW_LINK]).destroy_all
    ObjectManager::Attribute.where(object_lookup_id: ObjectLookup.by_name('Ticket'), name: Studenthub::TicketApproval::COLUMNS).destroy_all
    Setting.where(name: %w[ticket_approval ticket_approval_pause_sla ticket_approval_group_id]).destroy_all
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
    Setting.create_if_not_exists(
      title:       __('Pause SLA while waiting for approval'),
      name:        'ticket_approval_pause_sla',
      area:        'Ticket::Approval',
      description: __('The time a ticket waits for a manager does not count towards its SLA.'),
      options:     { form: [{ display: '', null: true, name: 'ticket_approval_pause_sla', tag: 'boolean', options: { true => 'yes', false => 'no' } }] },
      state:       true,
      preferences: { permission: ['admin.ticket_approval'] },
      frontend:    false
    )
    # The Managers group where tickets wait (see WaitingGroup); set when the feature is turned on.
    Setting.create_if_not_exists(
      title:       __('Group for tickets waiting for approval'),
      name:        'ticket_approval_group_id',
      area:        'Ticket::Approval',
      description: __('Tickets wait for approval in this group, which nobody has access to.'),
      options:     {},
      state:       nil,
      preferences: { permission: ['admin.ticket_approval'] },
      frontend:    false
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
    active       = Studenthub::TicketApproval.enabled?

    Overview.create_if_not_exists(
      name:          __('Awaiting my approval'),
      link:          'awaiting_my_approval',
      prio:          1005,
      role_ids:      [manager_role&.id].compact,
      condition:     managed_overview_attributes(active)['awaiting_my_approval'][:condition],
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

    upgrade_agent_overview
    Overview.create_if_not_exists(
      **agent_overview_attributes,
      prio:          1006,
      role_ids:      agent_role_ids,
      active:        active,
      updated_by_id: 1,
      created_by_id: 1,
    )
  end

  # The tickets the agent sent that wait for a decision. Once decided they leave this view;
  # the ticket's owner and state never change, so it is still in the agent's open tickets.
  def self.agent_overview_attributes
    {
      name:      __('Sent for approval'),
      link:      'sent_for_approval',
      condition: {
        'ticket.approval_state'           => { operator: 'is', value: ['pending'] },
        'ticket.approval_requested_by_id' => { operator: 'is', pre_condition: 'current_user.id', value: [] },
        'ticket.state_id'                 => { operator: 'is', value: Ticket::State.by_category_ids(:open) },
      },
      order:     { by: 'updated_at', direction: 'ASC' },
      view:      {
        d:                 %w[number title customer approval_state approval_approver_id updated_at],
        s:                 %w[number title customer approval_state approval_approver_id updated_at],
        m:                 %w[number title customer approval_state approval_approver_id updated_at],
        view_mode_default: 's',
      },
    }
  end

  # The agent roles, but not Managers (which carries ticket.agent too): managers approve, they
  # don't send. A manager who is also an agent gets the view through their agent role.
  def self.agent_role_ids
    Role.with_permissions('ticket.agent').where(active: true)
      .where.not(name: Studenthub::TicketApproval::MANAGER_ROLE).pluck(:id)
  end

  # Turns the old "Approval decisions" view into "Sent for approval" in place, so agents keep
  # their own order of views.
  def self.upgrade_agent_overview
    overview = Overview.find_by(link: PREVIOUS_AGENT_OVERVIEW_LINK)
    return if !overview || Overview.exists?(link: 'sent_for_approval')

    overview.update!(**agent_overview_attributes, role_ids: agent_role_ids)
  end

  # The two overviews are managed by Student Hub, not by admins: on while the feature is on, off
  # (hidden for everyone) while it is off, always for the same roles and with the same conditions.
  # Runs when the feature is switched, and in the background after a role or one of these
  # overviews changed (StudenthubTeamViewsSyncJob), so changes made by hand are undone.
  def self.sync_overviews(active = Studenthub::TicketApproval.enabled?)
    return if !Setting.exists?(name: 'ticket_approval')

    create_overviews
    managed_overview_attributes(active).each do |link, attributes|
      overview = Overview.find_by(link: link)
      next if !overview || !overview_changed?(overview, attributes)

      overview.update!(**attributes, updated_by_id: 1)
    end
  end

  def self.managed_overview_attributes(active)
    manager_role = Role.find_by(name: Studenthub::TicketApproval::MANAGER_ROLE)

    {
      'awaiting_my_approval' => {
        name:      __('Awaiting my approval'),
        condition: {
          'ticket.approval_state'       => { operator: 'is', value: ['pending'] },
          'ticket.approval_approver_id' => { operator: 'is', pre_condition: 'current_user.id', value: [] },
        },
        role_ids:  [manager_role&.id].compact,
        active:    active,
      },
      'sent_for_approval'    => {
        **agent_overview_attributes.slice(:name, :condition),
        role_ids: agent_role_ids,
        active:   active,
      },
    }
  end

  def self.overview_changed?(overview, attributes)
    overview.name != attributes[:name] || overview.active != attributes[:active] ||
      overview.role_ids.sort != attributes[:role_ids].sort ||
      overview.condition.to_h.deep_stringify_keys != attributes[:condition].deep_stringify_keys
  end

  # Added to Overview: an approval overview changed by hand is put back in the background.
  module OverviewSync
    extend ActiveSupport::Concern

    included do
      after_commit :studenthub_sync_approval_overviews
    end

    private

    def studenthub_sync_approval_overviews
      return if Setting.get('import_mode')
      return if OVERVIEW_LINKS.exclude?(link) && OVERVIEW_LINKS.exclude?(link_before_last_save)

      StudenthubTeamViewsSyncJob.perform_later
    end
  end
end
