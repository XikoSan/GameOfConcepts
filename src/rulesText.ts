export type RulesBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; headers: [string, string]; rows: [string, string][] }
  | { type: 'emphasis'; text: string }
  | { type: 'card'; text: string }
  | { type: 'example'; id: RulesExampleId };

export type RulesExampleId =
  | 'cards'
  | 'field'
  | 'neighbor-score'
  | 'chain'
  | 'cross'
  | 'bridge';

export interface RulesSection {
  title: string;
  blocks: RulesBlock[];
}

export interface RulesTab {
  title: string;
  sectionTitles: string[];
}

export interface RulesScoreSubsection {
  title: string;
  sectionTitles: string[];
}

export interface RulesExample {
  id: RulesExampleId;
  imageSrc?: string;
  alt: string;
  caption: string;
}

export const rulesExamples: RulesExample[] = [
  {
    id: 'cards',
    alt: 'Пример карт игрока на поле',
    caption: 'Пример подсчёта очков за свои карты на поле.',
  },
  {
    id: 'field',
    alt: 'Пример соседства карт по сторонам',
    caption:
      'Пример соседства по сторонам. Диагональные карты не считаются связанными.',
  },
  {
    id: 'neighbor-score',
    alt: 'Пример подсчёта очков за чужих соседей',
    caption: 'Пример подсчёта очков за чужих и нейтральных соседей.',
  },
  {
    id: 'chain',
    alt: 'Пример прямой цепочки одного цвета',
    caption: 'Пример прямой цепочки одного цвета.',
  },
  {
    id: 'cross',
    alt: 'Пример крестовины из пяти карт',
    caption:
      'Пример крестовины: центральная карта и четыре соседние карты по сторонам.',
  },
  {
    id: 'bridge',
    alt: 'Пример моста между двумя смысловыми крестовинами',
    caption: 'Пример моста между двумя смысловыми крестовинами.',
  },
];

