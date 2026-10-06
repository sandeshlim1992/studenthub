# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the SLA a new ticket would get (New ticket screen, "SLA for this priority").
class StudenthubSlaPreviewsController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  FIELDS = %w[priority_id group_id state_id].freeze

  # GET /api/v1/studenthub/sla_preview?priority_id=4&group_id=26&state_id=2
  def show
    result = Studenthub::SlaPreview.for(params.permit(*FIELDS).to_h.compact_blank)
    sla    = result[:sla]

    render json: {
      status: result[:status],
      sla:    sla && {
        name:                sla.name,
        first_response_time: sla.first_response_time,
        update_time:         sla.update_time,
        solution_time:       sla.solution_time,
        calendar:            sla.calendar&.name,
      },
    }
  end
end
