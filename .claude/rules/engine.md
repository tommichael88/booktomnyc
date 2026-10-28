---
paths:
  - "qr.html"
  - "modules/**/*.js"
---

# Engine

- Logic does not touch the DOM. Rendering does not read `S` or the catalog. Glue does neither layer's work. `COMPONENT_LAYER_MAP.md` is the authority.
- `pricing_engine.js` owns quantity, confidence arithmetic and pricing. `nlp_engine.js` owns parsing. `orchestrator_engine.js` owns resolution and the workflow. `resolver.js` reads the published artifact through `artifact_compat.js`.
- `qr.html` is the deployment unit; `modules/` mirrors it. If you edit a function in one, edit the copy in the other — parity tests fail if they disagree.
- The golden master is 2,988 price points. A price change is measured against it and recorded in `archive/`, not assumed harmless.
- **Do not edit `qrqrqr.html`.**
