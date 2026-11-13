import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const help = `Служебная выгрузка GameOfConcepts (нужен вход владельца через Supabase CLI).
  npm run diagnostics:export -- --room ABCD1234 --out ./private-exports/party
  npm run diagnostics:export -- --source local --session START_CARD_ID --out ./private-exports/local
  npm run diagnostics:export -- --relations --out ./private-exports/relations
Партия: JSON и Markdown, архив моложе 30 дней. Отношения для будущего соперника: CSV и JSON.
Для отношений доступны --deck emotions|discussion и --since YYYY-MM-DD.
SUPABASE_CLI задаёт путь к CLI. Серверный ключ не нужен в приложении или аргументах команды.`;

export function parseExportOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const name = args[i];
    if (name === '--help' || name === '-h') return { help: true };
    if (name === '--relations') { options.relations = true; continue; }
    const key = { '--room': 'room', '--session': 'session', '--source': 'source', '--out': 'out', '--deck': 'deck', '--since': 'since' }[name];
    if (!key || !args[i + 1] || args[i + 1].startsWith('--') || options[key] !== undefined) throw Error(`Неверный аргумент: ${name}. Используйте --help.`);
    options[key] = args[++i];
  }
  if (Number(Boolean(options.room)) + Number(Boolean(options.session)) + Number(Boolean(options.relations)) !== 1) throw Error('Укажите ровно один источник: --room, --session или --relations.');
  if (options.room && !/^[a-z0-9]{5,8}$/i.test(options.room)) throw Error('Код комнаты должен содержать 5–8 букв или цифр.');
  if (options.session && (!/^[a-zA-Z0-9_.:-]{1,250}$/.test(options.session) || !['local', 'online'].includes(options.source))) throw Error('Для --session нужны корректный идентификатор и --source local|online.');
  if (!options.session && options.source) throw Error('--source используется только с --session.');
  if ((options.deck || options.since) && !options.relations) throw Error('--deck и --since используются только с --relations.');
  if (options.deck && !/^[a-zA-Z0-9_-]{1,100}$/.test(options.deck)) throw Error('Неверный идентификатор колоды.');
  if (options.since && (!/^\d{4}-\d{2}-\d{2}$/.test(options.since) || Number.isNaN(Date.parse(`${options.since}T00:00:00Z`)) || new Date(`${options.since}T00:00:00Z`).toISOString().slice(0, 10) !== options.since)) throw Error('Дата --since должна иметь вид YYYY-MM-DD.');
  options.out = resolve(options.out ?? join(projectRoot, 'private-exports', options.relations ? 'relations' : options.room?.toUpperCase() ?? options.session));
  return options;
}

export function buildDiagnosticQuery(options) {
  const literal = value => `'${value.replaceAll("'", "''")}'`;
  return options.room
    ? `select game_diagnostics.export_room(${literal(options.room.toUpperCase())}) as archive;`
    : `select game_diagnostics.export_session(${literal(options.source)}, ${literal(options.session)}) as archive;`;
}

