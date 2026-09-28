"""Reproducible author-annotated research; never updates runtime deck data."""
from pathlib import Path
from collections import Counter
from itertools import combinations
from math import comb
import json, random, re
ROOT = Path(__file__).resolve().parents[1]
HERE = ROOT / 'medium'
REPO = ROOT.parents[1]
source = (REPO/'src/data/cardCatalog.ts').read_text().split('export const START_CARD_CATALOG')[0]
original = dict((name, ident) for ident, name in re.findall(r"\{ id: '([^']+)', name: '([^']+)', difficulty: 'medium', enabled: true \}", source))
cards = []
for i, line in enumerate((HERE/'cards.txt').read_text().splitlines()):
    word, meaning, themes = line.split('|')
    cards.append(dict(id=original.get(word, f'medium-r1-{i+1:02}'), word=word, meaning=meaning, themes=themes.split(';'), origin='existing-medium' if word in original else 'assistant-candidate', wikipedia_summary_status='not-checked'))
words = [c['word'] for c in cards]
assert len(words)==len(set(words))==56 and set(original)<=set(words)
relations = []
for i, line in enumerate((HERE/'relations.txt').read_text().splitlines(), 1):
    if not line or line.startswith('#'): continue
    a, kind, b, status, explanation = line.split('|')
    assert a in words and b in words and a!=b
    assert status in ('main','conditional','rejected') and explanation
    relations.append(dict(id=f'M01-{i:03}', source=a, target=b, type=kind, status=status, explanation=explanation, evidence='assistant-annotation; no player validation'))
assert len({(r['source'],r['type'],r['target']) for r in relations})==len(relations)
profiles = {
 'Текущие 5': ['Вид','Часть','Свойство','Причина','Противоположность'],
 'Аналог простой 6': ['Вид','Свойство','Причина','Противоположность','Помогает','Регулирует'],
 'Средняя 6': ['Вид','Часть','Свойство','Причина','Помогает','Регулирует'],
 'Расширенные 7': ['Вид','Часть','Свойство','Причина','Противоположность','Помогает','Регулирует']}

def graph(vs, types, conditional=False):
    g={w:set() for w in vs}
    for r in relations:
        a,b=r['source'],r['target']
        if a in g and b in g and r['type'] in types and (r['status']=='main' or conditional and r['status']=='conditional'):
            g[a].add(b);g[b].add(a)
    return g

def core(g):
    g={w:set(v) for w,v in g.items()};rounds=[]
    while bad:=sorted(w for w in g if len(g[w])<2):
        rounds.append(bad)
        g={w:ns-set(bad) for w,ns in g.items() if w not in bad}
    return g,rounds

def connected(g):
    if not g:return False
    seen=set();queue=[next(iter(g))]
    while queue:
        w=queue.pop()
        if w in seen:continue
        seen.add(w);queue.extend(g[w]-seen)
    return len(seen)==len(g)

def p(m,k,h=5):
    h=min(m,h)
    return 1-(comb(m-k,h) if m-k>=h else 0)/comb(m,h)

