import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESULT_CARD_CSV_BOM,
  buildResultCardCsv,
  buildResultCardCsvFileName,
  escapeCsvField,
  importResultCardsFromCsv,
  parseResultCardCsvRecords,
} from '../js/resultCardCsv.js';
import { getPlayerPlacement, setPlayerPlacement } from '../js/results.js';
import { buildRanking } from '../js/ranking.js';
import { calculateAllResultPoints, calculatePlacementPoints } from '../js/scoring.js';

const NOW = '2026-10-01T12:00:00.000Z';

function createState() {
  return {
    players: [
      { id: 'p-tuomo', name: 'Tuomo Rikman', division: 'MPO', pdgaNumber: '12345' },
      { id: 'p-leo', name: 'Leo Piironen', division: 'MPO', pdgaNumber: '67890' },
      { id: 'p-eve', name: 'Eveliina Salonen', division: 'FPO', pdgaNumber: '55555' },
    ],
    tournaments: [
      { id: 't-b', name: 'Tampere Open', startDate: '2026-06-01', displayOrder: 2, multiplierId: 'm-1' },
      { id: 't-a', name: 'European Open', startDate: '2026-07-17', displayOrder: 1, multiplierId: 'm-2' },
      { id: 't-c', name: 'Kotka Open', startDate: '2026-08-01', displayOrder: 3, multiplierId: 'm-1' },
    ],
    multipliers: [
      { id: 'm-1', orderNumber: 1, name: 'C-Tier', abbreviation: 'CT', multiplier: 1 },
      { id: 'm-2', orderNumber: 2, name: 'Major', abbreviation: 'MAJ', multiplier: 2 },
    ],
    pointsTable: {
      MPO: { 1: 100, 2: 90, 3: 80, 4: 70, 5: 60, 6: 50, 10: 10 },
      FPO: { 1: 60, 2: 50, 3: 40 },
    },
    resultCards: [
      {
        id: 'result-card-p-tuomo',
        playerId: 'p-tuomo',
        results: [
          { tournamentId: 't-a', placement: '3T4' },
          { tournamentId: 't-b', placement: '1' },
        ],
      },
      {
        id: 'result-card-p-leo',
        playerId: 'p-leo',
        results: [
          { tournamentId: 't-a', placement: '10' },
          { tournamentId: 't-c', placement: '0' },
        ],
      },
    ],
  };
}

function csv(lines) {
  return lines.join('\n');
}

test('export sisältää kaikki pelaajat ja kaikki turnaussarakkeet järjestysnumeron mukaan', () => {
  const output = buildResultCardCsv(createState());
  assert.ok(output.startsWith(RESULT_CARD_CSV_BOM), 'UTF-8 BOM puuttuu');

  const lines = output.slice(1).split('\r\n');
  assert.equal(lines.at(-1), '');
  assert.deepEqual(lines.slice(0, -1), [
    'PDGA ID;Nimi;T1;T2;T3',
    '55555;Eveliina Salonen;;;',
    '67890;Leo Piironen;10;;0',
    '12345;Tuomo Rikman;3T4;1;',
  ]);
});

test('export vie sijoitukset ja tasatulosmerkinnät täsmälleen tallennetussa muodossa', () => {
  const state = createState();
  state.resultCards[0].results.push({ tournamentId: 't-c', placement: '100T10' });
  state.resultCards[1].results[0].placement = '10T2';
  const lines = buildResultCardCsv(state).slice(1).split('\r\n');
  assert.equal(lines[2], '67890;Leo Piironen;10T2;;0');
  assert.equal(lines[3], '12345;Tuomo Rikman;3T4;1;100T10');
});

test('export lainausmerkitsee erikoismerkit ja suojaa kaavoiksi tulkittavat nimet', () => {
  assert.equal(escapeCsvField('a;b'), '"a;b"');
  assert.equal(escapeCsvField('Sanna "Ässä" K'), '"Sanna ""Ässä"" K"');
  assert.equal(escapeCsvField('rivi\nkaksi'), '"rivi\nkaksi"');
  assert.equal(escapeCsvField('3T4'), '3T4');

  const state = createState();
  state.players = [{ id: 'p-x', name: '=HYPERLINK("x")', division: 'MPO', pdgaNumber: '1' }];
  state.resultCards = [];
  const lines = buildResultCardCsv(state).slice(1).split('\r\n');
  assert.equal(lines[1], `1;"'=HYPERLINK(""x"")";;;`);

  const { summary } = importResultCardsFromCsv(state, buildResultCardCsv(state), { now: NOW });
  assert.equal(summary.errors.length, 0);
  assert.deepEqual(summary.observations.map((entry) => entry.reason), ['Ei muutoksia.']);
});

