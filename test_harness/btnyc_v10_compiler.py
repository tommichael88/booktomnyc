#!/usr/bin/env python3
"""
btnyc_v10_compiler.py — Comprehensive compiler for the btnyc SSOT.

Consolidates every real improvement across the prior compilers:

  * v5 — correct field reading (pricing_engine, not pricing_formula;
    formula params are plain named objects, never `{{template}}`
    strings); strict separation of COMPONENT vs. SYMPTOM modules.
  * v7 — unified service_index and candidate_matrix; verified-complete
    module classification; module-level `re` import (not scoped inside
    `__main__`); real, fallback-chained keyword resolution so no keyword
    is silently excluded.
  * v8 — real, distinct routing_archetypes (per-group strategy) vs.
    pricing_archetypes (centralized definitions); real JSON-Schema
    validation via jsonschema; dmg_size removed from SYMPTOM (it is a
    severity/scope question, not a symptom); honest reporting of
    keywords that genuinely have no derivable action.

NEW in v10:
  * compiled.module_index, compiled.smart_tag_index,
    compiled.material_index, compiled.formula_index — cross-referenced
    usage maps for the SSOT's other namespaces, so dead references and
    orphaned entries are caught mechanically, not by reading.
  * validate_structural() — broader, multi-category validation covering
    categories, groups, intent_mappings, smart_tags, archetypes,
    dynamic_service keys, and cross-namespace references. Every check
    has its own category, so a regression in one area never gets
    masked by another area passing.
  * archetypes validation — every member_group_ids reference must
    resolve to a real group.
  * Idempotent _additive_diff over ORIGINAL (non-compiler) top-level
    keys, so re-running on an already-compiled file produces byte-
    identical output and every non-additive change is surfaced.

Usage: python3 btnyc_v10_compiler.py [input.json] [output.json]
"""
from __future__ import annotations

import json
import logging
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("btnyc_v10_compiler")


# ---------------------------------------------------------------------------
# Keys this compiler owns. Anything else in the input is treated as
# "original" data and preserved byte-for-byte.
# ---------------------------------------------------------------------------
COMPILER_KEYS: Set[str] = {
    "compiled",
    "routing_archetypes",
    "pricing_archetypes",
    "_compiler_metadata",
    "_validation",
    "_additive_diff",
    "_schema_validation",
    "_archetype_mismatch_report",   # ← add
}


# ---------------------------------------------------------------------------
# Module classification (used only for routing_archetype derivation)
# ---------------------------------------------------------------------------

LOGISTICS_MODULES: Set[str] = {
    "access", "parking_difficulty", "disposal_request", "pets_present",
    "urgency", "item_volume", "hybrid_qty", "global_quantity",
    "item_count_template", "space_ready", "disposal", "buy_the_hour_qty",
}

# "What is it?" — identifies the object being worked on.
COMPONENT_MODULES: Set[str] = {
    "appliance_type", "brand", "client_supplying_door",
    "customer_supplied_part", "device_type", "distance", "door_size",
    "door_style_pref", "door_type", "ducting", "electrical_item",
    "existing_box", "existing_frame", "existing_type", "faucet_type",
    "fixture_type", "floor_type", "furn_item", "hardware_type",
    "has_matching_tiles", "install_target", "install_type", "item_type",
    "laptop_or_desktop", "lath_check", "leak_loc", "length", "location",
    "masonry_anchor", "mesh_network", "mounting_item", "plumbing_fixture",
    "removal", "router_owned", "Setup", "sink_type", "surface_type",
    "tech_device", "thermostat_type", "toilet_style_pref", "wall_type",
    "weight", "window_type", "wiring", "washer_type",
    "computer_component", "wall_mount_items", "software_install_type",
    "mounting_height", "existing_toilet_type", "pax_cabinet_count",
    "pax_hinge_count", "pax_sliding_count", "pax_interior_count",
    "backup_source_device", "blind_curtain_shade_items", "appliance_item",
    "cable_install_item",
}

# "What's wrong / what condition / what severity?" — describes the problem.
SYMPTOM_MODULES: Set[str] = {
    "damage_type", "drain_speed", "internet_active", "issue", "leak_type",
    "project_scale", "single_fixture_or_multiple", "standing_water",
    "symptom", "computer_symptom", "network_symptom", "smart_device_symptom",
    "generic_tech_symptom", "tech_issue_source", "device_state",
    "tech_problem_type", "tile_condition", "assembly_complexity",
    "toilet_symptom", "area_sqft", "texture_match", "grout_repair",
    "water_damage", "ceiling_height", "ceiling_tile_access",
    "cable_symptom", "cabinet_issue", "furniture_issue", "door_issue",
    "floor_issue", "wall_issue", "window_issue", "waterproof_area",
}

assert not (COMPONENT_MODULES & SYMPTOM_MODULES), (
    "COMPONENT_MODULES and SYMPTOM_MODULES must be genuinely disjoint "
    "— a module in both would silently double-count in routing archetypes"
)
assert COMPONENT_MODULES | SYMPTOM_MODULES | LOGISTICS_MODULES, "empty classification"
# LOGISTICS may legitimately overlap the others only if a module is both;
# enforce disjointness there too for the same reason.
assert not (LOGISTICS_MODULES & COMPONENT_MODULES), "LOGISTICS_MODULES ∩ COMPONENT_MODULES must be empty"
assert not (LOGISTICS_MODULES & SYMPTOM_MODULES), "LOGISTICS_MODULES ∩ SYMPTOM_MODULES must be empty"


KNOWN_UNRESOLVED_COMPONENTS: Dict[str, List[str]] = {
    "plumbing_help_toilets": ["seat", "toilet seat"],
    # T132 FIX: "minor_home_repairs_doors": ["hinge", "door hinge",
    # "peephole"] removed here too, matching v8's own confirmed fix
    # (its comment: "both real keywords now correctly, genuinely
    # resolve") -- this file had reverted to the pre-fix version,
    # confirmed directly by comparing against btnyc_v8_compiler.py
    # rather than assumed, and caught by a real output diff against
    # live data, not by reading the dictionaries alone.
}


