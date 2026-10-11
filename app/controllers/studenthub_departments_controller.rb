# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: departments (Studenthub::Departments) for the admin page.
class StudenthubDepartmentsController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  # GET /api/v1/studenthub/departments
  def index
    render json: {
      enabled:     Studenthub::Departments.enabled?,
      departments: StudenthubDepartment.reorder(:name).map { |department| department_payload(department) },
      campuses:    Studenthub::Departments.campus_options,
    }
  end

  # PUT /api/v1/studenthub/departments/settings
  def update_settings
    Setting.set(Studenthub::Departments::SETTING, ActiveModel::Type::Boolean.new.cast(params[:enabled]) == true)
    render json: { enabled: Studenthub::Departments.enabled? }
  end

  # POST /api/v1/studenthub/departments
  def create
    department = StudenthubDepartment.create!(department_params)
    render json: department_payload(department), status: :created
  end

  # PUT /api/v1/studenthub/departments/:id
  def update
    department.update!(department_params)
    render json: department_payload(department)
  end

  # DELETE /api/v1/studenthub/departments/:id
  def destroy
    department.destroy!
    head :ok
  end

  private

  def department
    @department ||= StudenthubDepartment.find(params[:id])
  end

  def department_params
    {
      name:      params[:name].to_s,
      email:     params[:email].to_s,
      locations: Array(params[:locations]).map(&:to_s),
    }
  end

  def department_payload(department)
    {
      id:                department.id,
      name:              department.name,
      locations:         department.locations,
      email:             department.email,
      missing_locations: department.missing_locations,
      updated_at:        department.updated_at,
    }
  end
end
