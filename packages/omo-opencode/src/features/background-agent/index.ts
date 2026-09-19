export * from "./types"
export { BackgroundManager, type SubagentSessionCreatedEvent, type OnSubagentSessionCreated, type SubagentSessionDeletedEvent, type OnSubagentSessionDeleted } from "./manager"
export { waitForTaskSessionID } from "./wait-for-task-session"
export type { WaitForTaskSessionIDOptions } from "./wait-for-task-session"
export {
  DELEGATION_ROLES,
  DelegationPolicyError,
  createDelegationPolicy,
  defaultDelegationPolicy,
} from "./delegation-policy"
export type {
  DelegationRole,
  DelegationPolicyErrorCode,
  DelegationLineage,
  DelegationRequest,
  DelegationPolicy,
} from "./delegation-policy"
export { authorizeDelegation, authorizeNamedDelegation } from "./delegation-authorizer"
