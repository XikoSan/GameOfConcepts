import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Modal } from './Modal';
import './Tutorial.css';
import gameModesImage from '../assets/tutorial/game-modes.png';
import deckSetupImage from '../assets/tutorial/deck-setup.png';
import startingHandImage from '../assets/tutorial/starting-hand.png';
import neutralStartImage from '../assets/tutorial/neutral-start.png';

import overviewImage from '../assets/tutorial/interface-overview.png';
import moveImage from '../assets/tutorial/move-on-board.png';
import pickerImage from '../assets/tutorial/relation-picker.png';
import votingImage from '../assets/tutorial/voting.png';
import logImage from '../assets/tutorial/log-details.png';
import pathImage from '../assets/tutorial/path-bonus.png';
import nodeImage from '../assets/tutorial/node-bonus.png';

function TutorialTerm({ children, explanation }: { children: ReactNode; explanation: ReactNode }) {
  const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const open = Boolean(position);
  const id = useId();
  const show = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(265, window.innerWidth - 32);
    setPosition({
      left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)),
      ...(rect.top > window.innerHeight / 2
        ? { bottom: window.innerHeight - rect.top + 9 }
        : { top: rect.bottom + 9 }),
    });
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = () => setPosition(null);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', show, true);
    return () => { window.removeEventListener('resize', close); window.removeEventListener('scroll', show, true); };
  }, [open, show]);
  return (
    <span className="tutorial-term" onMouseEnter={show} onMouseLeave={() => setPosition(null)}>
      <button ref={buttonRef} type="button" aria-describedby={open ? id : undefined}
        onFocus={show} onBlur={() => setPosition(null)} onClick={show}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) { event.stopPropagation(); setPosition(null); }
        }}>{children}</button>
      {open && <span id={id} role="tooltip" className="tutorial-term-note" style={position ?? undefined}>{explanation}</span>}
    </span>
  );
}

