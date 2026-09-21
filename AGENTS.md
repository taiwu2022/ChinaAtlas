# China Atlas public edition

- The user authorized this dedicated GitHub repository, PR and GitHub Pages publication.
- Chinese first, compact mobile reading, secondary English terms; keep all people visible.
- `web/` is shared front-end source. Build `site/` with `python3 scripts/build.py`; never hand-edit generated artifacts.
- Public data is a reviewed snapshot, not a live roster. Preserve sources, dates, stable IDs and uncertainty.
- Never infer personal grade, acquaintance, factions or motives from an office, shared place or co-service.
- Never commit local databases, notes, credentials, absolute machine paths, original course decks, raw research archives or backups.
- Export from the maintenance app merged view using the strict whitelist exporter. Do not replace it with seed-only JSON.
- Browser notes are private device storage. Reads that fail must never be treated as an empty writable database.
- Validate under a project subpath and at 320/390/desktop widths; use the documented in-app browser skill.
- Run Python export/build tests and Node portable/navigation/frontend tests. Preserve the maintenance app ledger.
- Source changes use `codex/*` branches and PRs; `gh-pages` contains only clean generated output. Record source commit in build-info.
- Published snapshot may precede source PR merge only when explicitly described in the PR.

- Portraits are curated in data/portraits.json by stable person ID plus exact name. Use explicit official captions/profile pages, never inferred facial identity. Keep source/credit/date provenance; no AI-generated substitute faces.
- Portrait binaries are linked from official sites over HTTPS and only loaded inside profiles. No-photo/error states must preserve readable profiles and private drafts. Mirror portrait JSON to the local maintenance dist/research and update its exact image-origin CSP when adding hosts.

- Expansion schema and upkeep: docs/DATA_MODEL.md. New role verification_status and as_of_date distinguish current evidence, undated directories, historical facts, conflicts and unverified leads. Do not turn historical status into known departure.
- Homonyms: possible_identity_ids is an identity review queue, never a social relation; known distinct people must not be linked as possible same identities. Retain each ID until explicit evidence supports a merge.
- Large locations use place_groups and lazy selected-person links; keep legacy small-group links, deep links and filtered regional exports functional. Run scripts/audit_data.py and synthetic scale tests before publishing.

- Evidence upkeep: docs/SOURCE_SEARCH_METHODS.md lists actual research methods; data/source-catalog.json is a discovery configuration, not a running crawler. Regenerate source_inventory.py and accuracy_report.py with the actual research date after changing data. Reports are read-only and no error count certifies factual truth. Preserve legacy unknowns and recorded conflicts.
- profile_facts stores sourced public background by stable person ID, field/value and evidence dates. Facts do not refresh offices or automatically create career links. Include them in both regional exports; run accuracy, export and frontend regression tests.


## Career review maintenance
- Open career intervals require as_of_date/latest_confirmed_at/current_evidence_date; never use checked_at as a term boundary. A CV stage boundary is not proof an overlapping Party office ended.
- reviewed_updates uses exact before/set preconditions and supporting sources; stale values reject the whole packet. Keep data_merge.py mirrored with the public scripts/data_merge.py and preserve correction packets. Never apply seed research over SQLite overlays or notes.
- Two-person comparison is unfiltered evidence inspection: same-place experience and dated co-service remain distinct. Preserve comparison deep links and unsaved drafts on Back.

## Personnel events and departments
- status_events stores separately sourced actions, not an inferred current verdict. Follow docs/PERSONNEL_STATUS_MODEL.md; unknown effective dates stay null and explicit supersession never deletes history. Investigation, expulsion, public-office removal, prosecution and conviction are separate. An unrecorded event means unknown, never a clean bill.
- Party and state CMC careers and representation qualifications stay separate. A pending ratification must remain visible; "previously" is not the publication date. Do not infer an individual removal date from general disciplinary rules.
- Department browsing includes role and career-only records, scopes service to the exact institution, and preserves deep links and notes. Themes are navigation groups, not chains of command or grades. Run tests/personnel.cjs with navigation/frontend/portable tests.
- Biography snippets must label evidence dates as evidence; a directory publication or activity date is not an appointment date. Keep source excerpts and the normalized short factual summaries readable in both editions.

- Overview working-agency cards use verified institutional classification, not parent_id alone; exclude provincial governments and schematic/historical tiers from central department groups. Child bureaux/offices require sourced administrative_leadership or office_link. Preserve diagram deep links and note drafts; each displayed name carries the exact institution role. The v10 research packet adds institutional facts only, without refreshing personnel.
