#!/usr/bin/env python3
"""T147 (second SSOT change): the open-ended top band of every banded count question prices at least what the band below it prices, and is wired to the owner's
item_count_overflow_formula (v9.6 DECIDED) with an anchor that matches it. Same formatting as the operator's file (json indent=2, ensure_ascii=False)."""
import json, re, sys
P = '/home/claude/work/btnyc.json'
b = json.load(open(P, encoding='utf-8'))
S = {s['id']: s for s in b['services']}; M = b['global_rules']['modifiers']
CFG = b['pricing_formulas']['item_count_overflow_formula']['anchor_and_overflow_ref_by_service']
mod = lambda t: t.get('module') if isinstance(t, dict) else t
step = lambda sid: next(t for t in S[sid]['intake_chain'] if mod(t) == 'item_count_template')
OF = 'item_count_overflow_formula'; log = []
# 1. the owner's five services: the dormant overflow band had NO modifier, so "5 or more windows" priced at the 1-window base ($55) -- less than 2 windows ($75)
for sid in ('cabinet_door_or_drawer_adjustment', 'gfci_outlet_replacement', 'usb_outlet_install', 'window_draft_sealing', 'window_hardware_repair'):
    resp = step(sid)['params']['client_response']; i = next(i for i, r in enumerate(resp) if r.get('formula_override') == OF)
    assert not resp[i].get('modifier_ref') and resp[i - 1].get('modifier_ref'), sid
    resp[i]['modifier_ref'] = resp[i - 1]['modifier_ref']; log.append(('dormant band now prices as the band below it', sid))
# 2. my ten re-authored services: the open-ended TOP band carries the overflow formula; the anchor is the count that top band is priced at
TOP = {'wall_hole_or_crack_repair': 5, 'brick_or_concrete_crack_repair': 5, 'plaster_wall_repair': 5, 'wood_paneling_repair': 5, 'squeaky_floor_repair': 5,
       'dimmer_switch_install': 4, 'smart_switch_install': 4, 'smart_plug_configuration': 4, 'wi_fi_extender_setup': 4, 'window_screen_repair': 4}
for sid, anchor in TOP.items():
    resp = step(sid)['params']['client_response']; assert re.search(r'or more', resp[-1]['label']) and resp[-1].get('modifier_ref'), sid
    resp[-1]['formula_override'] = OF; CFG[sid]['anchor'] = anchor; log.append(('top band wired to the overflow formula, anchor %d' % anchor, sid))
# 3. walls have no batch economy (each is a full patch-dry-paint cycle): beyond the anchor each wall costs the full base -- the operator's #80 rule, n x base, continued
for sid in ('wall_hole_or_crack_repair', 'brick_or_concrete_crack_repair', 'plaster_wall_repair', 'wood_paneling_repair', 'squeaky_floor_repair'):
    base = S[sid]['financial_engine']['base_price']; mins = S[sid]['operational_metrics']['expected_minutes']; key = CFG[sid]['overflow_rate_ref']
    M[key] = {'fee': float(base), 'minutes': mins, 'note': "T147 (operator ruling, PENDING_DECISIONS #80): %s has no batch economy -- each %s beyond the anchor is a full repair, so the overflow rate is this service's full base price ($%s) and %s minutes, continuing the n x base rule of its count bands. Replaces the uniform 10%% rule (v9.6) for this service." % (sid, 'area' if sid == 'squeaky_floor_repair' else 'wall', base, mins), 'scope': 'per_unit'}
    log.append(('overflow rate is linear: full base per unit beyond the anchor', sid))
# 4. door_repair_impact_damage lost its count question (doors are never homogeneous): its overflow configuration is now orphaned data
rk = CFG.pop('door_repair_impact_damage')['overflow_rate_ref']; M.pop(rk); log.append(('orphaned overflow configuration removed', 'door_repair_impact_damage'))
open(P, 'w', encoding='utf-8').write(json.dumps(b, indent=2, ensure_ascii=False) + '\n')
from collections import Counter; print(dict(Counter(k for k, _ in log)))
