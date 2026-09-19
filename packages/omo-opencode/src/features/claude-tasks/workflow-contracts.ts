import { z } from "zod"

const nonEmptyString = z.string().trim().min(1)
const relativePath = nonEmptyString.superRefine((value, ctx) => {
  if (value.startsWith("/") || value.split("/").includes("..")) {
    ctx.addIssue({ code: "custom", message: "Path must be repository-relative" })
  }
})

export const PlannerWorkItemSchema = z.object({
  id: nonEmptyString,
  objective: nonEmptyString,
  scope: z.array(relativePath).min(1),
  dependencies: z.array(nonEmptyString),
  skills: z.array(nonEmptyString),
  acceptanceCriteria: z.array(nonEmptyString).min(1),
}).strict()

export const PlannerRiskSchema = z.object({
  severity: z.enum(["low", "medium", "high"]),
  description: nonEmptyString,
  requiresArchitect: z.boolean(),
  requiresPreflightReview: z.boolean(),
}).strict()

export const PlannerParallelGroupSchema = z.array(nonEmptyString)

function normalizePath(value: string): string {
  const normalized = value.replace(/^\.\//, "").replace(/\/+$/, "")
  return normalized || "."
}

function pathIsWithinScope(file: string, scope: string): boolean {
  const normalizedFile = normalizePath(file)
  const normalizedScope = normalizePath(scope)
  return normalizedScope === "."
    || normalizedFile === normalizedScope
    || normalizedFile.startsWith(`${normalizedScope}/`)
}

export const DeveloperTaskContractSchema = z.object({
  id: nonEmptyString,
  objective: nonEmptyString,
  scope: z.array(relativePath).min(1),
  acceptanceCriteria: z.array(nonEmptyString).min(1),
  relevantFiles: z.array(relativePath).optional(),
  referencePatterns: z.array(nonEmptyString).optional(),
  forbiddenScope: z.array(relativePath).default([]),
  skills: z.array(nonEmptyString).default([]),
  dependencies: z.array(nonEmptyString).default([]),
}).strict().superRefine((contract, ctx) => {
  for (const [index, file] of (contract.relevantFiles ?? []).entries()) {
    if (!contract.scope.some(scope => pathIsWithinScope(file, scope))) {
      ctx.addIssue({
        code: "custom",
        path: ["relevantFiles", index],
        message: "Relevant file is outside the declared scope",
      })
    }
  }
})

export type DeveloperTaskContract = z.infer<typeof DeveloperTaskContractSchema>

export const PlannerPlanSchema = z.object({
  summary: nonEmptyString,
  workItems: z.array(PlannerWorkItemSchema).min(1),
  parallelGroups: z.array(PlannerParallelGroupSchema),
  risks: z.array(PlannerRiskSchema),
  finalAcceptance: z.array(nonEmptyString).min(1),
}).strict().superRefine((plan, ctx) => {
  const ids = new Set<string>()
  for (const [index, item] of plan.workItems.entries()) {
    if (ids.has(item.id)) {
      ctx.addIssue({ code: "custom", path: ["workItems", index, "id"], message: "Work item IDs must be unique" })
    }
    ids.add(item.id)
  }

  for (const [itemIndex, item] of plan.workItems.entries()) {
    for (const [dependencyIndex, dependency] of item.dependencies.entries()) {
      if (dependency === item.id) {
        ctx.addIssue({ code: "custom", path: ["workItems", itemIndex, "dependencies", dependencyIndex], message: "Work item cannot depend on itself" })
      } else if (!ids.has(dependency)) {
        ctx.addIssue({ code: "custom", path: ["workItems", itemIndex, "dependencies", dependencyIndex], message: "Dependency must reference a work item ID" })
      }
    }
  }

  for (const [groupIndex, group] of plan.parallelGroups.entries()) {
    for (const [memberIndex, member] of group.entries()) {
      if (!ids.has(member)) {
        ctx.addIssue({ code: "custom", path: ["parallelGroups", groupIndex, memberIndex], message: "Parallel group member must reference a work item ID" })
      }
    }
  }
})

export type PlannerPlan = z.infer<typeof PlannerPlanSchema>

export const WorkflowContractSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("developer"), contract: DeveloperTaskContractSchema }).strict(),
  z.object({ kind: z.literal("planner"), contract: PlannerPlanSchema }).strict(),
])

export type WorkflowContract = z.infer<typeof WorkflowContractSchema>

export const DeveloperTaskSchema = DeveloperTaskContractSchema

export function parseWorkflowContract(value: unknown): WorkflowContract {
  return WorkflowContractSchema.parse(value)
}
