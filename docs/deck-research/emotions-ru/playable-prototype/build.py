"""Reproducible editorial graph selection; not empirical validation."""
import json, math, itertools
from pathlib import Path
P=Path(__file__).resolve().parent; R=P.parent
read=lambda p:json.loads(p.read_text())
def save(name,data): (P/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
s=read(P/'selection.json'); centers=s['centers']; words=read(R/'words.json')['words']
alias={w['word']:w['word'] for w in words}
for cluster in read(R/'pair-audit/alias-clusters.json'):
 for w in cluster['members']:alias[w]=cluster['representative']
coverage={}
for fn in ['central-concepts/classification.json','central-concepts-v2/classification.json']:
 for r in read(R/fn):
  if r['center'] in centers and r.get('score',r.get('grade'))==2:
   coverage.setdefault(r['representative'],{})[r['center']]=r['explanation']
candidates=set(coverage)-set(centers)
evidence={}
def add(a,b,grade,kind,explanation,eid):
 a,b=alias.get(a,a),alias.get(b,b)
 if a==b or a not in candidates or b not in candidates or kind.startswith('близк'):return
 evidence.setdefault(tuple(sorted((a,b))),[]).append(dict(id=eid,grade=grade,type=kind,explanation=explanation))
for e in read(R/'pair-audit/evidence.json'):
 if e['countable']:add(e['a'],e['b'],e['grade'],e['relation'],e['explanation'],e['id'])
for i,(a,b,g,t,e) in enumerate(s['pairs_added'],1):add(a,b,g,t,e,f'P{i:03}')
direct={p for p,es in evidence.items() if max(e['grade'] for e in es)==2}
context=set(evidence)-direct
G={w:set() for w in candidates}
for a,b in direct:G[a].add(b);G[b].add(a)
def core(nodes):
 nodes=set(nodes)
 while True:
  drop={w for w in nodes if len(G[w]&nodes)<2}
  if not drop:return nodes
  nodes-=drop
def components(nodes,edges):
 adj={w:set() for w in nodes}
 for a,b in edges:
  if a in nodes and b in nodes:adj[a].add(b);adj[b].add(a)
 unseen=set(nodes);out=[]
 while unseen:
  stack=[min(unseen)];unseen.remove(stack[0]);part=[]
  while stack:
   w=stack.pop();part.append(w);n=adj[w]&unseen;unseen-=n;stack.extend(sorted(n))
  out.append(sorted(part))
 return sorted(out,key=lambda a:(-len(a),a))
def metrics(nodes):
 n=len(nodes);deg=[len(G[w]&nodes) for w in nodes]
 cov={c:sum(c in coverage[w] for w in nodes) for c in centers}
 return dict(cards=n,direct_pairs=sum(deg)//2,min_partners=min(deg),mean_partners=sum(deg)/n,centers={c:dict(partners=k,no_match_in_hand=math.comb(n-k,5)/math.comb(n,5) if n-k>=5 else 0) for c,k in cov.items()},direct_components=components(nodes,direct),components_with_context=components(nodes,evidence))
selected=core(candidates);m=metrics(selected)
cards=[dict(word=w,center_links=coverage[w],direct_partners=sorted(G[w]&selected),context_partners=sorted({b if a==w else a for a,b in context if w in (a,b) and a in selected and b in selected})) for w in sorted(selected)]
save('prototype.json',dict(status='Экспертный рабочий состав; не проверенная игровая колода',candidate_count=len(candidates),metrics=m,cards=cards))
save('pairs.json',[dict(a=a,b=b,evidence=es) for (a,b),es in sorted(evidence.items()) if a in selected and b in selected])
save('pair-inventory.json',[dict(a=a,b=b,status='direct' if (a,b) in direct else 'context' if (a,b) in context else 'unannotated') for a,b in itertools.combinations(sorted(selected),2)])
# Size comparison is a deterministic greedy diagnostic, not a global optimum.
trajectory=[dict(words=sorted(selected),metrics=m)];nodes=selected.copy()
while len(nodes)>20:
 options=[]
 for w in sorted(nodes):
  nxt=core(nodes-{w})
  if len(nxt)<20:continue
  mm=metrics(nxt)
  if any(v['partners']==0 for v in mm['centers'].values()):continue
  options.append((max(v['no_match_in_hand'] for v in mm['centers'].values()),-mm['mean_partners'],-len(nxt),sorted(nxt),mm))
 if not options:break
 best=min(options,key=lambda a:a[:4]);nodes=set(best[3]);trajectory.append(dict(words=best[3],metrics=best[4]))
save('size-comparison.json',trajectory)
lines=['# Карты и пары','', 'Это перечень размеченных гипотез, а не доказательство отсутствия остальных связей. Повторные аннотации одной пары считаются один раз.','', '| Карта | Центров | Партнёров внутри состава |','|---|---:|---:|']
for c in cards:lines.append(f"| {c['word']} | {len(c['center_links'])} | {len(c['direct_partners'])} |")
for c in cards:
 w=c['word'];lines+=['',f'## {w}','', 'Центры: '+', '.join(c['center_links'])+'.','']
 for v in c['direct_partners']:
  es=[e for e in evidence[tuple(sorted((w,v)))] if e['grade']==2]
  lines.append(f"- **{v}**: "+' / '.join(f"{e['explanation']} [{e['id']}]" for e in es))
 if c['context_partners']:lines+=['','Только с контекстом: '+', '.join(c['context_partners'])+'.']
(P/'cards-and-pairs.md').write_text('\n'.join(lines)+'\n')
lines=['# Все кандидаты','', 'Исключение означает недостаток текущей разметки или выбранного критерия, а не невозможность связать слово.','', '| Слово | Прямые центры | Партнёры в исходном пуле | Партнёры в составе | Статус |','|---|---|---:|---:|---|']
for w in sorted(set(alias.values())-set(centers)):
 lines.append(f"| {w} | {', '.join(coverage.get(w,{})) or 'не размечены'} | {len(G.get(w,set()))} | {len(G.get(w,set())&selected)} | {'в составе' if w in selected else 'вне устойчивой группы с ≥2 партнёрами' if w in candidates else 'нет прямого покрытия центра'} |")
(P/'candidates.md').write_text('\n'.join(lines)+'\n')
assert all(len(c['direct_partners'])>=2 for c in cards)
assert sum(len(c['direct_partners']) for c in cards)==2*m['direct_pairs']
assert len(read(P/'pair-inventory.json'))==math.comb(len(selected),2)
assert all(w in G[v] for w in G for v in G[w])
print(json.dumps(dict(candidate_count=len(candidates),metrics=m,comparison=[dict(n=x['metrics']['cards'],worst_no_match=max(v['no_match_in_hand'] for v in x['metrics']['centers'].values())) for x in trajectory]),ensure_ascii=False,indent=2))
