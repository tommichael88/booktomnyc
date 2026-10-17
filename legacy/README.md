# legacy/ — your older files, kept

Moved out of the repository root on 2026-10-16 (T180) so the root holds the live site, the files live addresses depend on, and the Charter's system. **Nothing was deleted or edited**: every file below is byte-for-byte what it was (`INDEX.json` records the sha256 of each, and `test_harness/verify_legacy_archive.js` fails if one is missing or changed).

## How they are kept

- **`legacy-archive` branch**: the whole repository exactly as it stood before the move, every file at its original path and URL. Do not commit to it.
- **This folder**: the same files, still on `main`, still served by GitHub Pages (at `/legacy/<group>/<name>`).
- **`master` branch** (the old default branch, two commits that `main` does not contain: the v8 compiled schema and a `.gitignore`) is untouched.
- **Git history**: every earlier version of every file stays in `main`'s history; `git log --follow legacy/<group>/<name>` follows a file across the move.

To put one back where it was: `git mv legacy/<group>/<name> <name>` (or `git checkout legacy-archive -- <name>`).

## Not part of the system

The Charter allows one source of business truth. These files are your history, not a second source: nothing may read from this folder, and the test above fails if `qr.html`, a module, `cms_bridge.js`, `sw.js`, a tool or a test starts to. Relative links inside the old pages (`images/…`, `External/…`) point at the repository root, so a page here may render without its images; open the same page from the `legacy-archive` branch for a working copy.

## Catalogs and data snapshots (`legacy/catalogs/`, 18 files)

Earlier snapshots of the service list, from before and during the entity-first SSOT work. No page, module, test or tool reads any of them: `btnyc.json` is the one live catalog and `ssot/btnyc_source.json` the authored source behind it.

| File | What it is | Last edited | Size |
|---|---|---|---|
| `setmore-data.json` | JSON object, 0 top-level keys:  | 2024-10-07 | 2 B |
| `services_new.json` | JSON object, 5 top-level keys: meta, categories, groups, services, furniture_items | 2026-04-26 | 89 KB |
| `new_services_restructured.json` | JSON object, 7 top-level keys: meta, categories, groups, services, intake_schema… | 2026-05-01 | 150 KB |
| `new_services_restructured_with_rules.json` | JSON object, 7 top-level keys: meta, categories, groups, services, intake_schema… | 2026-05-01 | 154 KB |
| `booktom-ssot.json` | JSON object, 4 top-level keys: meta, categories, groups, services | 2026-05-05 | 97 KB |
| `data.optimized.json` | JSON object, 12 top-level keys: meta, categories, groups, services, intake_schema… | 2026-05-05 | 328 KB |
| `new-services.json` | JSON object, 6 top-level keys: meta, categories, groups, services, intake_schema… | 2026-05-05 | 238 KB |
| `services.json` | JSON object, 12 top-level keys: meta, categories, groups, services, intake_schema… | 2026-05-05 | 328 KB |
| `booktom_catalog_v3_final.json` | JSON object, 6 top-level keys: meta, categories, groups, services, intake_schema… | 2026-05-08 | 125 KB |
| `services_catalog.json` | JSON object, 6 top-level keys: meta, categories, groups, services, intake_schema… | 2026-05-09 | 222 KB |
| `btnyc_services.json` | JSON object, 6 top-level keys: meta, categories, groups, services, intake_schema… | 2026-05-10 | 125 KB |
| `btnyc26.json` | JSON object, 8 top-level keys: meta, categories, service_types, services, dynamic_services… | 2026-06-03 | 139 KB |
| `booktomnyc.json` | JSON object, 11 top-level keys: meta, category, group, service_types, services… | 2026-06-05 | 147 KB |
| `btnyc2.json` | JSON object, 17 top-level keys: meta, global_rules, pricing_formulas, confidence_tiers, service_types… | 2026-06-17 | 298 KB |
| `btnyc_v2.json` | JSON object, 6 top-level keys: meta, sources, compiled, legacy, validation… | 2026-06-24 | 1,963 KB |
| `btnyc_v3.json` | JSON object, 28 top-level keys: $schema, $id, meta, archetype_definitions, group_archetypes… | 2026-06-25 | 1,066 KB |
| `btnyc_v4.json` | JSON object, 28 top-level keys: $schema, $id, meta, global_rules, pricing_formulas… | 2026-06-26 | 896 KB |
| `btnyc_v10_final.json` | JSON object, 16 top-level keys: $schema, $id, meta, workflow, invariants… | 2026-07-08 | 738 KB |

## Pages and experiments (`legacy/pages/`, 32 files)

Earlier versions and experiments of the booking page, the category grid, the iframes and the site home page. The live booking page is `qr.html`; the site home page is `index.html`.

