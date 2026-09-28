"""Reproduce structural metrics from E01's explicit pair annotations."""
from collections import defaultdict, Counter
from fractions import Fraction
from math import comb, ceil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TYPES = ('Вид', 'Часть', 'Сделано из', 'Нужно для', 'Приводит к', 'Противоположность')
Q = Fraction(4, 5)
TOLERANCE = Fraction(1, 4)


def probability(pool, neighbors, hand=5):
    hand = min(pool, hand)
    if pool <= 0:
        return Fraction(0)
    return 1 - Fraction(comb(pool - neighbors, hand) if pool - neighbors >= hand else 0, comb(pool, hand))


def minimum_neighbors(pool, hand=5):
    return next(k for k in range(pool + 1) if probability(pool, k, hand) >= Q)


def main():
    source = (ROOT / 'easy-study-01-pairs.md').read_text()
    table, annotations = source.split('## Основания подсчёта', 1)
    words = []
    previous_counts = {}
    for line in table.splitlines():
        cells = [c.strip() for c in line.strip('|').split('|')]
        if line.startswith('| ') and len(cells) == 3 and cells[1].isdigit():
            words.append(cells[0])
            previous_counts[cells[0]] = int(cells[1])
    pair_types = defaultdict(set)
    for line in annotations.split('## Исключения')[0].splitlines():
        cells = [c.strip() for c in line.strip('|').split('|')]
        if line.startswith('| ') and len(cells) == 4 and cells[2] in TYPES:
            a, b, relation, explanation = cells
            assert a in words and b in words and a != b and explanation
            pair_types[tuple(sorted((a, b)))].add(relation)
    neighbors = {w: set() for w in words}
    weights = Counter()
    for (a, b), types in pair_types.items():
        neighbors[a].add(b)
        neighbors[b].add(a)
        for relation in types:
            weights[relation] += Fraction(1, len(types))
    assert all(len(neighbors[w]) == previous_counts[w] for w in words)
    n, edges = len(words), len(pair_types)
    k = minimum_neighbors(n)
    assert sum(map(len, neighbors.values())) == 2 * edges
    assert sum(weights.values()) == edges
    passed = sum(probability(n, len(neighbors[w])) >= Q for w in words)
    lower = (1 - TOLERANCE) / len(TYPES)
    upper = (1 + TOLERANCE) / len(TYPES)
    deviation = max(abs(len(TYPES) * weights[t] / edges - 1) for t in TYPES)
    pct = lambda x: f'{float(x)*100:.1f}%'.replace('.', ',')
    out = f'''# E01: проверка новых критериев

Версия 0.3 · 28 сентября 2026 года.

Источник: [разметка пар](easy-study-01-pairs.md). Воспроизведение: `python3 docs/deck-research/tools/audit_easy.py` из корня репозитория.

## Условия

- Рабочие пороги для этой итерации: вероятность ≥80%; относительное отклонение доли типа ≤25%.
- Сценарий: заданное слово на поле, рука из пяти карт полного персонального набора. N={n}, одна копия каждого слова, d — число разных совместимых слов.
- P = 1 − C(N−d,5)/C(N,5). Требуется d ≥ {k}.
- Объяснения включают контекстные варианты. Связи не проверены игроками; неизвестные пары не объявляются невозможными.
- Подсчёт выполнен по {edges} размеченным парам из {comb(n,2)} возможных. Равномерность рассчитана по известным типам; дополнительные независимо обоснованные типы могут её изменить.

## Итог

Порог соседей достигнут у {passed} из {n} слов. Распределение типов не проходит: максимальное относительное отклонение D={float(deviation):.2f} при допустимом 0,25.

| Тип | Вес пар | Доля | Допуск | Результат |
|---|---:|---:|---|---|
'''
    for t in TYPES:
        share = weights[t] / edges
        out += f'| {t} | {float(weights[t]):g} | {pct(share)} | {pct(lower)}–{pct(upper)} | {"Проходит" if lower <= share <= upper else "Не проходит"} |\n'
    out += '\n## Карты\n\n| Слово | Соседей | Вероятность | Не хватает соседей до порога |\n|---|---:|---:|---:|\n'
    for w in sorted(words, key=lambda w: (-len(neighbors[w]), w)):
        d = len(neighbors[w])
        out += f'| {w} | {d} | {pct(probability(n,d))} | {max(0,k-d)} |\n'
    out += f'''
## Ограничения следующего состава

1. Для неизменного набора из {n} слов и d≥{k} необходимо хотя бы {ceil(n*k/2)} уникальных пар. Сейчас {edges}; нужно как минимум {ceil(n*k/2)-edges} дополнительных пар. Это необходимое, но недостаточное условие: связи должны распределиться по всем словам.
2. Если сохранять все {weights['Приводит к']} причинных пар с их нынешним весом и только добавлять пары других типов, для доли причинности ≤{pct(upper)} нужно минимум {ceil(weights['Приводит к']/upper)} пар всего. Это условный расчёт без смены классификации и без удаления карт.
3. В текущей разметке любой поднабор по-прежнему имеет ноль пар «сделано из». Поэтому удаление слабых слов само по себе не даст баланс шести типов. Это вывод о размеченном графе, не доказательство невозможности всех мыслимых объяснений.
4. При изменении размера набора порог соседей пересчитывается. Нельзя сохранить старый d_min и считать расширенный набор прошедшим.
5. Нельзя автоматически удалить слова с d<8: можно потерять соседей оставшихся карт и ухудшить показатели.

## Решения по отбору

- Не утверждать 28 кандидатов как готовую простую колоду.
- Сохранить список как исходный материал, а не как обязательный состав.
- Не дописывать причинные ассоциации ради достижения минимального числа соседей.
- Проверять новые кандидаты прежде всего на отношения «вид», «часть», «нужно для», «противоположность»; добавление ещё одной эмоции без таких связей усиливает перекос.
- Отдельно решить соответствие «сделано из» непредметному профилю. Возможные пути: расширить содержание материалами/составами либо пересмотреть этот тип. Изменение набора типов пока не применяется.

## Направления следующего поиска, не готовые замены

| Группа кандидатов | Что может добавить | Риск |
|---|---|---|
| Чувство, эмоция | Вид: страх, радость, грусть и другие эмоции | Чрезмерно общий центр; близкие слова могут дублировать друг друга |
| Действие, общение | Родовые категории для поиска, помощи, общения; уточнить значения | Рост абстрактности и риск универсальных объяснений |
| Разговор, речь, слушание | Возможные отношения части и необходимости | Требуется удержать разные значения и не засчитывать любую совместную деятельность как часть |
| Тишина, покой | Контрасты к звуку и движению | Мало соседей; пары противоположностей сами по себе не обеспечивают d_min |
| Вещество, смесь, вода, воздух | Проверка содержательной роли состава | «Состоит из» не автоматически тождественно «сделано из»; не менять правило незаметно |

Указанным кандидатам не назначены вымышленные степени связности. Следующая версия требует новой разметки и проверки качества объяснений.
'''
    (ROOT / 'easy-study-01-balance.md').write_text(out)
    print(f'N={n}; E={edges}; d_min={k}; passed={passed}/{n}; D={float(deviation):.2f}')


if __name__ == '__main__':
    main()
