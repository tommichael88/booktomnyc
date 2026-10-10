#!/usr/bin/env python3
"""T149 / R-DOMAIN-DYNCHAIN (#90): the five plumbing_help component_first groups led their Diagnostic fallback with the GENERIC shared `symptom` module
(question: "What's the issue with the appliance?"; first answer: "Won't spin / no movement"). Same remedy as T128's door_issue and T144's window_ac_issue:
a module per family that copies every APPLICABLE generic answer with IDENTICAL effects (tags, complexity/checkout overrides, modifier_ref) -- no price moves, no
new business numbers -- with the question's noun corrected. Same formatting as the operator's file (json indent=2, ensure_ascii=False)."""
import json, copy
P = 'btnyc.json'; b = json.load(open(P, encoding='utf-8')); mods = b['intake_modules']; gen = mods['symptom']
WONT_SPIN = 'Won\u2019t spin / no movement'; WONT_DRAIN = 'Won\u2019t drain (water stays inside)'
assert WONT_SPIN in [r['label'] for r in gen['client_response']] and WONT_DRAIN in [r['label'] for r in gen['client_response']]
SAFETY = ("The two emergency answers (burning smell, trips breaker) are kept deliberately: heated seats, bidets, electric water heaters and disposals put electricity beside water, "
          "and dropping a safety path to tidy a list would be the wrong trade. ")
COMMON = ("T149 (R-DOMAIN-DYNCHAIN; same remedy as T128's door_issue and T144's window_ac_issue): this family's group is component_first and its Diagnostic fallback led with the generic shared "
          "`symptom` module, whose question reads \"What\u2019s the issue with the appliance?\" and whose first answer is \"Won\u2019t spin / no movement\". Every generic answer that applies here is copied "
          "with IDENTICAL effects (tags, complexity/checkout overrides, modifier_ref). ")
NEW = {
 'garbage_disposal_issue': ('What\u2019s the issue with the garbage disposal?', [],
     COMMON + "All seven generic answers apply to a motorised disposal, so none is dropped; the module exists so the group owns its symptom set and its question names the right thing. No price moves; no new business numbers."),
 'plumbing_fixture_issue': ('What\u2019s the issue with the fixture?', [WONT_SPIN],
     COMMON + "\"Won\u2019t spin / no movement\" is dropped (a sink, tub or toilet has no motor). " + SAFETY + "No price moves; no new business numbers."),
 'water_line_issue': ('What\u2019s the issue with the water line?', [WONT_SPIN, WONT_DRAIN],
     COMMON + "\"Won\u2019t spin / no movement\" and \"Won\u2019t drain (water stays inside)\" are dropped (a supply line neither spins nor drains). " + SAFETY + "No price moves; no new business numbers."),
}
POINT = {'plumbing_help+plumbing_help_garbage_disposals+Diagnostic': 'garbage_disposal_issue', 'plumbing_help+plumbing_help_sinks+Diagnostic': 'plumbing_fixture_issue',
         'plumbing_help+plumbing_help_showers_tubs+Diagnostic': 'plumbing_fixture_issue', 'plumbing_help+plumbing_help_toilets+Diagnostic': 'plumbing_fixture_issue',
         'plumbing_help+plumbing_help_water_lines+Diagnostic': 'water_line_issue'}
out = {}
for k, v in mods.items():
    out[k] = v
    if k == 'window_ac_issue':
        for name, (q, drop, note) in NEW.items():
            assert name not in mods
            m = {'_note': note}; m.update({f: copy.deepcopy(gen[f]) for f in gen if f not in ('client_response', 'question')}); m['question'] = q
            m['client_response'] = [copy.deepcopy(r) for r in gen['client_response'] if r['label'] not in drop]
            out[name] = m
assert all(n in out for n in NEW), 'window_ac_issue anchor missing'
b['intake_modules'] = out
for key, name in POINT.items():
    ch = b['dynamic_services'][key]['intake_chain']; assert [s['module'] for s in ch] == ['symptom'] and ch[0].get('then') == {}, key
    ch[0]['module'] = name
open(P, 'w', encoding='utf-8').write(json.dumps(b, indent=2, ensure_ascii=False) + '\n')
print('modules added:', {n: len(out[n]['client_response']) for n in NEW}, '| chains re-pointed:', len(POINT))
