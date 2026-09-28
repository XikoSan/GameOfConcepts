"""Reproducible diagnostics, not a complete implementation of game strategy."""
from pathlib import Path
from collections import defaultdict, Counter, deque
from math import comb
from statistics import mean, median
import random,json

ROOT=Path(__file__).resolve().parents[1]
DIRS=((1,0),(-1,0),(0,1),(0,-1))

def graph(data, mode):
    adj={c['word']:set() for c in data['cards']}
    for e in data['relations']:
        if mode=='main' and e['level']!='основной':continue
        adj[e['a']].add(e['b']);adj[e['b']].add(e['a'])
    return adj

def legal(board,hand,adj):
    frontier={ (x+dx,y+dy) for x,y in board for dx,dy in DIRS }-board.keys()
    result={}
    for w in hand:
        cells=[]
        for x,y in frontier:
            neighbors=[board[(x+dx,y+dy)] for dx,dy in DIRS if (x+dx,y+dy) in board]
            if w not in neighbors and any(v in adj[w] for v in neighbors):cells.append((x,y))
        if cells:result[w]=sorted(cells)
    return result

def chance(n,k,h=5):
    return 1-(comb(n-k,h) if n-k>=h else 0)/comb(n,h)

def components(adj):
    remaining=set(adj);sizes=[]
    while remaining:
        todo=[next(iter(remaining))];component=set()
        while todo:
            w=todo.pop()
            if w in component:continue
            component.add(w);todo.extend(adj[w]-component)
        remaining-=component;sizes.append(len(component))
    return sorted(sizes,reverse=True)

def checks():
    adj={'a':{'b'},'b':{'a'},'c':set()}
    assert len(legal({(0,0):'a'},['b'],adj)['b'])==4
    assert not legal({(0,0):'a'},['a','c'],adj)
    # Even a compatible neighbor cannot override the identical-neighbor ban.
    assert (1,0) not in legal({(0,0):'a',(2,0):'b'},['a'],adj).get('a',[])
    # A diagonal connection alone is not adjacency.
    assert (1,1) not in legal({(0,0):'a'},['b'],adj).get('b',[])
    assert abs(chance(60,1)-5/60)<1e-12
    assert chance(60,0)==0 and chance(60,60)==1

def simulate(data,mode,players,repeats=6):
    adj=graph(data,mode);words=list(adj);rng=random.Random(48291+players)
    milestones=[1,5,10,20,40]
    snapshots={b:[] for b in milestones};stop=Counter();ever_stalled=0
    # Every possible surrogate center receives the same number of starts.
    for center in words:
        for repetition in range(repeats):
            decks=[];hands=[];redrawn=[False]*players
            for _ in range(players):
                pile=words.copy();rng.shuffle(pile)
                hands.append(pile[:5]);decks.append(deque(pile[5:]))
            board={(0,0):center};turn=0;stalled=False
            while True:
                active=turn%players
                moves=legal(board,hands[active],adj)
                size=len(board)
                if size in snapshots:snapshots[size].append(len(moves))
                if size>=40:break
                if not moves:
                    stalled=True
                    if not redrawn[active]:
                        # Existing rule: entire hand goes to the bottom, then draw.
                        num=len(hands[active]);decks[active].extend(hands[active]);hands[active]=[]
                        hands[active]=[decks[active].popleft() for _ in range(num)]
                        redrawn[active]=True;moves=legal(board,hands[active],adj)
                    if not moves:
                        stop[size]+=1;break
                w=rng.choice(sorted(moves));pos=rng.choice(moves[w])
                assert pos not in board
                board[pos]=w;hands[active].remove(w)
                if decks[active]:hands[active].append(decks[active].popleft())
                assert len(hands[active])<=5
                turn+=1
            ever_stalled+=stalled
    total=len(words)*repeats
    return dict(players=players,mode=mode,runs=total,seed=48291+players,
        reached_40=len(snapshots[40]),stopped_before_40=sum(stop.values()),
        ever_no_move_before_redraw=ever_stalled,
        snapshots={str(b):dict(reached=len(vals),share_reached=len(vals)/total,
                    has_move=sum(v>0 for v in vals)/len(vals) if vals else None,
                    mean_playable=mean(vals) if vals else None) for b,vals in snapshots.items()},
        stops_by_board_size=dict(sorted(stop.items())))

