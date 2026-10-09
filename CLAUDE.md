# Student Hub

Read these when the task needs them (they are not loaded automatically, to keep each request small):

- `README.md`: what Student Hub is, setup, deploying, and each feature with its files
- `.dev/NOTES.md`: current state: decisions, known issues, in progress, next steps
- `.dev/LOG.md`: what was done, one line per change

## Rules for this repo (override Zammad's defaults)

- Don't write or change code without the user's approval. Propose the change first
  and wait for a yes. Read-only work (reading files, searching, explaining) is fine.
- Before committing, update `.dev/NOTES.md` only if something changed: add new decisions
  or known issues, remove fixed ones, and update "In progress" and "Next steps".
  Add a line for the change to `.dev/LOG.md`. Include both in the same commit.
  Never put secrets in either.
- Branch is `develop`; merge commits only, never squash or rebase.
- Ignore Zammad's GitLab/`glab`/MR/cherry-pick workflow; this repo uses GitHub only.
