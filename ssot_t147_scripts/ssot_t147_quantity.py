#!/usr/bin/env python3
"""T147 SSOT change: one explicit quantity stance per service (PENDING_DECISIONS #76 item 2, #80, #47).
Reads btnyc.json, applies the decision table below, writes it back with the SAME formatting (json indent=2, ensure_ascii=False -- verified to
round-trip the operator's file byte-for-byte). Every decision is also written into the data itself (_quantity_justification / modifier notes)."""
import json, re, sys
P = '/home/claude/work/btnyc.json'
b = json.load(open(P, encoding='utf-8'))
S = {s['id']: s for s in b['services']}
M = b['global_rules']['modifiers']
QTYPE = {'item_count_template', 'hybrid_qty', 'global_quantity', 'buy_the_hour_qty', 'pax_cabinet_count', 'pax_hinge_count', 'pax_sliding_count', 'pax_interior_count', 'item_count', 'count'}
mod = lambda st: st.get('module') if isinstance(st, dict) else st
log = []

# ---- 1. SINGLE-UNIT: whole objects/environments whose intake answers describe ONE unit (the schema's own rule for per_unit_answers_vary) ----
# Group-level judgement: appliances, plumbing fixtures/lines, light fixtures/fans/thermostats, doors, TVs, whole-computer jobs. Units differ in every
# answer the chain collects, so two of them are two bookings (the flagged services already show "book each separately").
SINGLE_WITH_STEPPER = ['ceiling_fan_install', 'chandelier_or_pendant_install', 'light_fixture_replacement', 'under_cabinet_light_install', 'thermostat_replacement',
    'dishwasher_install', 'microwave_setup', 'refrigerator_install', 'washer_install', 'door_lock_or_handle_install', 'door_weatherstripping',
    'shower_head_replacement', 'slow_drain_clearing', 'tub_spout_replacement', 'angle_stop_replacement', 'p_trap_cleaning',
    'toilet_flapper_or_fill_valve_replacement', 'toilet_wax_ring_replacement', 'toilet_seat_replacement', 'refrigerator_water_line_install',
    'internal_hardware_replacement', 'software_or_driver_install', 'system_restore_or_reset', 'virus_or_malware_removal', 'flatscreen_mounting_standard']
SINGLE_NO_STEP = ['bathroom_exhaust_fan_replacement', 'dishwasher_repair', 'dryer_repair', 'microwave_repair', 'repair_appliances', 'stove_repair', 'washer_repair',
    'window_ac_repair', 'window_ac_setup', 'baseboard_install', 'garbage_disposal_replacement', 'faucet_repair_drip', 'leak_under_sink_repair',
    'bidet_attachment_install_or_removal', 'computer_diagnostic', 'data_backup_or_transfer', 'cable_management', 'flatscreen_mounting_with_hidden_cables']
SINGLE_BY_DAMAGE = ['door_repair_impact_damage']  # its "how many doors" band question was inert, and doors are never homogeneous
for sid in SINGLE_WITH_STEPPER:
    s = S[sid]; n0 = len(s['intake_chain'])
    s['intake_chain'] = [st for st in s['intake_chain'] if not (mod(st) in ('hybrid_qty', 'global_quantity') and not (isinstance(st, dict) and st.get('then')))]
    assert len(s['intake_chain']) == n0 - 1, (sid, n0, len(s['intake_chain']))
    s['per_unit_answers_vary'] = True; log.append(('single-unit, legacy quantity marker removed', sid))
for sid in SINGLE_NO_STEP:
    s = S[sid]; assert not any(mod(st) in QTYPE for st in s['intake_chain']), sid
    s['per_unit_answers_vary'] = True; log.append(('single-unit, stance made explicit', sid))
for sid in SINGLE_BY_DAMAGE:
    s = S[sid]; n0 = len(s['intake_chain'])
    s['intake_chain'] = [st for st in s['intake_chain'] if mod(st) != 'item_count_template']; assert len(s['intake_chain']) == n0 - 1
    s['per_unit_answers_vary'] = True; log.append(('single-unit, inert count question removed', sid))

# ---- 2. WIRE the batched questions that asked a count and priced nothing ----
slug = lambda t: re.sub(r'[^a-z0-9]+', '_', t.lower()).strip('_')
def add_mod(sid, label, fee, minutes):
    key = f"{sid}_item_count_template_{slug(label)}"; assert key not in M, key
    M[key] = {'fee': fee, 'minutes': minutes, 'note': f"Per-unit tier for {sid}'s item_count_template ('{label}')", 'scope': 'per_unit'}
    return key
def bands(sid, spec, noun_override=None, question=None, note=''):
    """spec: [(label, fee, minutes, complexity_override)] -- the first band is the 1-unit baseline (no modifier)."""
    st = next(t for t in S[sid]['intake_chain'] if mod(t) == 'item_count_template')
    resp = []
    for i, (label, fee, mins, cx) in enumerate(spec):
        r = {'label': label, 'tags': []}
        if i > 0: r['modifier_ref'] = add_mod(sid, label, fee, mins)
        r['complexity_override'] = cx
        resp.append(r)
    st['params'] = {'item_noun': noun_override, 'client_response': resp}
    if question: st['params']['question_override'] = question
    log.append(('count question wired', sid + ' ' + note))
