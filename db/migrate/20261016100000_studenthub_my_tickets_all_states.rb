# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: "My Tickets" lists a student's tickets in every state but merged
# (Studenthub::MyTicketsView). New systems get it after db:seed (Studenthub::Setup).
class StudenthubMyTicketsAllStates < ActiveRecord::Migration[8.0]
  def up
    return if !Studenthub::Setup.seeded?

    Studenthub::MyTicketsView.ensure!
  end
end