test('export ja import ovat yhteensopivia: viety tiedosto tuodaan ilman muutoksia', () => {
  const state = createState();
  const { resultCards, summary } = importResultCardsFromCsv(state, buildResultCardCsv(state), { now: NOW });
  assert.equal(summary.updatedCount, 0);
  assert.equal(summary.errors.length, 0);
  assert.equal(summary.observations.length, 3);
  assert.equal(resultCards, state.resultCards);
});

test('tiedostonimi sisältää päivämäärän', () => {
  assert.equal(buildResultCardCsvFileName(new Date(2026, 0, 5)), 'tuloskortit-2026-01-05.csv');
});

test('import päivittää oikeat pelaajat PDGA ID:n ja T-sarakkeiden perusteella', () => {
  const state = createState();
  const { resultCards, summary } = importResultCardsFromCsv(state, csv([
    'PDGA ID;Nimi;T1;T2;T3',
    '12345;Tuomo Rikman;2;1;4',
    '67890;Leo Piironen;5;;3',
  ]), { now: NOW });

  assert.equal(summary.updatedCount, 2);
  assert.deepEqual(summary.errors, []);
  assert.equal(getPlayerPlacement(resultCards, 'p-tuomo', 't-a'), '2');
  assert.equal(getPlayerPlacement(resultCards, 'p-tuomo', 't-b'), '1');
  assert.equal(getPlayerPlacement(resultCards, 'p-tuomo', 't-c'), '4');
  assert.equal(getPlayerPlacement(resultCards, 'p-leo', 't-a'), '5');
  assert.equal(getPlayerPlacement(resultCards, 'p-leo', 't-b'), '');
  assert.equal(getPlayerPlacement(resultCards, 'p-leo', 't-c'), '3');
  assert.deepEqual(resultCards.find((card) => card.playerId === 'p-eve'), undefined);
});

test('import käyttää vain PDGA ID:tä ja raportoi nimen poikkeaman huomiona', () => {
  const state = createState();
  const { resultCards, summary } = importResultCardsFromCsv(state, csv([
    'PDGA ID;Nimi;T1',
    '12345;Väärä Nimi;6',
  ]), { now: NOW });

  assert.equal(getPlayerPlacement(resultCards, 'p-tuomo', 't-a'), '6');
  assert.equal(summary.updatedCount, 1);
  assert.equal(summary.observations.length, 1);
  assert.match(summary.observations[0].reason, /Väärä Nimi.*Tuomo Rikman/);
  assert.equal(summary.observations[0].rowNumber, 2);
});

test('import tukee tasatuloksia, arvoa 0 ja tyhjää arvoa', () => {
  const state = createState();
  const { resultCards, summary } = importResultCardsFromCsv(state, csv([
    'PDGA ID;Nimi;T1;T2;T3',
    '12345;Tuomo Rikman;0;3t2;',
    '67890;Leo Piironen;;3T2;5',
  ]), { now: NOW });

  assert.deepEqual(summary.errors, []);
  assert.equal(summary.updatedCount, 2);
  assert.equal(getPlayerPlacement(resultCards, 'p-tuomo', 't-a'), '0');
  assert.equal(getPlayerPlacement(resultCards, 'p-tuomo', 't-b'), '3T2');
  assert.equal(getPlayerPlacement(resultCards, 'p-leo', 't-a'), '');
  assert.equal(getPlayerPlacement(resultCards, 'p-leo', 't-b'), '3T2');
  assert.equal(getPlayerPlacement(resultCards, 'p-leo', 't-c'), '5');
});

test('arvo 0 ei tuota pisteitä eikä lasketa osallistumiseksi', () => {
  const state = createState();
  const { resultCards } = importResultCardsFromCsv(state, csv([
    'PDGA ID;Nimi;T1;T2;T3',
    '12345;Tuomo Rikman;0;0;0',
  ]), { now: NOW });
  const nextState = { ...state, resultCards };

  assert.equal(calculatePlacementPoints({ placement: '0', division: 'MPO', pointsTable: state.pointsTable, multiplier: 2 }), null);
  assert.deepEqual(
    calculateAllResultPoints(nextState).filter((entry) => entry.playerId === 'p-tuomo'),
    [],
  );
  const tuomo = buildRanking(nextState).find((entry) => entry.id === 'p-tuomo');
  assert.equal(tuomo.totalPoints, 0);
  assert.equal(tuomo.tournamentCount, 0);

  const outcome = setPlayerPlacement(nextState, { playerId: 'p-tuomo', tournamentId: 't-a', placement: '0', now: NOW });
  assert.equal(outcome.changed, false);
  assert.equal(outcome.points, null);
});