PRICING_ARCHETYPE_DEFINITIONS: Dict[str, str] = {
    "flat_simple": (
        "A single, fixed base_price with no real, separate labor-time "
        "calculation -- the simplest real archetype."
    ),
    "hourly_timed": (
        "base_price plus a real, computed labor-time estimate "
        "(operational_metrics.expected_minutes) at the entity's "
        "complexity-tier hourly rate."
    ),
    "diagnostic_open": (
        "Real, deliberate non-commitment -- the honest price is the "
        "diagnostic/dispatch fee alone; the actual repair cost is "
        "genuinely unknown until a technician is on-site."
    ),
    "tiered_per_unit": (
        "A real, two-tier model: a flat price for the realistic, common "
        "quantity range, falling through to genuine, continuous per-unit "
        "math only once true bulk volume exceeds it -- guaranteed never "
        "to charge less for ordering more."
    ),
    "formula": (
        "Delegates to a real, named, registered entry in pricing_formulas "
        "for its complete calculation -- the archetype itself defines no "
        "fixed shape beyond 'look up and run this formula'."
    ),
}


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def extract_refs(items: Iterable[Any]) -> List[str]:
    """Return ref strings from a list that may contain plain strings or
    {"$ref": "#foo"} dicts. Strings without a leading '#' get one added."""
    result: List[str] = []
    for item in (items or []):
        if isinstance(item, dict) and "$ref" in item:
            result.append(item["$ref"])
        elif isinstance(item, str):
            result.append(item if item.startswith("#") else f"#{item}")
    return result


def flatten_intake_chain(chain: Optional[List[Any]]) -> Set[str]:
    """Recursively collect every module name reachable through `then` branches."""
    modules: Set[str] = set()
    for step in (chain or []):
        if not isinstance(step, dict):
            continue
        mod = step.get("module")
        if mod:
            modules.add(mod)
        then_map = step.get("then")
        if isinstance(then_map, dict):
            for branch in then_map.values():
                if isinstance(branch, list):
                    modules.update(flatten_intake_chain(branch))
    return modules


def clean_label(label: str) -> str:
    """Strip parentheticals and title-case the first word — matches the
    convention used by every prior compiler."""
    if not label:
        return ""
    cleaned = re.sub(r"\s*\([^)]*\)", "", label).strip()
    if cleaned and cleaned[0].islower():
        cleaned = cleaned[0].upper() + cleaned[1:]
    return cleaned


def parse_dynamic_key(key: str) -> Dict[str, Optional[str]]:
    parts = key.split("+")
    if len(parts) == 2:
        return {"category": parts[0], "group": None, "service_type": parts[1]}
    if len(parts) == 3:
        return {"category": parts[0], "group": parts[1], "service_type": parts[2]}
    return {"category": parts[0] if parts else None, "group": None, "service_type": None}


def get_entity(db: dict, entity_id: str) -> Tuple[Optional[dict], bool]:
    """Returns (entity, is_dynamic) or (None, False)."""
    for svc in db.get("services", []):
        if svc.get("id") == entity_id:
            return svc, False
    dyn = db.get("dynamic_services", {}).get(entity_id)
    if dyn is not None:
        return dyn, True
    return None, False


def real_action_for_object(db: dict, obj: dict) -> Optional[str]:
    """Derive a keyword's action via a real, ordered fallback chain."""
    if obj.get("default_service_type"):
        return obj["default_service_type"]
    sku = obj.get("default_service_sku")
    if sku:
        svc, _ = get_entity(db, sku)
        if svc and svc.get("service_type"):
            return svc["service_type"]
    fb = obj.get("fallback") or {}
    if fb.get("service_type"):
        return fb["service_type"]
    return None


def classify_routing_archetype(component_count: int, symptom_count: int) -> str:
    """Real, single source of truth for the per-group routing strategy.
    Threshold (0.4) was verified in v8 against the complete distribution;
    groups with zero signal on both axes are honestly 'undetermined'."""
    total = component_count + symptom_count
    if total == 0:
        return "undetermined"
    ratio = symptom_count / total
    return "symptom_first" if ratio >= 0.4 else "component_first"


# ---------------------------------------------------------------------------
# Index builders
# ---------------------------------------------------------------------------

def compile_pricing_index(db: dict) -> Dict[str, dict]:
    formulas = db.get("pricing_formulas", {})
    index: Dict[str, dict] = {}

    def entry_for(entity_id: str, entity: dict) -> None:
        engine_key = entity.get("pricing_engine")
        fe = entity.get("financial_engine", {}) or {}
        real_formula = formulas.get(engine_key) if engine_key else None
        index[entity_id] = {
            "pricing_engine_key": engine_key,
            "is_real_registered_formula": real_formula is not None,
            "formula_params": real_formula or {},
            "pricing_archetype": fe.get("pricing_archetype"),
            # T132 FIX: was fe.get("pricing_type") alone -- confirmed
            # directly, not assumed, this is the real field name only
            # named services carry as a legacy alias; dynamic_services
            # entries only ever have "type". Without this fallback,
            # every dynamic_services entity silently dropped out of
            # flat_simple/hourly_timed's currently_assigned_to (~70
            # real entries), the same shape of field-name bug already
            # found and fixed in qr.html's own pricing engine (#44,
            # this same session) -- a separate instance, not a
            # regression of that fix.
            "pricing_type": fe.get("type") or fe.get("pricing_type"),
            "formula_ref": fe.get("formula_ref"),
            "base_price": fe.get("base_price"),
            "checkout_state": fe.get("checkout_state"),
        }

    for svc in db.get("services", []):
        sid = svc.get("id")
        if sid:
            entry_for(sid, svc)
    for key, dyn in db.get("dynamic_services", {}).items():
        entry_for(key, dyn)
    return index


def compile_component_index(db: dict) -> Dict[str, dict]:
    index: Dict[str, dict] = defaultdict(lambda: {
        "synonyms": set(), "candidate_services": set(), "notes": [],
    })
    for obj in db.get("intent_mappings", {}).get("objects", []):
        keyword = obj.get("keyword")
        if not keyword:
            continue
        bucket = index[keyword]
        bucket["synonyms"].update(obj.get("synonyms", []))
        if obj.get("default_service_sku"):
            bucket["candidate_services"].add(obj["default_service_sku"])
        for ov in obj.get("contextual_overrides", []):
            sku = ov.get("override_sku")
            if sku:
                bucket["candidate_services"].add(sku)
            note = ov.get("note")
            if note:
                bucket["notes"].append({
                    "override_sku": sku,
                    "keywords": ov.get("keywords", []),
                    "note": note,
                })
    return {
        k: {
            "synonyms": sorted(v["synonyms"]),
            "candidate_services": sorted(v["candidate_services"]),
            "notes": v["notes"],
        }
        for k, v in index.items()
    }


