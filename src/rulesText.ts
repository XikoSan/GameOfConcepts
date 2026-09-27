import nodeExample from './assets/rules-node-example.png';
import acceptedConnectionExample from './assets/rules-accepted-connection.png';
import causePathExample from './assets/rules-cause-path-sequence.png';
import fieldRulesExample from './assets/rules-field-example.png';
import connectionRulesExample from './assets/rules-connection-example.png';

export type RulesBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'steps'; items: string[] }
  | { type: 'details'; title: string; blocks: RulesBlock[]; open?: boolean }
  | { type: 'table'; headers: [string, string]; rows: [string, string][] }
  | { type: 'emphasis'; text: string }
  | { type: 'card'; text: string }
  | { type: 'example'; id: RulesExampleId };

export type RulesExampleId =
  | 'cards'
  | 'accepted-connection'
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

export interface RulesExample {
  id: RulesExampleId;
  imageSrc?: string;
  alt: string;
  caption: string;
}

export interface ConnectionTypeRule {
  title: string;
  definition: string;
  examples: string[];
}

// Keep the order consistent across the full rules and the compact sidebar reminder.
export const connectionTypeRules: ConnectionTypeRule[] = [
  {
    title: 'Вид',
    definition: 'Выбранная карта обозначает разновидность или частный пример соседней карты.',
    examples: [
      'Дуб — вид дерева.',
      'Птица — вид животного.',
    ],
  },
  {
    title: 'Часть',
    definition: 'Выбранная карта обозначает часть соседней карты.',
    examples: [
      'Корень — часть дерева.',
      'Колесо — часть автомобиля.',
    ],
  },
  {
    title: 'Причина',
    definition: 'Выбранная карта обозначает причину, а соседняя — её следствие.',
    examples: [
      'Огонь — причина дыма.',
      'Страх — причина бегства.',
    ],
  },
  {
    title: 'Свойство',
    definition: 'Выбранная карта обозначает свойство или особенность соседней карты.',
    examples: [
      'Текучесть — свойство воды.',
      'Прочность — свойство металла.',
    ],
  },
  {
    title: 'Противоположность',
    definition: 'Значения карт противопоставлены друг другу; порядок карт не имеет значения.',
    examples: [
      'Свобода противоположна необходимости.',
      'Порядок противоположен хаосу.',
    ],
  },
];

