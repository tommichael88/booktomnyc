#!/usr/bin/env python3
"""T147 / #72 (operator ruling A): apply a reviewed synonym batch to the SSOT's full_weight_synonyms. Usage: ssot_t147_synonyms.py <batch.json>. Same formatting as the operator's file."""
import json, sys
P = '/home/claude/work/btnyc.json'
b = json.load(open(P, encoding='utf-8')); batch = json.load(open(sys.argv[1], encoding='utf-8'))
im = b['intent_mappings']; objs = im if isinstance(im, list) else im['objects']
n = 0
for kw, syns in batch.items():
    o = next(x for x in objs if x['keyword'] == kw)
    fw = o.setdefault('full_weight_synonyms', [])
    for s in syns:
        assert s in o.get('synonyms', []), (kw, s)
        if s not in fw: fw.append(s); n += 1
open(P, 'w', encoding='utf-8').write(json.dumps(b, indent=2, ensure_ascii=False) + '\n')
print("promoted", n, "synonyms across", len(batch), "entries")
