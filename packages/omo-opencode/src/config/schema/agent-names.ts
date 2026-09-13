import { z } from "zod"

export const BuiltinAgentNameSchema = z.enum([
  "orchestrator",
  "planner",
  "developer",
  "tester",
  "approver",
  "librarian",
  "architect",
])

export const BuiltinSkillNameSchema = z.enum([
  "playwright",
  "agent-browser",
  "dev-browser",
  "frontend",
  "git-master",
  "review-work",
  "remove-ai-slops",
  "init-deep",
  "debugging",
  "security-research",
  "security-review",
  "visual-qa",
  "team-mode",
])

export const OverridableAgentNameSchema = z.enum([
  "build",
  "plan",
  "orchestrator",
  "planner",
  "developer",
  "tester",
  "approver",
  "librarian",
  "architect",
  "OpenCode-Builder",
])

export const AgentNameSchema = BuiltinAgentNameSchema
export type AgentName = z.infer<typeof AgentNameSchema>

export type BuiltinSkillName = z.infer<typeof BuiltinSkillNameSchema>