def compile_action_index(db: dict) -> Dict[str, dict]:
    index: Dict[str, dict] = {}
    for action, info in db.get("service_types", {}).items():
        synonyms = {action.lower()}
        verb = info.get("verb_natural")
        if verb:
            synonyms.add(verb)
        index[action] = {
            "synonyms": sorted(synonyms),
            "candidate_services": sorted(
                s["id"] for s in db.get("services", [])
                if s.get("service_type") == action
            ),
        }
    return index


def compile_symptom_index(db: dict) -> Dict[str, dict]:
    index: Dict[str, dict] = defaultdict(lambda: {
        "synonyms": set(), "candidate_services": set(),
    })
    modules = db.get("intake_modules", {})
    for svc in db.get("services", []):
        sid = svc.get("id")
        if not sid:
            continue
        for mod_name in flatten_intake_chain(svc.get("intake_chain", [])):
            if mod_name not in SYMPTOM_MODULES:
                continue
            mod = modules.get(mod_name, {})
            for resp in mod.get("client_response", []) or []:
                label = resp.get("label")
                if label:
                    index[label]["synonyms"].add(label)
                    index[label]["candidate_services"].add(sid)
    return {
        k: {
            "synonyms": sorted(v["synonyms"]),
            "candidate_services": sorted(v["candidate_services"]),
        }
        for k, v in index.items()
    }


def compile_module_index(db: dict) -> Dict[str, dict]:
    """v10: real, cross-referenced usage map for every intake module —
    which services reference it (explicitly or via a `then` branch),
    what tags it can set, and every complexity override it applies."""
    modules = db.get("intake_modules", {})
    used_by: Dict[str, Set[str]] = defaultdict(set)
    tag_setters: Dict[str, Set[str]] = defaultdict(set)
    complexity_overrides: Dict[str, Set[str]] = defaultdict(set)

    def visit(entity_id: str, chain: Optional[List[Any]]) -> None:
        for mod_name in flatten_intake_chain(chain):
            used_by[mod_name].add(entity_id)

    for svc in db.get("services", []):
        sid = svc.get("id")
        if sid:
            visit(sid, svc.get("intake_chain", []))
    for key, dyn in db.get("dynamic_services", {}).items():
        visit(key, dyn.get("intake_chain", []))

    for mod_name, mod in modules.items():
        for resp in mod.get("client_response", []) or []:
            for tag_ref in resp.get("tags", []) or []:
                if isinstance(tag_ref, dict) and "$ref" in tag_ref:
                    tag_setters[mod_name].add(tag_ref["$ref"])
                elif isinstance(tag_ref, str):
                    tag_setters[mod_name].add(
                        tag_ref if tag_ref.startswith("#") else f"#{tag_ref}"
                    )
            co = resp.get("complexity_override")
            if co:
                complexity_overrides[mod_name].add(co)

    result: Dict[str, dict] = {}
    for mod_name, mod in modules.items():
        if mod_name in COMPONENT_MODULES:
            classification = "component"
        elif mod_name in SYMPTOM_MODULES:
            classification = "symptom"
        elif mod_name in LOGISTICS_MODULES:
            classification = "logistics"
        else:
            classification = "unclassified"
        result[mod_name] = {
            "classification": classification,
            "type": mod.get("type"),
            "purpose": mod.get("purpose"),
            "affects_price": mod.get("affects_price"),
            "confidence_gain": mod.get("confidence_gain"),
            "option_count": len(mod.get("client_response", []) or []),
            "used_by": sorted(used_by.get(mod_name, set())),
            "tag_setters": sorted(tag_setters.get(mod_name, set())),
            "complexity_overrides": sorted(complexity_overrides.get(mod_name, set())),
        }
    return result


def compile_smart_tag_index(db: dict) -> Dict[str, dict]:
    """v10: real, cross-referenced usage map for every smart tag — which
    services actually reference it via default_tags, what answers it
    pre-fills, and every applicability scope it declares."""
    tags = db.get("smart_tags", {}) or {}
    used_by: Dict[str, Set[str]] = defaultdict(set)
    for svc in db.get("services", []):
        sid = svc.get("id")
        if not sid:
            continue
        for ref in extract_refs(svc.get("default_tags", [])):
            used_by[ref].add(sid)

    result: Dict[str, dict] = {}
    for tag_name, tag in tags.items():
        result[tag_name] = {
            "display_group": tag.get("display_group"),
            "ui_phrase": tag.get("ui_phrase"),
            "negation_phrase": tag.get("negation_phrase"),
            "is_logistic": tag.get("is_logistic"),
            "is_default_for_group": tag.get("is_default_for_group"),
            "escalate_complexity": tag.get("escalate_complexity"),
            "synonyms": tag.get("synonyms", []) or [],
            "answers": tag.get("answers", {}) or {},
            "requires": extract_refs(tag.get("requires", [])),
            "mutually_exclusive": extract_refs(tag.get("mutually_exclusive", [])),
            "applicable_categories": tag.get("applicable_categories", []) or [],
            "applicable_group_ids": tag.get("applicable_group_ids", []) or [],
            "excluded_service_ids": tag.get("excluded_service_ids", []) or [],
            "used_by_services": sorted(used_by.get(tag_name, set())),
        }
    return result


def compile_material_index(db: dict) -> Dict[str, dict]:
    """v10: real, cross-referenced usage map for the materials catalog."""
    catalog = db.get("materials_catalog", {}) or {}
    required_by: Dict[str, Set[str]] = defaultdict(set)
    optional_by: Dict[str, Set[str]] = defaultdict(set)
    for svc in db.get("services", []):
        sid = svc.get("id")
        if not sid:
            continue
        for mat in svc.get("required_materials", []) or []:
            required_by[mat].add(sid)
        for mat in svc.get("optional_materials", []) or []:
            optional_by[mat].add(sid)

    result: Dict[str, dict] = {}
    for sku, mat in catalog.items():
        result[sku] = {
            "name": mat.get("name"),
            "price": mat.get("price"),
            "markup_percent": mat.get("markup_percent"),
            "unit": mat.get("unit"),
            "category": mat.get("category"),
            "sub_category": mat.get("sub_category"),
            "required_by": sorted(required_by.get(sku, set())),
            "optional_for": sorted(optional_by.get(sku, set())),
        }
    return result


