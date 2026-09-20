# Extending the public officials database

The database separates people, institutions, public posts, locations and sources. It is a reading collection, not a complete civil-service roster. Membership of a people's congress or political party does not by itself establish civil-service employment or personal administrative rank.

## Identity and geography

- Person IDs remain stable when an office changes. Names alone are never an identity key. Cross-agency homonyms stay separate until a biography or explicit transfer connects them; `possible_identity_ids` records review candidates, not social relationships.
- A role belongs to its exact institution. Party, government, court and procuratorate posts remain separate. Cross-agency compound titles must be split; a current report confirming one title cannot confirm all undated concurrent titles.
- Locations have a parent hierarchy: province → city → county. Functional development zones are labelled separately from statutory counties. `location_ids` describe jurisdiction; an institution's `parent_id` is a display grouping, not proof of supervision.
- Institutions carry a `sector` for browsing. Unverified institution specification and personal grade stay unverified.

## Evidence and dates

Each public role retains its own sources, office status and verification category:

| Field/category | Meaning |
| --- | --- |
| `status: current` | Dated evidence supports the recorded current office, with no identified later contradiction. Always read the evidence date. |
| `status: former` | A departure or former-role description is explicitly documented. |
| `status: historical` | The historical fact or directory entry is recorded; current service is unresolved. This does **not** mean known to have left office. |
| `verified_current` | Dated official activity, appointment with corroboration, or a dated current roster. |
| `directory_only` | An official directory lists the role, but its update date or current validity needs checking. |
| `historical_only` | An appointment/activity is established at its historical date. |
| `conflicting` | Sources conflict; the explanation and both sources remain visible. |
| `unverified` | A lead requiring further verification. Never silently promoted to current. |
| `as_of_date` | Date of the role evidence, separate from the date we read it. |
| `since` / `until` | Supported tenure boundaries only. Unknown remains null; year/month precision is preserved. |
| Source `published_at` / `accessed_at` | Publication date versus research retrieval date. |

New Jining packets conservatively classify activity evidence older than 180 days as historical-only pending a fresh corroboration. This is a freshness rule for this reading collection, not proof that an official has left office.

A proposed appointment is not a final appointment. A removal from an administrative post does not automatically close a Party position. A new job's start does not invent an old job's end. A current directory can lag a later, dated removal notice.

## Network at larger scale

Sourced, dated posts produce conservative same-institution overlap links. Unverified leads and conflicting career entries are excluded from derived relations until resolved. Unknown starts or unbounded historical periods cannot produce definite co-service. Same-place experience says nothing about acquaintance.

For locations with more than 40 recorded people, `place_groups` stores linear membership instead of all pairs. The reader expands only the selected person's same-place links, using the referenced posts and their sources. A synthetic 1,000-person regression test checks that this does not create 499,500 stored pair edges. Smaller groups retain stable legacy links. Career and institution lookup indexes support larger mobile directories; all people remain accessible without hidden +N chips.

## Maintenance and publishing

1. Read original sources; archive page text and evidence locally, retaining dates and retrieval outcome.
2. Prepare a bounded regional packet; review identities, exact posts, stale rosters, contradictory removals and jurisdiction. Record coverage gaps in `research_coverage`.
3. Preserve existing IDs and private SQLite overlays, notes, review history and rollback ledger. Back up the active SQLite database with its backup API.
4. Merge reviewed source packets; derive relationships; export the **merged maintenance view**, never the seed alone.
5. The strict public whitelist strips private notes, paths, raw archives and local course materials. Public evidence is a short excerpt plus the source link.
6. Run data, network, export and browser checks. Commit a source PR, then publish only the clean generated Pages snapshot.

A refresh is a new reviewed snapshot. The website does not automatically rewrite appointments from a headline or an LLM response. Coverage records identify unfinished departments and source conflicts so subsequent sessions can continue without confusing missing data with vacant offices.