# 2a. batched homogeneous units: the house curve the operator authored on outlets and windows (+20/+16, +35/+28, +50/+40 -- identical across those services)
HOUSE = lambda one, two, three, four: [(one, 0, 0, 'routine'), (two, 20, 16, 'routine'), (three, 35, 28, 'skilled'), (four, 50, 40, 'skilled')]
bands('dimmer_switch_install', HOUSE('1 switch', '2 switches', '3 switches', '4 or more switches'), 'light switches', note='house curve')
bands('smart_switch_install', HOUSE('1 switch', '2 switches', '3 switches', '4 or more switches'), 'light switches', note='house curve')
bands('smart_plug_configuration', HOUSE('1 plug', '2 plugs', '3 plugs', '4 or more plugs'), 'smart plugs', note='house curve')
bands('wi_fi_extender_setup', HOUSE('1 extender', '2 extenders', '3 extenders', '4 or more extenders'), 'Wi-Fi extenders', note='house curve')
bands('window_screen_repair', HOUSE('1 screen', '2 screens', '3 screens', '4 or more screens'), 'window screens', note='house curve; the band labels said "areas" for window screens')
# 2b. walls: each wall is a full patch-dry-paint cycle with no batch economy, so the operator's stated linear rule applies: n walls = n x the base price
def linear(sid, unit, plural, note):
    base = S[sid]['financial_engine']['base_price']; mins = S[sid]['operational_metrics']['expected_minutes']
    spec = [(f'1 {unit}', 0, 0, 'routine')]
    for n, cx in ((2, 'routine'), (3, 'routine'), (4, 'skilled')):
        spec.append((f'{n} {plural}', base * (n - 1), mins * (n - 1), cx))
    spec.append((f'5 or more {plural} (final count confirmed on arrival)', base * 4, mins * 4, 'skilled'))
    return spec
for sid, unit, plural, q in (('wall_hole_or_crack_repair', 'wall', 'walls', 'How many walls have damage like this?'),
                              ('brick_or_concrete_crack_repair', 'wall', 'walls', 'How many walls have cracks like this?'),
                              ('plaster_wall_repair', 'wall', 'walls', 'How many walls need plaster repair?'),
                              ('wood_paneling_repair', 'wall', 'walls', 'How many walls have damaged paneling?'),
                              ('squeaky_floor_repair', 'area', 'areas', 'How many areas of the floor squeak?')):
    bands(sid, linear(sid, unit, plural, ''), plural if unit == 'wall' else 'areas of floor', q, note='linear: n x base')
# 2c. overlap: project_scale asks the same extent the size and count questions already ask (its wording: "single item" / "a few items")
s = S['wall_hole_or_crack_repair']; n0 = len(s['intake_chain']); s['intake_chain'] = [t for t in s['intake_chain'] if mod(t) != 'project_scale']; assert len(s['intake_chain']) == n0 - 1
log.append(('overlapping extent question removed (size and count already ask it)', 'wall_hole_or_crack_repair'))

# ---- 3. JUSTIFY every remaining quantity step on a Skilled/Specialized service (the stance the ratchet enforces) ----
J = {
 'cabinet_knob_or_pull_install': 'Homogeneous batch: each knob or pull is the same job, so the count is the same fact applied N times; priced per unit by the tiered per-unit archetype.',
 'loose_tile_replacement': 'Homogeneous batch: each loose tile is the same small repair; priced per unit by the tile repair formula.',
 'scratch_or_water_ring_removal': 'Homogeneous batch: each mark is the same small, independent repair on the same piece.',
 'smart_speaker_setup': 'Homogeneous batch: each speaker is set up by the same procedure.',
 'shelf_mortar_mounting_buy_the_hour': 'Buy-the-hour: the number of items is what drives the billable hours (T118); the items are shelves or frames of one kind.',
 'shelf_mounting_standard_buy_the_hour': 'Buy-the-hour: the number of items is what drives the billable hours (T118); the items are shelves or frames of one kind.',
 'generic_mounting_service': 'Buy-the-hour style mounting: the number of items drives the billable hours; the items are frames or shelves of one kind.',
 'blinds_shades_curtains_buy_the_hour': 'A deliberate binary gate (T118): one item is a flat rate, more than one switches to hourly billing; it is not a numeric count.',
 'pax_wardrobe_assembly': 'Configurable product: every count is of identical components (cabinets, hinges, sliding doors, interiors), priced by the PAX formula. The wardrobe-count stepper is the one borderline step (each wardrobe is configured separately) -- see PENDING_DECISIONS #76.',
}
GEN = {'item_count_template': 'Homogeneous batch of identical small units; every band moves price and time (enforced by verify_quantity_question_ratchet).'}
for s in b['services']:
    for st in s['intake_chain']:
        if not isinstance(st, dict) or st['module'] not in QTYPE: continue
        if s['operational_metrics']['complexity_tier'] == 'routine': continue
        if s['id'] in J: st['_quantity_justification'] = J[s['id']]
        elif st['module'] == 'item_count_template' or st['module'].startswith('pax_'): st['_quantity_justification'] = J.get(s['id'], GEN['item_count_template'])
        else: raise SystemExit('unjustified quantity step: %s %s' % (s['id'], st['module']))
        log.append(('quantity step justified', s['id'] + ':' + st['module']))

# ---- 4. every static service now holds exactly one stance ----
bad = []
for s in b['services']:
    batched = any(mod(t) in QTYPE for t in s['intake_chain']); single = bool(s.get('per_unit_answers_vary'))
    if batched == single: bad.append((s['id'], 'batched' if batched else 'neither', 'and flagged single-unit' if single else ''))
if bad: print('PARTITION GAPS:', bad); sys.exit(2)
open(P, 'w', encoding='utf-8').write(json.dumps(b, indent=2, ensure_ascii=False) + ('\n' if open('/mnt/user-data/uploads/btnyc.json', encoding='utf-8').read().endswith('\n') else ''))
from collections import Counter
c = Counter(k for k, _ in log); print('applied:', dict(c)); print('services:', len(b['services']), '| single-unit:', sum(1 for s in b['services'] if s.get('per_unit_answers_vary')), '| batched:', sum(1 for s in b['services'] if not s.get('per_unit_answers_vary')))