| File | What it is | Last edited | Size |
|---|---|---|---|
| `index_home.html` | <body class="show-all-popups"> | 2023-09-16 | 51 KB |
| `serviceagreement_cadmium-light.html` | HTML page: Service Agreement | 2023-12-03 | 46 KB |
| `index1.html` | HTML page: Home / BookTomNYC | 2023-12-07 | 169 KB |
| `samplepage.html` | HTML page: Home / BookTomNYC | 2023-12-07 | 169 KB |
| `index_main_rewritten.html` | HTML page: Home / BookTomNYC | 2023-12-09 | 166 KB |
| `iframe.html` | HTML page: BookTOM.NYC | 2024-02-05 | 537 B |
| `qr2test.html` | HTML page: BookTOM | 2024-02-14 | 17 KB |
| `qrchimp.html` | HTML page: BookTOM | 2024-02-14 | 17 KB |
| `qr3test.html` | HTML page: BookTOM | 2024-02-18 | 29 KB |
| `qr_now.html` | HTML page: BookTOM | 2024-03-02 | 41 KB |
| `qr6.html` | HTML page: BookTOM | 2024-03-21 | 55 KB |
| `qr_new.html` | HTML page: BookTOM | 2024-04-22 | 61 KB |
| `qr6` | HTML page: BookTOM | 2024-07-24 | 27 KB |
| `qr_new2` | HTML page: Tom Kongerslev - Professional Services | 2024-09-19 | 9 KB |
| `qr_old.html` | HTML page: BookTOM | 2024-09-19 | 51 KB |
| `qr_1` | HTML page: BookTOM | 2024-10-10 | 43 KB |
| `qr5.html` | HTML page: BookTOM | 2025-02-04 | 40 KB |
| `category_grid_latest.html` | HTML page: Schedule Service by Category | 2025-04-28 | 52 KB |
| `qr_092524.html` | HTML page: BookTOM | 2025-04-28 | 31 KB |
| `qr_11.html` | HTML page: BookTOM | 2025-04-28 | 29 KB |
| `cat2.html` | HTML page: Handyman Services Booking | 2025-05-12 | 64 KB |
| `cat_light.html` | HTML page: Handyman Services Booking | 2025-05-12 | 67 KB |
| `cat_light5.html` | HTML page: Handyman Services Booking | 2025-05-12 | 48 KB |
| `catframe.html` | HTML page: BookTOM | 2025-05-12 | 55 KB |
| `catframe2.html` | HTML page: BookTOM | 2025-05-12 | 63 KB |
| `catframe3.html` | HTML page: BookTOM | 2025-05-12 | 63 KB |
| `cat_content.html` | HTML page: Category Services | 2025-05-13 | 62 KB |
| `cat_qrframe.html` | HTML page: BookTOM | 2025-05-13 | 79 KB |
| `qrcat_copilot.html` | HTML page: BookTOM | 2025-05-15 | 92 KB |
| `qr_cat.html` | HTML page: BookTOM | 2025-05-23 | 66 KB |
| `qr_booking.html` | HTML page: BookTOM - Handyman Services | 2025-09-28 | 68 KB |
| `qrqr.html` | HTML page: BookTOM | 2025-10-15 | 114 KB |

## QQB chat-bot side project (`legacy/qqb/`, 8 files)

The Flask/OpenAI scripts, the chat page and its conversation code, style and message templates.

