export const taskStatusValues = [
  'idea',
  'planned',
  'ready',
  'in_progress',
  'blocked',
  'review',
  'done',
] as const

export const taskPriorityValues = [
  'low',
  'medium',
  'high',
] as const

export const taskHumanReviewValues = [
  'required',
  'suggested',
  'not_required',
] as const

export const defaultTaskChecks = [
  'bun run lint',
  'bun run typecheck',
]
