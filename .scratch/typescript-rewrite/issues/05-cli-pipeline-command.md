# 05 — CLI pipeline command

**What to build:** Implement the `pipeline` subcommand that chains Phase 1 → Phase 2 → Phase 3 sequentially. Includes lock file to prevent concurrent runs and structured logging.

**Blocked by:** 02 — D1 read path + Worker API + minimal frontend, 03 — CLI detail command, 04 — CLI categorize command

**Status:** ready-for-agent

- [ ] `npx ojph pipeline` subcommand
- [ ] Chains: list → detail → categorize in sequence
- [ ] Lock file (`.run.lock`) prevents concurrent pipeline runs
- [ ] Each phase logs start/end with timestamps
- [ ] Pipeline aborts if any phase fails (exit code 1)
- [ ] Summary output: jobs scraped, enriched, categorized
- [ ] `--dry-run` flag previews what would be scraped
- [ ] Integration test: full pipeline runs against local D1