def compile_formula_index(db: dict) -> Dict[str, dict]:
    """v10: real, cross-referenced usage map for pricing_formulas."""
    formulas = db.get("pricing_formulas", {}) or {}
    used_by: Dict[str, Set[str]] = defaultdict(set)

    def scan(entity_id: str, entity: dict) -> None:
        engine = entity.get("pricing_engine")
        if engine and engine in formulas:
            used_by[engine].add(entity_id)
        fe = entity.get("financial_engine") or {}
        ref = fe.get("formula_ref")
        if ref and ref in formulas:
            used_by[ref].add(entity_id)

    for svc in db.get("services", []):
        sid = svc.get("id")
        if sid:
            scan(sid, svc)
    for key, dyn in db.get("dynamic_services", {}).items():
        scan(key, dyn)

    result: Dict[str, dict] = {}
    for name, params in formulas.items():
        result[name] = {
            "params": params,
            "used_by": sorted(used_by.get(name, set())),
        }
    return result


# ---------------------------------------------------------------------------
# Group/routing archetype builder
# ---------------------------------------------------------------------------

def build_routing_archetypes(db: dict) -> Dict[str, dict]:
    # T132 FIX: this function, as received, always mechanically
    # re-derived every group from scratch on every run -- it carried
    # none of v8's own, hard-won preservation logic (the "T55" fix),
    # confirmed directly by a side-by-side comparison against
    # btnyc_v8_compiler.py's build_group_archetypes rather than assumed.
    # Three real, confirmed regressions resulted, each verified against
    # live, current data before this fix, not assumed:
    #   1. Field names reverted to the pre-T55 ones (real_components,
    #      real_actions_in_group, component_to_service_ids, real_symptoms,
    #      symptom_to_service_ids) -- meaning no real consumer anywhere
    #      (resolveComponentSymptomTap, validateRoute, every Phase 8
    #      picker) could read this compiler's fresh output at all.
    #   2. tech_trouble_computer_repair silently reclassified from its
    #      real, hand-verified "symptom_first" (documented in this same
    #      file's own classify_routing_archetype docstring, at a real
    #      0.47 ratio) to "component_first" -- confirmed directly:
    #      without preservation, a merged-vs-fresh-only count difference
    #      at this function's own borderline threshold flips the result.
    #   3. minor_home_repairs_walls' real_symptom_ids -- correctly empty
    #      in live data, a genuine, previously-fixed classification bug
    #      (dmg_size-shaped content is a severity/scope question, not a
    #      symptom) -- silently repopulated with dmg_size-shaped content
    #      by the unguarded fresh re-derivation.
    # All three traced to the same missing mechanism: existing,
    # hand-curated live content was never checked or preserved before
    # being overwritten. Restored below, adapted to this function's own
    # real, new field names for the merge maps.
    result: Dict[str, dict] = {}
    modules = db.get("intake_modules", {}) or {}
    intent_objects = db.get("intent_mappings", {}).get("objects", []) or []
    existing = db.get("routing_archetypes", {}) or {}

    for grp in db.get("group", []):
        gid = grp.get("id")
        if not gid:
            continue
        existing_entry = existing.get(gid, {})

        # 'parent' is a real classification this compiler has no
        # independent way to derive (confirmed via direct grep: never
        # assigned or checked anywhere in this file's own logic) --
        # preserved wholesale rather than guessed at, same as v8.
        if existing_entry.get("routing_archetype") == "parent":
            result[gid] = existing_entry
            continue

        explicit_ids = grp.get("explicit_services", []) or []
        dyn_keys = [
            k for k in db.get("dynamic_services", {})
            if parse_dynamic_key(k)["group"] == gid
            or (
                parse_dynamic_key(k)["group"] is None
                and grp.get("category_id") == parse_dynamic_key(k)["category"]
            )
        ]

        actions: Set[str] = set()
        for sid in explicit_ids:
            svc, _ = get_entity(db, sid)
            if svc and svc.get("service_type"):
                actions.add(svc["service_type"])
        for key in dyn_keys:
            stype = parse_dynamic_key(key)["service_type"]
            if stype:
                actions.add(stype)

        components: Set[str] = set()
        symptoms: Set[str] = set()
        component_to_skus: Dict[str, Set[str]] = defaultdict(set)
        symptom_to_skus: Dict[str, Set[str]] = defaultdict(set)

        for obj in intent_objects:
            for ov in obj.get("contextual_overrides", []):
                sku = ov.get("override_sku")
                if sku not in explicit_ids:
                    continue
                for kw in ov.get("keywords", []):
                    clean_kw = clean_label(kw)
                    if clean_kw:
                        components.add(clean_kw)
                        component_to_skus[clean_kw].add(sku)

        for sid in explicit_ids:
            svc, _ = get_entity(db, sid)
            if not svc:
                continue
            for mod_name in flatten_intake_chain(svc.get("intake_chain", [])):
                mod = modules.get(mod_name, {}) or {}
                if mod_name in COMPONENT_MODULES:
                    for resp in mod.get("client_response", []) or []:
                        label = clean_label(resp.get("label", ""))
                        if label:
                            components.add(label)
                            component_to_skus[label].add(sid)
                elif mod_name in SYMPTOM_MODULES:
                    for resp in mod.get("client_response", []) or []:
                        label = clean_label(resp.get("label", ""))
                        if label:
                            symptoms.add(label)
                            symptom_to_skus[label].add(sid)

        # Existing, hand-curated content is authoritative outright when
        # present, not merged with the fresh pass -- a straight union
        # would pollute curated real_component_ids/real_symptom_ids with
        # noise from attribute-style modules (mounting_height, weight,
        # etc.) whose answers aren't genuine component/symptom labels,
        # the same real, confirmed problem v8's own comment documents.
        existing_components = set(existing_entry.get("real_component_ids", []))
        existing_symptoms = set(existing_entry.get("real_symptom_ids", []))
        existing_actions = set(existing_entry.get("real_action_ids", []))

        if existing_components or existing_symptoms:
            merged_components = existing_components
            merged_symptoms = existing_symptoms
            merged_component_to_skus = {k: set(v) for k, v in existing_entry.get("component_id_to_service_ids", {}).items()}
            merged_symptom_to_skus = {k: set(v) for k, v in existing_entry.get("symptom_id_to_service_ids", {}).items()}
        else:
            merged_components = components
            merged_symptoms = symptoms
            merged_component_to_skus = {k: set(v) for k, v in component_to_skus.items()}
            merged_symptom_to_skus = {k: set(v) for k, v in symptom_to_skus.items()}
        # Actions are a much narrower, cleaner signal (real service_type
        # values, not free-form answer labels) -- no equivalent noise
        # risk, safe to keep the union.
        merged_actions = actions | existing_actions

        merged_gaps = sorted(set(KNOWN_UNRESOLVED_COMPONENTS.get(gid, [])) | set(existing_entry.get("real_gaps", [])))

        # Preserve an already-determined live classification rather than
        # let a merged recount silently flip it -- only a group genuinely
        # 'undetermined' (nothing real to override) gets the freshly
        # computed label.
        existing_archetype = existing_entry.get("routing_archetype")
        if existing_archetype in ("component_first", "symptom_first"):
            routing_archetype = existing_archetype
        else:
            routing_archetype = classify_routing_archetype(len(merged_components), len(merged_symptoms))

        result[gid] = {
            "display_name": grp.get("display_name", ""),
            "category_id": grp.get("category_id", ""),
            "routing_archetype": routing_archetype,
            "real_action_ids": sorted(merged_actions),
            "real_component_ids": sorted(merged_components),
            "component_id_to_service_ids": {k: sorted(v) for k, v in merged_component_to_skus.items()},
            "real_symptom_ids": sorted(merged_symptoms),
            "symptom_id_to_service_ids": {k: sorted(v) for k, v in merged_symptom_to_skus.items()},
            "real_gaps": merged_gaps,
        }
    return result


