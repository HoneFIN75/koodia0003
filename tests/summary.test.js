import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRanking } from '../js/ranking.js';
import {
  buildTopRows,
  buildWorldRankingRows,
  getDefaultSummarySort,
  getSummarySort,
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

test('buildWorldRankingRows jättää pois pelaajat ilman World Rankingia ja järjestää rankingin mukaan', () => {
  const rows = buildWorldRankingRows(ranking);

  assert.deepEqual(rows.map((row) => row.id), ['p2', 'p3', 'p1']);
  assert.deepEqual(rows.map((row) => row.worldRank), [1, 2, 3]);
  assert.deepEqual(rows.map((row) => row.totalPoints), [1310, 1245, 1520]);
});

test('World Ranking -taulukon oletuslajittelu on World Ranking nousevasti', () => {
  assert.deepEqual(getDefaultSummarySort('summary-world-ranking-mpo'), { field: 'worldRank', direction: 'asc' });
  assert.deepEqual(getSummarySort({}, 'summary-world-ranking-fpo'), { field: 'worldRank', direction: 'asc' });
  assert.deepEqual(getDefaultSummarySort('summary-top-mpo'), { field: 'rankPosition', direction: 'asc' });

  const rows = sortSummaryRows(buildWorldRankingRows([...ranking].reverse()), getSummarySort(undefined, 'summary-world-ranking-mpo'));
  assert.deepEqual(rows.map((row) => row.worldRank), [1, 2, 3]);
});

test('toggleSummarySort vaihtaa nousevan ja laskevan järjestyksen sarakkeittain', () => {
  const rows = buildWorldRankingRows(ranking);
  const tableId = 'summary-world-ranking-mpo';

  let sort = toggleSummarySort({}, tableId, 'worldRank');
  assert.deepEqual(sort[tableId], { field: 'worldRank', direction: 'desc' });
  assert.deepEqual(sortSummaryRows(rows, sort[tableId]).map((row) => row.worldRank), [3, 2, 1]);

  sort = toggleSummarySort(sort, tableId, 'pdgaRating');
  assert.deepEqual(sort[tableId], { field: 'pdgaRating', direction: 'asc' });
  assert.deepEqual(sortSummaryRows(rows, sort[tableId]).map((row) => row.pdgaRating), [998, 1025, 1045]);

  sort = toggleSummarySort(sort, tableId, 'pdgaRating');
  assert.deepEqual(sort[tableId], { field: 'pdgaRating', direction: 'desc' });
  assert.deepEqual(sortSummaryRows(rows, sort[tableId]).map((row) => row.pdgaRating), [1045, 1025, 998]);

  sort = toggleSummarySort(sort, tableId, 'totalPoints');
  assert.deepEqual(sortSummaryRows(rows, sort[tableId]).map((row) => row.totalPoints), [1245, 1310, 1520]);
  sort = toggleSummarySort(sort, tableId, 'totalPoints');
  assert.deepEqual(sortSummaryRows(rows, sort[tableId]).map((row) => row.totalPoints), [1520, 1310, 1245]);
});

test('toggleSummarySort pitää MPO- ja FPO-taulukoiden lajittelut erillään', () => {
  const original = {};
  let sort = toggleSummarySort(original, 'summary-world-ranking-mpo', 'pdgaRating');
  sort = toggleSummarySort(sort, 'summary-world-ranking-fpo', 'totalPoints');
  sort = toggleSummarySort(sort, 'summary-world-ranking-fpo', 'totalPoints');

  assert.deepEqual(original, {});
  assert.deepEqual(getSummarySort(sort, 'summary-world-ranking-mpo'), { field: 'pdgaRating', direction: 'asc' });
  assert.deepEqual(getSummarySort(sort, 'summary-world-ranking-fpo'), { field: 'totalPoints', direction: 'desc' });
  assert.deepEqual(getSummarySort(sort, 'summary-top-mpo'), { field: 'rankPosition', direction: 'asc' });
});

test('toggleSummarySort ohittaa tuntemattomat taulukot ja sarakkeet', () => {
  assert.deepEqual(toggleSummarySort({}, 'summary-world-ranking-mpo', 'name'), {});
  assert.deepEqual(toggleSummarySort({}, 'ranking', 'totalPoints'), {});
  assert.deepEqual(toggleSummarySort({}, 'summary-top-mpo', 'worldRank'), {});
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

  const sortedByRating = sortSummaryRows(rows, { field: 'pdgaRating', direction: 'asc' });
  assert.deepEqual(new Set(sortedByRating.map((row) => row.id)), new Set(rows.map((row) => row.id)));
  assert.equal(sortedByRating[0].rankPosition, 10);
});
