import { buildAntiDuplicationSection } from "./dynamic-agent-prompt-builder";
import type { SisyphusDynamicPromptSections } from "./sisyphus-dynamic-prompt-sections";

export function renderExplorationSection(sections: SisyphusDynamicPromptSections): string {
  return `## Phase 2A - Exploration & Research

${sections.toolSelection}

${sections.librarianSection}

${sections.repositoryLibrarianSection}

### Parallel Execution (DEFAULT behavior)

**Parallelize EVERYTHING. Independent reads, searches, and agents run SIMULTANEOUSLY.**

<tool_usage_rules>
- Parallelize independent tool calls: multiple file reads, grep searches, agent fires - all at once
- Librarian repository mode = background grep. ALWAYS \`run_in_background=true\`, ALWAYS parallel
- Fire 2-5 Librarian agents in parallel for any non-trivial codebase question
- Parallelize independent file reads - don't read files one at a time
- After any write/edit tool call, briefly restate what changed, where, and what validation follows
- Prefer tools over internal knowledge whenever you need specific data (files, configs, patterns)
</tool_usage_rules>

**Librarian modes = Grep, not consultants.**

\`\`\`typescript
// CORRECT: Always background, always parallel
// Prompt structure (each field should be substantive, not a single sentence):
//   [CONTEXT]: What task I'm working on, which files/modules are involved, and what approach I'm taking
//   [GOAL]: The specific outcome I need - what decision or action the results will unblock
//   [DOWNSTREAM]: How I will use the results - what I'll build/decide based on what's found
//   [REQUEST]: Concrete search instructions - what to find, what format to return, and what to SKIP

task(subagent_type="librarian", run_in_background=true, load_skills=[], description="Find auth implementations", prompt="Use Librarian repository mode to find auth middleware, login handlers, token generation, and credential validation in src/. Skip tests and return file paths with pattern descriptions.")
task(subagent_type="librarian", run_in_background=true, load_skills=[], description="Find error handling patterns", prompt="Use Librarian repository mode to find custom errors, response shapes, catch patterns, and global error middleware. Skip tests and return the error hierarchy and response format.")

// Reference Grep (external)
task(subagent_type="librarian", run_in_background=true, load_skills=[], description="Find JWT security docs", prompt="Use Librarian external mode to find current OWASP JWT security guidance, token lifetimes, refresh rotation, and common vulnerabilities. Skip basic tutorials.")
task(subagent_type="librarian", run_in_background=true, load_skills=[], description="Find Express auth patterns", prompt="Use Librarian external mode to find production Express middleware ordering, refresh, RBAC, and error propagation patterns. Skip basic tutorials.")
// Continue only with non-overlapping work. If none exists, end your response and wait for completion.
// WRONG: Sequential or blocking
result = task(..., run_in_background=false)  // Never wait synchronously for explore/librarian
\`\`\`

### Background Result Collection:
1. Launch parallel agents → receive background task IDs (\`bg_...\`) for results and continuation session IDs (\`ses_...\`) for follow-ups
2. Continue only with non-overlapping work
   - If you have DIFFERENT independent work → do it now
   - Otherwise → **END YOUR RESPONSE.**
3. **STOP. END YOUR RESPONSE.** The system will send \`<system-reminder>\` when tasks complete.
4. On receiving \`<system-reminder>\` → collect results via \`background_output(task_id="bg_...")\`
5. **NEVER call \`background_output\` before receiving \`<system-reminder>\`.** This is a BLOCKING anti-pattern.
6. Cleanup: Cancel disposable tasks individually via \`background_cancel(taskId="...")\`
7. Use \`task(task_id="ses_...")\` only to continue the same sub-agent session

${buildAntiDuplicationSection()}

### Search Stop Conditions

STOP searching when:
- You have enough context to proceed confidently
- Same information appearing across multiple sources
- 2 search iterations yielded no new useful data
- Direct answer found

**DO NOT over-explore. Time is precious.**

---`;
}
