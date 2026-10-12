# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: which checklists are added automatically to tickets in which
# Category › Sub-category (Studenthub::ChecklistAssignments), for the Checklists admin page.
class StudenthubChecklistAssignmentsController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  # GET /api/v1/studenthub/checklist_assignments
  def index
    render json: {
      assignments:    StudenthubChecklistAssignment.reorder(:category, :sub_category).map { |assignment| assignment_payload(assignment) },
      categories:     Studenthub::ChecklistAssignments.categories,
      sub_categories: Studenthub::ChecklistAssignments.sub_categories_by_category,
    }
  end

  # PUT /api/v1/studenthub/checklist_assignments/:checklist_template_id
  # { sub_categories: [{ category:, sub_category: }] }: the pairs that template is added for.
  def update
    template = ChecklistTemplate.find(params[:checklist_template_id])
    Studenthub::ChecklistAssignments.replace!(template, pairs_param)

    render json: {
      assignments: StudenthubChecklistAssignment.where(checklist_template: template).reorder(:category, :sub_category)
        .map { |assignment| assignment_payload(assignment) },
    }
  end

  # GET /api/v1/studenthub/checklist_assignments/ticket/:ticket_id
  # The checklist the ticket's Category › Sub-category gets while it has none, for the ticket's
  # Checklist tab (agents who can see the ticket). Empty when there is none.
  def for_ticket
    ticket   = Ticket.find(params[:ticket_id]).tap { |record| authorize!(record, :show?) }
    template = Studenthub::ChecklistAssignments.template_for_ticket(ticket)
    return render json: {} if !template

    items = template.sorted_items.pluck(:text)

    render json: {
      checklist_template_id: template.id,
      name:                  template.name,
      category:              ticket[Studenthub::ChecklistAssignments::CATEGORY_FIELD],
      sub_category:          ticket[Studenthub::ChecklistAssignments::SUB_CATEGORY_FIELD],
      item_count:            items.size,
      first_items:           items.first(3),
    }
  end

  private

  def pairs_param
    Array(params[:sub_categories]).map { |pair| { category: pair[:category], sub_category: pair[:sub_category] } }
  end

  def assignment_payload(assignment)
    {
      id:                    assignment.id,
      category:              assignment.category,
      sub_category:          assignment.sub_category,
      checklist_template_id: assignment.checklist_template_id,
      missing:               assignment.missing?,
    }
  end
end