export const rulesExamples: RulesExample[] = [
  {
    id: 'accepted-connection',
    imageSrc: acceptedConnectionExample,
    alt: 'Карты «Государство», «Общество» и «Сотрудничество» на поле.',
    caption: 'Пример принятых связей.',
  },
  {
    id: 'cards',
    imageSrc: connectionRulesExample,
    alt: 'Окно выбора связи между картами «Сознание» и «Система»',
    caption: 'Выбор типа и направления связи.',
  },
  {
    id: 'field',
    imageSrc: fieldRulesExample,
    alt: 'Игровое поле с нейтральной картой в центре',
    caption:
      'Поле в начале партии.',
  },
  {
    id: 'neighbor-score',
    alt: 'Пример подсчёта очков за соседние карты',
    caption: 'Пример нескольких выбранных связей за один ход.',
  },
  {
    id: 'chain',
    imageSrc: causePathExample,
    alt: 'Общество сверху, Сотрудничество в центре, Безопасность снизу. Две нижние карты синие.',
    caption: 'Пример смыслового пути.',
  },
  {
    id: 'cross',
    imageSrc: nodeExample,
    alt: 'Смысловой узел: от Безопасности направлены причинные связи к Сотрудничеству, Власти, Языку и Закону.',
    caption: 'Пример смыслового узла вокруг центральной карты.',
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
        type: 'card',
        text: 'Набрать больше очков, чем остальные игроки, размещая карты понятий на общем поле и обосновывая связи между ними.',
      },
    ],
  },
  {
    title: 'Подготовка',
    blocks: [
      {
        type: 'paragraph',
        text: 'Перед началом партии выбираются количество игроков (2–4) и тип колоды понятий.',
      },
      { type: 'details', title: 'Порядок подготовки', blocks: [
        { type: 'steps', items: [
          'Каждый игрок получает собственную копию выбранной колоды. Колоды одинаковы по составу и перемешиваются независимо.',
          'Каждый игрок получает 5 карт на руку.',
          'Из отдельной, заранее подготовленной колоды нейтральных карт случайно выбирается одна карта и размещается в центре поля.',
          'Первый игрок определяется случайно. Далее игроки ходят по установленной очереди.',
        ] },
        { type: 'card', text: 'Нейтральная карта не принадлежит ни одному игроку. С ней можно создавать смысловые связи.' },
      ] },
    ],
  },
  {
    title: 'Поле',
    blocks: [
      { type: 'card', text: 'Карта размещается в свободной клетке сетки рядом по стороне хотя бы с одной картой на поле.' },
      { type: 'details', title: 'Соседство и ограничения', blocks: [
        { type: 'paragraph', text: 'Соседними считаются только карты по стороне:' },
        { type: 'list', items: ['сверху;', 'снизу;', 'слева;', 'справа.'] },
        { type: 'card', text: 'Диагонали не считаются связью.' },
        { type: 'card', text: 'Одинаковые понятия не могут быть соседями.' },
        { type: 'example', id: 'field' },
      ] },
    ],
  },
  {
    title: 'Ход игрока',
    blocks: [
      { type: 'card', text: 'В свой ход игрок выкладывает одну карту, обосновывает выбранные связи и отправляет ход на голосование.' },
      { type: 'details', title: 'Порядок хода', blocks: [{ type: 'list', items: [
          'Выбирает одну карту с руки.',
          'Размещает её в свободной клетке рядом хотя бы с одной картой на поле.',
          'Выбирает минимум одну смысловую связь с физическими соседями.',
          'Объясняет выбранные связи и отправляет ход на голосование.',
          'После принятия хода карта остаётся на поле, а игрок добирает одну карту.',
        ] }] },
      { type: 'card', text: 'Один раз за партию до розыгрыша карты можно полностью пересдать руку. Карты руки уходят в низ колоды, вы получаете столько же новых карт и продолжаете свой ход.' },
    ],
  },
  {
    title: 'Связи',
    blocks: [
      {
        type: 'card',
        text: 'Связь создаётся между новой картой и одной из соседних с ней карт по стороне.',
      },
      {
        type: 'paragraph',
        text: 'Для каждого соседа связь выбирается отдельно. Игрок может связывать новую карту с любым количеством соседей.',
      },
      {
        type: 'paragraph',
        text: 'В игре используются пять типов связей. Для типов «Вид», «Часть», «Причина» и «Свойство» нужно указать направление. «Противоположность» симметрична.',
      },
      { type: 'details', title: 'Настройка и проверка связи', blocks: [
        { type: 'steps', items: [
          'Выберите тип связи.',
          'Для «Вида», «Части», «Причины» или «Свойства» укажите, какая карта выполняет нужную роль.',
          'Проверьте связь в окне предварительного просмотра и нажмите «Добавить связь». До отправки хода связь можно изменить или удалить.',
        ] },
        { type: 'paragraph', text: 'На ход нужно выбрать минимум одну смысловую связь. Ход без выбранной смысловой связи не может быть вынесен на голосование.' },
        { type: 'example', id: 'cards' },
      ] },
      { type: 'details', title: 'Типы связей и примеры', blocks: [
        ...connectionTypeRules.flatMap((connectionType) => [
        { type: 'emphasis' as const, text: connectionType.title },
        { type: 'paragraph' as const, text: connectionType.definition },
        { type: 'list' as const, items: connectionType.examples },
        ]),
      ] },
    ],
  },
  {
    title: 'Подсчёт очков',
    blocks: [
      { type: 'card', text: 'Каждая обоснованная и принятая связь приносит 1 очко.' },
      { type: 'example', id: 'accepted-connection' },
      {
        type: 'details',
        title: 'Смысловой путь — 2 очка за новую связь',
        blocks: [
          { type: 'paragraph', text: 'Когда связи одного типа последовательно идут от карты к карте, образуется смысловой путь. Например, одно понятие выступает причиной второго, а второе — причиной третьего.' },
          { type: 'card', text: 'Новая связь в таком пути приносит 2 очка: 1 за принятую связь и ещё 1 за путь.' },
          { type: 'example', id: 'chain' },
          { type: 'paragraph', text: 'Путь должен проходить через ваши карты с сохранением типа и направления связей. Крайние карты могут быть вашими, чужими или нейтральными. Для «Противоположности» направление не учитывается.' },
        ],
      },
      {
        type: 'details',
        title: 'Смысловой узел — 2 очка за новую связь',
        blocks: [
          { type: 'paragraph', text: 'Если новая карта связана с центром узла тем же типом связи и направлением, что и другие карты вокруг него, за эту связь начисляется 2 очка: 1 за принятую связь и ещё 1 за поддержание смыслового узла.' },
          { type: 'paragraph', text: 'В смысловом узле связи сосредоточены вокруг одного понятия. Узел состоит из трёх и более карт: карты в центре и как минимум двух ваших карт вокруг неё. Тип и направление связей относительно центра совпадают: все они идут к центру или все от него.' },
          { type: 'example', id: 'cross' },
        ],
      },
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
    sectionTitles: ['Связи'],
  },
  {
    title: 'Подсчёт очков',
    sectionTitles: ['Подсчёт очков'],
  },
];
