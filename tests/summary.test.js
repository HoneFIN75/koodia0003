import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRanking } from '../js/ranking.js';
import {
  SUMMARY_TABLES,
  buildTopRows,
  getDefaultSummarySort,
  getSummarySort,
  getSummarySortableFields,
  isSummaryTable,
  parseWorldRank,
  sortSummaryRows,
  toggleSummarySort,
} from '../js/summary.js';

const ranking = [
  { id: 'p1', name: 'Niklas Anttila', pdgaRating: 1045, worldRank: 3, totalPoints: 1520 },
  { id: 'p2', name: 'Jesse Nieminen', pdgaRating: 1025, worldRank: '1', totalPoints: 1310 },
  { id: 'p3', name: 'Tuomo Rikman', pdgaRating: 998, worldRank: 2, totalPoints: 1245 },
  { id: 'p4', name: 'Tyhjä Ranking', pdgaRating: 980, worldRank: '', totalPoints: 1000 },
  { id: 'p5', name: 'Null Ranking', pdgaRating: 970, worldRank: null, totalPoints: 900 },
  { id: 'p6', name: 'Puuttuva Ranking', pdgaRating: 960, totalPoints: 800 },
];

test('parseWorldRank hyväksyy vain positiiviset kokonaisluvut', () => {
  assert.equal(parseWorldRank(5), 5);
  assert.equal(parseWorldRank(' 12 '), 12);
  assert.equal(parseWorldRank(''), null);
  assert.equal(parseWorldRank(null), null);
  assert.equal(parseWorldRank(undefined), null);
  assert.equal(parseWorldRank(0), null);
  assert.equal(parseWorldRank('-3'), null);
  assert.equal(parseWorldRank('abc'), null);
});

test('TOP 10 -taulukon oletuslajittelu on kokonaispisteet laskevasti', () => {
  assert.deepEqual(getDefaultSummarySort('summary-top-mpo'), { field: 'totalPoints', direction: 'desc' });
  assert.deepEqual(getSummarySort({}, 'summary-top-fpo'), { field: 'totalPoints', direction: 'desc' });
  assert.deepEqual(getSummarySort({ 'summary-top-mpo': { field: 'unknown', direction: 'asc' } }, 'summary-top-mpo'), { field: 'totalPoints', direction: 'desc' });

  const rows = sortSummaryRows([...ranking].reverse(), getSummarySort(undefined, 'summary-top-mpo'));
  assert.deepEqual(rows.map((row) => row.totalPoints), [1520, 1310, 1245, 1000, 900, 800]);
});

test('Yhteenvedossa on vain TOP 10 MPO- ja TOP 10 FPO -taulukot, joissa kaikki sarakkeet ovat lajiteltavia', () => {
  assert.deepEqual(Object.keys(SUMMARY_TABLES), ['summary-top-mpo', 'summary-top-fpo']);
  assert.equal(isSummaryTable('summary-world-ranking-mpo'), false);
  assert.deepEqual(getSummarySortableFields('summary-top-mpo'), ['rankPosition', 'name', 'pdgaRating', 'worldRank', 'tournamentCount', 'totalPoints']);
  assert.deepEqual(getSummarySortableFields('ranking'), []);
});

test('toggleSummarySort vaihtaa nousevan ja laskevan järjestyksen sarakkeittain', () => {
  const rows = buildTopRows(ranking);
  const tableId = 'summary-top-mpo';

  let sort = toggleSummarySort({}, tableId, 'totalPoints');
  assert.deepEqual(sort[tableId], { field: 'totalPoints', direction: 'asc' });
  assert.deepEqual(sortSummaryRows(rows, sort[tableId]).map((row) => row.totalPoints), [800, 900, 1000, 1245, 1310, 1520]);
  sort = toggleSummarySort(sort, tableId, 'totalPoints');
  assert.deepEqual(sort[tableId], { field: 'totalPoints', direction: 'desc' });

  sort = toggleSummarySort(sort, tableId, 'rankPosition');
  assert.deepEqual(sort[tableId], { field: 'rankPosition', direction: 'asc' });
  assert.deepEqual(sortSummaryRows(rows, sort[tableId]).map((row) => row.rankPosition), [1, 2, 3, 4, 5, 6]);
  sort = toggleSummarySort(sort, tableId, 'rankPosition');
  assert.deepEqual(sortSummaryRows(rows, sort[tableId]).map((row) => row.rankPosition), [6, 5, 4, 3, 2, 1]);

  sort = toggleSummarySort(sort, tableId, 'name');
  assert.deepEqual(sort[tableId], { field: 'name', direction: 'asc' });
  assert.deepEqual(sortSummaryRows(rows, sort[tableId]).map((row) => row.id), ['p2', 'p1', 'p5', 'p6', 'p3', 'p4']);
  sort = toggleSummarySort(sort, tableId, 'name');
  assert.deepEqual(sort[tableId], { field: 'name', direction: 'desc' });
  assert.deepEqual(sortSummaryRows(rows, sort[tableId]).map((row) => row.id), ['p4', 'p3', 'p6', 'p5', 'p1', 'p2']);

  sort = toggleSummarySort(sort, tableId, 'pdgaRating');
  assert.deepEqual(sort[tableId], { field: 'pdgaRating', direction: 'desc' });
  assert.deepEqual(sortSummaryRows(rows, sort[tableId]).map((row) => row.pdgaRating), [1045, 1025, 998, 980, 970, 960]);
  sort = toggleSummarySort(sort, tableId, 'pdgaRating');
  assert.deepEqual(sort[tableId], { field: 'pdgaRating', direction: 'asc' });
  assert.deepEqual(sortSummaryRows(rows, sort[tableId]).map((row) => row.pdgaRating), [960, 970, 980, 998, 1025, 1045]);

  sort = toggleSummarySort(sort, tableId, 'worldRank');
  assert.deepEqual(sort[tableId], { field: 'worldRank', direction: 'asc' });
  assert.deepEqual(sortSummaryRows(rows, sort[tableId]).map((row) => row.id).slice(0, 3), ['p2', 'p3', 'p1']);
  sort = toggleSummarySort(sort, tableId, 'worldRank');
  assert.deepEqual(sort[tableId], { field: 'worldRank', direction: 'desc' });
  assert.deepEqual(sortSummaryRows(rows, sort[tableId]).map((row) => row.id).slice(-3), ['p1', 'p3', 'p2']);

  sort = toggleSummarySort(sort, tableId, 'tournamentCount');
  assert.deepEqual(sort[tableId], { field: 'tournamentCount', direction: 'desc' });
  const tournamentCounts = sortSummaryRows([
    { id: 'few', tournamentCount: 2 },
    { id: 'many', tournamentCount: 10 },
    { id: 'none', tournamentCount: 0 },
  ], sort[tableId]);
  assert.deepEqual(tournamentCounts.map((row) => row.id), ['many', 'few', 'none']);
});

