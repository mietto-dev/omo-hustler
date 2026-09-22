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

export const VerificationStatusSchema = z.object({
  tests: z.enum(["pass", "fail", "not-applicable"]),
  build: z.enum(["pass", "fail", "not-applicable"]),
  lint: z.enum(["pass", "fail", "not-applicable"]),
  typecheck: z.enum(["pass", "fail", "not-applicable"]),
}).strict()

export type VerificationStatus = z.infer<typeof VerificationStatusSchema>

const VERIFICATION_CHECKS = ["tests", "build", "lint", "typecheck"] as const

export function hasSuccessfulVerification(verification: VerificationStatus): boolean {
  return VERIFICATION_CHECKS.every(check => verification[check] !== "fail")
}

export function getVerificationFailures(verification: VerificationStatus): string[] {
  return VERIFICATION_CHECKS
    .filter(check => verification[check] === "fail")
    .map(check => `${check} verification failed`)
}

export const TesterIssueSeveritySchema = z.enum(["low", "medium", "high", "critical"])

export const ActionableTesterIssueSchema = z.object({
  severity: TesterIssueSeveritySchema,
  file: relativePath.optional(),
  description: nonEmptyString,
  requiredFix: nonEmptyString,
  workItemId: nonEmptyString.optional(),
}).strict()

export type ActionableTesterIssue = z.infer<typeof ActionableTesterIssueSchema>

export const TesterReviewSchema = z.object({
  status: z.enum(["approved", "changes_requested"]),
  issues: z.array(ActionableTesterIssueSchema),
  reviewSummary: nonEmptyString,
  verification: VerificationStatusSchema,
}).strict().superRefine((review, ctx) => {
  if (review.status === "changes_requested" && review.issues.length === 0) {
    ctx.addIssue({ code: "custom", path: ["issues"], message: "Changes requested requires actionable issues" })
  }

  if (review.status === "approved" && !hasSuccessfulVerification(review.verification)) {
    ctx.addIssue({ code: "custom", path: ["verification"], message: "Approved review requires successful verification" })
  }

  if (review.status === "approved" && review.issues.some(issue => issue.severity === "high" || issue.severity === "critical")) {
    ctx.addIssue({ code: "custom", path: ["issues"], message: "Approved review cannot contain unresolved high-severity issues" })
  }
})

export type TesterReview = z.infer<typeof TesterReviewSchema>

export const ApproverMissingCriterionSchema = nonEmptyString

export const ApproverInputSchema = z.object({
  originalRequest: nonEmptyString,
  acceptanceCriteria: z.array(nonEmptyString).min(1),
  completedWork: z.array(nonEmptyString),
  unresolvedIssues: z.array(nonEmptyString),
  verification: VerificationStatusSchema,
}).strict()

export type ApproverInput = z.infer<typeof ApproverInputSchema>

export const ApproverResultSchema = z.object({
  status: z.enum(["accepted", "incomplete"]),
  missingCriteria: z.array(ApproverMissingCriterionSchema),
}).strict().superRefine((result, ctx) => {
  if (result.status === "accepted" && result.missingCriteria.length > 0) {
    ctx.addIssue({ code: "custom", path: ["missingCriteria"], message: "Accepted result cannot report missing criteria" })
  }

  if (result.status === "incomplete" && result.missingCriteria.length === 0) {
    ctx.addIssue({ code: "custom", path: ["missingCriteria"], message: "Incomplete result must report missing criteria" })
  }
})

export type ApproverResult = z.infer<typeof ApproverResultSchema>

function missingAcceptanceCriteria(input: ApproverInput): string[] {
  return input.acceptanceCriteria.filter(criteria => !input.completedWork.includes(criteria))
}

export function resolveApproverResult(input: ApproverInput): ApproverResult {
  const parsed = ApproverInputSchema.parse(input)
  const missingCriteria = [
    ...missingAcceptanceCriteria(parsed),
    ...getVerificationFailures(parsed.verification),
    ...parsed.unresolvedIssues,
  ]

  return ApproverResultSchema.parse({
    status: missingCriteria.length === 0 ? "accepted" : "incomplete",
    missingCriteria,
  })
}

export const WorkflowContractSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("developer"), contract: DeveloperTaskContractSchema }).strict(),
  z.object({ kind: z.literal("planner"), contract: PlannerPlanSchema }).strict(),
])

export type WorkflowContract = z.infer<typeof WorkflowContractSchema>

export const DeveloperTaskSchema = DeveloperTaskContractSchema

export function parseWorkflowContract(value: unknown): WorkflowContract {
  return WorkflowContractSchema.parse(value)
}
