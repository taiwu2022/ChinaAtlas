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
