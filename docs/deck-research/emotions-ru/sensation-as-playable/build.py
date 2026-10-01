import json,math
from pathlib import Path
P=Path(__file__).resolve().parent;R=P.parent
read=lambda p:json.loads(p.read_text())
b=read(R/'bridge-audit/comparison.json')['replacement'];g={c['word']:set(c['partners']) for c in b['cards']}
partners=set()
for r in read(R/'central-concepts/classification.json'):
 if r['center']=='ощущение' and r['score']==2 and r['representative'] in g:partners.add(r['representative'])
g['ощущение']=partners
for w in partners:g[w].add('ощущение')
def components(excluded):
 unseen=set(g)-excluded;out=[]
 while unseen:
  root=min(unseen);unseen.remove(root);stack=[root];part=[]
  while stack:
   w=stack.pop();part.append(w);n=g[w]&unseen;unseen-=n;stack.extend(n)
  out.append(sorted(part))
 return sorted(out,key=lambda p:(-len(p),p))
def risk(n,k):return math.comb(n-k,5)/math.comb(n,5) if n-k>=5 else 0
centers={}
for c,v in b['metrics']['centers'].items():
 if c=='ощущение':continue
 k=v['k'];centers[c]=dict(known_partners=k,previous_risk=v['no_match'],risk_if_new_card_not_partner=risk(55,k),risk_if_new_card_partner=risk(55,k+1),sensation_pair_status='не проверена: прежние таблицы исключали сравнение центров друг с другом')
data=dict(status='Сценарий, не изменение игрового каталога',base='bridge-audit/comparison.json: replacement',neutral_cards=list(centers),playable_cards=sorted(g),sensation_partners=sorted(partners),direct_pairs=sum(map(len,g.values()))//2,min_partners=min(map(len,g.values())),components=components(set()),without_istoma=components({'истома'}),without_sensation_and_istoma=components({'истома','ощущение'}),centers=centers)
assert len(g)==55 and data['direct_pairs']==82 and data['min_partners']==2
assert len(data['without_istoma'])==1
assert all(w in g[v] for w in g for v in g[w])
(P/'scenario.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
lines=['# Ощущение как игральная карта','', 'Сценарий построен на варианте 54 карт с заменой всхлипа, рыдания и ликования на приподнятость, подавленность и воодушевление. Этот состав ранее был предложен, но не интегрирован.','', 'После переноса: **7 нейтральных, 55 игральных, 82 размеченные прямые пары**. До переноса: 8 нейтральных, 54 игральных, 76 пар. Минимальная степень остаётся 2.','', 'Прямые партнёры ощущения по более поздней классификации: '+', '.join(sorted(partners))+'.','', 'Без истомы остальные 54 карты теперь остаются в одной группе. Например, усталость — ощущение — напряжение — тревога. Это цепочка недиректированного графа возможных пар, НЕ утверждение о бонусном смысловом пути в игре. После удаления и ощущения, и истомы телесная группа снова отделяется.','', 'Устранён слабый старт именно с нейтральным ощущением: такой старт больше не выбирается. Это не означает, что все старты стали лёгкими. У настроения и отношения остаётся заметный риск отсутствия размеченного прямого партнёра.','', '## Остальные центры','', 'Отношения между прежними центрами не были размечены. Поэтому для новой карты не выдумывается покрытие нейтральных центров. Интервал ниже — два варианта: ощущение является либо не является прямым партнёром центра. Интервал не учитывает другие ещё не найденные пары.','', '| Центр | Старый риск | Новый риск, диапазон |','|---|---:|---:|']
for c,v in centers.items():lines.append(f"| {c} | {100*v['previous_risk']:.2f}% | {100*v['risk_if_new_card_partner']:.2f}–{100*v['risk_if_new_card_not_partner']:.2f}% |")
lines+=['', 'Формула C(N−K,5)/C(N,5): случайная рука из пяти без повторений, один центр, до пересдачи. Это риск отсутствия размеченного прямого партнёра, не эмпирическая невозможность хода.','', '## Решение','', 'Перенос полезен как рабочая гипотеза: узкое понятие занимает роль связующей карты, а не обязательного стартового центра. Смысл ощущения остаётся телесным. Следующий отдельный вопрос — какие из семи нейтральных понятий напрямую связаны с ощущением; родовая широта слова сама по себе не считается связью. Без этой разметки нельзя гарантировать, что ощущение в стартовой руке сразу пригодится.','', 'Запуск: `python docs/deck-research/emotions-ru/sensation-as-playable/build.py`. Прежние результаты и игра не изменены.']
(P/'README.md').write_text('\n'.join(lines)+'\n')
print(json.dumps({'partners':sorted(partners),'pairs':data['direct_pairs'],'without_istoma':list(map(len,data['without_istoma'])),'mood':centers['настроение'],'attitude':centers['отношение']},ensure_ascii=False))
