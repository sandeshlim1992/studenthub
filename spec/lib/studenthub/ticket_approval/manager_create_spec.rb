# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::TicketApproval::ManagerCreate, aggregate_failures: true do
  let(:group)   { create(:group) }
  let(:manager) { create_manager(groups: [group]) }

  let(:customer_manager) do
    create_manager(groups: [group]).tap { |user| user.roles << Role.find_by(name: 'Customer') }
  end

  def group_options(user, screen: 'create_middle')
    payload = {
      'event'      => 'core_workflow',
      'request_id' => 'default',
      'class_name' => 'Ticket',
      'screen'     => screen,
      'params'     => {},
    }

    CoreWorkflow.perform(payload:, user:)[:restrict_values]['group_id']
  end

  describe 'managers who are also customers' do
    it 'are told apart from the other managers' do
      expect(Studenthub::TicketApproval.customer_manager?(customer_manager)).to be(true)
      expect(Studenthub::TicketApproval.customer_manager?(manager)).to be(false)
      expect(Studenthub::TicketApproval.customer_manager?(create(:customer))).to be(false)
    end
  end

  describe 'groups on the New ticket screen' do
    let!(:other_group) { create(:group) }

    it 'are the groups a customer may choose for managers who are also customers' do
      expect(group_options(customer_manager)).to include(group.id.to_s, other_group.id.to_s)
    end

    it 'follow the groups customers may create tickets in' do
      Setting.set('customer_ticket_create_group_ids', [other_group.id.to_s])

      expect(group_options(customer_manager)).to include(other_group.id.to_s)
      expect(group_options(customer_manager)).not_to include(group.id.to_s)
    end

    it 'stay empty for other managers, who may not create tickets' do
      expect(group_options(manager)).to eq([''])
    end

    it 'stay those of Zammad on other screens' do
      expect(group_options(customer_manager, screen: 'edit')).to eq([''])
    end
  end

  describe 'creating a ticket', type: :graphql do
    let(:query) do
      <<~QUERY
        mutation ticketCreate($input: TicketCreateInput!) {
          ticketCreate(input: $input) {
            ticket {
              internalId
            }
            errors {
              message
            }
          }
        }
      QUERY
    end

    let(:input) do
      {
        title:   'Projector in room 4 is broken',
        groupId: gql.id(group),
        article: { body: 'It shows no picture.', contentType: 'text/html', sender: 'Customer', type: 'web' },
      }
    end

    context 'when the manager is also a customer', authenticated_as: :customer_manager do
      it 'creates the ticket as theirs, like a customer' do
        gql.execute(query, variables: { input: })

        ticket = Ticket.find(gql.result.data.dig(:ticket, :internalId))
        article = ticket.articles.first

        expect(ticket.customer).to eq(customer_manager)
        expect(article.sender.name).to eq('Customer')
        expect(article.type.name).to eq('web')
        expect(article.internal).to be(false)
      end
    end

    context 'when the manager is not a customer', authenticated_as: :manager do
      it 'refuses to create a ticket' do
        gql.execute(query, variables: { input: })

        expect(gql.result.error_type).to eq(Pundit::NotAuthorizedError)
        expect(Ticket.where(title: 'Projector in room 4 is broken')).to be_none
      end
    end
  end
end
