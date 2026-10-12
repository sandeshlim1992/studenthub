# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the system's active languages for the new UI's Knowledge Base and Branding pages.
# Zammad has no REST list of them, and its GraphQL query has no ids, which a knowledge base's
# languages refer to.
class StudenthubLocalesController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  # GET /api/v1/studenthub/locales
  def index
    render json: Locale.where(active: true).reorder(:name).map { |locale| locale.slice(:id, :locale, :alias, :name, :dir, :active) }
  end
end
