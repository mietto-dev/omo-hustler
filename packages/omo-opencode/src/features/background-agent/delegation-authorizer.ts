import {
  defaultDelegationPolicy,
  type DelegationPolicy,
} from "./delegation-policy"

export interface DelegationAuthorizationInput {
  readonly rootSessionId: string
  readonly parentSessionId: string
  readonly callerSessionId: string
  readonly callerRole?: string
  readonly parentTaskId?: string
  readonly targetRole?: string
  readonly category?: string
  readonly depth?: number
  readonly storedRole?: string
}

export function authorizeDelegation(
  input: DelegationAuthorizationInput,
  policy: DelegationPolicy = defaultDelegationPolicy,
) {
  return policy.authorize({
    rootSessionId: input.rootSessionId,
    parentSessionId: input.parentSessionId,
    callerSessionId: input.callerSessionId,
    callerRole: input.callerRole ?? "",
    targetRole: input.targetRole,
    category: input.category,
    depth: input.depth ?? 0,
    parentTaskId: input.parentTaskId,
    storedRole: input.storedRole,
  })
}

export function authorizeNamedDelegation(
  input: DelegationAuthorizationInput,
  policy: DelegationPolicy = defaultDelegationPolicy,
) {
  return authorizeDelegation({ ...input, category: undefined }, policy)
}