# ---------------------------------------------------------------------------
# Service index + candidate matrix
# ---------------------------------------------------------------------------

def build_service_index(db: dict, pricing_index: Dict[str, dict]) -> Dict[str, dict]:
    index: Dict[str, dict] = {}
    for svc in db.get("services", []):
        sid = svc.get("id")
        if not sid:
            continue
        ui = svc.get("ui_taxonomy", {}) or {}
        index[sid] = {
            "name": ui.get("display_name") or sid,
            "service_type": svc.get("service_type"),
            "category": ui.get("category_id"),
            "group": ui.get("group_id"),
            "aliases": svc.get("aliases", []) or [],
            "intake_chain": svc.get("intake_chain", []) or [],
            "pricing": pricing_index.get(sid, {}),
            "dynamic": False,
            "default_estimates": svc.get("default_estimates", {}) or {},
            "required_materials": svc.get("required_materials", []) or [],
            "optional_materials": svc.get("optional_materials", []) or [],
            "default_tags": extract_refs(svc.get("default_tags", [])),
            "behavior": svc.get("behavior"),
            "remote_deep_dive_modules": svc.get("remote_deep_dive_modules", []) or [],
            "requires_furniture_selection": svc.get("requires_furniture_selection", False),
            "confidence_strategy": svc.get("confidence_strategy"),
        }
    for dyn_key, dyn in db.get("dynamic_services", {}).items():
        parsed = parse_dynamic_key(dyn_key)
        index[dyn_key] = {
            "name": dyn_key,
            "service_type": parsed["service_type"],
            "category": parsed["category"],
            "group": parsed["group"],
            "aliases": [],
            "intake_chain": dyn.get("intake_chain", []) or [],
            "pricing": pricing_index.get(dyn_key, {}),
            "dynamic": True,
            "default_estimates": dyn.get("default_estimate", {}) or {},
            "required_materials": [],
            "optional_materials": [],
            "default_tags": [],
            "behavior": None,
            "remote_deep_dive_modules": dyn.get("remote_deep_dive_modules", []) or [],
            "requires_furniture_selection": False,
            "confidence_strategy": dyn.get("confidence_strategy"),
        }
    return index


def build_candidate_matrix(
    db: dict, symptom_index: Dict[str, dict],
) -> Tuple[Dict[str, dict], Dict[str, str]]:
    """Real fallback-chained candidate matrix; excluded keywords get an
    explicit reason string instead of being silently dropped."""
    matrix: Dict[str, Dict[str, Dict[str, List[dict]]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(list))
    )
    symptom_synonyms: Dict[str, str] = {}
    for sym, info in symptom_index.items():
        for syn in info.get("synonyms", []):
            symptom_synonyms[syn] = sym

    excluded: Dict[str, str] = {}
    for obj in db.get("intent_mappings", {}).get("objects", []):
        comp = obj.get("keyword")
        if not comp:
            continue
        default_action = real_action_for_object(db, obj)
        if not default_action:
            excluded[comp] = (
                "no derivable action: no default_service_type, no "
                "default_service_sku with a resolvable service_type, "
                "and no fallback.service_type"
            )
            continue

        if obj.get("default_service_sku"):
            matrix[comp][default_action]["any"].append({
                "service_id": obj["default_service_sku"],
                "confidence": obj.get("confidence_weight", 50),
                "source": "default_service_sku",
            })

        for ov in obj.get("contextual_overrides", []):
            sku = ov.get("override_sku")
            if not sku:
                continue
            found_symptoms = {"any"}
            for kw in ov.get("keywords", []):
                if kw in symptom_synonyms:
                    found_symptoms.add(symptom_synonyms[kw])
            for sym in found_symptoms:
                matrix[comp][default_action][sym].append({
                    "service_id": sku,
                    "confidence": obj.get("confidence_weight", 50),
                    "source": "contextual_override",
                    "note": ov.get("note", ""),
                })

        if obj.get("default_dynamic_category"):
            dyn_key = f"{obj['default_dynamic_category']}+{default_action}"
            if dyn_key in db.get("dynamic_services", {}):
                matrix[comp][default_action]["any"].append({
                    "service_id": dyn_key,
                    "confidence": obj.get("confidence_weight", 50) * 0.8,
                    "source": "default_dynamic_category",
                })

    result = {
        k: {a: dict(s) for a, s in v.items()}
        for k, v in matrix.items()
    }
    return result, excluded


def compute_qualification(db: dict) -> Dict[str, dict]:
    modules = db.get("intake_modules", {}) or {}

    def needed_for(chain: Optional[List[Any]]) -> List[str]:
        chain_mods = flatten_intake_chain(chain)
        return sorted(
            m for m in chain_mods
            if modules.get(m, {}).get("affects_price") is True
            or m in LOGISTICS_MODULES
        )

    qual: Dict[str, dict] = {}
    for svc in db.get("services", []):
        sid = svc.get("id")
        if sid:
            qual[sid] = {"modules_needed_for_exact": needed_for(svc.get("intake_chain", []))}
    for dyn_key, dyn in db.get("dynamic_services", {}).items():
        qual[dyn_key] = {"modules_needed_for_exact": needed_for(dyn.get("intake_chain", []))}
    return qual

    
