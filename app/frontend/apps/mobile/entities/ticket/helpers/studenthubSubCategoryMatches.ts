// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub: the request types a student finds by typing ("card" → New ID Card · Service
// Request), from the new UI wizard's choices (/api/v1/studenthub/ticket_wizard_metadata). Used by
// the request chat and the students' search.

export interface RequestChoice {
  name: string
  value: string
}

export interface RequestCategories {
  categories: RequestChoice[]
  subcategories_by_category: Record<string, RequestChoice[]>
}

export interface RequestSearchMatch {
  category: RequestChoice
  subCategory: RequestChoice
}

export const studenthubSubCategoryMatches = (
  choices: RequestCategories,
  query: string,
  { inCategory, limit }: { inCategory?: string; limit: number },
): RequestSearchMatch[] => {
  const words = query.trim().toLowerCase()
  if (!words) return []

  return choices.categories
    .filter((choice) => !inCategory || choice.value === inCategory)
    .flatMap((choice) =>
      (choices.subcategories_by_category[choice.value] ?? [])
        .filter((sub) => sub.name.toLowerCase().includes(words))
        .map((sub) => ({ category: choice, subCategory: sub })),
    )
    .slice(0, limit)
}

// The request a link names (the request chat's ?category=…&sub_category=…), if it still exists.
export const studenthubSubCategoryMatch = (
  choices: RequestCategories,
  categoryValue: string,
  subCategoryValue: string,
): RequestSearchMatch | undefined => {
  const category = choices.categories.find((choice) => choice.value === categoryValue)
  const subCategory = choices.subcategories_by_category[categoryValue]?.find(
    (sub) => sub.value === subCategoryValue,
  )
  if (!category || !subCategory) return undefined

  return { category, subCategory }
}
