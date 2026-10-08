# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# A site (organisation) assigned to a manager (Studenthub::ManagerSites).
class StudenthubManagerSite < ApplicationModel
  belongs_to :user
  belongs_to :organization

  validates :organization_id, uniqueness: { scope: :user_id }

  after_commit :sync_site_views

  private

  def sync_site_views
    return if Setting.get('import_mode')

    StudenthubTeamViewsSyncJob.perform_later
  end
end
