# Project Instructions

## Language

- Отвечать пользователю на русском языке.
- Итоговые ответы держать короткими и практичными.

## Game Rules

- `game-rules.md` считается основным источником правил игры.
- Перед изменением правил, подсчёта очков, текста окна "Правила" или игровых ограничений сверяться с `game-rules.md`.
- Не менять игровую механику, список карт, подсчёт очков или правила размещения без прямого запроса.
- Physical adjacency does not create a semantic edge automatically.
- A move requires at least one accepted semantic edge.
- Every accepted new edge gives +1.
- A new edge may receive at most one path bonus and one node bonus.
- Path and node bonuses stack.
- A semantic path continues through cards owned by the player.
- A foreign or neutral card may be a terminal endpoint.
- A foreign or neutral card cannot be an internal continuation vertex.
- Path continuation requires head-to-tail semantic direction.
- Same-source or same-target edges may form a node, not a path.
- A node center may be owned, foreign, or neutral.
- Relation family and direction together define connectivity.
- Pending edges are scored in creation order.

## Online And Supabase

- Online-режим использует Supabase `rooms` и Realtime.
- Состояние партии хранится в `rooms.game_state`; локальные UI-состояния вроде камеры, zoom, hover, drag и модалок не синхронизировать.
- Для online-комнат учитывать `players`, `max_players`, `turn_order`, `current_turn_index`, `host_player_id` и `version`.
- При изменении online-логики сохранять совместимость локального режима.
- Не создавать legacy-комнаты без новых multiplayer-полей. Если схема Supabase не готова, показывать понятную ошибку.
- SQL-изменения хранить в `supabase/*.sql`.

## UI Constraints

- Не менять общий layout и визуальный стиль без прямого запроса.
- Карты в руке должны оставаться читаемыми и без переноса названия.
- Карты на поле должны оставаться компактными; текст должен помещаться внутри клетки.
- Tooltip и справка по понятию не должны ломать drag and drop, pending actions и camera pan.
- В online-режиме рука оппонента скрывается только в UI; помнить, что это MVP-ограничение.

## Card Catalog And Deck Architecture

- Catalog size is dynamic. The planned first full catalog is 40/40/20, not a hard limit.
- The approved 100-card catalog is connected with the first release distribution 40 easy / 40 medium / 20 hard.
- Card definitions use stable ids; game cards use separate instance ids.
- Standard deck ids are `easy`, `medium`, `hard`, and `mixed-all`.
- Standard decks derive from difficulty, and custom decks reference card definition ids.
- Deck sizes are arbitrary; counts must be derived from arrays, not stored as manual constants.
- Local games can choose a standard deck before starting.
- Online room hosts choose a standard deck; joining players use the room snapshot.
- Active games use deck snapshots as the source of card composition so later catalog edits affect only new games.
- Current UI does not expose deck editing.
- Custom deck UI and mixed-ratio UI are intentionally absent for now.
- Card roles and connection examples from planning docs are not runtime card data.

Future steps:
1. Обсудить критерии сложности.
2. Составить 100 карт.
3. Заполнить difficulty и stable ids.
4. Проверить catalog validation.
5. Подключить deck builder к local setup.
6. Добавить выбор колоды в online room creation.
7. Сохранять snapshot/config в game state.
8. Позже добавить редактор каталога и кастомных колод.

## Development Workflow

- Перед правками сначала читать существующий код и использовать текущие паттерны проекта.
- Для ручных правок использовать `apply_patch`.
- Не откатывать пользовательские изменения без явного запроса.
- После значимых изменений запускать:
  - `npm run build`
  - `npm run lint`
- Перед коммитом проверять `git status --short` и не включать случайные файлы.

## MVP Comments

- Реальные временные решения помечать точными комментариями:
  - `// TODO(MVP): ...`
  - `// FIXME(MVP): ...`
  - `// TEMP(MVP): ...`
- Не добавлять очевидные или шумные комментарии.

## Architecture Comments

