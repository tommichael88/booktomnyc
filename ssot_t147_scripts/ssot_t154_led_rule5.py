#!/usr/bin/env python3
"""T154 / PENDING_DECISIONS #108 (operator ruling "LED yes"): template-matrix rule 5 (the authored `bypass_intake` count template) gains `quantity_is_fixed: true`.
Rule 4 (pure quantity) already requires it (T151). Rule 5 is the SAME shape of rule -- a self-quote with no question -- so it must carry the SAME precondition: a service whose
quantity moves the price is not self-quotable, because the self-quote card cannot express it. led_bulb_upgrade (item_count_template; 1 bulb / 2-3 / 4-6 bands, each with a price-moving
modifier) is the one service rule 5 matches today; with the condition it routes to curated_card, asks the bulb count, and prices $20/$35/$50 when answered -- the same price the
card tap already produced. No price number is added or changed; no service gains or loses a field. Same formatting as the operator's file (json indent=2, ensure_ascii=False)."""
import json
P = 'btnyc.json'
b = json.load(open(P, encoding='utf-8'))
r = b['workflow']['ui_template_matrix']['rules'][5]
assert r['if'] == {'chain_is_single_simple_question': True, 'behavior.bypass_intake': True}, r['if']
assert r['then'] == {'ui_template': 'self_quote', 'bypass_intake': True}
r['if']['quantity_is_fixed'] = True
r['_note'] += (" T154 (operator ruling on #108, 'LED yes'): this rule now ALSO requires quantity_is_fixed, exactly as the pure-quantity rule above it has since T151. Before this, the rule matched"
               " led_bulb_upgrade -- an item_count_template chain whose three bands each move price and time -- and self-quoted it with no question, so the route showed a flat figure while the card tap"
               " (classifyServiceIntake, which asks isQuantityFixed first) asked the bulb count. Two entry paths disagreed about the same service (DEFECT-ARBITRATION). With the condition the route"
               " falls through to the curated-card rule below, asks 'How many light bulbs need attention?', and prices $20 / $35 / $50 by answer. The rule is now exercised by"
               " no current service (the catalog sweep below shows zero matches): it remains the correct home for a future authored bypass_intake count template whose bands do NOT move price.")
open(P, 'w', encoding='utf-8').write(json.dumps(b, indent=2, ensure_ascii=False) + '\n')
print('rule 5 updated')
