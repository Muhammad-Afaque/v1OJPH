# 04 — CLI categorize command

**What to build:** Implement the `categorize` subcommand that classifies all jobs into Categories based on title and Tags using keyword matching rules. Writes category assignments back to D1.

**Blocked by:** 03 — CLI detail command

**Status:** ready-for-agent

- [ ] `npx ojph categorize` subcommand
- [ ] Classification rules ported from Python (10 categories: VA, Marketing, Design, Development, Sales, Finance, Writing, Medical, Real Estate, Other)
- [ ] Score-based matching: tags weighted 2 points, title keywords weighted 3 points
- [ ] Ties broken by first match
- [ ] Writes `category` field back to D1 for all jobs
- [ ] Prints category distribution summary
- [ ] Unit tests for classification logic (test known inputs produce expected categories)
