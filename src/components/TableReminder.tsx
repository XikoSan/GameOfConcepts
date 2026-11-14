import type { GameDeckSnapshot } from '../types';
import { getRelationPresets, getRelationFamilyLabel } from '../scoring/semanticRelations';

export function TableReminder({ snapshot }: { snapshot?: GameDeckSnapshot }) {
  return <section className="table-reminder" aria-label="Памятка">
                <h3>Памятка</h3>
                <h4>Типы связей</h4>
                <ul className="reminder-relations">
                  {getRelationPresets(snapshot).map((relation) => (
                    <li key={relation.family}>{getRelationFamilyLabel(relation.family)}</li>
                  ))}
                </ul>
                <div className="reminder-score">
                  <h4><span>Принятая связь</span><strong>1 очко</strong></h4>
                </div>
                <div className="reminder-score">
                  <h4><span>Смысловой путь</span><strong>+1 очко</strong></h4>
                  <p>Последовательность связей одного типа с согласованным направлением. Бонус даётся за продолжение через ваши карты. Крайние карты могут быть своими, чужими или нейтральными.</p>
                </div>
                <div className="reminder-score">
                  <h4><span>Смысловой узел</span><strong>+1 очко</strong></h4>
                  <p>Центр — ваша новая карта, соседи могут быть любыми. Связи одного типа идут все к центру или все от него. Вторая и следующие такие связи дают по +1 за узел. Связь со старым центром бонуса узла не даёт.</p>
                </div>
                <p className="reminder-score-total">Бонусы складываются. До 3 очков за новую связь.</p>
              </section>;
}
