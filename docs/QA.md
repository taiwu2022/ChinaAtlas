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

## Evidence audit and background facts

- Public snapshot now contains 665 profiles, 919 posts, 461 sources, 254 source excerpt objects and 24 field-level background facts across three profiles. There are 433 distinct source URLs; URLs do not measure independent evidence.
- The read-only report finds 0 structural errors, 30 review flags, 819 evidence-record gaps and 14 duplicate-URL groups. Counts are rule hits, not incorrect-person counts. It does not fetch sources or certify factual truth. Legacy descriptive date strings remain gaps instead of being silently converted to appointment dates.
- A manual comparison found and corrected the Zhang Hui activity source's title and morning/afternoon summary. Archived source bytes and office facts were preserved; the maintenance correction log retains before/after values.
- Public Python suite: 50 tests, including 28 accuracy boundary checks and three profile-fact export checks. It verifies year/month precision, stale evidence, retrieval-date separation, safe read-only output paths, field conflicts and private-field filtering. Node adds eight background/escaping/export checks to the 55 directory checks; navigation (10), storage (9) and portrait suites pass. Existing maintenance 77 Python tests and 49 frontend checks pass.
- Browser inspection confirms source excerpts, per-fact dates and qualifications, and links to the methods/review queue. 320/390 px phone widths and 1280 px desktop width tested. Resizing revealed offscreen cards retaining an old intrinsic width; cards now constrain inline size while retaining block-size layout optimization.
- Both maintenance and public regional exports carry only their selected profiles' background facts and source closure. The maintenance HTTP export includes all 24 Jining facts. SQLite row contents still match the pre-audit backup (30 records, 1 review, 2 revisions, 0 profile notes).
- Source catalog entries are manually maintained discovery links. Only the existing 12371 on-use headline refresh is operational; no new crawler, external AI service or scheduler was installed.


## Career-network review and guarded updates (2026-09-21)

- Snapshot: 681 identity records, 326 institutions, 992 career posts, 490 source IDs, 283 excerpt objects and 33 background facts. Jining export: 615 identities and 893 posts.
- Independent semantic review caught a Party biography-stage boundary misread as departure, and biography labels that reused removal dates as unknown start dates. Both were corrected before export. Ten existing department profiles were reviewed, including the sourced resolution of Hu Guoliang's transfer.
- Open intervals no longer fall back to retrieval dates. The audit checks network evidence horizons and identity/institution consistency, source dates/URLs, event references and role states. Final data has 0 structural errors, 29 research review flags, 837 evidence-record gaps and 17 duplicate-URL groups; no whole-database fact certification.
- Public Python: 96 tests. Maintenance Python: 99 tests. Node storage 9, navigation 12, frontend/data regression suite and portrait identity/failure checks pass. New navigation tests cover pair-comparison deep links, invalid pairs and preservation of an unsaved note through Back.
- The strict reviewed-updates primitive rejects stale preconditions, unknown sources and ID mutations atomically in memory. It never writes SQLite. Its source and tests are mirrored in the public maintenance scripts.
- Browser: all six main routes fit 320, 390 and 1280 px widths (18 route/viewport checks). Pair search, comparison, source drilldown and Back were exercised under the `/ChinaAtlas/` project path; comparison and profile screenshots were inspected on phone and desktop widths. Comparison dialogs have no horizontal overflow at 320/390 px. These are viewport emulations, not physical-device tests.
- The restarted maintenance API returns 681 identities, 992 posts and 1,790 links, including the corrected Hu Guoliang and added Yu Yongsheng profiles. Full SQLite row contents match the pre-review backup: 30 records, 1 review, 2 revisions, 0 profile notes. Regional snapshots and original research evidence remain saved locally.


## Personnel status events and department browsing (2026-09-21)

- Merged public snapshot: 697 identities, 331 institutions, 1,028 career posts, 511 source IDs, 304 evidence objects and 16 atomic status events. Jining regional export contains 629 identities, 923 posts and four status events. Counts include historical records and unresolved homonyms.
- Official original text was checked for Zhang Youxia/Liu Zhenli's investigation, state-CMC removal and September 21 announcement. Party ratification remains pending; military expulsion happened earlier without a disclosed date; referral is not prosecution or conviction. Independent review also checked the Jining supervisory leadership transition and dated department roster.
- 117 public Python tests and 105 maintenance Python tests pass. Frontend/data, 14 navigation, 9 portable-storage, portrait and new personnel/department tests pass. Boundary tests cover invalid event types, missing sources, atomic rollback, unknown dates, supersession cycles, exact institution service and source closure. A corrected legacy audit rule now permits retrieval after the independent evidence date.
- Browser preview: all six routes plus department directory, specific department roster and status profile fit 320/390/1280 px (27 route/viewport checks). Department search/filter, the two expulsion profiles, source disclosure and Back were inspected. Mobile roster and event layouts were visually reviewed. These are viewport checks rather than physical-device tests.
- The maintenance server explicitly serves both new modules. The live API reports 697 profiles, 1,028 posts and 16 status events; its whitelist export equals the public snapshot. SQLite full row contents match the v9 pre-change backup: 30 records, 1 review, 2 revisions, 0 profile notes. Six regional snapshots and original evidence are saved locally.
- Audit: 0 structural errors, 29 research flags, 848 evidence-record gaps and 19 duplicate-URL groups. This is not a database-wide factual accuracy certification. The 22-entry discovery catalog remains manual except for the existing 12371 on-use headline refresh.
