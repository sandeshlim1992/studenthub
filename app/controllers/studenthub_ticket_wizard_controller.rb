# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the choices of the student ticket wizard, the students' ticket list and the managers'
# New ticket: the categories, the sub-categories offered under each (as Student Hub's core workflows
# narrow them, like on the staff form) and the campuses, all read from the ticket fields.
class StudenthubTicketWizardController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  CAMPUS_FIELD = 'campus'.freeze

  # GET /api/v1/studenthub/ticket_wizard_metadata
  def metadata
    options = Studenthub::RequestForms::Options

    render json: {
      categories:                choices(options.option_values(Studenthub::RequestForms::CATEGORY_FIELD)),
      all_subcategories:         choices(options.option_values(Studenthub::RequestForms::SUB_CATEGORY_FIELD)),
      subcategories_by_category: options.sub_categories_by_category.transform_values { |list| choices(list) },
      campuses:                  choices(options.option_values(CAMPUS_FIELD)),
    }
  end

  private

  # The wizard's shape of an option.
  def choices(options)
    options.map { |option| { name: option[:label], value: option[:value] } }
  end
end
