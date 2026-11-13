import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExportOptions, buildDiagnosticQuery, csvCell, renderDiagnosticMarkdown } from '../scripts/export-diagnostics.mjs';

test('diagnostic export requires a single explicit target and refuses SQL-like selectors', () => {
  for (const args of [[], ['--room', 'ABCD1234', '--relations'], ['--session', "x';drop", '--source', 'online'], ['--room', "X' OR 1"], ['--session', 'x'], ['--relations', '--since', '2026-02-30'], ['--room','ABCD1234','--deck','emotions']]) assert.throws(() => parseExportOptions(args));
  assert.equal(buildDiagnosticQuery(parseExportOptions(['--room', 'abcd1234'])), "select game_diagnostics.export_room('ABCD1234') as archive;");
  assert.equal(buildDiagnosticQuery(parseExportOptions(['--source','local','--session','card_123-abc'])), "select game_diagnostics.export_session('local', 'card_123-abc') as archive;");
});
test('relation CSV preserves quotes/newlines and neutralizes spreadsheet formulas', () => {
  assert.equal(csvCell('Слово,"цитата"\nещё'), '"Слово,""цитата""\nещё"');
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(csvCell(null), '""');
});
test('diagnostic Markdown retains ordered snapshot events for offline review', () => {
  const md = renderDiagnosticMarkdown({ events: [{ event_type:'start', occurred_at:'2026-11-13', snapshot:{scores:[0,0]} }, { event_type:'accepted', snapshot:{scores:[1,0]} }] });
  assert.ok(md.indexOf('## start') < md.indexOf('## accepted'));
  assert.match(md,/Игрок 1 — 1/);
  assert.match(md,/Событий: 2/);
});
