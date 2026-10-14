# Student Hub

Student Hub is a customised Zammad helpdesk for LSST, FSB and UKBC students and staff. These rules come first;
`.claude/CLAUDE.md` describes the codebase and its commands.

Read these when the task needs them. They are long, so read only the part you need: list the sections with
`grep -n '^## ' <file>`, then read just those lines.

- `README.md` (about 1,150 lines): what Student Hub is, setup, deploying, and each feature with its files
- `.dev/NOTES.md`: current state: tests that already fail, known issues, in progress, next steps
- `.dev/DECISIONS.md`: what was decided and why
- `.dev/security-review.md`: security findings and what was decided about each

## Approval

- Don't write or change code without the user's approval: propose the change and wait for a yes. One yes covers the
  whole task: don't ask again for each step, only when the work grows beyond what was approved.
- Reading, searching and explaining need no approval.

## Writing new code

New files, and new code in existing files, are lean and idiomatic from the start:

- Guard clauses and early returns instead of nesting; no `else` after `return`.
- Names from the domain (`ticket`, `approval`, `site`), not `data`, `item` or `tmp`.
- Comments say why, not what. No dead or commented-out code.
- `map` / `filter` / `reduce` instead of hand-written loops where that reads clearer.
- No abstraction until it has a second caller.

They also fit the repo:

- Every new file has the Zammad copyright header and comes with tests (RSpec for the backend, Vitest for the frontend).
- Prefer Student Hub's own files (`lib/studenthub/`, `Studenthub*` names, additions to Zammad classes in
  `config/initializers/studenthub_*.rb`). When a Zammad file has to change, mark the change with a `Student Hub:`
  comment.
- Text users see goes through `__()` or `$t()`.
- Every endpoint has its permission check: a controller policy, and `authorize!` for the records it touches.
- No new lint or type errors: RuboCop, ESLint and oxfmt on the files you changed. When `.ts` or `.vue` files changed,
  run the type check once, after the change (`pnpm lint:ts 2>&1 | grep -c 'error TS'`), and compare the count with
  `.dev/NOTES.md` → Tests that already fail.

## Changing an existing file: tidy it first

Before changing a Student Hub file that has its own spec file, tidy the code you're about to change (those functions
or methods, and their imports) to the style above. Skip the tidy for a one-line fix, and for a file without a spec
file unless the change adds tests anyway (then add them first and tidy).

- A tidy changes no behaviour: same inputs, outputs, side effects and errors. Keep validation, error handling,
  permission checks, text users see, and comments that explain why.
- Run the file's tests after the tidy. If they fail, undo the tidy; never change a test to make it pass. If they
  pass, stage the tidy (`git add <file>`).
- When the user asks to commit, commit the staged tidy first (`style(<area>): tidy <file>, no behaviour change`),
  then the change.
- Never tidy Zammad's own files, generated files (`*.api.ts`, `*.mocks.ts`, GraphQL types), migrations or tests.
- Don't use autofixes that change behaviour: ESLint's `vue/attributes-order`, `import/order`, `zammad-tailwind-ltr`
  and translatable-string fixes; RuboCop's `Style/IfUnlessModifier` (it builds very long lines here).
- A bug found while tidying gets its own commit, never the tidy's.

## Before committing

1. The tests and linters for what changed pass, or fail only as listed in `.dev/NOTES.md` → Tests that already fail.
2. Check `git diff HEAD` for security problems, as deeply as the risk needs, and tell the user what you found:
   - docs or tests only: no check;
   - a tidy: check that no permission check, validation or error handling disappeared;
   - server code that handles permissions, user input, SQL, files, redirects or secrets: a full review. For a big
     change of that kind, also run the `security-review` skill after committing and before pushing (it reviews
     commits that aren't on GitHub yet).

   Fix real problems, or let the user decide. Add findings and verdicts as a new section at the end of
   `.dev/security-review.md`, without reading the whole file.
3. Update `.dev/NOTES.md` only if something changed: add new known issues and failing tests, remove fixed ones, and
   keep "In progress" and "Next steps" current. New decisions go at the end of `.dev/DECISIONS.md`. Read and edit
   only the sections concerned. These go in the same commit as the change.
4. Never put secrets in any of these files.

## Git

- Branch `develop`; merge commits only, never squash or rebase. Commit and push only when the user asks.
- The commit message is the record of what was done (there is no change log): `type(area): what changed`, with a
  body that says why when it isn't obvious. Types: `feat`, `fix`, `style`, `chore`, `docs`, `test`.
- GitHub only: ignore Zammad's GitLab, `glab`, merge request and cherry-pick workflow.
