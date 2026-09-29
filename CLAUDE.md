# Student Hub

@README.md
@.dev/NOTES.md

## Rules for this repo (override Zammad's defaults)
- Before committing, update `.dev/NOTES.md` only if something changed: add new decisions
  or known issues, remove fixed ones, and update "In progress" and "Next steps".
  Include it in the same commit. Never put secrets in it.
- Branch is `develop`; merge commits only, never squash or rebase.
- Ignore Zammad's GitLab/`glab`/MR/cherry-pick workflow; this repo uses GitHub only.