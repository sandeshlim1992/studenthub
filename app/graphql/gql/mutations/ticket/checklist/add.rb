# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

module Gql::Mutations
  class Ticket::Checklist::Add < Ticket::Checklist::Base
    description 'Create an empty checklist or a checklist based on a template for a ticket.'

    argument :ticket_id, GraphQL::Types::ID, loads: Gql::Types::TicketType, loads_pundit_method: :agent_update_access?, description: 'Ticket to create the new checklist for.'
    argument :template_id, GraphQL::Types::ID, required: false, description: 'Checklist template ID to base the ticket checklist on.'
    argument :create_first_item, GraphQL::Types::Boolean, required: false, description: 'Create the first item in the checklist (only if no template is used).'

    field :checklist, Gql::Types::ChecklistType, null: true, description: 'Created checklist'

    requires_enabled_setting 'checklist', error_message: __('The checklist feature is not active')

    def resolve(ticket:, create_first_item: false, template_id: nil)
      template = Gql::ZammadSchema.verified_object_from_id(template_id, type: ::ChecklistTemplate) if template_id

      # Student Hub: agents add only the checklist assigned to the ticket's sub-category (Studenthub::ChecklistRules).
      raise Exceptions::Forbidden, __('Not authorized') if !Studenthub::ChecklistRules.may_add?(context.current_user, ticket, template)

      checklist = if template
                    Checklist.create_from_template!(ticket, template)
                  elsif create_first_item
                    Checklist.create_fresh!(ticket)
                  else
                    Checklist.create!(ticket:)
                  end

      { checklist: }
    end
  end
end