- При отдельной задаче на документирование кода добавлять короткие осмысленные комментарии к неочевидной логике проекта.
- Комментарии должны помогать быстро понимать назначение блоков, различать online/local логику, не возвращать случайно старые ограничения на двух игроков и понимать источник истины multiplayer-состояния.
- Не менять поведение приложения при такой задаче: это только документирование существующей архитектуры.
- Комментарии должны объяснять:
  - почему решение устроено именно так;
  - какое ограничение оно предотвращает;
  - какой источник данных считается главным;
  - почему нельзя заменить код более простой старой логикой;
  - какие online/local различия важно сохранить;
  - какие участки требуют осторожности при рефакторинге.
- Не добавлять комментарии, которые просто повторяют код.
- Предпочитать короткие комментарии: одна строка или максимум 2-3 строки для сложного ограничения.
- Для технических комментариев в коде предпочитать английский язык, так как типы, функции и переменные уже на английском.
- Не комментировать очевидные JSX-блоки: обычные кнопки, простые `div`, `map`, обычный `setState`, очевидные CSS-свойства и импорты.
- JSX комментировать только там, где есть важная архитектурная причина, например почему online mode рендерит только руку локального игрока.

### Commenting Targets

- `roomService.ts`:
  - `createRoom`: почему legacy fallback отключён; почему комната создаётся только с новой multiplayer-схемой; почему `maxPlayers` нормализуется в диапазоне 2-4; почему insert использует `.select().single()`; почему нельзя молча создавать комнату без multiplayer-полей.
  - `joinRoom`: как выбирается первый свободный `seatIndex`; почему `seatIndex` нельзя определять по длине `players`; почему `playerId` проверяется на повторное подключение; почему `turn_order` хранится отдельно от массива `players`.
  - `ensureGameStateCapacity`: зачем расширяются hands/decks/scores; как поддерживаются старые или частично созданные комнаты; почему функция не должна уменьшать уже существующие массивы; почему `seatIndex` 2/3 должен оставаться валидным.
  - `deleteRoom`: почему удаление разрешено только host; почему используется `host_player_id` с fallback на `player_1_id`; почему delete обязательно фильтруется по room id.
  - `subscribeToRoom`: как обрабатывается DELETE; почему удаление комнаты очищает локальное состояние всех клиентов; что Realtime доставляет состояние, но не является отдельным источником игровой логики.
- `useMultiplayerGameState.ts`:
  - active seat: `current_turn_index` является индексом внутри `turn_order`, а не `seatIndex`; active seat вычисляется через `turn_order` и `room.players`.
  - local seat: вычисляется по stable `playerId`; нельзя использовать индекс клиента в `players`; нельзя использовать fallback `0`, если игрок не найден.
  - `pendingMove`: хранится как общее состояние комнаты; автор хода не входит в `requiredVoters`; `votes` индексируются по `playerId`; игрок не должен голосовать повторно.
  - majority voting: большинство считается среди остальных игроков; для трёх игроков голосуют двое; ничья означает отклонение, чтобы состояние не зависало; голосование заканчивается сразу, когда исход математически определён.
  - принятие хода: очки начисляются по `placedBySeatIndex`; нельзя использовать текущего локального игрока или reviewer; ход меняется только после окончательного принятия.
  - отклонение: карта возвращается автору; ход остаётся у автора; событие не попадает в игровой лог.
  - переход хода: использовать modulo `turn_order.length`, не возвращать `% 2`; поддерживать 2-4 игроков.
  - гонки голосов: перед голосом загружается свежая комната; новый голос мержится с уже сохранёнными; это минимальная защита от перезаписи параллельных голосов.
- `App.tsx`:
  - online/local режимы используют разные источники идентичности игрока; не объединять их механически.
  - в online отображается только рука локального игрока; локальный игрок определяется по `playerId`/`seatIndex`; чужие руки не должны возвращаться в UI.
  - в online используется nickname из `room.players`; техническое имя `Игрок N` остаётся только fallback.

### Good Comment Examples

```ts
// current_turn_index selects an entry in turn_order.
// Resolve that playerId back to a seat before accessing hands or scores.
```

```ts
// Seat indexes are stable game identities; array order may change after reconnects.
```

```ts
// Resolve the vote as soon as a majority is reached or accepting becomes impossible.
// This avoids waiting for votes that can no longer change the outcome.
```
