// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub: where a student's ticket stands, from its state. Student Hub's states are named
// "4. Awaiting user Response", "5. Resolved" and so on, and "5. Resolved" is an open state in
// Zammad, so the names decide as well as the state types (as on the new UI's student ticket list).

export type StudenthubTicketStage = 'new' | 'progress' | 'waiting' | 'resolved' | 'closed'

interface TicketState {
  name: string
  stateType: { name: string }
}

export const studenthubTicketStage = ({ name, stateType }: TicketState): StudenthubTicketStage => {
  if (stateType.name === 'closed' || stateType.name === 'merged') return 'closed'

  const stateName = name.toLowerCase()
  if (stateName.includes('resolved')) return 'resolved'
  if (stateName.includes('waiting')) return 'waiting'
  if (stateType.name === 'new') return 'new'

  return 'progress'
}

export const studenthubTicketStageLabel: Record<StudenthubTicketStage, string> = {
  new: __('New'),
  progress: __('In progress'),
  waiting: __('Waiting for you'),
  resolved: __('Resolved'),
  closed: __('Closed'),
}

export const isStudenthubTicketDone = (stage: StudenthubTicketStage) =>
  stage === 'resolved' || stage === 'closed'
