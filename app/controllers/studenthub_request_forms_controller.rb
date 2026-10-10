# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: request forms (Studenthub::RequestForms). The admin page's list, drafts and
# publishing, and the form that applies when someone raises a ticket (for the student wizard).
class StudenthubRequestFormsController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  # GET /api/v1/studenthub/request_forms
  def index
    render json: {
      forms:   StudenthubRequestForm.reorder(:id).map { |form| form_payload(form) },
      options: {
        categories:     Studenthub::RequestForms::Options.option_values(Studenthub::RequestForms::CATEGORY_FIELD),
        sub_categories: Studenthub::RequestForms::Options.sub_categories_by_category,
        fields:         Studenthub::RequestForms::Options.field_choices,
        organizations:  Organization.where(active: true).reorder(:name).map { |organization| { id: organization.id, name: organization.name } },
        roles:          Role.where(active: true).reorder(:name).map { |role| { id: role.id, name: role.name } },
      },
    }
  end

  # POST /api/v1/studenthub/request_forms
  def create
    form = StudenthubRequestForm.create!(draft: definition_param)
    render json: form_payload(form), status: :created
  end

  # PUT /api/v1/studenthub/request_forms/:id
  def update
    form.update!(draft: definition_param)
    render json: form_payload(form)
  end

  # POST /api/v1/studenthub/request_forms/:id/publish
  def publish
    form.publish!
    render json: form_payload(form)
  end

  # POST /api/v1/studenthub/request_forms/:id/unpublish
  def unpublish
    form.unpublish!
    render json: form_payload(form)
  end

  # POST /api/v1/studenthub/request_forms/:id/discard
  def discard
    form.discard_changes!
    render json: form_payload(form)
  end

  # DELETE /api/v1/studenthub/request_forms/:id
  def destroy
    form.destroy!
    head :ok
  end

  # GET /api/v1/studenthub/request_forms/applicable?category=…&sub_category=…
  # The form for the person raising the ticket, or null.
  def applicable
    found = Studenthub::RequestForms.applicable(params[:category].to_s, params[:sub_category].to_s, current_user)

    render json: found&.slice('id', 'category', 'sub_category', 'title', 'help_text', 'items', 'fields')
  end

  private

  def form
    @form ||= StudenthubRequestForm.find(params[:id])
  end

  def definition_param
    StudenthubRequestForm.normalize_definition(params[:draft])
  end

  def form_payload(form)
    {
      id:                 form.id,
      draft:              form.draft,
      published:          form.published,
      status:             form.status,
      problems:           form.problems,
      published_problems: form.published_problems,
      published_at:       form.published_at,
      published_by:       form.published_by&.fullname,
      updated_at:         form.updated_at,
    }
  end
end
