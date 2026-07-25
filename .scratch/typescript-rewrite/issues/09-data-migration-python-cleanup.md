# 09 — Data migration + Python cleanup

**What to build:** Import existing 34K jobs from chunks into D1, delete Python files and shell scripts, update GitHub Actions workflow for TypeScript.

**Blocked by:** 05 — CLI pipeline command, 07 — Frontend — dashboard, 08 — Frontend — browse + filters

**Status:** ready-for-agent

- [ ] Migration script reads chunks/*.json and upserts into D1
- [ ] Verify all 34K jobs imported correctly (count match)
- [ ] Verify FTS5 index works with imported data
- [ ] Delete Python files: mainv2.py, phase2.py, phase3.py, run.sh, start.sh
- [ ] Delete frontend/server.py, frontend/serve.sh, frontend/vercel.json
- [ ] Delete chunks/ directory (data now in D1)
- [ ] Update .github/workflows/scrape.yml for TypeScript (bun install, bun run pipeline, wrangler d1 import)
- [ ] Update README.md with new setup instructions
- [ ] End-to-end verification: pipeline runs, frontend displays all jobs