test('import laskee pisteet uudelleen scoring-moduulin kautta', () => {
  const state = createState();
  const before = buildRanking(state).find((entry) => entry.id === 'p-tuomo');
  // 3T4 = (80 + 70 + 60 + 50) / 4 × 2 = 130 ja 1 × 1 = 100.
  assert.equal(before.totalPoints, 230);

  const { resultCards } = importResultCardsFromCsv(state, csv([
    'PDGA ID;Nimi;T1;T2',
    '12345;Tuomo Rikman;1;2',
  ]), { now: NOW });
  const after = buildRanking({ ...state, resultCards }).find((entry) => entry.id === 'p-tuomo');
  assert.equal(after.totalPoints, 100 * 2 + 90);
  resultCards.forEach((card) => card.results.forEach((entry) => {
    assert.deepEqual(Object.keys(entry).sort(), ['placement', 'tournamentId']);
  }));
});

test('virheelliset arvot raportoidaan ja muut rivit käsitellään', () => {
  const state = createState();
  const { resultCards, summary } = importResultCardsFromCsv(state, csv([
    'PDGA ID;Nimi;T1;T2;T3',
    '12345;Tuomo Rikman;ABC;1TT2;3-T-4',
    '67890;Leo Piironen;2;;',
  ]), { now: NOW });

  assert.deepEqual(summary.errors.map((entry) => [entry.rowNumber, entry.column]), [[2, 'T1'], [2, 'T2'], [2, 'T3']]);
  summary.errors.forEach((entry) => assert.match(entry.reason, /Virheellinen sijoitus/));
  assert.equal(getPlayerPlacement(resultCards, 'p-tuomo', 't-a'), '3T4');
  assert.equal(getPlayerPlacement(resultCards, 'p-tuomo', 't-b'), '1');
  assert.equal(getPlayerPlacement(resultCards, 'p-leo', 't-a'), '2');
  assert.equal(getPlayerPlacement(resultCards, 'p-leo', 't-c'), '');
  assert.equal(summary.updatedCount, 1);
});

test('tuntematon PDGA ID on virhe eikä pelaajia luoda tai poisteta', () => {
  const state = createState();
  const { resultCards, summary } = importResultCardsFromCsv(state, csv([
    'PDGA ID;Nimi;T1',
    '99999;Uusi Pelaaja;1',
    'abc;Virheellinen;1',
    ';Ilman ID:tä;1',
  ]), { now: NOW });

  assert.deepEqual(summary.errors.map((entry) => entry.rowNumber), [2, 3, 4]);
  assert.match(summary.errors[0].reason, /ei löydy pelaajaa/);
  assert.match(summary.errors[1].reason, /Virheellinen PDGA ID/);
  assert.match(summary.errors[2].reason, /PDGA ID puuttuu/);
  assert.equal(summary.updatedCount, 0);
  assert.equal(resultCards.length, state.resultCards.length);
  assert.ok(resultCards.every((card) => state.players.some((player) => player.id === card.playerId)));
});

test('tuntematon T-sarake ja ylimääräiset sarakkeet raportoidaan, turnauksia ei luoda', () => {
  const state = createState();
  const { resultCards, summary } = importResultCardsFromCsv(state, csv([
    'PDGA ID;Nimi;T1;T9;Kommentti',
    '12345;Tuomo Rikman;2;1;huom',
  ]), { now: NOW });

  assert.equal(summary.errors.length, 1);
  assert.equal(summary.errors[0].column, 'T9');
  assert.equal(summary.errors[0].rowNumber, 1);
  assert.equal(summary.observations.length, 1);
  assert.match(summary.observations[0].reason, /Tuntematon sarake "Kommentti"/);
  assert.equal(getPlayerPlacement(resultCards, 'p-tuomo', 't-a'), '2');
  assert.ok(resultCards.every((card) => card.results.every((entry) => ['t-a', 't-b', 't-c'].includes(entry.tournamentId))));
});

