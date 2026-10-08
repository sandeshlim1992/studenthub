# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the student's column on the ticket screen (summary, progress, files, actions).
# Every action needs read access to the ticket (Zammad's ticket rules); closing and reopening
# check the ticket rules again in their services.
class StudenthubCustomerTicketsController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  # GET /api/v1/studenthub/customer_tickets/:id
  def show
    render json: Service::StudenthubCustomerTicket::Overview.with_current_user(current_user).execute(ticket:)
  end

  # POST /api/v1/studenthub/customer_tickets/:id/close
  def close
    Service::StudenthubCustomerTicket::Close.with_current_user(current_user).execute(ticket:)

    show
  end

  # POST /api/v1/studenthub/customer_tickets/:id/reopen { message: "…" }
  def reopen
    Service::StudenthubCustomerTicket::Reopen.with_current_user(current_user).execute(ticket:, message: params[:message])

    show
  end

  # POST /api/v1/studenthub/customer_tickets/:id/rating { rating: 1-5, comments: "…" }
  def rating
    Service::StudenthubCustomerTicket::Rate.with_current_user(current_user).execute(ticket:, rating: params[:rating], comments: params[:comments])

    show
  end

  private

  def ticket
    @ticket ||= Ticket.find(params[:id]).tap { |record| authorize!(record, :show?) }
  end
end
