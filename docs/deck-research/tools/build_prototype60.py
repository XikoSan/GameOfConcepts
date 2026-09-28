"""Build the R1 research graph and a reproducible 60-card draft."""
from pathlib import Path
from collections import Counter, defaultdict
import json

from prototype60_data import CARDS, ADDITIONS, CONDITIONAL_INHERITED, RESERVE_NOTES

ROOT = Path(__file__).resolve().parents[1]
SIX = ['Характеристика', 'Противопоставление', 'Разновидность', 'Помогает', 'Вызывает', 'Регулирует']


def main():
    source = json.loads((ROOT / 'six-types-comparison.json').read_text())
    origin = {w: code for code, d in source['datasets'].items() for w in d['words']}
    cards = [dict(word=row.split('|')[0], themes=row.split('|')[1].split('; ')) for row in CARDS.splitlines()]
    words = [c['word'] for c in cards]
    assert len(words) == len(set(words)) == 60
    assert set(words) <= set(origin)
    meaning = {}
    for filename, prefix, wi, mi in [
        ('easy-candidates-100.md', 'E02-C', 2, 4),
        ('easy-candidates-100-v2.md', 'E03-C', 2, 4),
        ('independent-candidates-100-e04.md', 'E04-C', 3, 4),
    ]:
        for line in (ROOT / filename).read_text().splitlines():
            if line.startswith('| ' + prefix):
                fields = [x.strip() for x in line.split('|')]
                meaning[fields[wi]] = fields[mi]
    edges = []
    for code, dataset in source['datasets'].items():
        for r in dataset['relations']:
            if r['a'] in words and r['b'] in words:
                key = (r['type'], r['a'], r['b'])
                edges.append(dict(r, level='условный' if key in CONDITIONAL_INHERITED else 'основной',
                                  source=f'{code}: пересмотр R1'))
    additions = []
    for line in ADDITIONS.splitlines():
        typ, a, b, level, explanation = line.split('|')
        assert typ in SIX and a in origin and b in origin
        r = dict(type=typ, a=a, b=b, level=level, reason=explanation,
                 source='R1: новая разметка', cross_pool=origin[a] != origin[b])
        additions.append(r)
        if a in words and b in words and level != 'отклонённый':
            edges.append(r)
    assert len({(e['type'], e['a'], e['b']) for e in edges}) == len(edges)
    pairs = defaultdict(set)
    core = defaultdict(set)
    neighbors = defaultdict(set)
    core_neighbors = defaultdict(set)
    wordtypes = defaultdict(set)
    for e in edges:
        key = tuple(sorted((e['a'], e['b'])))
        pairs[key].add(e['type'])
        for a, b in [(e['a'], e['b']), (e['b'], e['a'])]:
            neighbors[a].add(b)
            wordtypes[a].add(e['type'])
            if e['level'] == 'основной':
                core_neighbors[a].add(b)
        if e['level'] == 'основной':
            core[key].add(e['type'])
    for c in cards:
        w = c['word']
        c.update(origin=origin[w], meaning=meaning[w], neighbors=len(neighbors[w]),
                 core_neighbors=len(core_neighbors[w]), types=sorted(wordtypes[w]),
                 note=RESERVE_NOTES.get(w, 'Проверить понятность значения и объяснений; пользовательских наблюдений нет.'))
    output = dict(status='research_prototype_not_runtime_deck', version='R1', cards=cards, relations=edges)
    (ROOT / 'prototype60.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    (ROOT / 'cross-pool-r1.json').write_text(json.dumps(dict(
        status='targeted_search_not_all_pairs', relations=additions), ensure_ascii=False, indent=2) + '\n')
    report = ['# Прототип R1: состав и проверяемые объяснения', '',
              'Исследовательский набор из 60 карт. Возраст 7–12 — рабочая гипотеза, не результат проверки с детьми. Действующая игра не изменена.', '',
              '## Основание состава', '',
              'Выбраны преимущественно знакомые занятия, переживания и способы совместного действия. Сохранены родовые слова и простые партнёры с одним типом связи. Четыре типа не являются верхним ограничением. Темы — экспертные метки с пересечением, не доказанные независимые категории; одна тема допустима.', '',
              '60 — размер первого рабочего прототипа для испытания, не найденный математический оптимум. Состав не отбирался по квотам типов. Природные, технические и экономические блоки оставлены для следующих вариантов: их исключение не является доказательством сложности каждого слова.', '',
              'Новыми объяснениями проверены главным образом пары вокруг выбранных слов. Все 30 000 межсписочных пар не проверены; отсутствие записи не означает невозможность отношения.', '',
              f'Рассмотрено {len(additions)} новых объяснений (включая отклонённые), из них межсписочных {sum(e["cross_pool"] for e in additions)}. В прототипе {len(edges)} объяснений на {len(pairs)} парах; основной уровень охватывает {len(core)} пар.', '',
              '## Типы', '', '| Тип | Основных пар | С условными |', '|---|---:|---:|']
    for t in SIX:
        report.append(f'| {t} | {sum(t in ts for ts in core.values())} | {sum(t in ts for ts in pairs.values())} |')
    report += ['', '## Состав', '',
               '| Слово | Источник | Значение | Темы | Основных соседей | С условными | Типов с условными | Замечание |',
               '|---|---|---|---|---:|---:|---:|---|']
    for c in cards:
        report.append(f'| {c["word"]} | {c["origin"]} | {c["meaning"]} | {"; ".join(c["themes"])} | {c["core_neighbors"]} | {c["neighbors"]} | {len(c["types"])} | {c["note"]} |')
    report += ['', '## Реестр связей', '',
               'Основной уровень означает отсутствие дополнительной спорной интерпретации, а не эмпирическую доказанность. Условные рёбра не гарантированы к принятию в игре.', '',
               '| A | Тип | B | Уровень | Объяснение |', '|---|---|---|---|---|']
    for e in edges:
        report.append(f'| {e["a"]} | {e["type"]} | {e["b"]} | {e["level"]} | {e["reason"]} |')
    (ROOT / 'prototype60.md').write_text('\n'.join(report) + '\n')
    print(json.dumps(dict(cards=len(cards), pairs=len(pairs), core_pairs=len(core),
        cross_explanations=sum(e['cross_pool'] for e in additions),
        core_min_degree=min(len(core_neighbors[w]) for w in words),
        weakest=sorted([(w, len(core_neighbors[w])) for w in words], key=lambda r: r[1])[:12]), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