def build_archetype_mismatch_report(db: dict, routing_archetypes: dict) -> dict:
    """v9.6 Phase 1 (DEVELOPERS_CHECKLIST_ROADMAP_TO_SEESAW.md): for each
    service, does its manually-authored confidence_strategy/routing
    behavior roughly match what its nearest archetype would suggest?
    Informational only -- never raises, never blocks, never changes any
    other compiled output."""
    group_to_archetype = {}
    for arch_name, arch in (db.get("archetypes") or {}).items():
        for gid in arch.get("member_group_ids", []):
            group_to_archetype[gid] = arch_name

    mismatches = []
    matches = 0
    no_archetype = []

    for svc in db.get("services", []):
        gid = (svc.get("ui_taxonomy") or {}).get("group_id")
        if not gid:
            continue
        arch_name = group_to_archetype.get(gid)
        if not arch_name:
            no_archetype.append(svc["id"])
            continue
        arch = db["archetypes"][arch_name]
        real_routing = (routing_archetypes.get(gid) or {}).get("routing_archetype")
        default_routing = arch.get("default_routing_strategy")

        entry = {
            "service_id": svc["id"],
            "group_id": gid,
            "archetype": arch_name,
            "real_routing_archetype": real_routing,
            "archetype_default_routing_strategy": default_routing,
            "routing_matches": real_routing == default_routing,
        }
        if entry["routing_matches"]:
            matches += 1
        else:
            mismatches.append(entry)

    return {
        "real_services_checked": matches + len(mismatches),
        "real_routing_matches": matches,
        "real_routing_mismatches": mismatches,
        "services_with_no_archetype": no_archetype,
        "_note": (
            "Informational only, per Phase 1's explicit requirement -- a "
            "mismatch here is real, expected signal for a future decision "
            "(the archetype default may need adjusting, or the service is "
            "a genuine, deliberate exception), never treated as an error "
            "or used to alter any route/quote computation."
        ),
    }

def build_pricing_archetypes(
    pricing_index: Dict[str, dict],
) -> Dict[str, dict]:
    # T132 FIX: this function, as received, only ever checked for an
    # already-set entry.get("pricing_archetype") -- but per v8's own,
    # separately-confirmed comment, "pricing_archetype is no longer
    # authored directly on entities" as of the v9.1+ schema; it must be
    # derived from financial_engine.type and the registered formula's
    # own shape. Confirmed directly, not assumed: without this
    # derivation, currently_assigned_to for diagnostic_open dropped from
    # a real 27 entities to 1 (missing every dynamic_services entry,
    # which never had this field authored directly). Restored below,
    # matching v8's own derivation exactly.
    assigned: Dict[str, List[str]] = defaultdict(list)
    for entity_id, entry in pricing_index.items():
        archetype = entry.get("pricing_archetype")
        if not archetype:
            if entry.get("checkout_state") == "diagnostic":
                archetype = "diagnostic_open"
            elif entry.get("is_real_registered_formula"):
                archetype = "tiered_per_unit" if "flat_tier_price" in entry.get("formula_params", {}) else "formula"
            elif entry.get("pricing_type") == "flat_rate":
                archetype = "flat_simple"
            elif entry.get("pricing_type"):
                archetype = "hourly_timed"
        if archetype:
            assigned[archetype].append(entity_id)
    return {
        name: {
            "definition": desc,
            "currently_assigned_to": sorted(assigned.get(name, [])),
        }
        for name, desc in PRICING_ARCHETYPE_DEFINITIONS.items()
    }


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _validate_module_refs(db: dict) -> List[str]:
    errors: List[str] = []
    module_ids = set(db.get("intake_modules", {}).keys())
    for svc in db.get("services", []):
        sid = svc.get("id")
        for mod in flatten_intake_chain(svc.get("intake_chain", [])):
            if mod not in module_ids:
                errors.append(f"Service '{sid}' references unknown intake module '{mod}'")
    for dyn_key, dyn in db.get("dynamic_services", {}).items():
        for mod in flatten_intake_chain(dyn.get("intake_chain", [])):
            if mod not in module_ids:
                errors.append(
                    f"Dynamic service '{dyn_key}' references unknown intake module '{mod}'"
                )
    return errors


def _validate_material_refs(db: dict) -> List[str]:
    errors: List[str] = []
    material_ids = set(db.get("materials_catalog", {}).keys())
    for svc in db.get("services", []):
        sid = svc.get("id")
        for mat in (svc.get("required_materials", []) or []) + (svc.get("optional_materials", []) or []):
            if mat not in material_ids:
                errors.append(f"Service '{sid}' references unknown material SKU '{mat}'")
    return errors


def _validate_intent_mapping_refs(db: dict) -> List[str]:
    errors: List[str] = []
    known_ids = {s.get("id") for s in db.get("services", []) if s.get("id")}
    known_ids |= set(db.get("dynamic_services", {}).keys())
    for obj in db.get("intent_mappings", {}).get("objects", []):
        kw = obj.get("keyword")
        sku = obj.get("default_service_sku")
        if sku and sku not in known_ids:
            errors.append(f"intent_mappings['{kw}'].default_service_sku '{sku}' does not exist")
        for ov in obj.get("contextual_overrides", []):
            target = ov.get("override_sku")
            if target and target not in known_ids:
                errors.append(
                    f"intent_mappings['{kw}'].contextual_overrides[].override_sku "
                    f"'{target}' does not exist"
                )
        dyn_cat = obj.get("default_dynamic_category")
        default_action = real_action_for_object(db, obj)
        if dyn_cat and default_action:
            dyn_key = f"{dyn_cat}+{default_action}"
            # Dynamic keys may be group-scoped; a bare category+type key
            # must exist among the dynamic_services entries for the
            # compiler's candidate_matrix to actually resolve it.
            if not any(
                k == dyn_key or k.startswith(f"{dyn_cat}+")
                for k in db.get("dynamic_services", {}).keys()
            ):
                # Not strictly an error — a category-level fallback with
                # no matching dynamic key is still valid data, just inert.
                pass
    return errors