export function csvCell(value) {
  const text = value == null ? '' : String(value);
  // Concept names should never execute as formulas in a spreadsheet application.
  const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function renderDiagnosticMarkdown(archive) {
  const events = Array.isArray(archive) ? archive : archive?.events ?? [];
  const clean = value => String(value ?? '—').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('`', '\\`');
  const linesForScore = score => {
    if (!score?.edges) return [];
    const result = [];
    for (const edge of score.edges) {
      const why = edge.explanation;
      result.push(`- **${clean(why?.relation ?? edge.pendingEdgeId)}: +${edge.total}** — связь ${edge.baseScore}, путь ${edge.pathBonus}, узел ${edge.nodeBonus}.`);
      if (why?.path) result.push(`  - Путь: ${why.path.cards.map(card => clean(card.name)).join(why.path.edges?.[0]?.relation?.family === 'opposite' ? ' ↔ ' : ' → ')}.`);
      if (why?.node) result.push(`  - Узел, центр «${clean(why.node.center.name)}»: ${why.node.edges.map(item => clean(item.label)).join('; ')}.`);
    }
    result.push(``, `Всего: **+${score.total}**.`, '');
    return result;
  };
  const lines = ['# Диагностический архив партии', '', `Выгружено: ${new Date().toISOString()}`, '', `Событий: ${events.length}. Игроки обозначены номерами; руки и данные авторизации не экспортируются.`, ''];
  let previousLogIndex = -1;
  for (const event of events) {
    const snapshot = event.snapshot ?? {};
    lines.push(`## ${clean(event.event_type ?? event.type ?? 'Событие')} — ${clean(event.occurred_at ?? event.received_at)}`, '',
      `Источник: ${clean(event.source)}. Версия: ${clean(event.client_version ?? event.server_version)}. Партия: ${clean(event.session_id)}.`, '',
      `Счёт: ${(snapshot.scores ?? []).map((value, seat) => `Игрок ${seat + 1} — ${value}`).join('; ') || 'не сохранён'}.`, '');
    if (snapshot.pendingMove) lines.push(`Предложена карта **${clean(snapshot.pendingMove.cardName)}**, игрок ${snapshot.pendingMove.placedBySeatIndex + 1}.`, '', ...linesForScore(snapshot.pendingMove.scorePreview));
    for (const move of snapshot.logDetails ?? []) {
      if (move.index <= previousLogIndex) continue;
      lines.push(`### Принятый ход ${move.index + 1}: Игрок ${move.playerId + 1} — ${clean(move.cardName)}`, '', ...linesForScore(move.semanticScore));
      previousLogIndex = Math.max(previousLogIndex, move.index);
    }
    if (snapshot.pendingFinish) lines.push(`Предложено завершить партию. Голоса по местам: ${clean(JSON.stringify(snapshot.pendingFinish.votes))}.`, '');
    if (snapshot.gameOver) lines.push(`**Партия завершена:** ${clean(snapshot.endReason)}.`, '');
    if (snapshot.board?.length) {
      lines.push('### Поле', '', '| Понятие | Владелец | X | Y |', '|---|---|---:|---:|');
      for (const card of snapshot.board) lines.push(`| ${clean(card.cardName)} | ${card.playerId === null ? 'Нейтральная' : `Игрок ${card.playerId + 1}`} | ${card.x} | ${card.y} |`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

async function query(sql) {
  const folder = await mkdtemp(join(tmpdir(), 'goc-export-'));
  try {
    const file = join(folder, 'query.sql');
    await writeFile(file, sql, { mode: 0o600 });
    const cliArgs = ['db', 'query', '--linked', '--project-ref', process.env.SUPABASE_PROJECT_REF ?? 'ipvwpnrncxoalefqyyue', '--file', file];
    const result = spawnSync(process.env.SUPABASE_CLI ?? 'supabase', cliArgs, { cwd: projectRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (result.error?.code === 'ENOENT') throw Error('Supabase CLI не найден. Задайте путь через SUPABASE_CLI.');
    if (result.error || result.status !== 0) throw Error('Не удалось прочитать архив. Проверьте вход Supabase CLI и применение diagnostics.sql.');
    const data = JSON.parse(result.stdout.slice(result.stdout.indexOf('{'), result.stdout.lastIndexOf('}') + 1));
    if (!Array.isArray(data.rows)) throw Error('Supabase CLI вернул неизвестный формат ответа.');
    return data.rows;
  } finally { await rm(folder, { recursive: true, force: true }); }
}

async function main() {
  const options = parseExportOptions(process.argv.slice(2));
  if (options.help) { console.log(help); return; }
  await mkdir(dirname(options.out), { recursive: true });
  if (options.relations) {
    const filters = [];
    if (options.deck) filters.push(`deck_id = '${options.deck}'`);
    if (options.since) filters.push(`received_at >= '${options.since}'::date`);
    const where = filters.length ? `where ${filters.join(' and ')}` : '';
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await query(`select source,session_id,edge_id,move_id,deck_id,from_name,to_name,from_definition_id,to_definition_id,family,from_role,to_role,received_at from relation_research.accepted_relations ${where} order by received_at,source,session_id,edge_id limit 1000 offset ${offset};`);
      rows.push(...page);
      if (page.length < 1000) break;
    }
    const columns = ['source', 'session_id', 'edge_id', 'move_id', 'deck_id', 'from_name', 'to_name', 'from_definition_id', 'to_definition_id', 'family', 'from_role', 'to_role', 'received_at'];
    await writeFile(`${options.out}.csv`, '\uFEFF' + [columns.map(csvCell).join(','), ...rows.map(row => columns.map(name => csvCell(row[name])).join(','))].join('\r\n') + '\r\n', { mode: 0o600 });
    await writeFile(`${options.out}.json`, JSON.stringify({ exported_at: new Date().toISOString(), count: rows.length, relations: rows }, null, 2) + '\n', { mode: 0o600 });
    console.log(`Выгружено отношений: ${rows.length}. Файлы: ${options.out}.csv и .json`);
  } else {
    const archive = (await query(buildDiagnosticQuery(options)))[0]?.archive;
    const events = Array.isArray(archive) ? archive : archive?.events;
    if (!Array.isArray(events) || !events.length) throw Error('Архив не найден: проверьте код/идентификатор. Данные старше 30 дней и партии до подключения архива недоступны.');
    await writeFile(`${options.out}.json`, JSON.stringify(archive, null, 2) + '\n', { mode: 0o600 });
    await writeFile(`${options.out}.md`, renderDiagnosticMarkdown(archive), { mode: 0o600 });
    console.log(`Выгружено событий: ${events.length}. Файлы: ${options.out}.json и .md`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url).endsWith('/scripts/export-diagnostics.mjs') && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error instanceof Error ? error.message : 'Не удалось выгрузить данные.'); process.exitCode = 1; });
