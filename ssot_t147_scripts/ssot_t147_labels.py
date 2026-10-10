#!/usr/bin/env python3
"""T147: the open-ended top bands tell the customer to put the exact count in the notes -- that label IS the capture prompt for the owner's overflow formula
(the 'Additional details' box parses the first number into __exact_count). Restores the wording on the ten re-authored services and renames each band's modifier key
to follow its label (the owner's key convention: <service>_item_count_template_<slug of label>)."""
import json, re
P = '/home/claude/work/btnyc.json'
b = json.load(open(P, encoding='utf-8')); S = {s['id']: s for s in b['services']}; M = b['global_rules']['modifiers']
slug = lambda t: re.sub(r'[^a-z0-9]+', '_', t.lower()).strip('_')
mod = lambda t: t.get('module') if isinstance(t, dict) else t
IDS = ['wall_hole_or_crack_repair', 'brick_or_concrete_crack_repair', 'plaster_wall_repair', 'wood_paneling_repair', 'squeaky_floor_repair', 'dimmer_switch_install', 'smart_switch_install', 'smart_plug_configuration', 'wi_fi_extender_setup', 'window_screen_repair']
for sid in IDS:
    r = next(t for t in S[sid]['intake_chain'] if mod(t) == 'item_count_template')['params']['client_response'][-1]
    old = r['label']; new = re.sub(r'\s*\(final count confirmed on arrival\)', '', old) + ' (specify exact count in notes)'
    if new == old: continue
    ok = r['modifier_ref']; nk = f"{sid}_item_count_template_{slug(new)}"; assert nk not in M
    M[nk] = M.pop(ok); M[nk]['note'] = f"Per-unit tier for {sid}'s item_count_template ('{new}')"
    r['label'] = new; r['modifier_ref'] = nk
open(P, 'w', encoding='utf-8').write(json.dumps(b, indent=2, ensure_ascii=False) + '\n')
print("top-band labels restored on", len(IDS), "services")