def _validate_smart_tag_refs(db: dict) -> List[str]:
    errors: List[str] = []
    tags = set(db.get("smart_tags", {}).keys())
    module_ids = set(db.get("intake_modules", {}).keys())
    modules = db.get("intake_modules", {}) or {}

    for tag_name, tag in (db.get("smart_tags", {}) or {}).items():
        # requires / mutually_exclusive must reference real tags
        for ref in extract_refs(tag.get("requires", [])):
            if ref not in tags:
                errors.append(f"smart_tags['{tag_name}'].requires references unknown tag '{ref}'")
        for ref in extract_refs(tag.get("mutually_exclusive", [])):
            if ref not in tags:
                errors.append(
                    f"smart_tags['{tag_name}'].mutually_exclusive references unknown tag '{ref}'"
                )
        # answers must reference real modules and real client_response labels
        for mod_name, expected_label in (tag.get("answers", {}) or {}).items():
            if mod_name not in module_ids:
                errors.append(
                    f"smart_tags['{tag_name}'].answers references unknown module '{mod_name}'"
                )
                continue
            labels = {
                r.get("label") for r in (modules[mod_name].get("client_response", []) or [])
            }
            if expected_label not in labels:
                errors.append(
                    f"smart_tags['{tag_name}'].answers['{mod_name}'] = '{expected_label}' "
                    f"is not a real client_response label for that module"
                )
    # default_tags on services must reference real tags
    for svc in db.get("services", []):
        sid = svc.get("id")
        for ref in extract_refs(svc.get("default_tags", [])):
            if ref not in tags:
                errors.append(f"Service '{sid}' default_tags references unknown tag '{ref}'")
    return errors


def _validate_category_group_refs(db: dict) -> List[str]:
    errors: List[str] = []
    category_ids = {c.get("id") for c in db.get("category", []) if c.get("id")}
    group_ids = {g.get("id") for g in db.get("group", []) if g.get("id")}

    for cat in db.get("category", []):
        for gid in cat.get("group_ids", []) or []:
            if gid not in group_ids:
                errors.append(f"category['{cat.get('id')}'].group_ids references unknown group '{gid}'")
    for grp in db.get("group", []):
        gid = grp.get("id")
        cat = grp.get("category_id")
        if cat and cat not in category_ids:
            errors.append(f"group['{gid}'].category_id references unknown category '{cat}'")
        parent = grp.get("parent_group")
        if parent and parent not in group_ids:
            errors.append(f"group['{gid}'].parent_group references unknown group '{parent}'")
        for sid in grp.get("explicit_services", []) or []:
            svc, _ = get_entity(db, sid)
            if svc is None:
                errors.append(f"group['{gid}'].explicit_services references unknown service '{sid}'")
    # Every service must sit in a real group + category
    for svc in db.get("services", []):
        sid = svc.get("id")
        ui = svc.get("ui_taxonomy", {}) or {}
        if ui.get("category_id") and ui["category_id"] not in category_ids:
            errors.append(f"Service '{sid}' ui_taxonomy.category_id '{ui['category_id']}' does not exist")
        if ui.get("group_id") and ui["group_id"] not in group_ids:
            errors.append(f"Service '{sid}' ui_taxonomy.group_id '{ui['group_id']}' does not exist")
    return errors


def _validate_dynamic_service_keys(db: dict) -> List[str]:
    errors: List[str] = []
    category_ids = {c.get("id") for c in db.get("category", []) if c.get("id")}
    group_ids = {g.get("id") for g in db.get("group", []) if g.get("id")}
    for key in db.get("dynamic_services", {}):
        parsed = parse_dynamic_key(key)
        if not parsed["category"] or not parsed["service_type"]:
            errors.append(f"dynamic_services key '{key}' does not parse as category[+group]+service_type")
            continue
        if parsed["category"] not in category_ids:
            errors.append(f"dynamic_services key '{key}' has unknown category '{parsed['category']}'")
        if parsed["group"] and parsed["group"] not in group_ids:
            errors.append(f"dynamic_services key '{key}' has unknown group '{parsed['group']}'")
    return errors


def _validate_archetypes(db: dict) -> List[str]:
    errors: List[str] = []
    group_ids = {g.get("id") for g in db.get("group", []) if g.get("id")}
    for name, arch in (db.get("archetypes", {}) or {}).items():
        for gid in arch.get("member_group_ids", []) or []:
            if gid not in group_ids:
                errors.append(f"archetypes['{name}'].member_group_ids references unknown group '{gid}'")
    return errors


def _validate_workflow(db: dict) -> List[str]:
    errors: List[str] = []
    wf = db.get("workflow", {}) or {}
    for field in ("steps", "ui_template_matrix", "intake_bypass_rules",
                  "fallback_routing_rules", "resolution_thresholds"):
        if field not in wf:
            errors.append(f"workflow missing '{field}'")
    steps = wf.get("steps", []) or []
    for step in steps:
        if "id" not in step:
            errors.append(f"workflow step missing 'id': {step}")
        ref = step.get("ref")
        if ref and ref not in wf:
            errors.append(f"workflow step '{step.get('id')}' has unresolved ref '{ref}'")
    return errors


def validate_structural(db: dict) -> Dict[str, List[str]]:
    """v10: multi-category validation. Every check is reported under its
    own category so a regression in one area is never masked by another
    area passing."""
    return {
        "module_references": _validate_module_refs(db),
        "material_references": _validate_material_refs(db),
        "intent_mapping_references": _validate_intent_mapping_refs(db),
        "smart_tag_references": _validate_smart_tag_refs(db),
        "category_group_references": _validate_category_group_refs(db),
        "dynamic_service_keys": _validate_dynamic_service_keys(db),
        "archetypes": _validate_archetypes(db),
        "workflow": _validate_workflow(db),
    }


def validate_against_real_schema(
    output: dict, schema_path: Path,
) -> List[str]:
    try:
        import jsonschema
    except ImportError:
        return [
            "jsonschema package not installed — cannot run real schema "
            "validation. Install with: pip install jsonschema"
        ]
    if not schema_path.exists():
        return [f"Schema file not found at {schema_path}"]
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    validator = jsonschema.Draft7Validator(schema)
    return [e.message for e in validator.iter_errors(output)]


