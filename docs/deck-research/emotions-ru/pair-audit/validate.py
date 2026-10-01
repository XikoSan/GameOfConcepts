from pathlib import Path
import json,itertools,collections
p=Path(__file__).resolve().parent
words=json.loads((p.parent/'words.json').read_text())['words'];names={w['word'] for w in words}
ev=json.loads((p/'evidence.json').read_text());evidence={r['id']:r for r in ev}
assert len(evidence)==len(ev)
assert all(r['a'] in names and r['b'] in names and r['explanation'] for r in ev)
seen=set();counts=collections.Counter()
for line in (p/'all-pairs.jsonl').read_text().splitlines():
 row=json.loads(line);key=tuple(sorted((row['a'],row['b'])))
 assert key not in seen and key[0]!=key[1]
 seen.add(key);counts[row['status']]+=1
 for id in row['evidence']:assert tuple(sorted((evidence[id]['a'],evidence[id]['b'])))==key
 if row['status']=='no_annotation':assert row['grade'] is None and not row['evidence']
assert seen=={tuple(sorted(pair)) for pair in itertools.combinations(names,2)}
s=json.loads((p/'summary.json').read_text());assert dict(counts)==s['pair_status_counts']
r=json.loads((p/'ranking.json').read_text());profiles=r['meta']+r['nonmeta'];index={x['word']:x for x in profiles}
assert len(index)==s['representative_concepts']
assert set(w for x in profiles for w in x['members'])==names
for row in profiles:
 assert row['direct']==len(set(row['direct_partners']))
 assert row['context_only']==len(set(row['context_only_partners']))
 assert not set(row['direct_partners'])&set(row['context_only_partners'])
 for other in row['direct_partners']:assert row['word'] in index[other]['direct_partners']
 for other in row['context_only_partners']:assert row['word'] in index[other]['context_only_partners']
 assert row['direct_without_meta_or_expressions']<=row['direct_without_meta']<=row['direct']
print(f'OK: {len(names)} words, {len(seen)} unique pairs, {len(ev)} evidence records; symmetric counts and nonnegative statuses checked.')
