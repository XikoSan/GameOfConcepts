"""Build a complete pair inventory from explicit expert hypotheses.
An unannotated pair is NOT a negative judgment or an independently reviewed pair.
Run from any directory: python .../pair-audit/build.py
"""
from pathlib import Path
import json,itertools,collections,hashlib
from annotations import ALIASES,META,GROUPS,CONTRASTS,CONTRAST_EXCLUDED,EXPRESSIONS,OBJECTS,CONTEXT,EXTRA
HERE=Path(__file__).resolve().parent
source=HERE.parent/'words.json'
words=json.loads(source.read_text())['words'];byword={w['word']:w for w in words};names=list(byword)
canon={w:w for w in names};aliases=[]
for representative,others,note in ALIASES:
 cluster=[representative,*others.split(', ')]
 assert all(w in byword for w in cluster)
 assert len({canon[w] for w in cluster})==len(cluster)
 for w in cluster:canon[w]=representative
 aliases.append({'representative':representative,'members':cluster,'fixed_sense':note})
meta=set(META);records=[];excluded=[]
def add(a,b,relation,explanation,grade,source_type):
 if a not in byword or b not in byword:
  excluded.append({'a':a,'b':b,'reason':'outside_original_310','source':source_type});return
 assert grade in (1,2)
 assert a!=b
 synonym_candidate=relation.startswith('близк') or relation=='образ переживания'
 records.append({'id':f'R{len(records)+1:04}', 'a':a,'b':b,'relation':relation,'explanation':explanation,'grade':grade,
  'source':'авторская смысловая гипотеза','annotation_mode':source_type,
  'countable':not synonym_candidate and canon[a]!=canon[b],
  'synonym_candidate':synonym_candidate})
for a,t,bs,e,g in GROUPS:
 for b in bs.split(', '):add(a,b,t,e.format(a=a,b=b),g,'explicit_enumerated_group')
for line in CONTRASTS.splitlines():
 if line in CONTRAST_EXCLUDED:
  excluded.append({'pair':line,'reason':'not_a_lexical_opposite_in_fixed_sense'});continue
 a,b=line.split('|');add(a,b,'противопоставление',f'«{a}» и «{b}» противопоставляются по выбранному признаку; одновременность смешанных чувств не исключена.',2,'explicit_pair')
for a,bs in EXPRESSIONS.items():
 for b in bs.split(', '):add(a,b,'выражение',f'«{b}» — обычный способ выражения «{a}». Это не означает, что по проявлению можно однозначно узнать чувство.',2,'explicit_enumerated_group')
for a,b,e in OBJECTS:add(a,b,'объект переживания',e,1 if a=='недоумение' else 2,'explicit_pair')
for a,(bs,e) in CONTEXT.items():
 for b in bs.split(', '):add(a,b,'контекстное отношение',f'«{a}» ↔ «{b}»: {e}',1,'explicit_enumerated_group')
for a,b,t,e,g in EXTRA:add(a,b,t,e,g,'explicit_pair')
# Taxonomic classification and ordinary expressions are editorial claims, not proof.
# No same-valence / same-family clique or transitive closure is constructed.
raw_pairs=collections.defaultdict(list)
for r in records:raw_pairs[tuple(sorted([r['a'],r['b']]))].append(r)
concept_pairs=collections.defaultdict(list)
for r in records:
 if r['countable']:
  a,b=canon[r['a']],canon[r['b']]
  concept_pairs[tuple(sorted([a,b]))].append(r)
concepts=list(dict.fromkeys(canon.values()))
members={c:[w for w in names if canon[w]==c] for c in concepts}

def profile(c):
 direct={};context={};strict={};allr=[]
 for (a,b),rs in concept_pairs.items():
  if c not in (a,b):continue
  other=b if c==a else a
  highest=max(r['grade'] for r in rs)
  (direct if highest==2 else context)[other]=[r for r in rs if r['grade']==highest]
  if any(r['grade']==2 and r['relation'] not in ['выражение','проявление'] for r in rs):strict[other]=True
  allr+=rs
 nonmeta={w:rs for w,rs in direct.items() if w not in meta}
 noncontext={w:rs for w,rs in context.items() if w not in meta}
 return {'word':c,'members':members[c],'layer':byword[c]['layer'],'family':byword[c]['family'],
 'direct':len(direct),'direct_without_meta':len(nonmeta),'direct_without_meta_or_expressions':sum(w not in meta for w in strict),
 'context_only':len(context),'context_without_meta':len(noncontext),
 'types_without_meta':len({r['relation'] for rs in nonmeta.values() for r in rs}),
 'families_without_meta':len({byword[w]['family'] for w in nonmeta}),
 'direct_partners':sorted(direct),'context_only_partners':sorted(context),
 'evidence_ids':sorted({r['id'] for r in allr}),
 'scope':'relations of this fixed-sense cluster are pooled; not independently verified for every synonym'}
