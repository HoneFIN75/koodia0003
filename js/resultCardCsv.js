import { isNonParticipationPlacement, parsePlacement, UNIQUE_FIRST_PLACE_ERROR } from './scoring.js';
import {
  clearPlayerPlacement,
  getPlayerPlacement,
  normalizePlacementInput,
  restorePlayerPlacement,
  setPlayerPlacement,
} from './results.js';
import { sortTournaments } from './tournaments.js';

// Tuloskorttien massavienti ja -tuonti CSV-muodossa (PDGA ID;Nimi;T1;T2;...).
// Moduuli on puhdas: se ei koske käyttöliittymään eikä tallennukseen. Tuonti muuttaa vain
// sijoituksia; pisteet lasketaan aina scoring.js:n kautta eikä niitä tallenneta.

export const RESULT_CARD_CSV_DELIMITER = ';';
export const RESULT_CARD_CSV_BOM = '\uFEFF';
const RESULT_CARD_CSV_LINE_BREAK = '\r\n';
const TOURNAMENT_COLUMN_PATTERN = /^T(\d+)$/i;
const FORMULA_PREFIX_PATTERN = /^[=+\-@\t\r]/;

function normalizeHeaderToken(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('fi')
    .replace(/[\s_-]+/g, '');
}

function normalizePdgaKey(value) {
  const digits = String(value ?? '').trim();
  if (!/^\d+$/.test(digits)) {
    return '';
  }

  return digits.replace(/^0+(?=\d)/, '');
}

// Estää taulukko-ohjelmaa tulkitsemasta nimeä kaavaksi (CSV-injektio).
function guardFormula(value) {
  const text = String(value ?? '');
  return FORMULA_PREFIX_PATTERN.test(text) ? `'${text}` : text;
}

function unguardFormula(value) {
  const text = String(value ?? '');
  return text.startsWith("'") && FORMULA_PREFIX_PATTERN.test(text.slice(1)) ? text.slice(1) : text;
}

