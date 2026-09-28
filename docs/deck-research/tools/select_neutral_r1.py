from pathlib import Path
from itertools import combinations
from statistics import mean
from collections import defaultdict
import json
from simulate_prototype60 import graph,chance,components
ROOT=Path(__file__).resolve().parents[1]

def evaluate(data,g,neutral):
 neutral=set(neutral);playing=set(g)-neutral;pg={w:g[w]&playing for w in playing}
 counts={w:len(g[w]&playing) for w in sorted(neutral)}
 return dict(neutral=sorted(neutral),playing=sorted(playing),partners=counts,
  minimum_partners=min(counts.values()),cross_edges=sum(counts.values()),
  remaining_pairs=sum(map(len,pg.values()))//2,components=components(pg),
  min_playing_degree=min(map(len,pg.values())),
  starting_chance={w:chance(len(playing),k) for w,k in counts.items()},
  mean_start=mean(chance(len(playing),k) for k in counts.values()))

def main():
 sets={n:json.loads((ROOT/f'prototype{n}.json').read_text()) for n in [48,40]}
 graphs={n:graph(d,'main') for n,d in sets.items()}
 rankings={n:sorted(g,key=lambda w:(-len(g[w]),w)) for n,g in graphs.items()}
 simple={}
 for n in sets:
  for k in [8,10]:simple[f'{n}-{k}']=evaluate(sets[n],graphs[n],rankings[n][:k])
 g=graphs[48];boundary=len(g[rankings[48][9]])
 candidates=[w for w in rankings[48] if len(g[w])>=boundary]
 checked=[evaluate(sets[48],g,s) for s in combinations(candidates,8)]
 connected=[r for r in checked if len(r['components'])==1]
 best=sorted(connected,key=lambda r:(-r['minimum_partners'],-r['cross_edges'],-r['remaining_pairs'],r['neutral']))[0]
 result=dict(status='research_split_not_runtime_change',basis='основные отношения R1',
  ranking={n:{w:len(graphs[n][w]) for w in rankings[n]} for n in sets},
  naive_splits=simple,search=dict(candidates=candidates,checked=len(checked),connected=len(connected),
   priorities=['связная игровая колода','максимум минимального числа игровых партнёров нейтральной карты','максимум связей нейтральные—игровые','максимум оставшихся игровых пар']),
  proposal=best)
 (ROOT/'neutral-r1.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 out=['# Нейтральные карты: варианты разделения R1','','Считаются уникальные соседние понятия по основным объяснениям, а не число типов или число направлений. Исходные наборы 48 и 40 — исследовательские прототипы; приложение не изменено.','','## Лидеры внутри исходных составов','','Ниже все слова с числом соседей не ниже десятого места соответствующего списка. При равенстве степени порядок по алфавиту — только для воспроизводимости, не оценка качества слова.','','| Слово | В составе 48 | В составе 40 |','|---|---:|---:|']
 top=set()
 for n,g0 in graphs.items():
  cutoff=len(g0[rankings[n][9]])
  top.update(w for w in g0 if len(g0[w])>=cutoff)
 for w in sorted(top,key=lambda w:(-len(graphs[48].get(w,set())),-len(graphs[40].get(w,set())),w)):
  out.append(f'| {w} | {len(graphs[48][w]) if w in graphs[48] else "—"} | {len(graphs[40][w]) if w in graphs[40] else "—"} |')
 out+=['','## Если просто забрать первые строки рейтинга','','| Исходный набор | Нейтральных | Игровых | Минимум игровых партнёров у нейтральной | Средний шанс первого хода | Игровых пар осталось |','|---:|---:|---:|---:|---:|---:|']
 for key,r in simple.items():
  n,k=key.split('-');out.append(f'| {n} | {k} | {len(r["playing"])} | {r["minimum_partners"]} | {100*r["mean_start"]:.1f}% | {r["remaining_pairs"]} |')
 out+=['','## Предложение: 8 нейтральных + 40 игровых из набора 48','',
  f'Проверено {len(checked)} наборов по 8 карт из {len(candidates)} лидеров исходного рейтинга. Связность игрового остатка сохранилась в {len(connected)} наборах. Это ограниченный поиск, не оптимизация по всем сочетаниям из 48.', '',
  'Из связных вариантов сначала максимизировано худшее число игровых партнёров у нейтральной карты, затем общее число связей нейтральные—игровые, затем сохранённые игровые пары. Эти предпочтения выбраны для сравнения, а не утверждены как обязательные критерии игры. Понятность слов не измерена.', '',
  '| Нейтральное слово | Соседей до переноса | Партнёров среди оставшихся 40 | Шанс хода из руки 5 |','|---|---:|---:|---:|']
 for w in sorted(best['neutral'],key=lambda w:(-best['partners'][w],w)):
  out.append(f'| {w} | {len(g[w])} | {best["partners"][w]} | {100*best["starting_chance"][w]:.1f}% |')
 out+=['',f'Средний шанс старта при равновероятном выборе одной из восьми нейтральных карт: **{100*best["mean_start"]:.1f}%**. Все 40 игровых понятий связаны в один компонент; игровых пар осталось **{best["remaining_pairs"]}** из 123 первоначального набора 48. Минимальная степень игровой карты — **{best["min_playing_degree"]}**.', '',
  'Удаление сильных слов повышает стартовую доступность нейтральной карты, но забирает связи из основной колоды. Восемь нейтральных слов не выкладываются одновременно: выбран только один центр. Поэтому остальные семь уже не помогут во время партии. Стартовые вероятности не доказывают устойчивость середины и конца игры; новую симуляцию разделённых колод здесь не проводили.', '',
  'Это новый состав из 40 игровых карт, не прежний prototype40: он получен другим способом из prototype48.', '',
  'Формула: P = 1 − C(40 − K, 5) / C(40, 5). Нейтральное слово удалено из личной колоды, рука случайна, все четыре стороны центра свободны; все основные объяснения условно принимаются. Вероятность для первого игрока; последующие ходы зависят от поля.', '',
  '«Длительность» остаётся самым сильным центром, но её понятность для младших игроков не проверена. Если это слово исключать по понятности, разделение нужно пересчитать, а не заменить его без проверки.', '',
  '## Состав игровой колоды после переноса','',', '.join(best['playing'])+'.','']
 (ROOT/'neutral-r1.md').write_text('\n'.join(out))
 assert len(best['neutral'])==8 and len(best['playing'])==40 and not set(best['neutral'])&set(best['playing'])
 assert best['minimum_partners']==min(best['partners'].values())
 print(json.dumps(best,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
