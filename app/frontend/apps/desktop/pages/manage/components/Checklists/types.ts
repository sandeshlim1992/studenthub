// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub: checklists added automatically to tickets in a Category › Sub-category
// (Studenthub::ChecklistAssignments, /api/v1/studenthub/checklist_assignments).

export interface ChecklistSubCategory {
  category: string
  sub_category: string
}

export interface ChecklistAssignment extends ChecklistSubCategory {
  id: number
  checklist_template_id: number
  // The Category / Sub-category fields no longer offer the pair.
  missing: boolean
}

export interface ChecklistCategoryOption {
  value: string
  label: string
}

export interface ChecklistAssignmentsData {
  assignments: ChecklistAssignment[]
  categories: ChecklistCategoryOption[]
  sub_categories: Record<string, ChecklistCategoryOption[]>
}
