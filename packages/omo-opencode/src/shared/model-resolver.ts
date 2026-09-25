import {
	resolveModel,
	resolveModelWithFallback as resolveModelWithFallbackFromCore,
	normalizeFallbackModels,
	flattenToFallbackModelStrings,
} from "@omo-hustler/model-core"
import type {
	ModelResolutionInput,
	ExtendedModelResolutionInput,
} from "@omo-hustler/model-core"
import * as connectedProvidersCache from "./connected-providers-cache"

export { resolveModel, normalizeFallbackModels, flattenToFallbackModelStrings }

type CoreModelResolutionResult = ReturnType<typeof resolveModelWithFallbackFromCore>
export type ModelResolutionResult = Exclude<CoreModelResolutionResult, undefined>
export type ModelSource = ModelResolutionResult["source"]

export function resolveModelWithFallback(
	input: ExtendedModelResolutionInput,
): CoreModelResolutionResult {
	return resolveModelWithFallbackFromCore(input, connectedProvidersCache)
}

export type {
	ModelResolutionInput,
	ExtendedModelResolutionInput,
}
