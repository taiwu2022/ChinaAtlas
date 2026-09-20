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
