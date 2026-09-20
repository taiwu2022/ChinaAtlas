# Mobile and public edition checks

Checked 2026-09-21 against the published source revision.

- Public snapshot: 78 people, 129 career posts, 343 sources, 138 short evidence excerpts. It includes reviewed database overlays, not only the original seed.
- Python public export/build suite: 10 tests; nested private-field rejection, source closure, clean artifact rebuild, merged data preservation.
- Node storage suite: 9 checks; denied/corrupt storage never overwrites notes, import preserves unknown profile IDs and conflicting text, public exports exclude personal notes, maintenance operations never call a backend.
- Node navigation suite: 9 tests; duplicate history events, search/filter/scroll restoration, profile/AI/source drilldown, saved drafts, region history, stale evidence request success/failure.
- Frontend/data suite: 49 regression checks for historical/current people, reviewed grades, regions and career links.
- Existing maintenance suite: 77 Python tests and 49 frontend checks passed. Added HTTP checks for all six new public assets.
- Browser preview served under `/ChinaAtlas/`, matching GitHub project Pages paths. All six pages fit 320 px; 390 px layouts visually inspected. Desktop layout also checked. No backend is required for public browsing.
- Browser flows checked: search, profile, institution, source excerpt, Back/Close, AI question, deep-link reload, save/reload/delete note, region-to-network and all-regions reset.
- Local maintenance data was backed up before synchronization. Ledger counts remained 30 records / 1 review / 2 revisions / 0 profile notes; four local course documents are retained locally only.

The responsive checks use desktop browser viewport emulation, not physical iPhone/Android hardware. Installation and browser-to-home-screen storage behavior should be checked on the actual device. Private notes do not automatically sync; export/import is deliberate. There is no offline cache or background personnel updater.

## Profile portraits

- 17 official source-page/name mappings checked; the seven Politburo Standing Committee profiles are covered, alongside selected economic officials and historical leaders. Source-page dates never update offices or verification dates.
- Four additional Python checks cover exact identity/ID, duplicate images, private/untrusted metadata and optional missing portraits. An isolated JavaScript check covers delayed response, wrong name, URL scheme, catalogue failure and failed images.
- Existing 77 local Python tests, public 14 Python tests, storage/navigation checks and 49 frontend checks pass. Local HTTP verifies both portrait assets and exact CSP image origins; ledger counts unchanged.
- Browser checked actual official photos for Xi Jinping, Pan Gongsheng, Deng Xiaoping and Li Chenggang; local profile layout fits 320 px and 390 px. Missing-photo profiles retain a text header.
- Photos are externally hosted: unavailable images are omitted without blocking profile reading. The catalogue loads independently, and a late response updates only the photo slot so existing notes remain intact.


## Jining expansion and scalable directory

- Public merged view: 665 identity records, 292 institutions, 960 role entries, 919 career posts, 456 sources and 249 source-excerpt records. Jining's regional export contains 599 identity records and 820 posts. These counts include unresolved homonyms and historical records, not a current-official headcount.
- Three large-place membership groups replace exhaustive pairwise same-place edges. 1,802 explicit/small-group links remain; selected-person expansion preserves the two endpoints' posts and sources. The 1,000-person synthetic check verifies linear membership storage.
- New roles retain verification categories and evidence dates. Undated directories and cached-only leads never become current. An explicit role-evidence date bounds an open career even if research retrieval was later. Unverified leads and conflicting career records cannot generate derived network links. Definitively distinct same-name people are excluded from each other's possible-identity candidates.
- Source review corrected stale leadership pages, cross-agency compound titles, appointment-versus-activity dates, one ambiguous county directory, and a prosecutor's stale concurrent office. Raw pages and hashes are retained only in the maintenance research archive.
- Public Python suite: 19 tests. Node: 55 frontend/data assertions, 10 navigation tests, 9 storage checks, plus portrait failure/identity checks. The existing maintenance suite of 77 Python tests passes.
- Browser: project-subpath preview, 390 px person profile, department/evidence filters, 320 px evidence dialog, large-network search and on-demand relationship details. No horizontal overflow observed at 320/390 px; desktop also checked. These are emulated viewport checks, not physical-device certification.
- SQLite row contents, not only counts, match the pre-expansion backup: 30 records, 1 review, 2 revisions, 0 profile notes. Regional JSON snapshots and raw evidence archives are persisted locally. Four local course documents remain private.
- Remaining scope is explicit: the directory is incomplete; many county and department posts still need fresh dated corroboration, and five cached-only leads remain unverified. No automatic headline-to-office updates or private relationship inference.