def stats(g):
    return dict(cards=len(g),pairs=sum(map(len,g.values()))//2,below2=sum(len(v)<2 for v in g.values()),minimum=min(map(len,g.values()),default=0),core=len(core(g)[0]))

comparison=[]
for pool,label in [(list(original),'Исходные 40'),(words,'Кандидаты 56')]:
    for name,types in profiles.items():
        g=graph(pool,types)
        comparison.append(dict(pool=label,profile=name,**stats(g),conditional_pairs=stats(graph(pool,types,True))['pairs']))
selected_types=profiles['Средняя 6']
g,removed=core(graph(words,selected_types))
print('CORE',len(g),'REMOVED',removed,flush=True)
# Search, not proof of optimality. Sorted inputs make seeded sampling repeatable.
rng=random.Random(28092026)
candidates=sorted(w for w in g if len(g[w])>=4)
search_results=[]
for neutral_count in (6,8):
    best=None;valid=0;attempts=60000
    for _ in range(attempts):
        neutral=set(rng.sample(candidates,neutral_count));play=set(g)-neutral
        pg={w:g[w]&play for w in sorted(play)}
        if min(map(len,pg.values()))<2 or not connected(pg):continue
        counts=[len(g[w]&play) for w in sorted(neutral)]
        if min(counts)<3:continue
        valid+=1
        objective=(min(counts),sum(p(len(play),k) for k in counts)/neutral_count,sum(map(len,pg.values())))
        if best is None or objective>best[0]:best=(objective,sorted(neutral),pg)
    assert best, 'No split found; do not fabricate an eligible split'
    search_results.append(dict(neutral_count=neutral_count,valid_samples=valid,attempts=attempts,minimum_neutral=best[0][0],mean_start=best[0][1],neutral=best[1],playing=sorted(best[2]),playing_pairs=stats(best[2])['pairs']))
# Prefer a 40-card personal deck without padding the candidate pool.
chosen=search_results[0]
neutral=chosen['neutral'];play=chosen['playing'];valid=chosen['valid_samples']
pg={w:g[w]&set(play) for w in play}
assert len(play)==40 and len(neutral)==6 and set(neutral).isdisjoint(play)
assert min(map(len,pg.values()))>=2
neutral_stats=[dict(word=w,neighbors=len(g[w]&set(play)),partners=sorted(g[w]&set(play)),probability=p(len(play),len(g[w]&set(play)))) for w in neutral]
# Matched field samples for main and conditional sensitivity. Uniform toy geometry-free fields.
scenario=[]
for b in (1,5,10,20):
    fields=[(n,[]) for n in neutral] if b==1 else [(rng.choice(neutral),rng.sample(play,b-1)) for _ in range(10000)]
    scores={False:[],True:[]}
    for n,field in fields:
        own=set(field[:len(field)//2]);pool=set(play)-own
        for conditional in scores:
            gg=graph(play+neutral,selected_types,conditional)
            partners=set().union(*(gg[w] for w in [n]+field)) & pool
            scores[conditional].append(p(len(pool),len(partners)))
    item=dict(field=b,own_cards=(b-1)//2,hand_pool=len(play)-(b-1)//2,samples=len(fields))
    for conditional,vals in scores.items():
        vals.sort();prefix='main_plus_conditional' if conditional else 'main'
        item[prefix]=dict(mean=sum(vals)/len(vals),p10=vals[int(.1*(len(vals)-1))],p90=vals[int(.9*(len(vals)-1))])
    scenario.append(item)

covered={tuple(sorted((r['source'],r['target']))) for r in relations}
coverage=[dict(a=a,b=b,status='has-annotation' if (a,b) in covered else 'not-reviewed',relation_ids=[r['id'] for r in relations if {r['source'],r['target']}=={a,b}]) for a,b in combinations(sorted(words),2)]
assert len(coverage)==comb(len(words),2)
result=dict(status='research-only; not integrated; no players or Wikipedia checks',profiles=profiles,cards=cards,relations=relations,pair_coverage=coverage,comparison=comparison,selected_types=selected_types,removal_rounds=removed,neutral=neutral_stats,playing=play,search=dict(seed=28092026,variants=search_results,optimality_proved=False),scenarios=scenario)
(HERE/'audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
report='''# Средняя колода M02: состав для обсуждения

Исследовательский прототип, 28 сентября 2026. Игра не изменена.

## Основания и ограничения

Использованы исходные 40 карт средней колоды, протокол отбора и метод подсчёта простой колоды. В сохранённых материалах не найдено отдельного исследования, доказывающего оптимальность именно общественной тематики. Дополнительные 16 слов — предложения ассистента, а не результат опроса. Выбранные значения и тематические метки также авторские; две метки не доказывают две независимые категории. Возраст и понимание игроками не установлены; реальные сводки Википедии не проверены.

Основная связь — короткое объяснение при зафиксированном значении в обычном контексте, не универсальный закон и не подтверждённое голосование. Условная требует дополнительного согласования. Отклонённая относится к указанному объяснению, а не к запрету любой связи этой пары.

'''
report+=f'Размечено {len(relations)} объяснений для {len(covered)} из {comb(len(words),2)} пар 56 кандидатов. Остальные пары помечены «не проверены», а не «невозможны». Поэтому сравнение отражает только этот граф и не является доказательством оптимальности типов или состава.\n\n'
report+='## Сравнение типов на одном наборе\n\nДля сопоставления названий «Характеристика» нормализована в Свойство, «Разновидность» в Вид, «Вызывает» в Причина, «Противопоставление» в Противоположность. Это сравнение совместимости пар, а не перенос направления стрелок между игровыми правилами.\n\n| Состав | Типы | Основные пары | Основные + условные | Карт с <2 партнёрами | Остаток после удаления <2 |\n|---|---|---:|---:|---:|---:|\n'
for r in comparison:report+=f"| {r['pool']} | {r['profile']} | {r['pairs']} | {r['conditional_pairs']} | {r['below2']} | {r['core']} |\n"
report+='\nПредлагаемые шесть: **Вид, Часть, Свойство, Причина, Помогает, Регулирует**. Противоположность не включена в этот прототип: её единственная основная пара в разметке — Согласие/Отказ; её наличие само по себе не делает колоду лучше. Это решение по ограниченной разметке, а не утверждение, что других противоположностей нет. Дополнительный тип «Используется для» пока не вводится: сначала проверяется более компактный набор.\n\n'
report+='## Выбор состава\n\nИзвестный граф очищен от слов с менее чем двумя основными партнёрами до устойчивости. Это кандидаты на доработку, а не доказанно плохие слова.\n\n'
for i,group in enumerate(removed,1):report+=f"- Итерация {i}: {', '.join(group)}.\n"
report+=f'\nОсталось {len(g)} карт; из них выбраны {len(neutral)} нейтральных и {len(play)} игровых. Перебрано {attempts:,} случайных наборов с фиксированным seed, допустимых выборок — {valid:,}; глобальная оптимальность не доказана. Сначала максимизируется минимум игровых партнёров нейтральной карты, затем средний шанс старта, затем число игровых рёбер. Числа являются рабочим способом сравнения, не пользовательскими порогами.\n\n'
report+=f'В игровом составе {stats(pg)["pairs"]} основных пар; минимум {min(map(len,pg.values()))}, максимум {max(map(len,pg.values()))} партнёров. Граф связен. Минимум двух проверен после изъятия нейтральных и без условных объяснений.\n\n'
report+='### Сравнение разделений\n\n| Нейтральных | Игровых | Минимум партнёров старта | Средний шанс старта | Игровых пар |\n|---:|---:|---:|---:|---:|\n'
for v in search_results:report+=f"| {v['neutral_count']} | {len(v['playing'])} | {v['minimum_neutral']} | {v['mean_start']:.1%} | {v['playing_pairs']} |\n"
report+='\nВыбран вариант 40 + 6: он сохраняет привычный размер личной колоды без добавления слов ради круглого числа. Вариант 38 + 8 оставлен для сравнения; число нейтральных не обязано совпадать с простой колодой.\n\n'
report+='### Нейтральные\n\n| Слово | Игровых партнёров | Шанс из руки 5 | Партнёры |\n|---|---:|---:|---|\n'
for n in neutral_stats:report+=f"| {n['word']} | {n['neighbors']} | {n['probability']:.1%} | {', '.join(n['partners'])} |\n"
report+='\n### Игровые карты\n\n| Слово | Значение | Партнёров | Типов | Основные партнёры |\n|---|---|---:|---:|---|\n'
for w in play:
    c=next(c for c in cards if c['word']==w)
    types={r['type'] for r in relations if r['status']=='main' and r['type'] in selected_types and r['source'] in pg and r['target'] in pg and w in (r['source'],r['target'])}
    report+=f"| {w} | {c['meaning']} | {len(pg[w])} | {len(types)} | {', '.join(sorted(pg[w]))} |\n"
report+='\n### Пары по типам внутри игровых карт\n\nПара с несколькими типами учитывается в каждой соответствующей строке, но только один раз в общем числе соседей. Равномерность не требуется.\n\n| Тип | Основных пар |\n|---|---:|\n'
for t in selected_types:
    pairs={tuple(sorted((r['source'],r['target']))) for r in relations if r['status']=='main' and r['type']==t and r['source'] in pg and r['target'] in pg}
    report+=f'| {t} | {len(pairs)} |\n'
report+='''
## Вероятности: диагностическая модель

P = 1 − C(M−K,5)/C(M,5), где M — доступный пул личной колоды, K — разные слова этого пула, совместимые хотя бы с одной доступной картой поля. Одинаковое слово само с собой не соединяется.

Поле состоит из одной равномерно выбранной нейтральной и b−1 разных игровых карт, случайно выбранных без повторений. Половина этих игровых карт условно выложена самим игроком и исключена из его личного пула, остальные — соперником. Рука равномерная из остатка личного набора. Это упрощение игры на двоих: нет дублей на поле, стратегии, пересдачи, голосования и геометрии свободных клеток. Все карты поля условно доступны. Эти проценты НЕ прогноз реального хода и не обоснование удаления слов. Игровая связность означает только возможность хотя бы одного принятого объяснения, не бонус пути/узла.

Для старта перебраны все выбранные центры; для прочих размеров — 10 000 полей с фиксированным seed. 10–90% — разброс условных вероятностей между полями, не доверительный интервал. Условные связи сравниваются на тех же полях.

| Размер поля | M | Средняя, основные | 10–90% по полям | С условными |
|---:|---:|---:|---|---:|
'''
for r in scenario:report+=f"| {r['field']} | {r['hand_pool']} | {r['main']['mean']:.1%} | {r['main']['p10']:.1%}–{r['main']['p90']:.1%} | {r['main_plus_conditional']['mean']:.1%} |\n"
report+='''
## Чего ещё не доказывает результат

- Связность двух партнёров не гарантирует понятность слова и наличие хода в конкретной партии.
- Слова с одним типом не исключены автоматически. Старые ограничения «2–4 типа» и «две категории» нельзя объявить выполненными: сейчас проверяется согласованный минимум двух разных партнёров.
- Перед интеграцией нужны проверка спорных основных объяснений и фактических игровых сводок. Это версия для обсуждения, не утверждённая замена средней колоды.
- Возможность улучшения другими словами и неразмеченными парами остаётся открытой. Изменение нейтрального набора требует повторного подсчёта игрового минимума.

## Воспроизведение и данные

`python3 docs/deck-research/tools/audit_medium.py`

- `cards.txt`: все 56 кандидатов и выбранные значения.
- `relations.txt`: все объяснения, направления и статусы.
- `audit.json`: данные, покрытие всех пар со статусом непроверенных, сравнение и результаты поиска.
- `review.md`: причины отложения и спорные места.
'''
(HERE/'report.md').write_text(report)
print('NEUTRAL',[(n['word'],n['neighbors']) for n in neutral_stats],flush=True)
print('PLAY',len(play),stats(pg),flush=True)
print('COMPARISON',comparison,flush=True)
print('SCENARIOS',scenario,flush=True)
