import { configureSharedSubunitLogger } from "@omo-hustler/utils"
import {
  LIVE_ROUTE_DISPATCH_LOG,
  LIVE_ROUTE_UNAVAILABLE_LOG,
  configurePromptDispatchRouteResolver,
} from "@omo-hustler/utils/prompt-async-gate/route-resolver"

import {
  isPreSendConnectionFailure,
  markLiveRouteUnavailable,
  resolveDispatchClient,
  tryResolveDispatchClientSync,
} from "./live-server-route"
import { log } from "./logger"

configureSharedSubunitLogger(log)
configurePromptDispatchRouteResolver({
  tryResolveDispatchClientSync,
  resolveDispatchClient,
  isPreSendConnectionFailure,
  markLiveRouteUnavailable,
})

export {
  LIVE_ROUTE_DISPATCH_LOG,
  LIVE_ROUTE_UNAVAILABLE_LOG,
}
export * from "@omo-hustler/utils/prompt-async-gate"