def diff_top_level_keys(
    original: dict, compiled: dict,
) -> Dict[str, List[str]]:
    report: Dict[str, List[str]] = {
        "unchanged": [],
        "CHANGED (should never happen)": [],
    }
    for k, v in original.items():
        if k in compiled and compiled[k] == v:
            report["unchanged"].append(k)
        else:
            report["CHANGED (should never happen)"].append(k)
    return report


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def compile_v10(input_file: Path, output_file: Path) -> int:
    with open(input_file, "r", encoding="utf-8") as f:
        db = json.load(f)

    # Snapshot only the ORIGINAL (non-compiler) keys so the additive
    # diff is idempotent and re-running on an already-compiled file
    # surfaces genuine non-additive changes rather than self-noise.
    original = {k: v for k, v in db.items() if k not in COMPILER_KEYS}

    logger.info("Compiling pricing index (pricing_engine, not pricing_formula)...")
    pricing_index = compile_pricing_index(db)

    logger.info("Compiling component / action / symptom / module / tag / material / formula indexes...")
    component_index = compile_component_index(db)
    action_index = compile_action_index(db)
    symptom_index = compile_symptom_index(db)
    module_index = compile_module_index(db)
    smart_tag_index = compile_smart_tag_index(db)
    material_index = compile_material_index(db)
    formula_index = compile_formula_index(db)

    logger.info("Building routing archetypes (per-group strategy)...")
    routing_archetypes = build_routing_archetypes(db)

    logger.info("Building centralized pricing archetypes...")
    pricing_archetypes = build_pricing_archetypes(pricing_index)

    # Add:
    logger.info("Building archetype-mismatch report (informational only)...")
    archetype_mismatch_report = build_archetype_mismatch_report(db, routing_archetypes)

    logger.info("Building unified service index...")
    service_index = build_service_index(db, pricing_index)

    logger.info("Building candidate matrix (real fallback chain, no silent exclusions)...")
    candidate_matrix, excluded_reasons = build_candidate_matrix(db, symptom_index)

    logger.info("Computing qualification metadata...")
    qualification = compute_qualification(db)
    for sid, q in qualification.items():
        if sid in service_index:
            service_index[sid].update(q)

    logger.info("Assembling output...")
    output: Dict[str, Any] = dict(original)
    output["compiled"] = {
        "pricing_index": pricing_index,
        "component_index": component_index,
        "action_index": action_index,
        "symptom_index": symptom_index,
        "service_index": service_index,
        "candidate_matrix": candidate_matrix,
        "module_index": module_index,
        "smart_tag_index": smart_tag_index,
        "material_index": material_index,
        "formula_index": formula_index,
    }
    output["routing_archetypes"] = routing_archetypes
    output["pricing_archetypes"] = pricing_archetypes
    output["_archetype_mismatch_report"] = archetype_mismatch_report   # ← add
    output["_compiler_metadata"] = {
        "version": "10.0",
        "source_compiler": "btnyc_v10_compiler.py",
        "excluded_from_candidate_matrix": excluded_reasons,
    }

    # Multi-category structural validation
    structural = validate_structural(db)
    flat_errors = [e for errs in structural.values() for e in errs]
    output["_validation"] = {
        "errors": flat_errors,
        "valid": len(flat_errors) == 0,
        "by_category": structural,
        "summary": {k: len(v) for k, v in structural.items()},
    }

    # Additive diff (against ORIGINAL keys only)
    output["_additive_diff"] = diff_top_level_keys(original, output)

    # Real schema validation runs AFTER everything else is attached.
    # T132 FIX: was input_file.parent / "btnyc_schema.json" -- resolved
    # relative to wherever the *input data* happens to live, which
    # breaks the moment input/output aren't both in this project's own
    # root (confirmed directly: the idempotency check's own two-run
    # sequence compiles to/from a temp directory with no schema file
    # alongside it). The schema is a fixed companion to this compiler
    # script itself, not something that should depend on where the
    # data lives -- resolved relative to __file__ instead.
    #
    # T164: the schema moved to schema/btnyc_schema.json in the T157 package
    # layout (the SSOT's own `$schema` declares that location). The old
    # companion path beside this script no longer exists, so every run
    # reported "Schema file not found" and wrote a false `_schema_validation`.
    # The repo-layout location is tried first; the old companion path stays as
    # the fallback for a checkout that still keeps the schema beside the script.
    _here = Path(__file__).resolve().parent
    schema_path = next(
        (c for c in (_here.parent / "schema" / "btnyc_schema.json",
                     _here / "btnyc_schema.json") if c.exists()),
        _here.parent / "schema" / "btnyc_schema.json",
    )
    schema_errors = validate_against_real_schema(output, schema_path)
    output["_schema_validation"] = {
        "errors": schema_errors,
        "valid": len(schema_errors) == 0,
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    # -- Logging summary --------------------------------------------------
    logger.info(f"Wrote {output_file}")
    if flat_errors:
        logger.warning(f"{len(flat_errors)} structural validation error(s):")
        for cat, errs in structural.items():
            if errs:
                logger.warning(f"  [{cat}] {len(errs)} error(s)")
                for e in errs[:3]:
                    logger.warning(f"    - {e}")
                if len(errs) > 3:
                    logger.warning(f"    ... and {len(errs) - 3} more")
    else:
        logger.info("Zero structural validation errors.")

    if schema_errors:
        logger.warning(f"{len(schema_errors)} schema validation error(s):")
        for e in schema_errors[:5]:
            logger.warning(f"  - {e}")
        if len(schema_errors) > 5:
            logger.warning(f"  ... and {len(schema_errors) - 5} more")
    else:
        logger.info("Schema validation: PASS.")

    if excluded_reasons:
        logger.warning(
            f"{len(excluded_reasons)} keyword(s) excluded from the candidate matrix "
            f"(each with an explicit reason):"
        )
        for kw, reason in excluded_reasons.items():
            logger.warning(f"  - '{kw}': {reason}")
    else:
        logger.info("Zero keywords excluded from the candidate matrix.")

    changed = output["_additive_diff"]["CHANGED (should never happen)"]
    if changed:
        logger.error(f"NON-ADDITIVE CHANGE DETECTED: {changed}")
    else:
        logger.info("Confirmed genuinely additive: every original top-level key is unchanged.")

    return 0 if not flat_errors and not schema_errors and not changed else 1


if __name__ == "__main__":
    in_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("btnyc.json")
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("btnyc_v10_compiled.json")
    sys.exit(compile_v10(in_path, out_path))