export function escapeCsvField(value) {
  const text = String(value ?? '');
  if (/[;"\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function getTournamentColumnName(tournament) {
  return `T${tournament.displayOrder}`;
}

function sortPlayersForExport(players = []) {
  return [...players].sort(
    (left, right) =>
      String(left.name ?? '').localeCompare(String(right.name ?? ''), 'fi') ||
      normalizePdgaKey(left.pdgaNumber).localeCompare(normalizePdgaKey(right.pdgaNumber), 'fi'),
  );
}

// Vie kaikkien pelaajien nykyiset sijoitukset. Sarakkeet T1, T2, ... noudattavat turnausten
// järjestysnumeroa, ja sijoitukset viedään täsmälleen tallennetussa muodossa (esim. 3T4 tai 0).
export function buildResultCardCsv(dataState = {}) {
  const tournaments = sortTournaments(dataState.tournaments || []);
  const resultCards = dataState.resultCards || [];
  const header = ['PDGA ID', 'Nimi', ...tournaments.map(getTournamentColumnName)];
  const rows = sortPlayersForExport(dataState.players || []).map((player) => [
    String(player.pdgaNumber ?? ''),
    guardFormula(player.name),
    ...tournaments.map((tournament) => getPlayerPlacement(resultCards, player.id, tournament.id)),
  ]);

  return `${RESULT_CARD_CSV_BOM}${[header, ...rows]
    .map((row) => row.map(escapeCsvField).join(RESULT_CARD_CSV_DELIMITER))
    .join(RESULT_CARD_CSV_LINE_BREAK)}${RESULT_CARD_CSV_LINE_BREAK}`;
}

export function buildResultCardCsvFileName(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `tuloskortit-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.csv`;
}

// Pilkkoo CSV-tekstin tietueiksi. Lainausmerkkien sisällä sallitaan erotin, lainausmerkki ("")
// ja rivinvaihto. Sekä LF- että CRLF-rivinvaihdot hyväksytään.
export function parseResultCardCsvRecords(csvText) {
  const text = String(csvText ?? '').replace(/^\uFEFF/, '');
  const records = [];
  let fields = [];
  let current = '';
  let quoted = false;
  let lineNumber = 1;
  let recordLineNumber = 1;

  const pushRecord = () => {
    fields.push(current);
    records.push({ lineNumber: recordLineNumber, fields });
    fields = [];
    current = '';
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        if (character === '\n') {
          lineNumber += 1;
        }
        current += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === RESULT_CARD_CSV_DELIMITER) {
      fields.push(current);
      current = '';
    } else if (character === '\r' || character === '\n') {
      if (character === '\r' && text[index + 1] === '\n') {
        index += 1;
      }
      pushRecord();
      lineNumber += 1;
      recordLineNumber = lineNumber;
    } else {
      current += character;
    }
  }

  if (quoted) {
    throw new Error('CSV-tiedostossa on sulkematon lainausmerkki.');
  }

  pushRecord();
  return records.filter((record) => record.fields.some((field) => field.trim() !== ''));
}

function isValidHeader(fields) {
  return normalizeHeaderToken(fields[0]) === 'pdgaid' && normalizeHeaderToken(fields[1]) === 'nimi';
}

function buildColumnMapping(headerFields, tournaments, dataRecords, addIssue) {
  const tournamentsByOrder = new Map();
  tournaments.forEach((tournament) => {
    const list = tournamentsByOrder.get(tournament.displayOrder) || [];
    list.push(tournament);
    tournamentsByOrder.set(tournament.displayOrder, list);
  });

  const headerCounts = new Map();
  headerFields.slice(2).forEach((field) => {
    const match = TOURNAMENT_COLUMN_PATTERN.exec(field.trim());
    if (match) {
      const key = Number(match[1]);
      headerCounts.set(key, (headerCounts.get(key) || 0) + 1);
    }
  });

  const columns = [];
  const reportedDuplicates = new Set();
  headerFields.slice(2).forEach((rawField, offset) => {
    const index = offset + 2;
    const field = rawField.trim();
    const match = TOURNAMENT_COLUMN_PATTERN.exec(field);

    if (!match) {
      const columnHasValues = dataRecords.some((record) => String(record.fields[index] ?? '').trim() !== '');
      if (field || columnHasValues) {
        addIssue('observation', {
          rowNumber: 1,
          column: field,
          reason: `Tuntematon sarake "${field || `sarake ${index + 1}`}" ohitettiin. Turnaussarakkeiden nimet ovat muotoa T1, T2, T3.`,
        });
      }
      return;
    }

    const orderNumber = Number(match[1]);
    const columnName = `T${orderNumber}`;
    if (headerCounts.get(orderNumber) > 1) {
      if (!reportedDuplicates.has(orderNumber)) {
        reportedDuplicates.add(orderNumber);
        addIssue('error', {
          rowNumber: 1,
          column: columnName,
          reason: `Sarake ${columnName} esiintyy otsikkorivillä useammin kuin kerran. Sarakkeen arvoja ei käsitelty.`,
        });
      }
      return;
    }

    const matchingTournaments = tournamentsByOrder.get(orderNumber) || [];
    if (matchingTournaments.length === 0) {
      addIssue('error', {
        rowNumber: 1,
        column: columnName,
        reason: `Sarakkeelle ${columnName} ei löydy turnausta järjestysnumerolla ${orderNumber}. Sarakkeen arvoja ei käsitelty.`,
      });
      return;
    }

    if (matchingTournaments.length > 1) {
      addIssue('error', {
        rowNumber: 1,
        column: columnName,
        reason: `Järjestysnumero ${orderNumber} on usealla turnauksella, joten sarakkeen ${columnName} turnausta ei voida yksilöidä. Sarakkeen arvoja ei käsitelty.`,
      });
      return;
    }

    columns.push({ index, columnName, tournament: matchingTournaments[0] });
  });

  return columns;
}

function validatePlacementValue(value) {
  if (value === '' || isNonParticipationPlacement(value)) {
    return '';
  }

  try {
    parsePlacement(value);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : 'Sijoituksen muoto on virheellinen.';
  }
}

// Tuo tuloskorttien sijoitukset CSV-tiedostosta. Pelaajat tunnistetaan vain PDGA ID:n ja
// turnaukset vain T<n>-sarakkeen (järjestysnumero n) perusteella. Pelaajia tai turnauksia ei
// luoda eikä poisteta. Virheelliset solut ja rivit raportoidaan ja muut rivit käsitellään normaalisti.
// Otsikkorivin puuttuminen tai virhe keskeyttää koko tuonnin.
export function importResultCardsFromCsv(dataState = {}, csvText, { now = new Date().toISOString() } = {}) {
  const records = parseResultCardCsvRecords(csvText);
  const headerRecord = records.shift();
  if (!headerRecord || !isValidHeader(headerRecord.fields)) {
    throw new Error('CSV-tiedoston otsikkorivi puuttuu tai on virheellinen. Otsikkorivin pitää alkaa sarakkeilla PDGA ID;Nimi.');
  }
  if (!records.length) {
    throw new Error('CSV-tiedostossa ei ole päivitettäviä pelaajarivejä.');
  }

  const players = dataState.players || [];
  const errors = [];
  const observations = [];
  const addIssue = (type, issue) => {
    const entry = { rowNumber: issue.rowNumber, pdgaId: issue.pdgaId || '', column: issue.column || '', reason: issue.reason };
    (type === 'error' ? errors : observations).push(entry);
  };

  const headerFields = headerRecord.fields;
  const columns = buildColumnMapping(headerFields, dataState.tournaments || [], records, addIssue);
  const playerByPdga = new Map();
  players.forEach((player) => {
    const key = normalizePdgaKey(player.pdgaNumber);
    if (key && !playerByPdga.has(key)) {
      playerByPdga.set(key, player);
    }
  });

  const seenPdgaKeys = new Set();
  const changes = [];
  const importedFirstPlaces = new Map();
  records.forEach(({ lineNumber: rowNumber, fields }) => {
    const pdgaId = String(fields[0] ?? '').trim();
    if (!pdgaId) {
      addIssue('error', { rowNumber, reason: 'PDGA ID puuttuu. Rivi ohitettiin.' });
      return;
    }

    const pdgaKey = normalizePdgaKey(pdgaId);
    if (!pdgaKey) {
      addIssue('error', { rowNumber, pdgaId, reason: 'Virheellinen PDGA ID. Rivi ohitettiin.' });
      return;
    }

    const player = playerByPdga.get(pdgaKey);
    if (!player) {
      addIssue('error', { rowNumber, pdgaId, reason: 'PDGA ID:llä ei löydy pelaajaa. Pelaajia ei luoda tuonnissa, joten rivi ohitettiin.' });
      return;
    }

    if (seenPdgaKeys.has(pdgaKey)) {
      addIssue('observation', {
        rowNumber,
        pdgaId,
        reason: 'PDGA ID esiintyy tiedostossa useammin kuin kerran. Vain ensimmäinen rivi käsiteltiin, tämä rivi ohitettiin.',
      });
      return;
    }
    seenPdgaKeys.add(pdgaKey);

    const fileName = unguardFormula(String(fields[1] ?? '').trim());
    if (fileName && fileName !== String(player.name ?? '').trim()) {
      addIssue('observation', {
        rowNumber,
        pdgaId,
        reason: `Nimi tiedostossa (${fileName}) poikkeaa tallennetusta nimestä (${player.name}). Päivitys tehtiin PDGA ID:n perusteella.`,
      });
    }

    if (fields.slice(headerFields.length).some((field) => field.trim() !== '')) {
      addIssue('observation', {
        rowNumber,
        pdgaId,
        reason: 'Rivillä on enemmän sarakkeita kuin otsikkorivillä. Ylimääräiset arvot ohitettiin.',
      });
    }

    if (columns.some((column) => column.index >= fields.length)) {
      addIssue('observation', {
        rowNumber,
        pdgaId,
        reason: 'Rivillä on vähemmän sarakkeita kuin otsikkorivillä. Puuttuvien sarakkeiden sijoituksia ei muutettu.',
      });
    }

    let rowHasErrors = false;
    let rowHasChanges = false;
    columns.forEach(({ index, columnName, tournament }) => {
      if (index >= fields.length) {
        return;
      }

      const rawValue = String(fields[index] ?? '').trim();
      const placement = normalizePlacementInput(rawValue);
      const formatError = validatePlacementValue(placement);
      if (formatError) {
        rowHasErrors = true;
        addIssue('error', {
          rowNumber,
          pdgaId,
          column: columnName,
          reason: `Virheellinen sijoitus "${rawValue}". ${formatError} Sallitut arvot: tyhjä, 0, positiivinen kokonaisluku tai tasatulos (esim. 3T4).`,
        });
        return;
      }

      if (placement && !isNonParticipationPlacement(placement) && parsePlacement(placement)?.place === 1) {
        const firstPlaces = importedFirstPlaces.get(tournament.id) || [];
        firstPlaces.push({ rowNumber, pdgaId, columnName });
        importedFirstPlaces.set(tournament.id, firstPlaces);
      }

      const previous = getPlayerPlacement(dataState.resultCards || [], player.id, tournament.id);
      if (placement === previous) {
        return;
      }

      rowHasChanges = true;
      changes.push({ rowNumber, pdgaId, columnName, player, tournament, previous, placement });
    });

    if (!rowHasErrors && !rowHasChanges) {
      addIssue('observation', { rowNumber, pdgaId, reason: 'Ei muutoksia.' });
    }
  });

  const blockedTournamentIds = new Set();
  importedFirstPlaces.forEach((firstPlaces, tournamentId) => {
    if (firstPlaces.length < 2) {
      return;
    }

    blockedTournamentIds.add(tournamentId);
    firstPlaces.forEach(({ rowNumber, pdgaId, columnName }) => {
      addIssue('error', {
        rowNumber,
        pdgaId,
        column: columnName,
        reason: UNIQUE_FIRST_PLACE_ERROR,
      });
    });
  });

  // Muuttuvat solut tyhjennetään ensin, jotta voittajan vaihtaminen ei kaadu sijoituksen 1
  // uniikkiustarkistukseen. Sen jälkeen uudet arvot asetetaan samalla
  // validoinnilla kuin yksittäisellä tuloskortilla (setPlayerPlacement).
  const applicableChanges = changes.filter(({ tournament }) => !blockedTournamentIds.has(tournament.id));
  let resultCards = dataState.resultCards || [];
  applicableChanges.forEach(({ player, tournament, previous }) => {
    if (previous) {
      resultCards = clearPlayerPlacement(resultCards, player.id, tournament.id, now);
    }
  });

  const updatedPlayerIds = new Set();
  applicableChanges.forEach(({ rowNumber, pdgaId, columnName, player, tournament, previous, placement }) => {
    if (!placement) {
      updatedPlayerIds.add(player.id);
      return;
    }

    try {
      const outcome = setPlayerPlacement(
        { ...dataState, resultCards },
        { playerId: player.id, tournamentId: tournament.id, placement, now },
      );
      resultCards = outcome.resultCards;
      updatedPlayerIds.add(player.id);
    } catch (error) {
      if (previous) {
        resultCards = restorePlayerPlacement(resultCards, player.id, tournament.id, previous, now);
      }
      addIssue('error', {
        rowNumber,
        pdgaId,
        column: columnName,
        reason: error instanceof Error && error.message === UNIQUE_FIRST_PLACE_ERROR
          ? UNIQUE_FIRST_PLACE_ERROR
          : `Sijoitusta "${placement}" ei tallennettu: ${error instanceof Error ? error.message : 'Tuntematon virhe.'}${previous ? ` Aiempi sijoitus ${previous} säilytettiin.` : ''}`,
      });
    }
  });

  const byRow = (left, right) => left.rowNumber - right.rowNumber;
  return {
    resultCards,
    summary: {
      totalRows: records.length,
      updatedCount: updatedPlayerIds.size,
      errors: errors.sort(byRow),
      observations: observations.sort(byRow),
    },
  };
}
