# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: checklists added automatically. On the Checklists admin page admins pick, per
# checklist template, the Category › Sub-category pairs whose tickets get it
# (StudenthubChecklistAssignment). A ticket gets it when it is created in one of them, or when it is
# moved there later and has no checklist yet: a checklist is never replaced, so ticked items stay.
# Only active templates, and only while Zammad's checklists are on (setting checklist).
module Studenthub::ChecklistAssignments
  PERMISSION = 'admin.checklist'.freeze

  # The ticket fields the pair is read from, the same as for request forms.
  CATEGORY_FIELD     = Studenthub::RequestForms::CATEGORY_FIELD
  SUB_CATEGORY_FIELD = Studenthub::RequestForms::SUB_CATEGORY_FIELD

  # The active template for this Category › Sub-category, if any.
  def self.template_for(category, sub_category)
    return if category.blank? || sub_category.blank?

    template = StudenthubChecklistAssignment.find_by(category: category.to_s, sub_category: sub_category.to_s)&.checklist_template
    template if template&.active
  end

  # The checklist the ticket's Category › Sub-category gets, while the ticket has none. Also offered
  # on the ticket's Checklist tab, for tickets that were there before the assignment.
  def self.template_for_ticket(ticket)
    return if !Setting.get('checklist') || ticket.checklist_id.present?

    template_for(field_value(ticket, CATEGORY_FIELD), field_value(ticket, SUB_CATEGORY_FIELD))
  end

  # Gives the ticket the checklist of its Category › Sub-category, unless it has one already.
  def self.apply!(ticket)
    template = template_for_ticket(ticket)
    return if !template

    UserInfo.ensure_current_user_id { Checklist.create_from_template!(ticket, template) }
  end

  def self.field_value(ticket, name)
    ticket[name] if ticket.has_attribute?(name)
  end

  # The categories, and the sub-categories offered under each, as on the request forms page.
  def self.categories
    Studenthub::RequestForms::Options.option_values(CATEGORY_FIELD)
  end

  def self.sub_categories_by_category
    Studenthub::RequestForms::Options.sub_categories_by_category
  end

  def self.offered?(category, sub_category, offered = sub_categories_by_category)
    Array(offered[category]).any? { |option| option[:value] == sub_category }
  end

  # Makes `pairs` ([{ category:, sub_category: }]) the ones the template is added for. A pair can
  # only be chosen anew while the fields offer it; pairs they dropped stay until taken off.
  def self.replace!(template, pairs)
    offered = sub_categories_by_category
    wanted  = pairs.map { |pair| [pair[:category].to_s.strip, pair[:sub_category].to_s.strip] }.uniq
    current = StudenthubChecklistAssignment.where(checklist_template: template)

    StudenthubChecklistAssignment.transaction do
      current.reject { |assignment| wanted.include?([assignment.category, assignment.sub_category]) }.each(&:destroy!)

      kept = current.reload.map { |assignment| [assignment.category, assignment.sub_category] }
      (wanted - kept).each do |category, sub_category|
        if !offered?(category, sub_category, offered)
          raise Exceptions::UnprocessableContent, format(__('%1$s › %2$s is not a sub-category.'), category, sub_category)
        end

        StudenthubChecklistAssignment.create!(checklist_template: template, category:, sub_category:)
      end
    end
  end

  # Added to Ticket: after a ticket is created, or its Category or Sub-category changed, it gets
  # that pair's checklist. Noted on each save and done after the commit, when the ticket is
  # complete (a ticket can be saved several times in one transaction).
  module TicketHook
    extend ActiveSupport::Concern

    included do
      after_save   :studenthub_note_checklist_due
      after_commit :studenthub_add_checklist
    end

    private

    def studenthub_note_checklist_due
      fields = [CATEGORY_FIELD, SUB_CATEGORY_FIELD]
      @studenthub_checklist_due = true if previously_new_record? || fields.any? { |field| saved_change_to_attribute?(field) }
    end

    def studenthub_add_checklist
      return if !@studenthub_checklist_due

      @studenthub_checklist_due = false
      return if Setting.get('import_mode') || destroyed?

      Studenthub::ChecklistAssignments.apply!(self)
    rescue => e
      Rails.logger.error "Student Hub: no checklist added to ticket #{id}: #{e.message}"
    end
  end
end
