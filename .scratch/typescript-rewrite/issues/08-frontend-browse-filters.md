# 08 — Frontend — browse + filters

**What to build:** Implement the browse view with job list panel, detail panel, search, filters, sorting, pagination, and notes. Full feature parity with current frontend.

**Blocked by:** 06 — Worker API — full endpoints

**Status:** ready-for-agent

- [ ] Browse view with job list panel (38% width) and detail panel (flex)
- [ ] Job cards show title, company, salary, work type, posted date, category badge
- [ ] Search box with debounced input (300ms)
- [ ] Category filter checkboxes
- [ ] Work type filter chips (Full Time, Part Time, Gig, Freelance, Contract)
- [ ] Salary range filter (min/max inputs)
- [ ] Date range filter (date pickers)
- [ ] Sort by posted/title/company/salary with ascending/descending toggle
- [ ] Pagination with 50 jobs per page
- [ ] Detail panel shows all job fields + tags
- [ ] Notes section: email, extra description, custom notes (add/delete)
- [ ] Notes save to D1 via POST /api/jobs/:id/notes
- [ ] Export filtered results as CSV
- [ ] Mobile responsive (filter bar toggle, stacked layout)
- [ ] Keyboard navigation (Escape closes filter bar)
