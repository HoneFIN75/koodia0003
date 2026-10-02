import { getTopRanking } from './ranking.js';
import { sortTableRows, toggleSortState } from './table-sorting.js';

// Yhteenveto-sivulla on kaksi TOP 10 -taulukkoa. Jokaisella taulukolla on oma lajittelutilansa, jotta
// esimerkiksi TOP 10 MPO voi olla lajiteltu ratingin ja TOP 10 FPO kokonaispisteiden mukaan.
export const SUMMARY_TABLES = {
  'summary-top-mpo': { division: 'MPO' },
  'summary-top-fpo': { division: 'FPO' },
};

const SUMMARY_SORT_COLUMNS = {
  rankPosition: { type: 'number', defaultDirection: 'asc' },
  name: { type: 'text', defaultDirection: 'asc' },
  pdgaRating: { type: 'number', defaultDirection: 'desc' },
  worldRank: { type: 'number', defaultDirection: 'asc', getValue: (row) => parseWorldRank(row?.worldRank) },
  tournamentCount: { type: 'number', defaultDirection: 'desc' },
  totalPoints: { type: 'number', defaultDirection: 'desc' },
};

const DEFAULT_SUMMARY_SORT = { field: 'totalPoints', direction: 'desc' };

export function isSummaryTable(tableId) {
  return Object.hasOwn(SUMMARY_TABLES, tableId);
}

export function getSummarySortableFields(tableId) {
  return isSummaryTable(tableId) ? Object.keys(SUMMARY_SORT_COLUMNS) : [];
}

// Oletuksena taulukot lajitellaan kokonaispisteiden mukaan laskevasti (eniten pisteitä ensin).
export function getDefaultSummarySort(tableId) {
  return isSummaryTable(tableId) ? { ...DEFAULT_SUMMARY_SORT } : { field: '', direction: 'asc' };
}

export function getSummarySort(summarySort, tableId) {
  const current = summarySort?.[tableId];
  if (current && getSummarySortableFields(tableId).includes(current.field) && (current.direction === 'asc' || current.direction === 'desc')) {
    return { field: current.field, direction: current.direction };
  }

  return getDefaultSummarySort(tableId);
}

// Palauttaa uuden lajittelutilan muuttamatta muiden taulukoiden tiloja. Uuden sarakkeen ensimmäinen
// valinta käyttää sarakkeen luontevaa suuntaa (esim. pisteet ja rating laskevasti, nimi nousevasti).
export function toggleSummarySort(summarySort, tableId, field) {
  const nextState = { ...(summarySort || {}) };
  if (!isSummaryTable(tableId) || !getSummarySortableFields(tableId).includes(field)) {
    return nextState;
  }

  nextState[tableId] = toggleSortState(getSummarySort(summarySort, tableId), field, SUMMARY_SORT_COLUMNS[field].defaultDirection);
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

// TOP 10 -listan jäsenet ja järjestys tulevat ennallaan rankinglaskennasta (kokonaispisteet laskevasti);
// rankPosition säilyttää sijoituksen, vaikka taulukko lajiteltaisiin toisen sarakkeen mukaan.
export function buildTopRows(ranking, limit = 10) {
  return getTopRanking(ranking || [], limit).map((entry, index) => ({ ...entry, rankPosition: index + 1 }));
}

export function sortSummaryRows(rows, sortState) {
  return sortTableRows(rows, sortState, SUMMARY_SORT_COLUMNS);
}