def main():
    checks();data=json.loads((ROOT/'prototype60.json').read_text());results={}
    for mode in ['main','with_conditions']:
        adj=graph(data,mode)
        ps={w:chance(len(adj),len(ns)) for w,ns in adj.items()}
        results[mode]=dict(components=components(adj),pairs=sum(map(len,adj.values()))//2,
            degree_min=min(map(len,adj.values())),degree_median=median(map(len,adj.values())),
            degree_max=max(map(len,adj.values())),
            initial=dict(mean=mean(ps.values()),minimum=min(ps.values()),maximum=max(ps.values())),
            initial_by_center=ps,runs=[simulate(data,mode,p) for p in [2,4]])
    (ROOT/'prototype60-simulation.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
    out=['# Прототип R1: диагностика вероятности хода','','## Модель и ограничения','','Основа — `game-rules.md`: отдельная копия колоды у каждого из 2 или 4 игроков, рука 5, добор, сетка, соседство по стороне, запрет одинаковых соседних понятий, минимум одна смысловая связь. Отдельную нейтральную колоду пока не выбирали. Поэтому центр — тестовый экземпляр каждого из 60 понятий по очереди, не карта, изъятая из личной колоды. Это диагностика чувствительности к старту, не предлагаемая нейтральная колода.','','Наличие хода определяется существованием свободной клетки, в которой нет одноимённого соседа и есть хотя бы одна размеченная совместимость. Направления отношений сохранены в реестре, но для существования одной связи достаточно любого допустимого направления. Очки, пути, узлы, стратегия, объяснение ребёнка и голосование не моделируются; записанные связи условно принимаются.','','Игрок выбирает равновероятно одну из доступных карт, затем одну из подходящих клеток. Если ход отсутствует, использует доступную однократную пересдачу. Если и после неё ход отсутствует, сценарий прекращается. Это **остановка сценария**, а не утверждение, что остальные игроки не способны продолжать реальную партию. Переход хода без размещения не введён. Максимум поля — 40 экземпляров вместе с центром.','','На режим и число игроков по 360 сценариев: 60 центров × 6 независимых перемешиваний. Случайный seed фиксирован; повторение скрипта воспроизводит результат. Таблицы поздних состояний условны на достижение этого размера: нельзя считать их безусловной вероятностью успешной партии. Число достигших показано явно.','','## Формула для первого хода','','Для фиксированного тестового центра: P = 1 − C(N − d, 5) / C(N, 5), где N = 60 — полная личная колода, d — число её слов, совместимых с центром. Копия слова центра остаётся в личной колоде и не считается совместимой с собой. Поэтому здесь не N − 1. Для дальнейшего реального состояния M и K нужно определять по личному пулу, а не вычитать все карты чужих игроков с поля.','','| Режим | Пар | Компоненты графа | Средняя стартовая вероятность | Худший центр | Лучший центр |','|---|---:|---|---:|---:|---:|']
    for mode,r in results.items():
        out.append(f'| {mode} | {r["pairs"]} | {r["components"]} | {100*r["initial"]["mean"]:.1f}% | {100*r["initial"]["minimum"]:.1f}% | {100*r["initial"]["maximum"]:.1f}% |')
    for mode,r in results.items():
        for run in r['runs']:
            out += ['',f'## {mode}, игроков {run["players"]}', '',
                    f'Сценариев: {run["runs"]}. Остановились до 40 карт: {run["stopped_before_40"]}. Достигли 40 карт: {run["reached_40"]}.', '',
                    '| Карт поля | Достигли состояния | Доля всех сценариев | Есть ход до пересдачи, среди достигших | Среднее число доступных карт руки |',
                    '|---:|---:|---:|---:|---:|']
            for b,s in run['snapshots'].items():
                p='—' if s['has_move'] is None else f'{100*s["has_move"]:.1f}%'
                av='—' if s['mean_playable'] is None else f'{s["mean_playable"]:.2f}'
                out.append(f'| {b} | {s["reached"]} | {100*s["share_reached"]:.1f}% | {p} | {av} |')
    out += ['', '## По каждому тестовому центру', '', '| Понятие в центре | Основные связи | С условными |', '|---|---:|---:|']
    for w in results['main']['initial_by_center']:
        out.append(f'| {w} | {100*results["main"]["initial_by_center"][w]:.1f}% | {100*results["with_conditions"]["initial_by_center"][w]:.1f}% |')
    out += ['', 'Основные и условные отношения — уровни авторской разметки, не доверительные интервалы. Разница сценариев отражает чувствительность к принятию спорных связей, но не измеренную вероятность их принятия игроками.', '']
    (ROOT/'prototype60-simulation.md').write_text('\n'.join(out))
    print(json.dumps({m:dict(initial=r['initial'],components=r['components'],runs=[dict(players=x['players'],reached_40=x['reached_40'],runs=x['runs']) for x in r['runs']]) for m,r in results.items()},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
