---
description: Create atomic git commits
agent: build
---

Create one or more atomic git commits from the current working tree.

Workflow:
- Run: `git status --porcelain=v1 -uall`, `git diff`, and `git log -10 --oneline --decorate`.
- Group changes into buildable/logical units (schema, generated types, UI, auth wiring, docs, etc.).
- Stage and commit each group with an intent-focused Conventional Commit message.
- Use the `Git Commit Helper` (`git-commit-helper`) skill to draft messages from the staged diff, then normalize to Conventional Commits (ignore repo style).
- Include a short rationale in the commit body (1-2 lines explaining why).
- Linear integration:
  - Detect Linear issue IDs referenced in the session or current work; assume Team: Freelance and Project: Library unless the user says otherwise.
  - Ensure any active issues are set to `In Progress` before finalizing commits (assign to `me` if applicable).
  - After commits, list the issues that would be completed and ask for confirmation before closing them.
  - If confirmed, add a short comment with commit hashes + verification results, then move issues to Done.
  - If no issues are detected, ask for IDs and skip closing.
- Respond in Spanish.
- Do not commit secrets/credentials (e.g. `.env.local`).
- Do not commit large exports like `data/*.csv` unless explicitly requested.
- Do not push.
- Do not amend commits.
- After commits, run a fast verification step when reasonable (`bun run check` or `bun run test`) and report results.

If grouping is ambiguous, ask exactly one targeted question and proceed with a recommended default.