const titles = ['Как начать', 'Колода и подготовка', 'Что перед вами', 'Что делать', 'Ваш ход', 'Голосование', 'Очки', 'Смысловой путь', 'Смысловой узел', 'Где искать помощь'];
type Shot = { src: string; alt: string; arrows?: 'path' | 'node' };
function ShotVisual({ shot }: { shot: Shot }) {
  if (!shot.arrows) return <img src={shot.src} alt={shot.alt} />;
  const path = shot.arrows === 'path';
  const width = path ? 212 : 324;
  const height = path ? 390 : 278;
  return <svg className="tutorial-annotated-shot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={shot.alt}>
    <image href={shot.src} width={width} height={height} />
    {(path ? [{ x: 106, y: 114, rotate: 0 }, { x: 106, y: 226, rotate: 0 }]
      : [{ x: 164, y: 62, rotate: -90 }, { x: 220, y: 118, rotate: 180 }]).map(arrow => (
      <g key={`${arrow.x}-${arrow.y}`} transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.rotate})`} aria-hidden="true">
        <circle r="12" fill="#253e4c" stroke="#b5c5c9" strokeWidth="0.8" />
        <path d="M 0 6 V -6 M -4 -2 L 0 -6 L 4 -2" fill="none" stroke="#f4e8cb" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    ))}
  </svg>;
}
const extraShots: Record<number, Shot[]> = {
  2: [{ src: overviewImage, alt: 'Игровой экран: игроки сверху, поле в центре, рука снизу, управление и лог справа.' }],
  3: [{ src: logImage, alt: 'Принятый ход: «Радость» — причина «Улыбки», начислено одно очко.' }],
  4: [{ src: pickerImage, alt: 'Выбор типа «Причина» и направления связи на игровом поле.' }],
  5: [{ src: moveImage, alt: 'Связь подготовлена к голосованию.' }, { src: votingImage, alt: 'Принять или отклонить предложенные связи.' }],
  6: [],
  7: [{ src: pathImage, arrows: 'path', alt: 'Спорт вызывает усталость, усталость вызывает сон. Причинная последовательность из трёх карт.' }],
  8: [{ src: nodeImage, arrows: 'node', alt: 'Радость вызывает улыбку и смех. Новая связь с центром узла даёт два очка.' }],
  9: [],
};
function ExtraCopy({ step }: { step: number }) {
  switch (step) {
    case 2: return <>
      <p>Сверху — имена игроков, статус хода и общий счёт.</p>
      <div className="tutorial-explanation"><h4>Поле и рука</h4><p>В центре вы выкладываете карты. Внизу — ваша рука и колода.</p></div>
      <div className="tutorial-explanation"><h4>Если рука не подходит</h4><p>До выкладывания карты можно один раз за партию пересдать всю руку: пять карт уйдут вниз вашей колоды, а взамен вы получите пять новых. Ход остаётся у вас.</p></div>
      <div className="tutorial-explanation"><h4>Правая панель</h4><p>Здесь находятся управление партией, лог ходов и памятка с типами связей и начислением очков. Подробные объяснения доступны в «Правилах».</p></div>
    </>;
    case 3: return <>
      <p className="tutorial-intro">Находите смысловые связи между понятиями и объясняйте их другим игрокам.</p>
      <div className="tutorial-explanation"><p>Каждая обоснованная и принятая связь приносит очки. Просто поставить карту рядом недостаточно.</p></div>
      <div className="tutorial-explanation"><h4>Пример</h4><p>«Радость — <u>причина</u> улыбки». Если остальные принимают объяснение, игрок получает 1 очко.</p></div>
      <div className="tutorial-explanation"><p>Цель — набрать больше очков к <TutorialTerm explanation="Условие окончания выбирают перед началом партии: когда закончится колода или когда один из игроков наберёт 30, 50 либо 70 очков.">концу партии</TutorialTerm>.</p></div>
    </>;
    case 4: return <>
      <p>Перетащите карту из руки на свободную клетку, которая соприкасается стороной с картой на поле.</p>
      <div className="tutorial-explanation"><p>Нажмите на связь между картами. Выберите её тип и, если требуется, <TutorialTerm explanation={<>Направление определяет роли понятий. «Радость — <u>причина</u> улыбки» и «Улыбка — <u>причина</u> радости» — разные связи: меняются причина и следствие.</>}>направление</TutorialTerm>. Отправьте на голосование.</p></div>
      <div className="tutorial-explanation"><p>Новую карту можно связать с несколькими соседями. Для каждого соседа связь выбирается отдельно.</p></div>
      <p className="tutorial-hint">Для хода нужна хотя бы одна связь. Выбирайте место, где у новой карты нет соседей с тем же понятием.</p>
    </>;
    case 5: return <>
      <p>Остальные игроки принимают или отклоняют предложенные связи. Автор хода не голосует.</p>
      <div className="tutorial-explanation"><h4>Ход принят</h4><p>Если большинство остальных игроков за, карта остаётся на поле, начисляются очки, рука пополняется до пяти карт. Ход переходит дальше.</p></div>
      <div className="tutorial-explanation"><h4>Ход отклонён</h4><p>Карта возвращается в руку, очки не начисляются. Тот же игрок пробует снова. При равенстве голосов ход отклоняется.</p></div>
    </>;
    case 6: return <>
      <p className="tutorial-intro">Каждая новая принятая связь приносит <strong>1 очко</strong>.</p>
      <div className="tutorial-explanation"><p>За смысловой путь к ней может добавиться <strong>+1</strong>, за смысловой узел — ещё <strong>+1</strong>. Их разберём на следующих шагах.</p></div>
      <div className="tutorial-explanation"><p>Бонусы складываются: до <strong>3 очков за одну новую связь</strong>. Если связей несколько, очки за них суммируются.</p></div>
    </>;
    case 7: return <>
      <p>В смысловом пути связь идёт от первой карты ко второй, затем от второй к третьей. На каждом шаге сохраняется один тип связи: так получается последовательность.</p>
      <div className="tutorial-explanation"><h4>Спорт → Усталость → Сон</h4><p>Спорт <u>вызывает</u> усталость, усталость <u>вызывает</u> сон. Усталость сначала выступает следствием, затем — причиной.</p></div>
      <div className="tutorial-explanation"><p>Промежуточные карты должны быть <TutorialTerm explanation="Промежуточные карты должны принадлежать вам. Крайние могут быть вашими, чужими или нейтральными. Последовательность может поворачивать на поле. Для симметричной противоположности направление не учитывается.">вашими</TutorialTerm>.</p></div>
      <div className="tutorial-callout">Если новая связь входит в смысловой путь, она приносит 2 очка: 1 за принятую связь и ещё 1 за путь. Длина пути не увеличивает эти 2 очка.</div>
    </>;
    case 8: return <>
      <p>В смысловом узле несколько понятий связаны с одним центром одинаковым типом связи и направлением: все к центру или все от него.</p>
      <div className="tutorial-explanation"><h4>Радость — <u>причина</u> улыбки и смеха</h4><p>«Радость» — центр узла. Новая связь приносит <strong>1 за связь + 1 за поддержание смыслового узла</strong>.</p></div>
      <div className="tutorial-explanation"><p>Нужны как минимум <TutorialTerm explanation="Окружающие карты узла принадлежат одному игроку. Центр может быть вашим, чужим или нейтральным. Узел состоит из трёх и более карт.">две ваши карты вокруг центра</TutorialTerm>.</p></div>
      <p className="tutorial-hint">Если та же новая связь одновременно подходит для пути, оба бонуса складываются.</p>
    </>;
    case 9: return <>
      <div className="tutorial-explanation"><h4>Справка о понятии</h4><p>Наведитесь на карту, чтобы открыть справку о понятии из Википедии.</p></div>
      <div className="tutorial-explanation"><h4>Лог партии</h4><p>Наведите курсор на запись хода, чтобы увидеть объяснение связей и начисленные очки.</p></div>
    </>;
    default: return null;
  }
}

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [zoom, setZoom] = useState<Shot | null>(null);
  const closeZoom = () => { setZoom(null); requestAnimationFrame(() => { const buttons = rootRef.current?.querySelectorAll<HTMLButtonElement>('.tutorial-shot-button'); Array.from(buttons ?? []).find(button => button.dataset.shot === zoom?.src)?.focus(); }); };
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    headingRef.current?.focus();
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const buttons = rootRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
    if (!buttons?.length) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  };

  return (
    <div ref={rootRef} className="tutorial-host" onKeyDown={trapFocus}>
      <Modal title="Быстрое обучение" onClose={zoom ? closeZoom : onClose}>
        <div className="tutorial">
          {zoom ? <div className="tutorial-zoom"><ShotVisual shot={zoom} /><button autoFocus type="button" onClick={closeZoom}>Вернуться к шагу</button></div> : <div className={`tutorial-body tutorial-body--${step}`} ref={bodyRef}>
            <div className={`tutorial-screenshots tutorial-screenshots--${step}`}>
              {step === 6 ? <div className="tutorial-score-diagram" aria-label="1 очко за связь, плюс 1 за путь, плюс 1 за узел; до 3 очков"><div><strong>1</strong><span>Связь</span></div><div><strong>+1</strong><span>Путь</span></div><div><strong>+1</strong><span>Узел</span></div><p>До <b>3</b> очков</p></div> : step >= 2 ? extraShots[step].map(shot => <button key={shot.src} data-shot={shot.src} type="button" className="tutorial-shot tutorial-shot-button" aria-label="Увеличить скриншот" onClick={() => setZoom(shot)}><ShotVisual shot={shot} /><span className="tutorial-enlarge">Увеличить</span></button>) : step === 0 ? (
                <div className="tutorial-shot tutorial-modes-shot">
                  <img src={gameModesImage} alt="Кнопки «Онлайн игра» и «Локальная игра»." />
                </div>
              ) : <>
                <div className="tutorial-shot tutorial-setup-shot">
                  <img src={deckSetupImage} alt="1 — выбор числа игроков и колоды в окне локальной игры." />
                  <span className="tutorial-pin" aria-hidden="true">1</span>
                </div>
                <div className="tutorial-shot tutorial-hand-shot">
                  <img src={startingHandImage} alt="2 — пять карт на руке после начала партии." />
                  <span className="tutorial-pin" aria-hidden="true">2</span>
                </div>
                <div className="tutorial-shot tutorial-neutral-shot">
                  <img src={neutralStartImage} alt="3 — нейтральная карта в центре поля." />
                  <span className="tutorial-pin" aria-hidden="true">3</span>
                </div>
              </>}
            </div>
            <section className="tutorial-copy" aria-labelledby="tutorial-step-title">
              <span className="tutorial-eyebrow">Первая партия</span>
              <h3 id="tutorial-step-title" ref={headingRef} tabIndex={-1}>{titles[step]}</h3>
              {step >= 2 ? <ExtraCopy step={step} /> : step === 0 ? <>
              <p className="tutorial-intro">В игре участвуют от двух до четырёх человек.</p>
              <div className="tutorial-explanation">
                <h4>Локальная игра</h4>
                <p>Играйте по очереди на одном устройстве.</p>
              </div>
              <div className="tutorial-explanation">
                <h4>Онлайн игра</h4>
                <p>Каждый играет со своего устройства. Один игрок создаёт{' '}
                  <TutorialTerm explanation="Общее место для вашей онлайн-партии. Остальные игроки находят её в списке доступных комнат и присоединяются. Затем создатель запускает партию.">комнату</TutorialTerm>, остальные присоединяются к ней.</p>
              </div>
              </> : <>
                <p className="tutorial-intro"><span className="tutorial-text-pin" aria-hidden="true">1</span>Перед началом выберите колоду. От неё зависят понятия на картах. Во всех колодах одинаковые{' '}
                  <TutorialTerm explanation={<>Тип связи обозначает, как соотносятся два понятия. Например, одно <u>является частью</u> другого или <u>является причиной</u> другого. Доступны пять типов: Вид, Часть, Причина, Свойство, Противоположность.</>}>типы связей</TutorialTerm>.</p>
                <div className="tutorial-explanation">
                  <p><span className="tutorial-text-pin" aria-hidden="true">2</span>Каждый игрок получает собственную копию выбранной колоды и пять карт на руку.</p>
                </div>
                <div className="tutorial-explanation">
                  <p><span className="tutorial-text-pin" aria-hidden="true">3</span>В центре появляется случайная{' '}
                    <TutorialTerm key="neutral" explanation="Не принадлежит ни одному игроку. С ней можно создавать связи. Она выбирается из отдельного нейтрального набора выбранной колоды.">нейтральная карта</TutorialTerm>.
                    {' '}Первый игрок определяется случайно.</p>
                </div>
              </>}
              {step === 0 && <p className="tutorial-hint">Подчёркнутые слова содержат пояснения — наведите курсор или нажмите.</p>}
            </section>
          </div>}
          {!zoom && <footer className="tutorial-footer">
            <button type="button" className="tutorial-back" disabled={step === 0} onClick={() => setStep(value => value - 1)}>Назад</button>
            <span aria-live="polite" aria-label={`Шаг ${step + 1} из ${titles.length}`}>{step + 1} / {titles.length}</span>
            <button type="button" className="tutorial-done" onClick={step < titles.length - 1 ? () => setStep(value => value + 1) : onClose}>{step < titles.length - 1 ? 'Далее' : 'К игре'}</button>
          </footer>}
        </div>
      </Modal>
    </div>
  );
}