export const rulesSections: RulesSection[] = [
  {
    title: 'Цель',
    blocks: [
      {
        type: 'paragraph',
        text: 'Набрать больше победных очков, размещая карты понятий на поле и создавая наиболее выгодные связи.',
      },
    ],
  },
  {
    title: 'Подготовка',
    blocks: [
      { type: 'paragraph', text: 'Каждый игрок получает колоду своего цвета.' },
      { type: 'paragraph', text: 'Колоды игроков содержат одинаковые понятия.' },
      { type: 'paragraph', text: 'Одинаковые понятия у разных игроков разрешены.' },
      { type: 'paragraph', text: 'Каждый игрок берёт на руку 5 карт.' },
      { type: 'paragraph', text: 'В центр поля кладётся нейтральная стартовая карта.' },
      {
        type: 'paragraph',
        text: 'Нейтральная карта считается чужой для всех игроков.',
      },
    ],
  },
  {
    title: 'Поле',
    blocks: [
      { type: 'paragraph', text: 'Карты размещаются на сетке.' },
      {
        type: 'paragraph',
        text: 'Соседними считаются только карты по стороне:',
      },
      { type: 'list', items: ['сверху;', 'снизу;', 'слева;', 'справа.'] },
      { type: 'card', text: 'Диагонали не считаются связью.' },
      { type: 'example', id: 'field' },
    ],
  },
  {
    title: 'Ход игрока',
    blocks: [
      { type: 'paragraph', text: 'В свой ход игрок:' },
      {
        type: 'list',
        items: [
          'Выбирает 1 карту с руки.',
          'Кладёт её в свободную клетку рядом хотя бы с одной картой на поле.',
          'Объясняет связь со всеми соседними картами.',
          'Если связь принята игроками, карта остаётся на поле.',
          'Игрок добирает 1 карту.',
        ],
      },
      { type: 'card', text: 'Сброса карт нет.' },
    ],
  },
  {
    title: 'Допустимая связь',
    blocks: [
      {
        type: 'paragraph',
        text: 'Связь считается допустимой, если игрок может понятно объяснить отношение между понятиями.',
      },
      { type: 'paragraph', text: 'Типы допустимых связей:' },
      {
        type: 'list',
        items: [
          'аспекты;',
          'проявления;',
          'причины;',
          'следствия;',
          'части;',
          'противоположности.',
        ],
      },
      {
        type: 'paragraph',
        text: 'Если большинство игроков не принимает объяснение, карта не размещается.',
      },
    ],
  },
  {
    title: 'Подсчёт очков',
    blocks: [
      { type: 'card', text: 'Очки считаются только в конце партии.' },
    ],
  },
  {
    title: '1. Карты',
    blocks: [
      { type: 'paragraph', text: 'Каждая своя карта на поле:' },
      { type: 'emphasis', text: '+1 ПО' },
      { type: 'example', id: 'cards' },
    ],
  },
  {
    title: '2. Соседство с чужими картами',
    blocks: [
      {
        type: 'paragraph',
        text: 'Для каждой своей карты считаются соседние чужие или нейтральные карты.',
      },
      { type: 'paragraph', text: 'Свои карты очков соседства не дают.' },
      {
        type: 'table',
        headers: ['Чужих соседей', 'Очки'],
        rows: [
          ['0', '0'],
          ['1', '+2'],
          ['2', '+4'],
          ['3', '+6'],
          ['4', '+8'],
        ],
      },
      {
        type: 'card',
        text: 'Нейтральная стартовая карта считается чужой и участвует в подсчёте на общих основаниях.',
      },
      { type: 'example', id: 'neighbor-score' },
    ],
  },
  {
    title: '3. Прямые цепочки',
    blocks: [
      {
        type: 'paragraph',
        text: 'Цепочка — непрерывная прямая линия карт одного цвета.',
      },
      {
        type: 'paragraph',
        text: 'Считаются только горизонтальные и вертикальные цепочки.',
      },
      { type: 'paragraph', text: 'Диагонали и ломаные линии не считаются.' },
      {
        type: 'table',
        headers: ['Длина цепочки', 'Бонус'],
        rows: [
          ['3 карты', '+1 ПО'],
          ['5 карт', '+2 ПО'],
          ['7 карт', '+3 ПО'],
          ['9 карт', '+4 ПО'],
        ],
      },
      {
        type: 'paragraph',
        text: 'Если цепочка длиннее 3, она получает бонус по своей максимальной длине.',
      },
      { type: 'paragraph', text: '4 карты = бонус за 3 карты.' },
      { type: 'paragraph', text: '6 карт = бонус за 5 карт.' },
      { type: 'example', id: 'chain' },
    ],
  },
  {
    title: '4. Крестовина',
    blocks: [
      {
        type: 'paragraph',
        text: 'Крестовина — фигура из 5 карт, где одна карта находится в центре, а четыре карты стоят вокруг неё по сторонам.',
      },
      {
        type: 'card',
        text: 'Нейтральная карта не участвует в крестовине.',
      },
      {
        type: 'paragraph',
        text: 'Центральная карта должна быть общей причиной для четырёх соседних карт.',
      },
      {
        type: 'paragraph',
        text: 'Чтобы получить бонус, игрок обязан одним предложением объяснить, как центральная карта приводит к каждой из соседних.',
      },
      {
        type: 'paragraph',
        text: 'Если хотя бы одна соседняя карта не является следствием центральной, бонус за крестовину не начисляется.',
      },
      { type: 'paragraph', text: 'Засчитанная крестовина даёт:' },
      { type: 'emphasis', text: '+5 ПО' },
      {
        type: 'paragraph',
        text: 'Владелец крестовины — игрок, у которого в ней больше карт.',
      },
      {
        type: 'paragraph',
        text: 'Каждая карта может быть частью только одной крестовины.',
      },
      { type: 'example', id: 'cross' },
    ],
  },
  {
    title: '5. Мосты',
    blocks: [
      {
        type: 'paragraph',
        text: 'Мост — карта, соединяющая две смысловые крестовины.',
      },
      {
        type: 'paragraph',
        text: 'На текущем этапе мосты можно отмечать, но очки за них не начисляются.',
      },
      { type: 'example', id: 'bridge' },
    ],
  },
  {
    title: 'Итоговый подсчёт',
    blocks: [
      {
        type: 'emphasis',
        text: 'ПО игрока = карты + соседство + прямые цепочки + крестовины',
      },
      { type: 'paragraph', text: 'Побеждает игрок с наибольшим количеством ПО.' },
    ],
  },
];

export const rulesTabs: RulesTab[] = [
  {
    title: 'Старт',
    sectionTitles: ['Цель', 'Подготовка'],
  },
  {
    title: 'Поле',
    sectionTitles: ['Поле'],
  },
  {
    title: 'Ход',
    sectionTitles: ['Ход игрока'],
  },
  {
    title: 'Связи',
    sectionTitles: ['Допустимая связь'],
  },
  {
    title: 'Подсчёт очков',
    sectionTitles: [],
  },
];

export const rulesScoreSubsections: RulesScoreSubsection[] = [
  {
    title: 'Карты',
    sectionTitles: ['Подсчёт очков', '1. Карты'],
  },
  {
    title: 'Соседство',
    sectionTitles: ['2. Соседство с чужими картами'],
  },
  {
    title: 'Цепочки',
    sectionTitles: ['3. Прямые цепочки'],
  },
  {
    title: 'Крестовина',
    sectionTitles: ['4. Крестовина'],
  },
  {
    title: 'Мосты',
    sectionTitles: ['5. Мосты'],
  },
  {
    title: 'Итог',
    sectionTitles: ['Итоговый подсчёт'],
  },
];
