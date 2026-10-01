"""Apply approved role changes while preserving unresolved semantic pairs."""
import json,math
from pathlib import Path
P=Path(__file__).resolve().parent
read=lambda f:json.loads((P/f).read_text())
def save(f,x):(P/f).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
d=read('decision.json');base=read(d['role_change_base']);neutral=d['neutral_cards']
moved=[w for w in base['neutral_cards'] if w not in neutral]
original={c['word']:c for c in base['playable_cards']}
g={w:set(c['playable_partners']) for w,c in original.items()}
for w in moved:g[w]=set()
# Previously annotated center membership becomes an internal pair after the role change.
for w,c in original.items():
 for center in moved:
  if center in c['neutral_partners']:g[w].add(center);g[center].add(w)
cards=[dict(word=w,neutral_partners=[c for c in original.get(w,{}).get('neutral_partners',[]) if c in neutral],unreviewed_neutral_pairs=neutral.copy() if w in moved else [],playable_partners=sorted(g[w])) for w in sorted(g)]
n=len(cards);coverage={}
def risk(k):return math.comb(n-k,5)/math.comb(n,5) if n-k>=5 else 0
for center in neutral:
 k=sum(center in c['neutral_partners'] for c in cards)
 unknown=sum(center in c['unreviewed_neutral_pairs'] for c in cards)
 coverage[center]=dict(direct_partners=k,unreviewed_new_pairs=unknown,no_match_known_graph=risk(k),risk_if_both_new_cards_match=risk(k+unknown))
seen=set();parts=[]
for root in sorted(g):
 if root in seen:continue
 seen.add(root);stack=[root];part=[]
 while stack:
  w=stack.pop();part.append(w);ns=g[w]-seen;seen|=ns;stack.extend(ns)
 parts.append(sorted(part))
metrics=dict(playable_count=n,neutral_count=len(neutral),direct_playable_pairs=sum(map(len,g.values()))//2,min_playable_partners=min(map(len,g.values())),components=list(map(len,parts)),center_coverage=coverage)
manifest=dict(status=d['status'],scope='Исследовательский состав; пары являются экспертными гипотезами',neutral_cards=neutral,playable_cards=cards,unreviewed_playable_pairs=[moved],metrics=metrics,provenance=[d['role_change_base'],'decision.json'])
assert n==57 and len(neutral)==5 and set(g).isdisjoint(neutral)
assert len(g['настроение'])==11 and len(g['отношение'])==13
assert metrics['direct_playable_pairs']==106 and metrics['min_playable_partners']>=2
assert all(w in g[v] for w in g for v in g[w])
assert len(parts)==1
assert len(neutral)+n==len(base['neutral_cards'])+len(base['playable_cards'])
save('deck.json',manifest)
lines=['# Рабочая колода: 5 нейтральных + 57 игральных','', '**Нейтральные:** '+', '.join(neutral)+'.','', '**Игральные:** '+', '.join(sorted(g))+'.','', 'По решению пользователя настроение и отношение перенесены из нейтральных в игральные; ощущение было перенесено ранее. Основа сохраняет ранее предложенные три замены для настроения. Всего 62 уникальных понятия; роли не пересекаются. Это исследовательский состав, не обновление приложения.','', '## Проверка переноса','', '| Карта | Прямые партнёры внутри игральной колоды |','|---|---|']
for w in d['role_changes']:lines.append(f"| {w} ({len(g[w])}) | {', '.join(sorted(g[w]))} |")
lines+=['', '**106 размеченных прямых пар**, минимум два партнёра у каждой карты; все 57 карт образуют одну компоненту связности. Было 82 внутренних пары: после переноса добавились 11 пар настроения и 13 пар отношения. Это прежде существовавшие пары с центрами, а не новые семантические открытия.','', '## Что ещё не размечено','', 'Пары двух новых игральных карт с пятью оставшимися нейтральными (10 сочетаний), а также настроение — отношение пока не проверены и не засчитаны. Это не отрицательные оценки. Пары ощущения с настроением и отношением ранее оценены как контекстные и не повышаются из-за смены роли.','', '## Покрытие старта','', '| Центр | Известных прямых партнёров | Риск без прямого партнёра по известному графу | Диапазон после проверки двух новых карт |','|---|---:|---:|---:|']
for c,v in coverage.items():lines.append(f"| {c} | {v['direct_partners']} | {100*v['no_match_known_graph']:.2f}% | {100*v['risk_if_both_new_cards_match']:.2f}–{100*v['no_match_known_graph']:.2f}% |")
lines+=['', 'C(N−K,5)/C(N,5), где N=57: случайная рука из пяти без повторений, один нейтральный центр, до пересдачи. Диапазон меняет только статус двух перенесённых карт; не учитывает иные ещё не найденные пары. Это расчёт по авторской разметке, не вероятность невозможности хода, измеренная у игроков.','', '## Воспроизводимость','', '`python docs/deck-research/emotions-ru/working-deck/build.py`. Предыдущий состав сохранён в previous-7-neutral-55-playable.json. Проверены сохранение 62 понятий, разделение ролей, симметрия соседства, число пар, минимальная степень и связность. deck.json содержит актуальный состав и все известные партнёрства.']
(P/'README.md').write_text('\n'.join(lines)+'\n')
print(json.dumps(metrics,ensure_ascii=False))
