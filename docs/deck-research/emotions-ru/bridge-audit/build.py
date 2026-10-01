"""Compare additions without silently changing previous center senses."""
import json,math,itertools
from pathlib import Path
P=Path(__file__).resolve().parent; R=P.parent
read=lambda f:json.loads(f.read_text())
def save(f,d):(P/f).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
base=read(R/'playable-review/prototype.json');review=read(P/'review.json')
basewords={c['word'] for c in base['cards']}; centers=list(base['metrics']['centers'])
alias={w['word']:w['word'] for w in read(R/'words.json')['words']}
for c in read(R/'pair-audit/alias-clusters.json'):
 for w in c['members']:alias[w]=c['representative']
coverage={}
for fn in ['central-concepts/classification.json','central-concepts-v2/classification.json']:
 for row in read(R/fn):
  if row['center'] in centers and row.get('score',row.get('grade'))==2:coverage.setdefault(row['representative'],set()).add(row['center'])
evidence={}
def put(a,b,g,t,e,eid,replace=False):
 key=tuple(sorted((alias.get(a,a),alias.get(b,b))))
 if key[0]==key[1]:return
 if replace:evidence[key]=[]
 if g>0 and not t.startswith('близк'):evidence.setdefault(key,[]).append(dict(grade=g,type=t,explanation=e,id=eid))
for e in read(R/'pair-audit/evidence.json'):
 if e['countable']:put(e['a'],e['b'],e['grade'],e['relation'],e['explanation'],e['id'])
for i,(a,b,g,t,e) in enumerate(read(R/'playable-prototype/selection.json')['pairs_added'],1):put(a,b,g,t,e,f'P{i:03}')
for prefix,rows in [('V',read(R/'playable-review/review.json')['pair_reviews']),('B',review['pair_reviews'])]:
 for i,e in enumerate(rows,1):put(e['a'],e['b'],e['grade'],e['type'],e['explanation'],f'{prefix}{i:03}',True)
direct={k for k,v in evidence.items() if v and max(e['grade'] for e in v)==2}
def graph(nodes):
 g={w:set() for w in nodes}
 for a,b in direct:
  if a in nodes and b in nodes:g[a].add(b);g[b].add(a)
 return g
def core(nodes):
 nodes=set(nodes)
 while True:
  g=graph(nodes);drop={w for w,v in g.items() if len(v)<2}
  if not drop:return nodes
  nodes-=drop
def components(nodes):
 g=graph(nodes);unseen=set(nodes);parts=[]
 while unseen:
  start=min(unseen);unseen.remove(start);stack=[start];part=[]
  while stack:
   w=stack.pop();part.append(w);ns=g[w]&unseen;unseen-=ns;stack.extend(ns)
  parts.append(sorted(part))
 return sorted(parts,key=lambda p:(-len(p),p))
def result(nodes):
 nodes=core(nodes);g=graph(nodes);n=len(nodes)
 m=dict(n=n,pairs=sum(map(len,g.values()))//2,min_partners=min(map(len,g.values())),components=list(map(len,components(nodes))),without_istoma=list(map(len,components(nodes-{'истома'}))))
 m['centers']={c:{'k':sum(c in coverage.get(w,set()) for w in nodes)} for c in centers}
 for x in m['centers'].values():x['no_match']=math.comb(n-x['k'],5)/math.comb(n,5) if n-x['k']>=5 else 0
 assert all(w in g[v] for w in g for v in g[w])
 return dict(metrics=m,words=sorted(nodes),added=sorted(nodes-basewords),removed=sorted(basewords-nodes),cards=[dict(word=w,centers=sorted(coverage.get(w,set())),partners=sorted(g[w])) for w in sorted(nodes)])
moods=set(review['trial_groups']['настроения']);body=set(review['trial_groups']['самочувствие'])
cases={'baseline':result(basewords),'moods':result(basewords|moods),'body':result(basewords|body),'combined':result(basewords|moods|body)}
cases['replacement']=result((basewords-{'всхлип','рыдание','ликование'})|moods)
assert cases['baseline']['metrics']['n']==54 and cases['baseline']['metrics']['pairs']==78
save('comparison.json',cases)
trial=basewords|moods|body
save('reviewed-graph.json',[dict(a=a,b=b,evidence=es) for (a,b),es in sorted(evidence.items()) if a in trial and b in trial and es])
lines=['# Проверенные добавления','', 'Прежняя классификация центров сохранена. Пары — авторские гипотезы; отсутствие аннотации не является доказательством отсутствия связи.','', '| Кандидат | Прямые партнёры среди 54 + 7 кандидатов | После повторного отсева |','|---|---|---|']
g=graph(trial);final=set(cases['combined']['words'])
for w in sorted(moods|body):lines.append(f"| {w} | {', '.join(sorted(g[w])) or 'нет размеченных'} | {'включён' if w in final else 'менее двух партнёров после отсева'} |")
lines+=['','## Журнал решений','','| Пара | Оценка | Объяснение |','|---|---:|---|']
for e in review['pair_reviews']:lines.append(f"| {e['a']} — {e['b']} | {e['grade']} | {e['explanation']} |")
(P/'candidates.md').write_text('\n'.join(lines)+'\n')
for name,c in cases.items():print(name,c['metrics'],c['added'])
