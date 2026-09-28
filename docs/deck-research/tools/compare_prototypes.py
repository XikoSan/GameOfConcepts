from pathlib import Path
from collections import defaultdict
from statistics import mean,median
import json
from simulate_prototype60 import graph,chance,simulate,components,checks

ROOT=Path(__file__).resolve().parents[1]

def subgraph(data,k):
    adj=graph(data,'main');keep=set(adj)
    while True:
        new={w for w in keep if len(adj[w]&keep)>=k}
        if new==keep:break
        keep=new
    result = dict(status='research_variant_not_runtime_deck',selection=f'iterated_known_degree_at_least_{k}',
        cards=[dict(c) for c in data['cards'] if c['word'] in keep],
        relations=[e for e in data['relations'] if e['a'] in keep and e['b'] in keep])
    main_graph=graph(result,'main'); full_graph=graph(result,'with_conditions')
    for c in result['cards']:
        w=c['word']; c['core_neighbors']=len(main_graph[w]); c['neighbors']=len(full_graph[w])
        c['types']=sorted({e['type'] for e in result['relations'] if w in (e['a'],e['b'])})
    return result

def analyze(data):
    modes={}
    for mode in ['main','with_conditions']:
        adj=graph(data,mode);pairs=defaultdict(set)
        for e in data['relations']:
            if mode=='main' and e['level']!='основной':continue
            pairs[tuple(sorted((e['a'],e['b'])))].add(e['type'])
        deg=[len(ns) for ns in adj.values()]
        modes[mode]=dict(pairs=len(pairs),components=components(adj),min_degree=min(deg),median_degree=median(deg),
            types={t:sum(t in ts for ts in pairs.values()) for t in sorted({t for ts in pairs.values() for t in ts})},
            initial_mean=mean(chance(len(adj),d) for d in deg),initial_min=chance(len(adj),min(deg)),
            initial_max=chance(len(adj),max(deg)),runs=[simulate(data,mode,p) for p in [2,4]])
    return modes

def main():
    checks();base=json.loads((ROOT/'prototype60.json').read_text())
    variants={60:base}
    for k in [2,3]:
        data=subgraph(base,k);size=len(data['cards']);variants[size]=data
        (ROOT/f'prototype{size}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    results={}
    for size,data in variants.items():
        results[size]=analyze(data)
    (ROOT/'prototype-comparison.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
    out=['# Сравнение исследовательских составов R1','','## Что сравнивается','','60 слов — первоначальный тематический прототип. Варианты 48 и 40 получены последовательным удалением слов с менее чем двумя или тремя известными соседями соответственно. Это эксперимент над текущим графом, не универсальный критерий качества слов и не доказательство оптимального размера колоды. Удалённые слова остаются в резерве. Новые связи могут изменить результат отбора.','','Равномерность типов не оптимизируется. Тематическое разнообразие нельзя выводить только из количества соседей. 40 слов — компактный вариант для первой проверки понятности, 48 — альтернатива с более широким содержанием. Полного перебора наборов не проводилось.','','Основной граф содержит прямые авторские объяснения, условный добавляет обсуждаемые интерпретации. Игроки ещё не оценивали их. Полная модель размещения и ограничения описаны в `prototype60-simulation.md`; здесь меняется только личная колода. Стартовый центр равномерно перебирает понятия каждого варианта, поэтому сравнение включает изменение распределения центров и не изолирует только эффект размера колоды. Нейтральная колода не назначена.','','## Основной граф','','| Размер | Пар | Минимум соседей | Медиана соседей | Типов | Средний шанс первого хода | Худший центр | Лучший центр |','|---:|---:|---:|---:|---:|---:|---:|---:|']
    for size,r in results.items():
        m=r['main'];out.append(f'| {size} | {m["pairs"]} | {m["min_degree"]} | {m["median_degree"]} | {len(m["types"])} | {100*m["initial_mean"]:.1f}% | {100*m["initial_min"]:.1f}% | {100*m["initial_max"]:.1f}% |')
    out+=['','## Одинаковые центры для всех вариантов','','Здесь центр перебирается только среди понятий 40-карточного варианта во всех трёх случаях. Личная колода остаётся своего размера. Это контролирует состав центров, но не превращает их в утверждённую нейтральную колоду.','','| Личная колода | Средний шанс первого хода при одинаковом наборе центров |','|---:|---:|']
    shared={c['word'] for c in variants[40]['cards']}
    for size,data in variants.items():
        adj=graph(data,'main');p=mean(chance(size,len(adj[w])) for w in shared)
        out.append(f'| {size} | {100*p:.1f}% |')
    out+=['','## Типы в основном графе','','| Тип | 60 | 48 | 40 |','|---|---:|---:|---:|']
    for t in sorted(results[60]['main']['types']):
        out.append(f'| {t} | '+ ' | '.join(str(results[n]['main']['types'].get(t,0)) for n in [60,48,40])+' |')
    out+=['','## Случайные сценарии на поле','','Остановка означает, что активный игрок не нашёл хода и не смог исправить это доступной пересдачей. Это не равнозначно концу реальной партии. Все размеченные связи принимаются; стратегия по очкам не моделируется. Доля дошедших до 40 карт — диагностика этих ограниченных сценариев, а не вероятность победы или качество игры.','','| Колода | Рёбра | Игроков | Сценариев | Достигли 40 карт | Доля |','|---:|---|---:|---:|---:|---:|']
    for size,r in results.items():
        for mode,m in r.items():
            for run in m['runs']:
                out.append(f'| {size} | {mode} | {run["players"]} | {run["runs"]} | {run["reached_40"]} | {100*run["reached_40"]/run["runs"]:.1f}% |')
    for size in [48,40]:
        data=variants[size];adj=graph(data,'main');alladj=graph(data,'with_conditions')
        out+=['',f'## Состав {size}', '', '| Слово | Темы | Основных соседей | С условными |', '|---|---|---:|---:|']
        for c in data['cards']:
            w=c['word'];out.append(f'| {w} | {"; ".join(c["themes"])} | {len(adj[w])} | {len(alladj[w])} |')
    out+=['','## Интерпретация','','Сокращение повышает концентрацию известных связей, но удаляет часть знакомых эмоций, жанров и простых партнёров. Не считать исключённые слова плохими: причины включают неполноту аннотаций и выбранную модель отношений. Не требуется выбирать 40 вместо 48 до проверки понятности.','','Следующая внешняя проверка: дать читателю определения и примеры, отметить непонятные слова и непринимаемые связи. До неё результаты описывают авторскую модель, а не фактический детский игровой опыт. Отдельный выбор нейтральных карт остаётся отложенным.','']
    (ROOT/'prototype-comparison.md').write_text('\n'.join(out))
    print(json.dumps({size:{mode:{'pairs':m['pairs'],'initial_mean':m['initial_mean'],'min_degree':m['min_degree'],'reached40':[(r['players'],r['reached_40'],r['runs']) for r in m['runs']]} for mode,m in rs.items()} for size,rs in results.items()},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