| File | What it is | Last edited | Size |
|---|---|---|---|
| `qqb.py` | Fixed Python script | 2023-11-12 | 8 KB |
| `bbq4.py` | Define environment variable for API key | 2023-12-07 | 9 KB |
| `chat_with_qqb_glitch.html` | HTML page (no title) | 2024-02-05 | 478 B |
| `qqb.html` | HTML page: SMS-Like Conversation | 2024-12-15 | 4 KB |
| `Qqqb.py` | Import necessary modules | 2024-12-15 | 9 KB |
| `qqb_convo_code.js` | (() => { | 2025-10-01 | 9 KB |
| `qqb_convo_style.css` | Theme variables */ | 2025-10-02 | 9 KB |
| `QQB_CHAT_MESSAGES_SMS.html` | HTML page: 🤖 Messages | 2025-10-09 | 4 KB |

## Deliberately left in the repository root

These are linked from live pages or used by the site, or were edited recently enough that I would not guess:

- **Live addresses**: `ServiceAgreement.html` and `ServiceAgreement_markdown.MD`, `SOW.html`, `PrivacyPolicy.html`, `Privacy Policy.html`, `privacy`, the contact page, `cat.html`, `furniture-fixes-assembly.html`, `index.html`, `manifest.json`, `sw.js`. (the contact page was one of these; on 2026-10-17 you moved it to `deprecated/contact.html`, so it no longer answers at its old address.) The repository's own pages and agreements link to `…/booktomnyc/ServiceAgreement`, `…/Privacy`, `…/SOW` and `…/cat.html`; moving them would break links in documents customers already hold.
- **Served assets**: `new_services.json` (the service worker caches it), `combined_theme.css`, `css_extras_Privacy_Policy_inline_markdown_code.md`, the chevron script (now `deprecated/checkboxchevronbookhere.js`, moved by you on 2026-10-17; the code-scanning config still names the old path), and the six `*-removebg-preview.png` icons (now `images/*-removebg-preview2.png`, renamed by you on 2026-10-17).
- **Recent**: `qr2` (edited 2026-07-03; you moved it to `deprecated/qr2` on 2026-10-17) and `state.js` (2026-07-02). Tell me if `state.js` is finished and I will move it here.
- **The system**: `qr.html`, `btnyc.json`, `btnyc_schema.json`, `cms_bridge.js`, `trace.js`, `run_vectors.js`, `innerhtml_audit.json`, the Charter, its prototype, the Layer Map, `TIMELINE.md`, `PENDING_DECISIONS.md` and the other records.

## Branches that are safe to delete

Each of these is already fully contained in `main` (0 commits of their own), so deleting the branch name loses nothing: the commits stay in `main`'s history. They are **still on GitHub**: the session that tidied the repository could not delete them (its git access refuses branch deletion). This table records where each tip is, so a deleted branch can be recreated with `git branch <name> <sha>`. `master` is not listed: it holds two commits `main` does not, and stays.

To delete them all from your own machine:

```
for b in alert-autofix-8 alert-autofix-10 alert-autofix-12 alert-autofix-14 alert-autofix-23 alert-autofix-24 alert-autofix-28 alert-autofix-29 alert-autofix-31 alert-autofix-32 alert-autofix-35 alert-autofix-38 alert-autofix-42 alert-autofix-51 alert-autofix-64 alert-autofix-67 alert-autofix-312 t158-adopt-operator-qr t166-ssot-audit t167-question-pass t173-followup t174-landing ssot-entity-first; do git push origin --delete "$b"; done
```

| Branch | Tip |
|---|---|
| `alert-autofix-10` | `45d6a35edda219a46244ff66d83a92659d87cdb0` |
| `alert-autofix-12` | `1892137fefed5d2903db21083067a212547e30ee` |
| `alert-autofix-14` | `d1588c0c249b66bf6a459f3d9da8da6e3628e54a` |
| `alert-autofix-23` | `ac2d4e49b5b7df78f53528c62999663fdf64daec` |
| `alert-autofix-24` | `c51d7bacdf9b3f11ee39d0152c62c4c28be0942d` |
| `alert-autofix-28` | `32826420018c0bb6373f420c55fda4a109bf7c33` |
| `alert-autofix-29` | `7a14f120e685d8992c21006bdd243b55137279f1` |
| `alert-autofix-31` | `446e83a2669f316f521c72b6a1e4494a3c2df7e2` |
| `alert-autofix-312` | `45ede961b65559a7e5a29347793ea13e0b3a699f` |
| `alert-autofix-32` | `3140074fd668a6e8dbbca1dc3de4239ebc5e417f` |
| `alert-autofix-35` | `a0055f7c01df6877cbcda3af44e400edca509fac` |
| `alert-autofix-38` | `5e1099c740c4af9066d82773230eb07fd2a993a9` |
| `alert-autofix-42` | `66eaac1d0e57ff6dd6130f49fec35f69e1a4a4f0` |
| `alert-autofix-51` | `c725536220b6ab9d3b8455edf931a5140e8d6c93` |
| `alert-autofix-64` | `1cd8b072ddd8e8daee0e1137bc7d32eab47b3775` |
| `alert-autofix-67` | `ff6d363152e485542b79b3d09320bfc742acbbd7` |
| `alert-autofix-8` | `6cd06bc2857b182ccbba4ad9b92f128e25e34dfe` |
| `ssot-entity-first` | `7e9229c79fac650263fbb8c5bd76058c3fca52fe` |
| `t158-adopt-operator-qr` | `c2abdc2a46c8a6625a4dbad28908a464490a0754` |
| `t166-ssot-audit` | `3c919c4d0a0f6dbab846bf3a1612cdd8d72c1623` |
| `t167-question-pass` | `86a2cb92d5efb6e0a154bacf141c55dc1b942af5` |
| `t173-followup` | `5f1ffbaecf23cd400c1f48e0ba20c2b10df9a008` |
| `t174-landing` | `afc972da7c5bd1cc92617bd9da3293ea957516c1` |
