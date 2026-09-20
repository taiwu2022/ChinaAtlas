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