profiles=[profile(c) for c in concepts]
ranked=sorted(profiles,key=lambda p:(-p['direct_without_meta'],p['word']))
normal=[p for p in ranked if p['word'] not in meta]
meta_profiles=sorted([p for p in profiles if p['word'] in meta],key=lambda p:-p['direct'])
# Emit all original unordered pairs. Unannotated stays null, not negative.
counts=collections.Counter()
with (HERE/'all-pairs.jsonl').open('w') as f:
 for a,b in itertools.combinations(names,2):
  rs=raw_pairs.get(tuple(sorted([a,b])),[])
  if canon[a]==canon[b]: status='duplicate_cluster';grade=None
  elif any(r['countable'] and r['grade']==2 for r in rs): status='direct_hypothesis';grade=2
  elif any(r['countable'] and r['grade']==1 for r in rs): status='context_hypothesis';grade=1
  elif rs:status='near_meaning_not_counted';grade=None
  else:status='no_annotation';grade=None
  counts[status]+=1
  f.write(json.dumps({'a':a,'b':b,'status':status,'grade':grade,'evidence':[r['id'] for r in rs]},ensure_ascii=False)+'\n')
write=lambda filename,obj:(HERE/filename).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
write('evidence.json',records);write('alias-clusters.json',aliases);write('excluded.json',excluded)
write('ranking.json',{'meta':meta_profiles,'nonmeta':normal,'note':'Rank by nonmeta direct cluster neighbors. Ties are alphabetical, not quality differences.'})
summary={'source_words':len(words),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'unordered_pairs':sum(counts.values()),
 'pair_status_counts':dict(counts),'semantic_annotations':len(records),'representative_concepts':len(concepts),'alias_clusters':len(aliases),
 'countable_concept_pairs':len(concept_pairs),'unannotated_is_not_negative':True,
 'coverage_note':'Every pair is inventoried, but only explicit positive/synonym annotations were semantically reviewed. No claim of 47,895 independent expert judgments.'}
write('summary.json',summary)
assert sum(counts.values())==47895
assert all(p['direct_without_meta']<=p['direct'] for p in profiles)
assert all(set(p['direct_partners']).isdisjoint(p['context_only_partners']) for p in profiles)
assert all(p['word'] not in p['direct_partners'] for p in profiles)
# Full original-word table links each word to its editorial representative.
lookup={p['word']:p for p in profiles}
lines=['# Все 310 слов: предварительные показатели','','Счётчики относятся к смысловому кластеру, а не независимой проверке каждого синонима. «Без общих» исключает партнёров эмоция / чувство / переживание / настроение / ощущение. Нули означают отсутствие аннотаций в этом проходе.','','| Слово | Представитель | Прямые | Без общих | Контекстные | Типов без общих | Групп без общих |','|---|---|---:|---:|---:|---:|---:|']
for w in names:
 p=lookup[canon[w]];lines.append(f'| {w} | {canon[w]} | {p["direct"]} | {p["direct_without_meta"]} | {p["context_only"]} | {p["types_without_meta"]} | {p["families_without_meta"]} |')
(HERE/'all-words.md').write_text('\n'.join(lines)+'\n')
# Human-readable evidence per concept, including weak ones; each edge keeps its own explanation.
lines=['# Объяснения по понятиям','','Цифры в рейтинге соответствуют уникальным партнёрам-кластерам, не числу объяснений. Полный синонимический состав — alias-clusters.json.']
for p in ranked:
 c=p['word'];lines+=['',f'## {c}',f'Состав: {", ".join(p["members"])}. Прямых: {p["direct"]}; без общих терминов: {p["direct_without_meta"]}; контекстных: {p["context_only"]}.','']
 for other in p['direct_partners']+p['context_only_partners']:
  rs=concept_pairs[tuple(sorted([c,other]))];score=max(r['grade'] for r in rs)
  for r in rs:
   lines.append(f'- **{other}** · уровень {r["grade"]} · {r["relation"]} · `{r["id"]}`: {r["explanation"]}')
 if not p['direct_partners'] and not p['context_only_partners']:lines.append('Связи в этом проходе не размечены. Не считать слово изолированным без дополнительной проверки.')
(HERE/'partners.md').write_text('\n'.join(lines)+'\n')
print(json.dumps(summary,ensure_ascii=False,indent=2))
print('TOP NONMETA')
for p in normal[:25]:print(p['word'],p['direct'],p['direct_without_meta'],p['context_only'],p['direct_without_meta_or_expressions'])
print('NO ANNOTATIONS', [p['word'] for p in profiles if not p['direct'] and not p['context_only']])
