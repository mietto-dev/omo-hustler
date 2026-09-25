import type { ModelRequirement } from "./model-requirement-types"

export const AGENT_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {
  orchestrator: {
    fallbackChain: [
      {
        providers: ["anthropic", "github-copilot", "opencode"],
        model: "claude-opus-5",
        variant: "max",
      },
      {
        providers: ["opencode-go", "kimi-for-coding", "moonshotai", "opencode", "bailian-coding-plan", "moonshotai-cn", "firmware", "ollama-cloud", "aihubmix"],
        model: "kimi-k3",
      },
      {
        providers: ["openai", "openai-codex", "github-copilot", "opencode"],
        model: "gpt-5.6-sol",
        variant: "medium",
      },
      { providers: ["zai-coding-plan", "opencode", "bailian-coding-plan"], model: "glm-5.2" },
      { providers: ["opencode"], model: "big-pickle" }
    ],
    requiresAnyModel: true,
  },
  developer: {
    fallbackChain: [
      {
        providers: ["openai", "openai-codex", "github-copilot", "opencode"],
        model: "gpt-5.6-sol",
        variant: "medium",
      }
    ],
    requiresProvider: ["openai", "openai-codex", "github-copilot", "opencode"],
    requiresAnyModel: true,
  },
  architect: {
    fallbackChain: [
      { providers: ["openai", "openai-codex", "opencode"], model: "gpt-5.6-sol", variant: "xhigh" },
      { providers: ["github-copilot"], model: "gpt-5.6-sol", variant: "high" },
      {
        providers: ["google", "github-copilot", "opencode"],
        model: "gemini-3.1-pro",
        variant: "high",
      },
      {
        providers: ["anthropic", "github-copilot", "opencode"],
        model: "claude-opus-5",
        variant: "max",
      },
      { providers: ["opencode-go"], model: "glm-5.2" }
    ],
  },
  librarian: {
    fallbackChain: [
      { providers: ["openai", "openai-codex"], model: "gpt-5.6-luna-fast", variant: "low" },
      { providers: ["deepseek"], model: "deepseek-v4-flash", variant: "max" },
      { providers: ["opencode-go", "bailian-coding-plan"], model: "qwen3.7-plus" },
      { providers: ["opencode-go"], model: "minimax-m3" },
      { providers: ["minimax-coding-plan", "minimax-cn-coding-plan"], model: "MiniMax-M3" },
      { providers: ["opencode-go"], model: "minimax-m2.7" },
      { providers: ["anthropic"], model: "claude-haiku-4-5" },
      { providers: ["github-copilot"], model: "gpt-5-mini" },
      { providers: ["opencode"], model: "gpt-5-nano" }
    ],
  },
  planner: {
    fallbackChain: [
      {
        providers: ["anthropic", "github-copilot", "opencode"],
        model: "claude-fable-5-1",
        variant: "xhigh",
      },
      {
        providers: ["opencode-go", "kimi-for-coding", "moonshotai", "opencode"],
        model: "kimi-k3",
        variant: "max",
      }
    ],
  },
  tester: {
    fallbackChain: [
      { providers: ["openai", "openai-codex"], model: "gpt-6-astra", variant: "xhigh" },
      { providers: ["github-copilot"], model: "gpt-6-astra", variant: "high" },
      { providers: ["openai", "openai-codex", "opencode"], model: "gpt-6-astra", variant: "high" },
      {
        providers: ["anthropic", "github-copilot", "opencode"],
        model: "claude-opus-5",
        variant: "max",
      },
      {
        providers: ["google", "github-copilot", "opencode"],
        model: "gemini-3.1-pro",
        variant: "high",
      },
      { providers: ["opencode-go"], model: "glm-5.2" }
    ],
  },
  approver: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-5" },
      { providers: ["opencode-go"], model: "kimi-k3" },
      {
        providers: ["openai", "openai-codex", "github-copilot", "opencode"],
        model: "gpt-5.6-sol",
        variant: "medium",
      },
      { providers: ["opencode-go"], model: "minimax-m3" },
      { providers: ["minimax-coding-plan", "minimax-cn-coding-plan"], model: "MiniMax-M3" },
      { providers: ["opencode-go"], model: "minimax-m2.7" }
    ],
  },
}
