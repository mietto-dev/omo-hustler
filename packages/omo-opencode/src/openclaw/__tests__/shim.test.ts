import { describe, expect, test } from "bun:test"
import * as coreConfig from "@omo-hustler/openclaw-core/config"
import * as coreDispatcher from "@omo-hustler/openclaw-core/dispatcher"
import * as coreInjection from "@omo-hustler/openclaw-core/reply-listener-injection"
import * as coreRegistry from "@omo-hustler/openclaw-core/session-registry"
import * as coreStart from "@omo-hustler/openclaw-core/reply-listener-start"
import * as coreTmux from "@omo-hustler/openclaw-core/tmux"
import * as adapterConfig from "../config"
import * as adapterDispatcher from "../dispatcher"
import * as adapterInjection from "../reply-listener-injection"
import * as adapterRegistry from "../session-registry"
import * as adapterStart from "../reply-listener-start"
import * as adapterTmux from "../tmux"

describe("OpenClaw adapter shims", () => {
  test("#given legacy OpenCode OpenClaw import paths #when loaded #then they re-export openclaw-core implementations", () => {
    expect(adapterConfig.resolveGateway).toBe(coreConfig.resolveGateway)
    expect(adapterDispatcher.wakeGateway).toBe(coreDispatcher.wakeGateway)
    expect(adapterInjection.injectReplyIntoPane).toBe(coreInjection.injectReplyIntoPane)
    expect(adapterRegistry.registerMessage).toBe(coreRegistry.registerMessage)
    expect(adapterStart.resolveReplyListenerDaemonScript).toBe(coreStart.resolveReplyListenerDaemonScript)
    expect(adapterTmux.sendToPane).toBe(coreTmux.sendToPane)
  })
})