test('toggleSummarySort pitää MPO- ja FPO-taulukoiden lajittelut erillään', () => {
  const original = {};
  let sort = toggleSummarySort(original, 'summary-top-mpo', 'pdgaRating');
  sort = toggleSummarySort(sort, 'summary-top-fpo', 'name');
  sort = toggleSummarySort(sort, 'summary-top-fpo', 'name');

  assert.deepEqual(original, {});
  assert.deepEqual(getSummarySort(sort, 'summary-top-mpo'), { field: 'pdgaRating', direction: 'desc' });
  assert.deepEqual(getSummarySort(sort, 'summary-top-fpo'), { field: 'name', direction: 'desc' });
});

test('toggleSummarySort ohittaa tuntemattomat taulukot ja sarakkeet', () => {
  assert.deepEqual(toggleSummarySort({}, 'summary-top-mpo', 'division'), {});
  assert.deepEqual(toggleSummarySort({}, 'ranking', 'totalPoints'), {});
  assert.deepEqual(toggleSummarySort({}, 'summary-world-ranking-mpo', 'worldRank'), {});
});

test('buildTopRows säilyttää TOP 10 -jäsenet ja rankinglaskennan järjestyksen', () => {
  const dataState = {
    players: Array.from({ length: 12 }, (_, index) => ({
      id: `p${index + 1}`,
      name: `Pelaaja ${String(index + 1).padStart(2, '0')}`,
      division: 'MPO',
      pdgaRating: 900 + index,
    })),
    tournaments: [{ id: 't1', name: 'Testi', startDate: '2026-07-01', multiplierId: 'm1' }],
    multipliers: [{ id: 'm1', name: 'Kerroin', abbreviation: 'K', multiplier: 1 }],
    pointsTable: { MPO: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [index + 1, 120 - index * 10])), FPO: {} },
    resultCards: Array.from({ length: 12 }, (_, index) => ({
      id: `result-card-p${index + 1}`,
      playerId: `p${index + 1}`,
      results: [{ tournamentId: 't1', placement: String(12 - index) }],
    })),
  };

  const fullRanking = buildRanking(dataState, 'MPO');
  const rows = buildTopRows(fullRanking);

  assert.equal(rows.length, 10);
  assert.deepEqual(rows.map((row) => row.id), fullRanking.slice(0, 10).map((row) => row.id));
  assert.deepEqual(rows.map((row) => row.rankPosition), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(rows.map((row) => row.totalPoints), fullRanking.slice(0, 10).map((row) => row.totalPoints));
  assert.deepEqual(rows.map((row) => row.tournamentCount), Array(10).fill(1));

  const sortedByRating = sortSummaryRows(rows, { field: 'pdgaRating', direction: 'asc' });
  assert.deepEqual(new Set(sortedByRating.map((row) => row.id)), new Set(rows.map((row) => row.id)));
  assert.equal(sortedByRating[0].rankPosition, 10);
});

test('buildRanking laskee vain yksilölliset turnaukset, joissa on validi tulos', () => {
  const dataState = {
    players: [
      { id: 'p1', name: 'Pelaaja', division: 'MPO' },
      { id: 'p2', name: 'Ilman tuloksia', division: 'MPO' },
    ],
    tournaments: [
      { id: 't1', multiplierId: 'm1' },
      { id: 't2', multiplierId: 'm1' },
    ],
    multipliers: [{ id: 'm1', multiplier: 1 }],
    pointsTable: { MPO: { 1: 100 }, FPO: {} },
    resultCards: [{
      id: 'result-card-p1',
      playerId: 'p1',
      results: [
        { tournamentId: 't1', placement: '1' },
        { tournamentId: 't1', placement: '1' },
        { tournamentId: 't2', placement: '0' },
        { tournamentId: 'missing', placement: '1' },
        { tournamentId: 't2', placement: '' },
      ],
    }],
  };

  const rankingRows = buildRanking(dataState, 'MPO');
  assert.equal(rankingRows.find((row) => row.id === 'p1').tournamentCount, 1);
  assert.equal(rankingRows.find((row) => row.id === 'p2').tournamentCount, 0);
});