test('saman PDGA ID:n toistuva rivi ohitetaan huomiona', () => {
  const state = createState();
  const { resultCards, summary } = importResultCardsFromCsv(state, csv([
    'PDGA ID;Nimi;T1',
    '12345;Tuomo Rikman;5',
    '12345;Tuomo Rikman;6',
  ]), { now: NOW });

  assert.equal(getPlayerPlacement(resultCards, 'p-tuomo', 't-a'), '5');
  assert.equal(summary.observations.length, 1);
  assert.equal(summary.observations[0].rowNumber, 3);
  assert.match(summary.observations[0].reason, /useammin kuin kerran/);
});

test('sijoitusten vaihtaminen pelaajien kesken onnistuu yhdellä tuonnilla', () => {
  const state = createState();
  const { resultCards, summary } = importResultCardsFromCsv(state, csv([
    'PDGA ID;Nimi;T2',
    '12345;Tuomo Rikman;2',
    '67890;Leo Piironen;1',
  ]), { now: NOW });

  assert.deepEqual(summary.errors, []);
  assert.equal(getPlayerPlacement(resultCards, 'p-tuomo', 't-b'), '2');
  assert.equal(getPlayerPlacement(resultCards, 'p-leo', 't-b'), '1');
});

test('päällekkäinen sijoitus tai puuttuva pistetaulukon arvo ei tallennu ja aiempi arvo säilyy', () => {
  const state = createState();
  const { resultCards, summary } = importResultCardsFromCsv(state, csv([
    'PDGA ID;Nimi;T1;T2',
    '12345;Tuomo Rikman;8;',
    '67890;Leo Piironen;;1',
  ]), { now: NOW });

  // Tuomo: sijoitukselle 8 ei ole pistetaulukon arvoa → 3T4 säilyy. T2 tyhjennetään.
  assert.equal(getPlayerPlacement(resultCards, 'p-tuomo', 't-a'), '3T4');
  assert.equal(getPlayerPlacement(resultCards, 'p-tuomo', 't-b'), '');
  assert.equal(getPlayerPlacement(resultCards, 'p-leo', 't-b'), '1');
  assert.equal(summary.errors.length, 1);
  assert.equal(summary.errors[0].column, 'T1');
  assert.match(summary.errors[0].reason, /Pisteitä ei ole määritetty.*Aiempi sijoitus 3T4 säilytettiin/);
});

test('import hyväksyy BOM:n, CRLF-rivinvaihdot ja tyhjät loppurivit', () => {
  const state = createState();
  const text = `${RESULT_CARD_CSV_BOM}PDGA ID;Nimi;T1;T2;T3\r\n12345;"Tuomo Rikman";2;1;\r\n;;;;\r\n\r\n\r\n`;
  const { resultCards, summary } = importResultCardsFromCsv(state, text, { now: NOW });
  assert.deepEqual(summary.errors, []);
  assert.equal(summary.totalRows, 1);
  assert.equal(getPlayerPlacement(resultCards, 'p-tuomo', 't-a'), '2');
});

test('puuttuva tai virheellinen otsikkorivi keskeyttää koko tuonnin', () => {
  const state = createState();
  assert.throws(() => importResultCardsFromCsv(state, ''), /otsikkorivi puuttuu tai on virheellinen/);
  assert.throws(() => importResultCardsFromCsv(state, '12345;Tuomo Rikman;1'), /otsikkorivi puuttuu tai on virheellinen/);
  assert.throws(() => importResultCardsFromCsv(state, 'PDGA ID,Nimi,T1\n12345,Tuomo,1'), /otsikkorivi/);
  assert.throws(() => importResultCardsFromCsv(state, 'PDGA ID;Nimi;T1\n'), /ei ole päivitettäviä pelaajarivejä/);
});

test('CSV-jäsennin tukee lainausmerkkejä ja rivinvaihtoja kentissä', () => {
  const records = parseResultCardCsvRecords('A;"b;c";"d ""e"""\r\n1;"rivi\nkaksi";3\n');
  assert.deepEqual(records, [
    { lineNumber: 1, fields: ['A', 'b;c', 'd "e"'] },
    { lineNumber: 2, fields: ['1', 'rivi\nkaksi', '3'] },
  ]);
  assert.throws(() => parseResultCardCsvRecords('A;"b'), /sulkematon lainausmerkki/);
});
