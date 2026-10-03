import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { suggestedTrainingMove, type TrainingState, type TrainingAction } from '../tutorial/trainingGame';
import type { Dispatch } from 'react';

interface Props {
  state: TrainingState; dragging: boolean; dispatch: Dispatch<TrainingAction>; onClose: () => void;
}

export function TrainingHint({ state, dragging, dispatch, onClose }: Props) {
  const { phase, feedback, game } = state;
  const ready = Boolean(game.pendingMove?.semanticEdges?.length);
  const suggestion = useMemo(() => phase === 'place' ? suggestedTrainingMove(state) : undefined, [state, phase]);
  const box = useRef<HTMLElement>(null);
  const arrow = useRef<HTMLSpanElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let frame = 0, lastMessage = '';
    const find = (selector: string, text?: string) => Array.from(document.querySelectorAll<HTMLElement>(selector))
      .find(el => !el.closest('[inert]') && (!text || el.textContent?.trim() === text));
    const update = () => {
      let target: HTMLElement | undefined;
      let text: string;
      const editor = find('.semantic-relation-popover');
      if (phase === 'intro') {
        target = find('.training-session .card-in-cell', 'Эмоция');
        text = 'Это нейтральная карта. Она не принадлежит игрокам. Чтобы начать игру, разместите карту рядом с ней и выберите связь.';
      } else if (phase === 'hand') {
        target = find('.training-session .cards-container');
        text = 'Это ваша рука: пять карт, из которых вы выбираете ход. Перетащите карту на свободную клетку рядом с картой на поле.';
      } else if (phase === 'deck') {
        target = find('.training-session .deck-stack');
        text = 'Это ваша колода. Число на ней — оставшиеся карты. После принятого хода вы автоматически добираете карту до пяти в руке. Для обучения подготовлены пять карт в руке и ещё пять в колоде.';
      } else if (phase === 'redraw') {
        target = find('.training-session .hand-redraw-button');
        text = 'Пересдача руки доступна один раз за обычную партию, до размещения карты: вся рука уходит вниз колоды, вы получаете новые карты и сохраняете ход. В обучении эта кнопка отключена.';
      } else if (phase === 'reminder') {
        target = find('.training-session .table-reminder');
        text = 'Справа — памятка с типами связей и подсчётом очков. Здесь можно проверить, сколько очков приносит связь и когда она получает бонус за участие в узле или пути.';
      } else if (phase === 'place') {
        target = find('.training-session .card', state.selected || suggestion?.name);
        const goal = !state.moves ? 'Начните с любой карты и разместите её рядом с нейтральной картой.' : !state.sawNode ? 'Попробуйте собрать узел вокруг «Эмоции». У вас уже есть связь с этой картой. Свяжите с ней ещё одну свою карту типом «Вид»: две ваши карты будут направлены к общему центру. Новая связь принесёт 1 очко за связь и ещё 1 за участие в узле.' : !state.sawPath ? 'Теперь попробуйте продолжить связь в путь: разместите разновидность рядом со своей эмоцией и свяжите их типом «Вид». Получится последовательность: разновидность → ваша эмоция → «Эмоция». Связи одного типа идут одна за другой через вашу карту. Новая связь принесёт 1 очко за связь и ещё 1 за участие в пути.' : 'Продолжите свой ход.';
        text = `${goal} ${suggestion ? `Например карта, «${suggestion.name}» как вид «${suggestion.neighbor}».` : ''} Перетащите карту из руки на свободную клетку рядом с уже выложенной картой.`;
      } else if (phase === 'relation' && editor) {
        const chosen = find('.semantic-popover-chips button[aria-pressed="true"]');
        const source = find('.semantic-popover-source button[aria-pressed="true"]');
        if (!chosen) {
          target = find('.semantic-popover-chips');
          text = 'Тип связи задаёт смысл вашего утверждения. Например, «Вид» означает разновидность, а «Противоположность» — противопоставление. Для эмоции и её разновидности выберите «Вид».';
        } else if (chosen.textContent?.trim() !== 'Противоположность' && !source) {
          target = find('.semantic-popover-source');
          text = 'Теперь задайте направление: выберите понятие, которое является видом, частью, причиной или свойством другого. Например, радость — вид эмоции, а не наоборот.';
        } else {
          target = find('.semantic-popover-primary');
          text = 'Проверьте получившуюся фразу. Кнопка «Добавить связь» сохранит этот выбор для текущего хода. Если карта соседствует с несколькими понятиями, каждую связь выбирают отдельно.';
        }
      } else if (phase === 'relation') {
        target = ready ? find('.semantic-submit-popover button', 'На голосование') : find('.training-session button[aria-label^="Связь между"]');
        text = ready ? 'Связь выбрана. Нажмите «На голосование», чтобы перейти к обоснованию.' : 'Чтобы связать соседние понятия, нажмите «+» между ними. Само соседство карт не создаёт связи и не приносит очков.';
      } else if (phase === 'explain') {
        target = find('.training-session .card-in-cell', game.pendingMove?.cardName);
        text = 'Объясните вслух, почему эти понятия связаны выбранным типом. Остальные игроки выслушают ваше обоснование и примут или отклонят ход.';
      } else if (phase === 'result') {
        target = find('.training-session .card-in-cell', game.logDetails?.[game.log.length - 1]?.score.cardName);
        text = 'Ход принят: карта остаётся на поле, а очки начислены.';
      } else if (phase === 'score') {
        target = find('.training-session .player-score-total');
        text = 'Здесь ваш общий счёт.';
      } else if (phase === 'log') {
        target = find('.training-session .sidebar-log');
        text = 'В логе сохраняются принятые ходы. Наведите курсор на запись, чтобы увидеть выбранные связи и расчёт очков.';
      } else if (phase === 'opponent') {
        target = find('.training-session .card-in-cell', game.pendingMove?.cardName);
        text = `Соперник предлагает ход. ${state.lastExplanation} Теперь вы голосуете за весь ход: принять или отклонить.`;
      } else if (phase === 'opponent-result') {
        target = find('.training-session .player-score-orange .player-score-total');
        text = feedback || 'Вы приняли ход соперника: его карта осталась на поле, а счёт вырос. Теперь снова ваш ход.';
      } else {
        target = find('.training-session .table-players');
        text = 'Вы прошли учебную партию: размещали карты, выбирали и обосновывали связи, голосовали и построили личный путь и узел.';
      }
      target ??= find('.training-session .board-section');
      if (text !== lastMessage) { lastMessage = text; setMessage(text); }
      const hint = box.current, pointer = arrow.current, outline = ring.current;
      if (hint && pointer && outline) {
        const rect = target?.getBoundingClientRect();
        const visible = rect && rect.width > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth && !dragging;
        hint.style.visibility = visible ? 'visible' : 'hidden';
        outline.style.visibility = visible ? 'visible' : 'hidden';
        if (visible && rect) {
          // Keep the hint outside the editor, leaving all relation controls accessible.
          const bounds = phase === 'relation' && editor ? editor.getBoundingClientRect() : rect;
          const w = hint.offsetWidth, h = hint.offsetHeight, gap = phase === 'relation' && ready ? 34 : 14, margin = 10;
          const cx = (rect.left + rect.right) / 2, cy = (rect.top + rect.bottom) / 2;
          const candidates = [
            { side: 'top', x: cx - w / 2, y: bounds.top - h - gap },
            { side: 'bottom', x: cx - w / 2, y: bounds.bottom + gap },
            { side: 'right', x: bounds.right + gap, y: cy - h / 2 },
            { side: 'left', x: bounds.left - w - gap, y: cy - h / 2 },
          ];
          const overflow = (p: typeof candidates[number]) => Math.max(0, margin - p.x) + Math.max(0, p.x + w + margin - innerWidth) + Math.max(0, margin - p.y) + Math.max(0, p.y + h + margin - innerHeight);
          const chosen = phase === 'opponent-result' ? candidates.find(candidate => candidate.side === 'bottom')! : ['log', 'reminder'].includes(phase) ? candidates.find(candidate => candidate.side === 'left')! : candidates.sort((a, b) => overflow(a) - overflow(b))[0];
          const x = Math.max(margin, Math.min(chosen.x, innerWidth - w - margin));
          const y = Math.max(margin, Math.min(chosen.y, innerHeight - h - margin));
          hint.style.left = x + 'px'; hint.style.top = y + 'px'; hint.dataset.side = chosen.side;
          const vertical = chosen.side === 'top' || chosen.side === 'bottom';
          pointer.style.left = vertical ? Math.max(16, Math.min(w - 24, cx - x - 5)) + 'px' : '';
          pointer.style.top = vertical ? '' : Math.max(16, Math.min(h - 24, cy - y - 5)) + 'px';
          Object.assign(outline.style, { left: rect.left - 3 + 'px', top: rect.top - 3 + 'px', width: rect.width + 6 + 'px', height: rect.height + 6 + 'px' });
        }
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [phase, ready, dragging, state, game, feedback, suggestion]);

  if (phase === 'voting' || (phase === 'relation' && state.moves > 0)) return null;

  return createPortal(<>
    <div ref={ring} className="training-target-ring" aria-hidden="true" />
    <section ref={box} className="training-guide" aria-label="Подсказка обучения">
      <span ref={arrow} className="training-guide-arrow" aria-hidden="true" />
      <button className="training-close" type="button" onClick={onClose} aria-label="Выйти из обучения">×</button>
      <div aria-live="polite" aria-atomic="true"><p>{message}</p>
        {feedback && phase !== 'opponent-result' && <p className="training-feedback">{feedback}</p>}
      </div>
      {['intro', 'hand', 'deck', 'redraw', 'result', 'score', 'reminder', 'log', 'opponent-result'].includes(phase) && <button className="training-primary" onClick={() => dispatch({ type: 'next' })}>{phase === 'redraw' ? 'К первому ходу' : 'Далее'}</button>}
      {phase === 'explain' && <button className="training-primary" onClick={() => dispatch({ type: 'explain' })}>На голосование</button>}
      {phase === 'opponent' && <div className="training-vote-actions"><button className="training-primary" onClick={() => dispatch({ type: 'reject-opponent' })}>Отклонить</button><button className="training-primary" onClick={() => dispatch({ type: 'approve-opponent' })}>Принять</button></div>}
      {phase === 'complete' && <button className="training-primary" onClick={onClose}>В меню</button>}
    </section>
  </>, document.body);
}
