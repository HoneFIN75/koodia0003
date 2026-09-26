import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../js/storage.js';
import { renderApp } from '../js/ui.js';

function createRootStub() {
  return {
    innerHTML: '',
    querySelector() {
      return null;
    },
  };
}

function createUiState(overrides = {}) {
  return {
    activeView: 'players',
    navOpen: false,
    rankingFilter: 'ALL',
    summaryFilter: 'ALL',
    summaryPlayerId: '',
    selectedPlayerId: '',
    playerSearch: '',
    playerDivisionFilter: 'ALL',
    playerSortField: 'name',
    playerSortDirection: 'asc',
    playerDialogOpen: false,
    playerDialogFocusTarget: '',
    playerFormId: null,
    playerFormErrors: {},
    playerFormDraft: null,
    playersStatus: 'ready',
    playersError: '',
    tournamentDialogOpen: false,
    tournamentFormId: null,
    tournamentFormErrors: {},
    tournamentFormDraft: null,
    tournamentFormFocusTarget: '',
    selectedTournamentId: '',
    resultFormId: null,
    pointsForm: { division: 'MPO', place: '', basePoints: '', editingKey: '' },
    confirmationDialog: null,
    feedback: null,
    settingsFormErrors: {},
    settingsFormDraft: null,
    deploymentInfo: null,
    ...overrides,
  };
}

test('renderApp shows persisted settings values in settings form', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.settings = {
    playerBaseUrl: 'https://example.com/player/',
    eventBaseUrl: 'https://example.com/event/',
  };

  renderApp(root, dataState, createUiState({ activeView: 'settings' }));

  assert.match(root.innerHTML, /value="https:\/\/example\.com\/player\/"/);
  assert.match(root.innerHTML, /value="https:\/\/example\.com\/event\/"/);
  assert.match(root.innerHTML, /Tallenna asetukset/);
});

test('renderApp builds PDGA links from centralized settings', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.settings = {
    playerBaseUrl: 'https://example.com/player/',
    eventBaseUrl: 'https://example.com/event/',
  };
  dataState.players = [
    {
      id: 'player-1',
      firstName: 'Testi',
      lastName: 'Pelaaja',
      name: 'Testi Pelaaja',
      division: 'MPO',
      pdgaNumber: 12345,
      pdgaRating: 1000,
      worldRank: '',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  dataState.tournaments = [
    {
      id: 'tournament-1',
      name: 'Testi Open',
      pdgaEventId: 98765,
      startDate: '2026-07-03',
      endDate: '',
      displayOrder: 1,
      location: 'Helsinki',
      venue: 'Rata',
      status: '',
      multiplierKey: 'fpt',
      multiplier: 1,
      division: '',
      externalUrl: '',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  renderApp(
    root,
    dataState,
    createUiState({
      activeView: 'players',
      playersStatus: 'ready',
      selectedPlayerId: 'player-1',
      selectedTournamentId: 'tournament-1',
    }),
  );

  assert.match(root.innerHTML, /href="https:\/\/example\.com\/player\/12345"/);
  assert.match(root.innerHTML, /target="_blank"/);
  assert.match(root.innerHTML, /rel="noopener noreferrer"/);
});

test('renderApp hides deployment metadata when it is not available', () => {
  const root = createRootStub();

  renderApp(root, createEmptyState(), createUiState({ activeView: 'summary' }));

  assert.match(root.innerHTML, /<h1 id="summary-title">SFL Pisteytystyökalu<\/h1>/);
  assert.doesNotMatch(root.innerHTML, /deployment-meta/);
});

test('renderApp shows deployment metadata below home page title in Helsinki time', () => {
  const root = createRootStub();

  renderApp(
    root,
    createEmptyState(),
    createUiState({
      activeView: 'summary',
      deploymentInfo: {
        version: '1.0.15',
        deployedAt: '2026-09-26T20:14:00Z',
        commit: '84f2c71',
      },
    }),
  );

  assert.match(root.innerHTML, /<h1 id="summary-title">SFL Pisteytystyökalu<\/h1>\s*<div class="deployment-meta"/);
  assert.match(root.innerHTML, /Versio: 1\.0\.15/);
  assert.match(root.innerHTML, /Päivitetty: 2026-09-26 23:14/);
  assert.doesNotMatch(root.innerHTML, /UTC/);
});

test('renderApp player list uses required column order and add button', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.players = [
    {
      id: 'player-1',
      firstName: 'Testi',
      lastName: 'Pelaaja',
      name: 'Testi Pelaaja',
      division: 'MPO',
      pdgaNumber: 12345,
      pdgaRating: 1000,
      worldRank: 5,
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  renderApp(root, dataState, createUiState({ activeView: 'players' }));

  assert.match(root.innerHTML, /data-open-player-dialog>Lisää pelaaja<\/button>/);
  assert.match(root.innerHTML, /<th>Pelaajan nimi<\/th>\s*<th>PDGA ID<\/th>\s*<th>Divisioona<\/th>\s*<th>Rating<\/th>\s*<th>World Ranking<\/th>\s*<th>Muokkaa<\/th>/);
  assert.match(root.innerHTML, /data-edit-player="player-1">Muokkaa<\/button>/);
});

test('renderApp shows shared add/edit player modal and delete action only in edit mode', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.players = [
    {
      id: 'player-1',
      firstName: 'Testi',
      lastName: 'Pelaaja',
      name: 'Testi Pelaaja',
      division: 'MPO',
      pdgaNumber: 12345,
      pdgaRating: 1000,
      worldRank: '',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  renderApp(root, dataState, createUiState({ activeView: 'players', playerDialogOpen: true, playerFormId: 'player-1' }));

  assert.match(root.innerHTML, /<h2 id="player-dialog-title">Muokkaa pelaajaa<\/h2>/);
  assert.match(root.innerHTML, /data-delete-player="player-1">Poista pelaaja<\/button>/);

  renderApp(root, dataState, createUiState({ activeView: 'players', playerDialogOpen: true, playerFormId: null }));
  assert.match(root.innerHTML, /<h2 id="player-dialog-title">Lisää pelaaja<\/h2>/);
  assert.doesNotMatch(root.innerHTML, /data-delete-player="player-1">Poista pelaaja<\/button>/);
});

test('renderApp shows required player delete confirmation dialog copy', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.players = [
    {
      id: 'player-1',
      firstName: 'Testi',
      lastName: 'Pelaaja',
      name: 'Testi Pelaaja',
      division: 'MPO',
      pdgaNumber: 12345,
      pdgaRating: '',
      worldRank: '',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  renderApp(
    root,
    dataState,
    createUiState({
      activeView: 'players',
      playerDialogOpen: true,
      playerFormId: 'player-1',
      confirmationDialog: { type: 'delete-player', playerId: 'player-1' },
    }),
  );

  assert.match(root.innerHTML, /<h2 id="confirm-dialog-title">Poista pelaaja<\/h2>/);
  assert.match(root.innerHTML, /Haluatko varmasti poistaa pelaajan Testi Pelaaja\?<br \/>\s*Toimintoa ei voi peruuttaa\./);
  assert.match(root.innerHTML, /data-cancel-confirm-dialog[^>]*>Peruuta<\/button>/);
  assert.match(root.innerHTML, /data-confirm-delete-player="player-1">Poista pelaaja<\/button>/);
});
