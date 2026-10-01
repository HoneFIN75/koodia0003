import { getTopRanking } from './ranking.js';
import { sortTableRows, toggleSortState } from './table-sorting.js';

// Yhteenveto-sivun taulukot. Jokaisella taulukolla on oma lajittelutilansa, jotta esimerkiksi
// World Ranking MPO voi olla lajiteltu ratingin ja World Ranking FPO kokonaispisteiden mukaan.
export const SUMMARY_TABLES = {
  'summary-world-ranking-mpo': { division: 'MPO', type: 'world-ranking', positionField: 'worldRank' },
  'summary-world-ranking-fpo': { division: 'FPO', type: 'world-ranking', positionField: 'worldRank' },
  'summary-top-mpo': { division: 'MPO', type: 'top', positionField: 'rankPosition' },
  'summary-top-fpo': { division: 'FPO', type: 'top', positionField: 'rankPosition' },
};

const SUMMARY_SORT_COLUMNS = {
  worldRank: { type: 'number' },
  rankPosition: { type: 'number' },
  pdgaRating: { type: 'number' },
  totalPoints: { type: 'number' },
};

export function isSummaryTable(tableId) {
  return Object.hasOwn(SUMMARY_TABLES, tableId);
}

export function getSummarySortableFields(tableId) {
  const table = SUMMARY_TABLES[tableId];
  return table ? [table.positionField, 'pdgaRating', 'totalPoints'] : [];
}

// Oletuksena taulukot lajitellaan sijoituksen mukaan nousevasti (paras ensin).
export function getDefaultSummarySort(tableId) {
  const table = SUMMARY_TABLES[tableId];
  return { field: table?.positionField || '', direction: 'asc' };
}

export function getSummarySort(summarySort, tableId) {
  const current = summarySort?.[tableId];
  if (current && getSummarySortableFields(tableId).includes(current.field) && (current.direction === 'asc' || current.direction === 'desc')) {
    return { field: current.field, direction: current.direction };
  }

  return getDefaultSummarySort(tableId);
}

// Palauttaa uuden lajittelutilan muuttamatta muiden taulukoiden tiloja.
export function toggleSummarySort(summarySort, tableId, field) {
  const nextState = { ...(summarySort || {}) };
  if (!isSummaryTable(tableId) || !getSummarySortableFields(tableId).includes(field)) {
    return nextState;
  }

  nextState[tableId] = toggleSortState(getSummarySort(summarySort, tableId), field, 'asc');
  return nextState;
}

export function parseWorldRank(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

// World Ranking -taulukkoon otetaan vain pelaajat, joilla on World Ranking -sijoitus.
// Kokonaispisteet tulevat suoraan rankinglaskennasta, joten pisteitä ei lasketa tässä uudelleen.
export function buildWorldRankingRows(ranking) {
  return (ranking || [])
    .map((entry) => ({ entry, worldRank: parseWorldRank(entry?.worldRank) }))
    .filter(({ worldRank }) => worldRank !== null)
    .sort((left, right) => left.worldRank - right.worldRank)
    .map(({ entry, worldRank }) => ({ ...entry, worldRank }));
}

// TOP 10 -listan jäsenet ja järjestys tulevat ennallaan rankinglaskennasta; rankPosition säilyttää sijoituksen.
export function buildTopRows(ranking, limit = 10) {
  return getTopRanking(ranking || [], limit).map((entry, index) => ({ ...entry, rankPosition: index + 1 }));
}

export function sortSummaryRows(rows, sortState) {
  return sortTableRows(rows, sortState, SUMMARY_SORT_COLUMNS);
}
