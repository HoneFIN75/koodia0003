import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../js/storage.js';
import { bindUi, renderApp } from '../js/ui.js';
import { HELP_SECTIONS } from '../js/helpData.js';

function createRootStub() {
  return {
    innerHTML: '',
    querySelector() {
      return null;
    },
  };
}

function createFocusableElement() {
  return {
    listeners: {},
    dataset: {},
    addEventListener(eventName, handler) {
      this.listeners[eventName] = handler;
    },
    focus() {
      global.document.activeElement = this;
    },
    getAttribute() {
      return null;
    },
    hasAttribute() {
      return false;
    },
    querySelectorAll() {
      return [];
    },
  };
}

function createInteractiveRoot(selectors = {}) {
  return {
    __dialogKeydownHandler: null,
    querySelector(selector) {
      return selectors[selector] || null;
    },
    querySelectorAll() {
      return [];
    },
  };
}

function installDocumentStub() {
  const originalDocument = global.document;
  global.document = {
    activeElement: null,
    addEventListener() {},
    removeEventListener() {},
  };

  return () => {
    global.document = originalDocument;
  };
}

function createNoopHandlers() {
  return new Proxy(
    {},
    {
      get() {
        return () => {};
      },
    },
  );
}

function getSummarySectionHtml(html) {
  return html.match(/id="section-summary"[\s\S]*?<\/section>/)?.[0] || '';
}

function createUiState(overrides = {}) {
  return {
    activeView: 'players',
    rankingFilter: 'ALL',
    summaryFilter: 'ALL',
    summaryPlayerId: '',
    comparePlayerIds: [],
    compareSearch: '',
    compareHideEmptyTournaments: true,
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
    playerImportDivision: '',
    playerImportSummary: null,
    playersStatus: 'ready',
    playersError: '',
    tournamentDialogOpen: false,
    tournamentFormId: null,
    tournamentFormErrors: {},
    tournamentFormDraft: null,
    tournamentFormFocusTarget: '',
    tournamentSearch: '',
    tournamentStatusFilter: 'ALL',
    tournamentSortField: 'displayOrder',
    tournamentSortDirection: 'asc',
    rankingSortField: 'totalPoints',
    rankingSortDirection: 'desc',
    multipliersSortField: 'orderNumber',
    multipliersSortDirection: 'asc',
    pointsSortField: 'place',
    pointsSortDirection: 'asc',
    tournamentImportDialogOpen: false,
    tournamentImportFocusTarget: '',
    tournamentImportSummary: null,
    multiplierDialogOpen: false,
    multiplierFormId: null,
    multiplierFormErrors: {},
    multiplierFormDraft: null,
    multiplierFormFocusTarget: '',
    pendingFocusSelector: '',
    selectedTournamentId: '',
    pointsForm: { division: 'MPO', place: '', basePoints: '', editingKey: '' },
    pointsImportDialogOpen: false,
    pointsImportDivision: 'MPO',
    pointsImportFocusTarget: '',
    resultCardPlayerId: '',
    resultCardOrigin: 'players',
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
      multiplierId: 'multiplier-major',
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
  assert.match(root.innerHTML, /aria-label="Avaa pelaajan Testi Pelaaja PDGA-profiili"/);
});

test('renderApp renders PDGA ID as the PDGA profile link and keeps player names as plain text', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.settings = {
    playerBaseUrl: 'https://example.com/player/',
    eventBaseUrl: 'https://example.com/event/',
  };
  dataState.players = [
    {
      id: 'player-1',
      firstName: 'Linkki',
      lastName: 'Pelaaja',
      name: 'Linkki Pelaaja',
      division: 'MPO',
      pdgaNumber: 12345,
      pdgaRating: 1000,
      worldRank: '',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'player-2',
      firstName: 'Teksti',
      lastName: 'Pelaaja',
      name: 'Teksti Pelaaja',
      division: 'FPO',
      pdgaNumber: '',
      pdgaRating: 950,
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
      pdgaEventId: '',
      startDate: '2026-07-03',
      endDate: '',
      displayOrder: 1,
      location: '',
      venue: '',
      status: '',
      multiplierId: 'multiplier-major',
      division: '',
      externalUrl: '',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  dataState.resultCards = [
    { id: 'result-card-player-1', playerId: 'player-1', results: [{ tournamentId: 'tournament-1', placement: '1' }] },
    { id: 'result-card-player-2', playerId: 'player-2', results: [{ tournamentId: 'tournament-1', placement: '1' }] },
  ];

  renderApp(root, dataState, createUiState({ activeView: 'summary' }));

  assert.match(
    getSummarySectionHtml(root.innerHTML),
    /<button type="button" class="player-name-button" data-open-player-result-card="player-1" data-result-card-origin="summary" title="Avaa tuloskortti" aria-label="Avaa pelaajan Linkki Pelaaja tuloskortti">Linkki Pelaaja<\/button>/,
  );
  assert.doesNotMatch(getSummarySectionHtml(root.innerHTML), /pdga-id-link/);
  assert.match(
    root.innerHTML,
    /id="section-ranking"[\s\S]*<button type="button" class="player-name-button" data-open-player-result-card="player-1" data-result-card-origin="ranking" title="Avaa tuloskortti" aria-label="Avaa pelaajan Linkki Pelaaja tuloskortti">Linkki Pelaaja<\/button>[\s\S]*<a class="pdga-id-link" href="https:\/\/example\.com\/player\/12345" target="_blank" rel="noopener noreferrer" title="Avaa PDGA-profiili" aria-label="Avaa pelaajan Linkki Pelaaja PDGA-profiili">12345<\/a>/,
  );
  assert.match(
    root.innerHTML,
    /id="section-players"[\s\S]*<span class="player-name-text">Linkki Pelaaja<\/span>[\s\S]*<a class="pdga-id-link" href="https:\/\/example\.com\/player\/12345" target="_blank" rel="noopener noreferrer" title="Avaa PDGA-profiili" aria-label="Avaa pelaajan Linkki Pelaaja PDGA-profiili">12345<\/a>/,
  );
  assert.doesNotMatch(root.innerHTML, /href="https:\/\/example\.com\/player\/[^"]*">Linkki Pelaaja<\/a>/);
  assert.doesNotMatch(root.innerHTML, /player-name-link/);
});

test('renderApp näyttää yhteenvetosivulla vain dashboardin avainluvut ja TOP 10 -listat', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.players = [
    {
      id: 'player-1',
      firstName: 'Matti',
      lastName: 'Meikäläinen',
      name: 'Matti Meikäläinen',
      division: 'MPO',
      pdgaNumber: 11111,
      pdgaRating: '',
      worldRank: '',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'player-2',
      firstName: 'Maija',
      lastName: 'Meikäläinen',
      name: 'Maija Meikäläinen',
      division: 'FPO',
      pdgaNumber: 22222,
      pdgaRating: '',
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
      pdgaEventId: '',
      startDate: '2026-07-03',
      endDate: '',
      displayOrder: 1,
      location: '',
      venue: '',
      status: '',
      multiplierId: 'multiplier-major',
      division: '',
      externalUrl: '',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  dataState.resultCards = [
    { id: 'result-card-player-1', playerId: 'player-1', results: [{ tournamentId: 'tournament-1', placement: '1' }] },
    { id: 'result-card-player-2', playerId: 'player-2', results: [{ tournamentId: 'tournament-1', placement: '1' }] },
  ];
  dataState.pointsTable = {
    MPO: { '1': 100 },
    FPO: { '1': 90 },
  };

  renderApp(root, dataState, createUiState({ activeView: 'summary' }));

  assert.match(root.innerHTML, /<h1 id="summary-title">Yhteenveto<\/h1>/);
  assert.match(root.innerHTML, /TOP 10 MPO/);
  assert.match(root.innerHTML, /TOP 10 FPO/);
  assert.match(root.innerHTML, /Matti Meikäläinen/);
  assert.match(root.innerHTML, /Maija Meikäläinen/);
  assert.match(root.innerHTML, /Pelaajat/);
  assert.match(root.innerHTML, /Turnaukset/);
  assert.doesNotMatch(root.innerHTML, /<span class="eyebrow">Pistetaulukot<\/span>/);
  assert.doesNotMatch(root.innerHTML, /<span class="eyebrow">Tulokset<\/span>/);
  assert.doesNotMatch(root.innerHTML, /Pelaajan perustiedot/);
  assert.doesNotMatch(root.innerHTML, /Valitun pelaajan turnaustulokset/);
  assert.doesNotMatch(root.innerHTML, /data-summary-filter=/);
  assert.doesNotMatch(root.innerHTML, /data-summary-player/);
  assert.doesNotMatch(root.innerHTML, /Syötetyt tulokset/);
});

test('renderApp näyttää kompaktin build-rivin otsikon alla commit-buildillä Suomen ajassa', () => {
  const root = createRootStub();
  const dataState = createEmptyState();

  renderApp(
    root,
    dataState,
    createUiState({
      deploymentInfo: {
        version: '1.0.15',
        commit: '84f2c71',
        deployedAt: '2026-09-27T11:15:00Z',
      },
    }),
  );

  const buildInfo = root.innerHTML.match(/<p class="build-info"[^>]*>[\s\S]*?<\/p>/)?.[0] ?? '';
  assert.match(root.innerHTML, /<strong class="brand-title">SFL Pisteytystyökalu<\/strong>/);
  assert.match(
    buildInfo,
    /Build <span class="build-info-id">84f2c71<\/span>\s*<span class="build-info-separator" aria-hidden="true">•<\/span><span class="visually-hidden">, päivitetty<\/span>\s*<time datetime="2026-09-27T11:15:00Z">27\.09\.2026 14:15<\/time>/,
  );
  assert.match(buildInfo, /<span class="visually-hidden">, versio 1\.0\.15<\/span>/);
  assert.match(buildInfo, /title="Versio 1\.0\.15"/);
  assert.doesNotMatch(root.innerHTML, /<dt>Koonti:<\/dt>/);
  assert.doesNotMatch(root.innerHTML, /<span>Suomen frisbeegolfliitto<\/span>/);
  assert.match(root.innerHTML, /<span class="visually-hidden">Suomen frisbeegolfliitto<\/span>/);
});

test('renderApp näyttää vain olemassa olevat pelaajat TOP 10 -listoilla', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.players = [
    {
      id: 'player-1',
      firstName: 'Ari',
      lastName: 'Aalto',
      name: 'Ari Aalto',
      division: 'MPO',
      pdgaNumber: 12345,
      pdgaRating: '',
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
      pdgaEventId: '',
      startDate: '2026-07-03',
      endDate: '',
      displayOrder: 1,
      location: '',
      venue: '',
      status: '',
      multiplierId: 'multiplier-major',
      division: '',
      externalUrl: '',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  dataState.resultCards = [
    { id: 'result-card-player-1', playerId: 'player-1', results: [{ tournamentId: 'tournament-1', placement: '1' }] },
  ];

  renderApp(root, dataState, createUiState({ activeView: 'summary' }));

  assert.match(root.innerHTML, /Ari Aalto/);
  assert.doesNotMatch(root.innerHTML, /Sijoitus 1 • Sarja MPO/);
  assert.doesNotMatch(root.innerHTML, /Sijoitus 2 • Sarja MPO/);
  assert.match(root.innerHTML, /Sarjassa FPO ei ole vielä pisteellisiä pelaajia\./);
});

test('renderApp ranking-taulukon sijakesarakkeen lajittelupainikkeella on kuvaava aria-label', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.players = [
    {
      id: 'player-1',
      firstName: 'Ari',
      lastName: 'Aalto',
      name: 'Ari Aalto',
      division: 'MPO',
      pdgaNumber: 100,
      pdgaRating: 990,
      worldRank: 50,
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  dataState.resultCards = [
    { id: 'result-card-player-1', playerId: 'player-1', results: [{ tournamentId: 'tournament-1', placement: '1' }] },
  ];

  renderApp(root, dataState, createUiState({ activeView: 'ranking' }));

  assert.match(root.innerHTML, /data-sort-table="ranking" data-sort-field="rankPosition" aria-label="Sijoitus"/);
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
  assert.match(root.innerHTML, /data-sort-table="players" data-sort-field="name"/);
  assert.match(root.innerHTML, /data-sort-table="players" data-sort-field="pdgaNumber"/);
  assert.match(root.innerHTML, /data-sort-table="players" data-sort-field="division"/);
  assert.match(root.innerHTML, /data-sort-table="players" data-sort-field="pdgaRating"/);
  assert.match(root.innerHTML, /data-sort-table="players" data-sort-field="worldRank"/);
  assert.match(root.innerHTML, /aria-sort="ascending"/);
  assert.match(root.innerHTML, /<th>Tuloskortti<\/th>\s*<th>Tiedot<\/th>/);
  assert.match(root.innerHTML, /data-open-player-result-card="player-1" aria-label="Avaa pelaajan Testi Pelaaja tuloskortti">Tuloskortti<\/button>/);
  assert.match(root.innerHTML, /data-edit-player="player-1" aria-label="Muokkaa pelaajan Testi Pelaaja tietoja">Tiedot<\/button>/);
  assert.doesNotMatch(root.innerHTML, /data-edit-player="player-1"[^>]*>Muokkaa<\/button>/);
});

test('pelaajalista merkitsee vain puuttuvan ratingin myös ruudunlukijalle', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.players = [
    { id: 'one', name: 'Testi Pelaaja', division: 'MPO', pdgaNumber: 12345, pdgaRating: null, worldRank: null },
    { id: 'two', name: 'Toinen Pelaaja', division: 'FPO', pdgaNumber: 67890, pdgaRating: 998, worldRank: null },
  ];

  renderApp(root, dataState, createUiState({ activeView: 'players' }));

  assert.match(root.innerHTML, /<td data-label="PDGA-rating" class="rating-missing">—<span class="visually-hidden"> Ei ratingia<\/span><\/td>/);
  assert.match(root.innerHTML, /<td data-label="PDGA-rating">998<\/td>/);
  assert.match(root.innerHTML, /<td data-label="Maailmanranking">—<\/td>/);
  assert.doesNotMatch(root.innerHTML, /data-label="Maailmanranking" class="rating-missing"/);
});

test('renderApp renders sortable headers as keyboard-accessible buttons', () => {
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

  assert.match(root.innerHTML, /<button type="button" class="table-sort-button[^"]*" data-sort-table="players" data-sort-field="name">/);
  assert.match(root.innerHTML, /<button type="button" class="table-sort-button[^"]*" data-sort-table="players" data-sort-field="pdgaNumber">/);
});

test('renderApp shows player import fields and summary without instructions', () => {
  const root = createRootStub();
  const dataState = createEmptyState();

  renderApp(
    root,
    dataState,
    createUiState({
      activeView: 'players',
      playerImportDialogOpen: true,
      playerImportDivision: 'MPO',
      playerImportSummary: {
        totalRows: 4,
        importedCount: 2,
        failedCount: 2,
        failures: [
          { rowNumber: 18, pdgaId: '', reason: 'PDGA ID puuttuu' },
          { rowNumber: 20, pdgaId: '67890', reason: 'Virheellinen PDGA-rating' },
        ],
      },
    }),
  );

  assert.match(root.innerHTML, /<h2 id="players-import-dialog-title">Tuo pelaajat<\/h2>/);
  assert.match(root.innerHTML, /data-players-import-dialog-panel/);
  assert.doesNotMatch(root.innerHTML, /class="import-instructions"/);
  assert.match(root.innerHTML, /id="players-import-division" name="division" required/);
  assert.match(root.innerHTML, /id="players-import-file" name="file" type="file" accept="\.csv,text\/csv" required/);
  assert.match(root.innerHTML, /data-cancel-players-import>Sulje<\/button>/);
  assert.match(root.innerHTML, /Importti valmis/);
  assert.match(root.innerHTML, /class="message warning" role="alert" aria-live="assertive"/);
  assert.match(root.innerHTML, /Yhteensä rivejä: 4/);
  assert.match(root.innerHTML, /PDGA ID 67890 — Syy: Virheellinen PDGA-rating/);
  assert.match(root.innerHTML, /Rivi 18 — Syy: PDGA ID puuttuu/);
});

test('renderApp shows a separate rating and ranking import dialog and escaped summary', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  renderApp(root, dataState, createUiState({ ratingRankingDialogOpen: true }));
  assert.match(root.innerHTML, /data-open-rating-ranking-dialog>Päivitä Rating ja Ranking<\/button>/);
  assert.match(root.innerHTML, /role="dialog" aria-modal="true" aria-labelledby="rating-ranking-title"/);
  assert.doesNotMatch(root.innerHTML, /class="import-instructions"/);
  assert.match(root.innerHTML, /<textarea id="rating-ranking-csv" name="csv" rows="6" required/);

  renderApp(root, dataState, createUiState({
    ratingRankingDialogOpen: true,
    ratingRankingSummary: {
      updatedCount: 1,
      errors: [{ rowNumber: 3, pdgaId: '<b>123</b>', reason: 'Duplikaatti' }],
      observations: [{ rowNumber: 4, pdgaId: '456', reason: 'Pelaajaa ei löydy' }],
    },
  }));
  assert.match(root.innerHTML, /Onnistuneesti päivitetyt: 1/);
  assert.match(root.innerHTML, /Virheet: 1/);
  assert.match(root.innerHTML, /Huomiot: 1/);
  assert.match(root.innerHTML, /&lt;b&gt;123&lt;\/b&gt;/);
  assert.doesNotMatch(root.innerHTML, /<b>123<\/b>/);
  assert.doesNotMatch(root.innerHTML, /id="rating-ranking-form"/);
});

test('bindUi focuses rating and ranking dialog and restores focus to its opener', () => {
  const restoreDocument = installDocumentStub();
  try {
    const csv = createFocusableElement();
    const closeButton = createFocusableElement();
    const opener = createFocusableElement();
    const root = createInteractiveRoot({
      '#rating-ranking-csv': csv,
      '[data-cancel-rating-ranking-dialog]': closeButton,
      '[data-open-rating-ranking-dialog]': opener,
    });
    const state = createUiState({ ratingRankingDialogOpen: true, ratingRankingSummary: { updatedCount: 1 } });
    let closed = false;
    bindUi(root, createEmptyState(), state, {
      ...createNoopHandlers(),
      closeRatingRankingDialog() { closed = true; },
    });
    assert.equal(global.document.activeElement, closeButton);
    const event = { key: 'Escape', preventDefault() { this.prevented = true; } };
    root.__dialogKeydownHandler(event);
    assert.equal(closed, true);
    assert.equal(event.prevented, true);
    state.ratingRankingSummary = null;
    const inputRoot = createInteractiveRoot({ '#rating-ranking-csv': csv });
    bindUi(inputRoot, createEmptyState(), state, createNoopHandlers());
    assert.equal(global.document.activeElement, csv);
    state.ratingRankingDialogOpen = false;
    state.pendingFocusSelector = '[data-open-rating-ranking-dialog]';
    bindUi(root, createEmptyState(), state, createNoopHandlers());
    assert.equal(global.document.activeElement, opener);
  } finally {
    restoreDocument();
  }
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

test('renderApp shows tournament table with required column order and PDGA event id link', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.settings = {
    playerBaseUrl: 'https://example.com/player/',
    eventBaseUrl: 'https://example.com/event/',
  };
  dataState.tournaments = [
    {
      id: 'tournament-1',
      name: 'Finnish Nationals 2027',
      pdgaEventId: 123456,
      startDate: '2027-07-03',
      endDate: '2027-07-06',
      displayOrder: 1,
      location: 'Lahti',
      venue: 'Mukkula',
      multiplierId: 'multiplier-major',
      division: '',
      externalUrl: '',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'tournament-2',
      name: 'TBA Open 2027',
      pdgaEventId: '000000',
      startDate: '2027-08-01',
      endDate: '2027-08-03',
      displayOrder: 2,
      location: 'Helsinki',
      venue: 'Tali',
      multiplierId: 'multiplier-c-tier',
      division: '',
      externalUrl: '',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  renderApp(root, dataState, createUiState({ activeView: 'tournaments' }));

  assert.match(root.innerHTML, /data-open-tournament-dialog>Lisää turnaus<\/button>/);
  assert.match(root.innerHTML, /data-open-tournament-import-dialog>Tuo turnaukset<\/button>/);
  assert.match(root.innerHTML, /data-request-delete-all-tournaments/);
  assert.match(root.innerHTML, /data-sort-table="tournaments" data-sort-field="name"/);
  assert.match(root.innerHTML, /data-sort-table="tournaments" data-sort-field="displayOrder"/);
  assert.match(root.innerHTML, /data-sort-table="tournaments" data-sort-field="multiplierAbbreviation"/);
  assert.match(root.innerHTML, /data-sort-table="tournaments" data-sort-field="pdgaEventId"/);
  assert.match(root.innerHTML, /data-sort-table="tournaments" data-sort-field="startDate"/);
  assert.match(root.innerHTML, /data-sort-table="tournaments" data-sort-field="endDate"/);
  assert.match(root.innerHTML, /data-sort-table="tournaments" data-sort-field="location"/);
  assert.match(root.innerHTML, /data-sort-table="tournaments" data-sort-field="venue"/);
  assert.match(root.innerHTML, /data-label="Järjestysnumero">1<\/td>/);
  assert.match(root.innerHTML, /<th>Muokkaa<\/th>/);
  assert.match(root.innerHTML, /<span class="tournament-name-text">Finnish Nationals 2027<\/span>/);
  assert.match(root.innerHTML, /<span class="tournament-name-text">TBA Open 2027<\/span>/);
  assert.doesNotMatch(root.innerHTML, /class="tournament-name-link"/);
  assert.match(
    root.innerHTML,
    /<a class="pdga-id-link" href="https:\/\/example\.com\/event\/123456" target="_blank" rel="noopener noreferrer"[^>]*>123456<\/a>/,
  );
  assert.match(root.innerHTML, /<span class="pdga-id-unassigned">000000<\/span>/);
  assert.doesNotMatch(root.innerHTML, /href="[^"]*000000"/);
  assert.match(root.innerHTML, /data-edit-tournament="tournament-1">Muokkaa<\/button>/);
  assert.match(root.innerHTML, /Hae nimellä, paikkakunnalla tai radalla/);
  assert.doesNotMatch(root.innerHTML, /Turnaustulokset/);
  assert.doesNotMatch(root.innerHTML, /Hallittava turnaus/);
  assert.doesNotMatch(root.innerHTML, /Tulokset \(\d+\)/);
  assert.doesNotMatch(root.innerHTML, /Valittuna tuloksiin/);
  assert.doesNotMatch(root.innerHTML, /data-delete-tournament="tournament-1">Poista turnaus<\/button>/);
});

test('renderApp shows tournament import dialog and summary', () => {
  const root = createRootStub();
  const dataState = createEmptyState();

  renderApp(
    root,
    dataState,
    createUiState({
      activeView: 'tournaments',
      tournamentImportDialogOpen: true,
      tournamentImportSummary: {
        totalRows: 5,
        importedCount: 3,
        duplicateCount: 1,
        validationErrorCount: 1,
        failures: [
          { rowNumber: 4, reason: 'Turnauksen nimi puuttuu' },
          { rowNumber: 5, reason: 'PDGA Event ID on jo järjestelmässä (123456)' },
        ],
      },
    }),
  );

  assert.match(root.innerHTML, /<h2 id="tournament-import-dialog-title">Tuo turnaukset<\/h2>/);
  assert.match(root.innerHTML, /id="tournament-import-file" name="file" type="file" accept="\.csv,text\/csv" required/);
  assert.doesNotMatch(root.innerHTML, /class="import-instructions"/);
  assert.match(root.innerHTML, /Turnausten tuonti valmis/);
  assert.match(root.innerHTML, /<dt>Tuotu<\/dt><dd>3<\/dd>/);
  assert.match(root.innerHTML, /<dt>Ohitetut duplikaatit<\/dt><dd>1<\/dd>/);
  assert.match(root.innerHTML, /<dt>Validointivirheet<\/dt><dd>1<\/dd>/);
  assert.match(root.innerHTML, /Rivi 4: Turnauksen nimi puuttuu/);
});

test('renderApp shows disabled import button before file selection', () => {
  const root = createRootStub();
  const dataState = createEmptyState();

  renderApp(
    root,
    dataState,
    createUiState({
      activeView: 'tournaments',
      tournamentImportDialogOpen: true,
      tournamentImportSummary: null,
    }),
  );

  assert.match(
    root.innerHTML,
    /data-submit-tournament-import disabled>Tuo<\/button>/,
  );
});

test('renderApp shows delete all tournaments confirmation dialog copy', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.tournaments = [{ id: 't1' }, { id: 't2' }];
  dataState.resultCards = [{ id: 'result-card-player-1', playerId: 'player-1', results: [{ tournamentId: 't1', placement: '1' }] }];

  renderApp(
    root,
    dataState,
    createUiState({
      activeView: 'tournaments',
      confirmationDialog: { type: 'delete-all-tournaments' },
    }),
  );

  assert.match(root.innerHTML, /role="alertdialog"/);
  assert.match(root.innerHTML, /class="danger-banner" id="confirm-dialog-warning"><span aria-hidden="true">⚠<\/span> VAROITUS <span aria-hidden="true">⚠<\/span>/);
  assert.match(root.innerHTML, /<h2 id="confirm-dialog-title">Poista kaikki turnaukset<\/h2>/);
  assert.match(root.innerHTML, /Olet poistamassa kaikki turnaukset \(2 kpl\) ja turnaustulokset \(1 kpl\)\./);
  assert.match(root.innerHTML, /Tätä toimintoa ei voi perua\./);
  assert.match(root.innerHTML, /data-confirm-delete-all-tournaments>Poista<\/button>/);
  assert.match(root.innerHTML, /data-cancel-confirm-dialog autofocus>Peruuta<\/button>/);
});

test('renderApp shows shared tournament modal and delete action only in edit mode', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.tournaments = [
    {
      id: 'tournament-1',
      name: 'Testi Open',
      pdgaEventId: 123456,
      startDate: '2026-07-03',
      endDate: '',
      displayOrder: 1,
      location: 'Helsinki',
      venue: 'Rata',
      multiplierId: 'multiplier-major',
      division: '',
      externalUrl: '',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  renderApp(root, dataState, createUiState({ activeView: 'tournaments', tournamentDialogOpen: true, tournamentFormId: 'tournament-1' }));

  assert.match(root.innerHTML, /<h2 id="tournament-dialog-title">Muokkaa turnausta<\/h2>/);
  assert.match(root.innerHTML, /data-delete-tournament="tournament-1">Poista turnaus<\/button>/);

  renderApp(root, dataState, createUiState({ activeView: 'tournaments', tournamentDialogOpen: true, tournamentFormId: null }));
  assert.match(root.innerHTML, /<h2 id="tournament-dialog-title">Lisää turnaus<\/h2>/);
  assert.doesNotMatch(root.innerHTML, /data-delete-tournament="tournament-1">Poista turnaus<\/button>/);
});

test('renderApp shows required tournament delete confirmation dialog copy', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.tournaments = [
    {
      id: 'tournament-1',
      name: 'Testi Open',
      pdgaEventId: 123456,
      startDate: '2026-07-03',
      endDate: '',
      displayOrder: 1,
      location: 'Helsinki',
      venue: 'Rata',
      multiplierId: 'multiplier-major',
      division: '',
      externalUrl: '',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  dataState.resultCards = [{
    id: 'result-card-player-1',
    playerId: 'player-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    results: [{ tournamentId: 'tournament-1', placement: '1' }],
  }];

  renderApp(
    root,
    dataState,
    createUiState({
      activeView: 'tournaments',
      tournamentDialogOpen: true,
      tournamentFormId: 'tournament-1',
      confirmationDialog: { type: 'delete-tournament', tournamentId: 'tournament-1' },
    }),
  );

  assert.match(root.innerHTML, /<h2 id="confirm-dialog-title">Poista turnaus<\/h2>/);
  assert.match(root.innerHTML, /Haluatko varmasti poistaa turnauksen Testi Open\?<br \/>\s*Samalla poistetaan 1 turnaustulosta eikä toimintoa voi peruuttaa\./);
  assert.match(root.innerHTML, /data-cancel-confirm-dialog[^>]*>Peruuta<\/button>/);
  assert.match(root.innerHTML, /data-confirm-delete-tournament="tournament-1">Poista turnaus<\/button>/);
});

test('renderApp shows tournament delete confirmation copy for zero linked results', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.tournaments = [
    {
      id: 'tournament-1',
      name: 'Testi Open',
      pdgaEventId: '',
      startDate: '2026-07-03',
      endDate: '',
      displayOrder: 1,
      location: 'Helsinki',
      venue: 'Rata',
      multiplierId: 'multiplier-major',
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
      activeView: 'tournaments',
      tournamentDialogOpen: true,
      tournamentFormId: 'tournament-1',
      confirmationDialog: { type: 'delete-tournament', tournamentId: 'tournament-1' },
    }),
  );

  assert.match(root.innerHTML, /Samalla poistetaan 0 turnaustulosta eikä toimintoa voi peruuttaa\./);
});

test('renderApp shows tournament delete confirmation copy for multiple linked results', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.tournaments = [
    {
      id: 'tournament-1',
      name: 'Testi Open',
      pdgaEventId: '',
      startDate: '2026-07-03',
      endDate: '',
      displayOrder: 1,
      location: 'Helsinki',
      venue: 'Rata',
      multiplierId: 'multiplier-major',
      division: '',
      externalUrl: '',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  dataState.resultCards = [
    { id: 'result-card-player-1', playerId: 'player-1', results: [{ tournamentId: 'tournament-1', placement: '1' }] },
    { id: 'result-card-player-2', playerId: 'player-2', results: [{ tournamentId: 'tournament-1', placement: '2' }] },
  ];

  renderApp(
    root,
    dataState,
    createUiState({
      activeView: 'tournaments',
      tournamentDialogOpen: true,
      tournamentFormId: 'tournament-1',
      confirmationDialog: { type: 'delete-tournament', tournamentId: 'tournament-1' },
    }),
  );

  assert.match(root.innerHTML, /Samalla poistetaan 2 turnaustulosta eikä toimintoa voi peruuttaa\./);
});

test('renderApp shows score table division actions and Finnish decimals', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.pointsTable = {
    MPO: { '1': 100, '2': 10.5 },
    FPO: { '1': 7.25 },
  };

  renderApp(root, dataState, createUiState({ activeView: 'points' }));

  assert.match(root.innerHTML, /data-open-points-dialog>Lisää rivi<\/button>/);
  assert.match(root.innerHTML, /data-open-points-import>Tuo pistetaulukko<\/button>/);
  assert.match(root.innerHTML, /data-request-delete-points="MPO">.*Poista kaikki MPO-pisteet<\/button>/);
  assert.match(root.innerHTML, /data-request-delete-points="FPO">.*Poista kaikki FPO-pisteet<\/button>/);
  assert.doesNotMatch(root.innerHTML, /id="points-form"/);
  assert.match(root.innerHTML, /<td>10,5<\/td>/);
  assert.match(root.innerHTML, /<td>7,25<\/td>/);
});

test('renderApp shows score table import dialog with division dropdown and file input', () => {
  const root = createRootStub();
  const dataState = createEmptyState();

  renderApp(
    root,
    dataState,
    createUiState({
      activeView: 'points',
      pointsImportDialogOpen: true,
      pointsImportDivision: 'FPO',
    }),
  );

  assert.match(root.innerHTML, /<h2 id="points-import-dialog-title">Tuo pistetaulukko<\/h2>/);
  assert.match(root.innerHTML, /id="points-import-division" name="division" required/);
  assert.match(root.innerHTML, /<option value="MPO" >MPO<\/option>/);
  assert.match(root.innerHTML, /<option value="FPO" selected>FPO<\/option>/);
  assert.doesNotMatch(root.innerHTML, /class="import-instructions"/);
  assert.match(root.innerHTML, /id="points-import-file" name="file" type="file" accept="\.csv,text\/csv" required/);
  assert.match(root.innerHTML, /<button type="submit" class="button">Tuo<\/button>/);
  assert.match(root.innerHTML, /data-cancel-points-import>Peruuta<\/button>/);
});

test('renderApp shows score table delete confirmation copy', () => {
  const root = createRootStub();
  const dataState = createEmptyState();

  renderApp(
    root,
    dataState,
    createUiState({
      activeView: 'points',
      confirmationDialog: { type: 'delete-points-division', division: 'MPO' },
    }),
  );

  assert.match(root.innerHTML, /<h2 id="confirm-dialog-title">Poista sarjan MPO pisteet<\/h2>/);
  assert.match(root.innerHTML, /Haluatko varmasti poistaa kaikki sarjan MPO pistetaulukon rivit\?<br \/>\s*Tätä toimintoa ei voi perua\./);
  assert.match(root.innerHTML, /data-confirm-delete-points-division="MPO">Poista<\/button>/);
});

test('renderApp näyttää Kertoimet-välilehden ja taulukon sarakkeet', () => {
  const root = createRootStub();
  const dataState = createEmptyState();

  renderApp(root, dataState, createUiState({ activeView: 'multipliers' }));

  assert.match(root.innerHTML, /data-view-target="multipliers"/);
  assert.match(root.innerHTML, /<h2 id="multipliers-title">Kertoimet<\/h2>/);
  assert.match(root.innerHTML, /data-open-multiplier-dialog>Lisää kerroin<\/button>/);
  assert.match(root.innerHTML, /data-sort-table="multipliers" data-sort-field="orderNumber"/);
  assert.match(root.innerHTML, /data-sort-table="multipliers" data-sort-field="name"/);
  assert.match(root.innerHTML, /data-sort-table="multipliers" data-sort-field="abbreviation"/);
  assert.match(root.innerHTML, /data-sort-table="multipliers" data-sort-field="multiplier"/);
  assert.match(root.innerHTML, /<th>Muokkaa<\/th>/);
});

test('renderApp näyttää kertoimen dialogin ja poiston vahvistustekstit', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  const firstMultiplierId = dataState.multipliers[0].id;

  renderApp(
    root,
    dataState,
    createUiState({
      activeView: 'multipliers',
      multiplierDialogOpen: true,
      multiplierFormId: firstMultiplierId,
      confirmationDialog: { type: 'delete-multiplier', multiplierId: firstMultiplierId },
    }),
  );

  assert.match(root.innerHTML, /<h2 id="multiplier-dialog-title">Muokkaa kerrointa<\/h2>/);
  assert.match(root.innerHTML, /id="multiplier-order-number"/);
  assert.match(root.innerHTML, /data-delete-multiplier="[^"]+">Poista<\/button>/);
  assert.match(root.innerHTML, /Varoitus: poista kerroin/);
  assert.match(root.innerHTML, /Olet poistamassa kertoimen\./);
  assert.match(root.innerHTML, /Tätä toimintoa ei voi perua\./);
  assert.match(root.innerHTML, /Haluatko varmasti jatkaa\?/);
  assert.match(root.innerHTML, /data-confirm-delete-multiplier="[^"]+">Poista<\/button>/);
});

test('renderApp näyttää navigaatiossa Tulokset-välilehden heti Rankingin jälkeen', () => {
  const root = createRootStub();
  const dataState = createEmptyState();

  renderApp(root, dataState, createUiState({ activeView: 'summary' }));

  assert.match(root.innerHTML, /Ranking[\s\S]*Tulokset[\s\S]*Pelaajat/);
});

function createResultsDataState() {
  const dataState = createEmptyState();
  dataState.settings = {
    playerBaseUrl: 'https://example.com/player/',
    eventBaseUrl: 'https://www.pdga.com/tour/event/',
    pointDecimals: 2,
  };
  dataState.players = [
    { id: 'mpo-1', name: 'Niklas Anttila', division: 'MPO', pdgaNumber: 100 },
    { id: 'mpo-2', name: 'Aapo Aalto', division: 'MPO', pdgaNumber: 101 },
    { id: 'fpo-1', name: 'Eveliina Salonen', division: 'FPO', pdgaNumber: 200 },
  ];
  dataState.tournaments = [
    { id: 't-tampere', name: 'Tampere Open', pdgaEventId: '000000', startDate: '2026-08-01', endDate: '', displayOrder: 2, multiplierId: 'multiplier-c-tier' },
    { id: 't-european', name: 'European Open', pdgaEventId: 97339, startDate: '2026-07-17', endDate: '2026-07-20', displayOrder: 1, multiplierId: 'multiplier-major' },
  ];
  dataState.pointsTable = { MPO: { 1: 100, 2: 90 }, FPO: { 1: 60 } };
  dataState.resultCards = [
    { id: 'result-card-mpo-1', playerId: 'mpo-1', results: [{ tournamentId: 't-european', placement: '1' }] },
    { id: 'result-card-mpo-2', playerId: 'mpo-2', results: [{ tournamentId: 't-european', placement: '2' }] },
    { id: 'result-card-fpo-1', playerId: 'fpo-1', results: [{ tournamentId: 't-european', placement: '1' }] },
  ];
  return dataState;
}

test('renderApp näyttää Tulokset-sivulla turnausyhteenvedon järjestysnumeron mukaan ja parhaat MPO/FPO-tulokset', () => {
  const root = createRootStub();
  const dataState = createResultsDataState();

  renderApp(root, dataState, createUiState({ activeView: 'results' }));

  const section = root.innerHTML.slice(root.innerHTML.indexOf('id="section-results"'));
  assert.match(
    section,
    /<th scope="col">Turnauksen nimi<\/th>\s*<th scope="col">Tila<\/th>\s*<th scope="col" class="number">Kerroin<\/th>\s*<th scope="col">PDGA Event ID<\/th>\s*<th scope="col">Alkupäivä<\/th>\s*<th scope="col">Loppupäivä<\/th>\s*<th scope="col">Paras MPO<\/th>\s*<th scope="col">Paras FPO<\/th>/,
  );
  assert.match(section, /European Open[\s\S]*Tampere Open/);
  assert.match(section, /<span class="tournament-name-text">European Open<\/span>/);
  assert.match(section, /<span class="tournament-name-text">Tampere Open<\/span>/);
  assert.doesNotMatch(section, /class="tournament-name-link"/);
  assert.match(
    section,
    /<a class="pdga-id-link" href="https:\/\/www\.pdga\.com\/tour\/event\/97339" target="_blank" rel="noopener noreferrer"[^>]*>97339<\/a>/,
  );
  assert.match(section, /<span class="pdga-id-unassigned">000000<\/span>/);
  assert.doesNotMatch(section, /href="[^"]*000000"/);
  assert.match(section, /<td data-label="Tila">MAJ<\/td>/);
  assert.match(section, /<td data-label="Paras MPO">1 Niklas Anttila<\/td>\s*<td data-label="Paras FPO">1 Eveliina Salonen<\/td>/);
  assert.match(section, /<td data-label="Paras MPO">-<\/td>\s*<td data-label="Paras FPO">-<\/td>/);
  assert.doesNotMatch(root.innerHTML, /Lisää tuloskortti|data-open-result-card-dialog|data-delete-all-result-cards/);
});

test('renderApp näyttää Tulokset-painikkeen jokaisen turnausrivin lopussa', () => {
  const root = createRootStub();
  const dataState = createResultsDataState();

  renderApp(root, dataState, createUiState({ activeView: 'results' }));

  const section = root.innerHTML.slice(root.innerHTML.indexOf('id="section-results"'));
  assert.equal((section.match(/data-open-tournament-result-card="/g) || []).length, 2);
  assert.match(
    section,
    /<td data-label="Paras FPO">1 Eveliina Salonen<\/td>\s*<td data-label="Turnauksen tulokset"><button type="button" class="secondary-button" data-open-tournament-result-card="t-european" aria-label="Avaa turnauksen European Open tulokset">Tulokset<\/button><\/td>\s*<\/tr>/,
  );
  assert.match(section, /data-open-tournament-result-card="t-tampere"/);
});

test('renderApp näyttää turnauksen tuloskortin otsakkeen, sarjat ja mitalikorostukset lukutilassa', () => {
  const root = createRootStub();
  const dataState = createResultsDataState();
  dataState.tournaments[1].location = 'Nokia';
  dataState.players.push(
    { id: 'mpo-3', name: 'Väinö Mäkelä', division: 'MPO' },
    { id: 'mpo-4', name: 'Teemu Lampainen', division: 'MPO' },
    { id: 'mpo-5', name: 'Aki Seppälä', division: 'MPO' },
  );
  dataState.resultCards.push(
    { id: 'result-card-mpo-5', playerId: 'mpo-5', results: [{ tournamentId: 't-european', placement: '5' }] },
    { id: 'result-card-mpo-3', playerId: 'mpo-3', results: [{ tournamentId: 't-european', placement: '3T2' }] },
    { id: 'result-card-mpo-4', playerId: 'mpo-4', results: [{ tournamentId: 't-european', placement: '3T2' }] },
  );

  renderApp(root, dataState, createUiState({ activeView: 'tournament-result-card', tournamentResultCardId: 't-european' }));

  const html = root.innerHTML;
  assert.match(html, /data-view-target="results" aria-current="page"/);
  assert.match(html, /<h2 id="tournament-result-card-title" class="tournament-result-card-title">European Open<\/h2>/);
  assert.match(html, /data-tournament-result-card-date>17\.07\.2026 - 20\.07\.2026<\/dd>/);
  assert.match(html, /<dt>Paikkakunta<\/dt><dd>Nokia<\/dd>/);
  assert.match(html, /<dt>Tila<\/dt><dd><span class="status-chip tournament-result-card-status">MAJ<\/span><\/dd>/);
  assert.match(
    html,
    /<dt>PDGA Event ID<\/dt><dd><a class="pdga-id-link" href="https:\/\/www\.pdga\.com\/tour\/event\/97339" target="_blank" rel="noopener noreferrer"[^>]*>97339<\/a><\/dd>/,
  );
  assert.match(html, /data-close-tournament-result-card>← Takaisin tuloksiin<\/button>/);
  assert.match(html, /data-tournament-standings-division="MPO"[\s\S]*data-tournament-standings-division="FPO"/);
  assert.match(html, /<th scope="col">Sijoitus<\/th>\s*<th scope="col">Kilpailija<\/th>/);

  const mpo = html.slice(html.indexOf('data-tournament-standings-division="MPO"'), html.indexOf('data-tournament-standings-division="FPO"'));
  const rowOrder = [...mpo.matchAll(/class="standings-player">([^<]+)</g)].map((match) => match[1]);
  assert.deepEqual(rowOrder, ['Niklas Anttila', 'Aapo Aalto', 'Teemu Lampainen', 'Väinö Mäkelä', 'Aki Seppälä']);
  assert.match(mpo, /class="standings-row medal-gold" data-medal="gold">[\s\S]*?aria-label="Kultamitali">🥇<\/span><span class="standings-placement-value">1</);
  assert.match(mpo, /data-medal="silver">[\s\S]*?🥈[\s\S]*?>2</);
  assert.equal((mpo.match(/data-medal="bronze"/g) || []).length, 2);
  assert.match(mpo, /🥉<\/span><span class="standings-placement-value">3T2</);
  assert.match(mpo, /<tr class="standings-row">\s*<td data-label="Sijoitus" class="standings-placement"><span class="medal-icon medal-icon-empty" aria-hidden="true"><\/span><span class="standings-placement-value">5</);

  const cardStart = html.indexOf('id="section-tournament-result-card"');
  const card = html.slice(cardStart, html.indexOf('</article>', cardStart));
  assert.doesNotMatch(card, /<input|data-result-placement|data-edit-player-result-card|danger-button|Tyhjennä/);
});

test('renderApp näyttää yksipäiväisen turnauksen yhden päivän, piilottaa tyhjät sarjat ja 000000-tunnuksen varoituksena', () => {
  const root = createRootStub();
  const dataState = createResultsDataState();
  dataState.tournaments[0].endDate = '2026-08-01';
  dataState.resultCards.push({ id: 'result-card-x', playerId: 'fpo-1', results: [{ tournamentId: 't-tampere', placement: '1T2' }] });

  renderApp(root, dataState, createUiState({ activeView: 'tournament-result-card', tournamentResultCardId: 't-tampere' }));

  const html = root.innerHTML;
  assert.match(html, /data-tournament-result-card-date>01\.08\.2026<\/dd>/);
  assert.doesNotMatch(html, /01\.08\.2026 - 01\.08\.2026/);
  assert.match(html, /data-tournament-standings-division="FPO"/);
  assert.doesNotMatch(html, /data-tournament-standings-division="MPO"/);
  assert.match(html, /data-medal="gold"[\s\S]*?🥇<\/span><span class="standings-placement-value">1T2</);
  assert.match(html, /<span class="pdga-id-unassigned pdga-id-warning"[^>]*><span aria-hidden="true">⚠<\/span> <span class="pdga-id-unassigned">000000<\/span><span class="visually-hidden"> \(PDGA Event ID:tä ei ole vielä määritetty\)<\/span><\/span>/);
  assert.doesNotMatch(html, /href="[^"]*000000"/);
});

test('renderApp näyttää turnauksen tuloskortilla ilmoituksen, kun tuloksia ei ole', () => {
  const root = createRootStub();
  const dataState = createResultsDataState();

  renderApp(root, dataState, createUiState({ activeView: 'tournament-result-card', tournamentResultCardId: 't-tampere' }));

  assert.match(root.innerHTML, /Turnaukseen ei ole vielä syötetty tuloksia\./);
  assert.doesNotMatch(root.innerHTML, /data-tournament-standings-division/);
});

test('bindUi kutsuu turnauksen tuloskortin avaus- ja sulkemiskäsittelijöitä', () => {
  const restoreDocument = installDocumentStub();
  const openButton = createFocusableElement();
  openButton.dataset = { openTournamentResultCard: 't-european' };
  const closeButton = createFocusableElement();
  const root = {
    __dialogKeydownHandler: null,
    querySelector(selector) {
      return selector === '[data-close-tournament-result-card]' ? closeButton : null;
    },
    querySelectorAll(selector) {
      return selector === '[data-open-tournament-result-card]' ? [openButton] : [];
    },
  };
  const calls = [];
  const handlers = new Proxy(
    {
      openTournamentResultCard(tournamentId) {
        calls.push(['open', tournamentId]);
      },
      closeTournamentResultCard() {
        calls.push(['close']);
      },
    },
    {
      get(target, property) {
        return property in target ? target[property] : () => {};
      },
    },
  );

  try {
    bindUi(root, createEmptyState(), createUiState(), handlers);
    openButton.listeners.click();
    closeButton.listeners.click();
    assert.deepEqual(calls, [['open', 't-european'], ['close']]);
  } finally {
    restoreDocument();
  }
});

test('renderApp näyttää pelaajan tuloskortin sarakkeet, PDGA Event -linkin, sijoituskentät ja lasketut pisteet', () => {
  const root = createRootStub();
  const dataState = createResultsDataState();

  renderApp(root, dataState, createUiState({ activeView: 'player-result-card', resultCardPlayerId: 'mpo-1' }));

  assert.match(root.innerHTML, /<h2 id="player-result-card-title">Tuloskortti: Niklas Anttila<\/h2>/);
  assert.match(root.innerHTML, /data-view-target="players" aria-current="page"/);
  assert.match(
    root.innerHTML,
    /<th scope="col">Turnauksen nimi<\/th>\s*<th scope="col">Tila<\/th>\s*<th scope="col" class="number">Kerroin<\/th>\s*<th scope="col">PDGA Event ID<\/th>\s*<th scope="col">Sijoitus<\/th>\s*<th scope="col" class="number">Lasketut pisteet<\/th>\s*<th scope="col">Tyhjennä<\/th>/,
  );
  assert.match(root.innerHTML, /data-player-result-row="t-european"[\s\S]*data-player-result-row="t-tampere"/);
  assert.match(
    root.innerHTML,
    /<a class="pdga-id-link" href="https:\/\/www\.pdga\.com\/tour\/event\/97339" target="_blank" rel="noopener noreferrer"[^>]*>97339<\/a>/,
  );
  assert.match(root.innerHTML, /<span class="pdga-id-unassigned">000000<\/span>/);
  assert.doesNotMatch(root.innerHTML, /href="[^"]*000000"/);
  assert.match(root.innerHTML, /value="1"[\s\S]*?data-result-placement\s*data-player-id="mpo-1"\s*data-tournament-id="t-european"/);
  assert.match(root.innerHTML, /data-result-points>200 p<\/td>/);
  assert.match(root.innerHTML, /data-clear-player-placement="t-european" data-player-id="mpo-1" aria-label="Tyhjennä sijoitus: European Open" disabled>Tyhjennä<\/button>/);
  assert.match(root.innerHTML, /data-clear-player-placement="t-tampere" data-player-id="mpo-1" aria-label="Tyhjennä sijoitus: Tampere Open" disabled>Tyhjennä<\/button>/);
  assert.match(root.innerHTML, /data-edit-player-result-card>Muokkaa<\/button>/);
  assert.match(root.innerHTML, /data-close-player-result-card/);
});

test('renderApp näyttää Ranking-sivun pelaajan nimen tuloskortin avaavana painikkeena', () => {
  const root = createRootStub();
  const dataState = createResultsDataState();

  renderApp(root, dataState, createUiState({ activeView: 'ranking' }));

  const section = root.innerHTML.slice(root.innerHTML.indexOf('id="section-ranking"'));
  assert.match(
    section,
    /<button type="button" class="player-name-button" data-open-player-result-card="mpo-1" data-result-card-origin="ranking" title="Avaa tuloskortti" aria-label="Avaa pelaajan Niklas Anttila tuloskortti">Niklas Anttila<\/button>/,
  );
  assert.match(
    section,
    /<a class="pdga-id-link" href="https:\/\/example\.com\/player\/100" target="_blank" rel="noopener noreferrer" title="Avaa PDGA-profiili" aria-label="Avaa pelaajan Niklas Anttila PDGA-profiili">100<\/a>/,
  );
  assert.doesNotMatch(section, /target="_blank"[^>]*>Niklas Anttila</);
});

test('renderApp näyttää Rankingista avatun tuloskortin lukutilassa ja paluun Rankingiin', () => {
  const root = createRootStub();
  const dataState = createResultsDataState();

  renderApp(
    root,
    dataState,
    createUiState({ activeView: 'player-result-card', resultCardPlayerId: 'mpo-1', resultCardOrigin: 'ranking' }),
  );

  assert.match(root.innerHTML, /data-result-card-mode="read-only"/);
  assert.match(root.innerHTML, /data-close-player-result-card>← Takaisin Rankingiin<\/button>/);
  assert.match(root.innerHTML, /data-edit-player-result-card>Muokkaa<\/button>/);
  assert.match(root.innerHTML, /data-view-target="ranking" aria-current="page"/);
  assert.doesNotMatch(root.innerHTML, /data-view-target="players" aria-current="page"/);
});

test('renderApp näyttää Yhteenvedosta avatun tuloskortin lukutilassa ja paluun yhteenvetoon', () => {
  const root = createRootStub();
  const dataState = createResultsDataState();

  renderApp(
    root,
    dataState,
    createUiState({ activeView: 'player-result-card', resultCardPlayerId: 'mpo-1', resultCardOrigin: 'summary' }),
  );

  assert.match(root.innerHTML, /data-result-card-mode="read-only"/);
  assert.match(root.innerHTML, /data-close-player-result-card>← Takaisin yhteenvetoon<\/button>/);
  assert.match(root.innerHTML, /data-view-target="summary" aria-current="page"/);
});

test('renderApp näyttää Yhteenvedossa World Ranking -taulukot TOP 10 -taulukoiden yläpuolella', () => {
  const root = createRootStub();
  const dataState = createResultsDataState();
  dataState.players = [
    { id: 'mpo-1', name: 'Niklas Anttila', division: 'MPO', pdgaNumber: 100, pdgaRating: 1045, worldRank: 2 },
    { id: 'mpo-2', name: 'Aapo Aalto', division: 'MPO', pdgaNumber: 101, pdgaRating: 1025, worldRank: 1 },
    { id: 'mpo-3', name: 'Ilman Rankingia', division: 'MPO', pdgaNumber: 102, pdgaRating: 990, worldRank: '' },
    { id: 'fpo-1', name: 'Eveliina Salonen', division: 'FPO', pdgaNumber: 200, pdgaRating: 950, worldRank: null },
  ];

  renderApp(root, dataState, createUiState({ activeView: 'summary' }));
  const html = getSummarySectionHtml(root.innerHTML);

  assert.match(html, /World Ranking MPO[\s\S]*World Ranking FPO[\s\S]*TOP 10 MPO[\s\S]*TOP 10 FPO/);
  const worldRankingMpo = html.match(/data-summary-table="summary-world-ranking-mpo"[\s\S]*?<\/article>/)[0];
  assert.match(worldRankingMpo, /<th scope="col">Nimi<\/th>/);
  assert.match(worldRankingMpo, /aria-sort="ascending">\s*<button type="button" class="table-sort-button is-active" data-sort-table="summary-world-ranking-mpo" data-sort-field="worldRank" aria-label="World Ranking -sijoitus">\s*<span>#<\/span>\s*<span class="table-sort-indicator" aria-hidden="true">▲<\/span>/);
  assert.match(worldRankingMpo, /data-sort-field="pdgaRating"[\s\S]*<span>Rating<\/span>/);
  assert.match(worldRankingMpo, /data-sort-field="totalPoints"[\s\S]*<span>Kokonaispisteet<\/span>/);
  assert.match(worldRankingMpo, /<td>1<\/td>[\s\S]*Aapo Aalto[\s\S]*<td>2<\/td>[\s\S]*Niklas Anttila/);
  assert.match(worldRankingMpo, /data-open-player-result-card="mpo-1" data-result-card-origin="summary"/);
  assert.doesNotMatch(worldRankingMpo, /Ilman Rankingia/);

  const worldRankingFpo = html.match(/data-summary-table="summary-world-ranking-fpo"[\s\S]*?<\/article>/)[0];
  assert.match(worldRankingFpo, /Sarjassa FPO ei ole pelaajia, joilla on World Ranking -sijoitus\./);

  const topMpo = html.match(/data-summary-table="summary-top-mpo"[\s\S]*?<\/article>/)[0];
  assert.match(topMpo, /data-sort-table="summary-top-mpo" data-sort-field="rankPosition" aria-label="Sijoitus"/);
  assert.match(topMpo, /Ilman Rankingia/);
  assert.match(topMpo, /<td class="number">1025<\/td>/);
});

test('renderApp käyttää Yhteenvedon taulukoissa toisistaan riippumatonta lajittelua', () => {
  const root = createRootStub();
  const dataState = createResultsDataState();
  dataState.players = [
    { id: 'mpo-1', name: 'Niklas Anttila', division: 'MPO', pdgaNumber: 100, pdgaRating: 1045, worldRank: 2 },
    { id: 'mpo-2', name: 'Aapo Aalto', division: 'MPO', pdgaNumber: 101, pdgaRating: 1025, worldRank: 1 },
    { id: 'fpo-1', name: 'Eveliina Salonen', division: 'FPO', pdgaNumber: 200, pdgaRating: 950, worldRank: 5 },
    { id: 'fpo-2', name: 'Henna Blomroos', division: 'FPO', pdgaNumber: 201, pdgaRating: 960, worldRank: 3 },
  ];

  renderApp(
    root,
    dataState,
    createUiState({ activeView: 'summary', summarySort: { 'summary-world-ranking-mpo': { field: 'pdgaRating', direction: 'desc' } } }),
  );
  const html = getSummarySectionHtml(root.innerHTML);
  const worldRankingMpo = html.match(/data-summary-table="summary-world-ranking-mpo"[\s\S]*?<\/article>/)[0];
  const worldRankingFpo = html.match(/data-summary-table="summary-world-ranking-fpo"[\s\S]*?<\/article>/)[0];

  assert.match(worldRankingMpo, /Niklas Anttila[\s\S]*Aapo Aalto/);
  assert.match(worldRankingMpo, /aria-sort="descending">\s*<button[^>]*data-sort-field="pdgaRating"[\s\S]*?▼/);
  assert.match(worldRankingFpo, /Henna Blomroos[\s\S]*Eveliina Salonen/);
  assert.match(worldRankingFpo, /aria-sort="ascending">\s*<button[^>]*data-sort-field="worldRank"/);
});

test('renderApp avaa tuloskortin lukutilaan, jossa sijoituksia ei voi muokata', () => {
  const root = createRootStub();
  const dataState = createResultsDataState();

  renderApp(root, dataState, createUiState({ activeView: 'player-result-card', resultCardPlayerId: 'mpo-1' }));

  assert.match(root.innerHTML, /data-result-card-mode="read-only"[^>]*>\s*<span aria-hidden="true">🔒<\/span> Lukutila/);
  assert.doesNotMatch(root.innerHTML, /data-result-card-mode="edit"/);
  assert.match(root.innerHTML, /data-tournament-id="t-european"\s*readonly aria-readonly="true"/);
  assert.doesNotMatch(root.innerHTML, /data-save-player-result-card|data-exit-player-result-card-edit/);
});

test('renderApp näyttää muokkaustilan painikkeet, luonnoksen sijoitukset ja muokattavat kentät', () => {
  const root = createRootStub();
  const dataState = createResultsDataState();

  renderApp(root, dataState, createUiState({
    activeView: 'player-result-card',
    resultCardPlayerId: 'mpo-1',
    resultCardEditMode: true,
    resultCardDraft: [
      { id: 'result-card-mpo-1', playerId: 'mpo-1', results: [{ tournamentId: 't-european', placement: '2' }] },
    ],
  }));

  assert.match(root.innerHTML, /data-result-card-mode="edit"[^>]*>\s*<span aria-hidden="true">✎<\/span> Muokkaustila/);
  assert.match(root.innerHTML, /data-save-player-result-card>Tallenna ja poistu<\/button>/);
  assert.match(root.innerHTML, /data-exit-player-result-card-edit>Poistu<\/button>/);
  assert.doesNotMatch(root.innerHTML, /readonly aria-readonly="true"/);
  assert.match(root.innerHTML, /value="2"[\s\S]*?data-tournament-id="t-european"/);
  assert.match(root.innerHTML, /data-clear-player-placement="t-european" data-player-id="mpo-1" aria-label="Tyhjennä sijoitus: European Open">Tyhjennä<\/button>/);
});

test('renderApp näyttää vahvistuksen muokkaustilasta poistumiselle tallentamatta', () => {
  const root = createRootStub();
  const dataState = createResultsDataState();

  renderApp(root, dataState, createUiState({
    activeView: 'player-result-card',
    resultCardPlayerId: 'mpo-1',
    resultCardEditMode: true,
    confirmationDialog: { type: 'exit-player-result-card-edit' },
  }));

  assert.match(root.innerHTML, /Tuloskortilla on tallentamattomia muutoksia\./);
  assert.match(root.innerHTML, /data-confirm-exit-player-result-card-edit[^>]*>Poistu ilman tallennusta<\/button>/);
  assert.match(root.innerHTML, /data-cancel-confirm-dialog[^>]*>Peruuta<\/button>/);
});

test('renderApp näyttää sijoituksen tyhjennyksen vahvistusdialogin', () => {
  const root = createRootStub();
  const dataState = createResultsDataState();

  renderApp(root, dataState, createUiState({
    activeView: 'player-result-card',
    resultCardPlayerId: 'mpo-1',
    confirmationDialog: { type: 'clear-player-placement', playerId: 'mpo-1', tournamentId: 't-european' },
  }));

  assert.match(root.innerHTML, /Tyhjennetäänkö sijoitus ja lasketut pisteet\?/);
  assert.match(root.innerHTML, /data-confirm-clear-player-placement[^>]*>Tyhjennä<\/button>/);
  assert.match(root.innerHTML, /data-cancel-confirm-dialog[^>]*>Peruuta<\/button>/);
});

function createPlacementInput(tournamentId, value = '') {
  const input = createFocusableElement();
  input.value = value;
  input.dataset = { playerId: 'mpo-1', tournamentId };
  input.setSelectionRange = (start, end) => {
    input.selection = [start, end];
  };
  return input;
}

test('bindUi siirtää Tab-näppäimellä kohdistuksen seuraavan turnauksen sijoituskenttään ja tallentaa muutoksen', () => {
  const restoreDocument = installDocumentStub();
  const firstInput = createPlacementInput('t-european', '1');
  const secondInput = createPlacementInput('t-tampere', '');
  const saveButton = createFocusableElement();
  const calls = [];
  const root = {
    __dialogKeydownHandler: null,
    querySelector(selector) {
      return selector === '[data-save-player-result-card]' ? saveButton : null;
    },
    querySelectorAll(selector) {
      if (selector.includes('data-result-placement')) {
        return [firstInput, secondInput];
      }
      if (selector === '[data-save-player-result-card]') {
        return [saveButton];
      }
      return [];
    },
  };
  const handlers = new Proxy(
    {
      updatePlayerPlacement(playerId, tournamentId, value) {
        calls.push(['update', playerId, tournamentId, value]);
      },
      savePlayerResultCard(playerId, entries) {
        calls.push(['save', playerId, entries]);
      },
    },
    {
      get(target, property) {
        return property in target ? target[property] : () => {};
      },
    },
  );

  try {
    bindUi(
      root,
      createResultsDataState(),
      createUiState({ activeView: 'player-result-card', resultCardPlayerId: 'mpo-1', resultCardEditMode: true }),
      handlers,
    );

    let prevented = false;
    firstInput.listeners.keydown({ key: 'Tab', shiftKey: false, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(global.document.activeElement, secondInput);
    assert.equal(firstInput.value, '1');
    assert.equal(secondInput.value, '');

    firstInput.listeners.change({ target: firstInput });
    assert.deepEqual(calls[0], ['update', 'mpo-1', 't-european', '1']);

    saveButton.listeners.click();
    assert.equal(calls.at(-1)[0], 'save');
    assert.equal(calls.at(-1)[1], 'mpo-1');
  } finally {
    restoreDocument();
  }
});

test('bindUi ei sido sijoituskenttien muokkaustoimintoja lukutilassa', () => {
  const restoreDocument = installDocumentStub();
  const firstInput = createPlacementInput('t-european', '1');
  const root = {
    __dialogKeydownHandler: null,
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      return selector.includes('data-result-placement') ? [firstInput] : [];
    },
  };

  try {
    bindUi(
      root,
      createResultsDataState(),
      createUiState({ activeView: 'player-result-card', resultCardPlayerId: 'mpo-1' }),
      createNoopHandlers(),
    );

    assert.equal(firstInput.listeners.change, undefined);
    assert.equal(firstInput.listeners.keydown, undefined);
  } finally {
    restoreDocument();
  }
});

test('bindUi kutsuu tuloskortin muokkaustilan avaus- ja poistumiskäsittelijöitä', () => {
  const restoreDocument = installDocumentStub();
  const editButton = createFocusableElement();
  const exitButton = createFocusableElement();
  const confirmExitButton = createFocusableElement();
  const calls = [];
  const root = createInteractiveRoot({
    '[data-edit-player-result-card]': editButton,
    '[data-exit-player-result-card-edit]': exitButton,
    '[data-confirm-exit-player-result-card-edit]': confirmExitButton,
  });
  const handlers = new Proxy(
    {
      enterPlayerResultCardEdit() {
        calls.push('enter');
      },
      exitPlayerResultCardEdit() {
        calls.push('exit');
      },
      confirmExitPlayerResultCardEdit() {
        calls.push('confirm-exit');
      },
    },
    {
      get(target, property) {
        return property in target ? target[property] : () => {};
      },
    },
  );

  try {
    bindUi(
      root,
      createResultsDataState(),
      createUiState({ activeView: 'player-result-card', resultCardPlayerId: 'mpo-1' }),
      handlers,
    );

    editButton.listeners.click();
    exitButton.listeners.click();
    confirmExitButton.listeners.click();
    assert.deepEqual(calls, ['enter', 'exit', 'confirm-exit']);
  } finally {
    restoreDocument();
  }
});

test('bindUi välittää tuloskortin avauksen lähtönäkymän käsittelijälle', () => {
  const restoreDocument = installDocumentStub();
  const rankingNameButton = createFocusableElement();
  rankingNameButton.dataset = { openPlayerResultCard: 'player-1', resultCardOrigin: 'ranking' };
  const playersButton = createFocusableElement();
  playersButton.dataset = { openPlayerResultCard: 'player-2' };
  const root = {
    __dialogKeydownHandler: null,
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-open-player-result-card]') {
        return [rankingNameButton, playersButton];
      }
      return [];
    },
  };
  const calls = [];
  const handlers = new Proxy(
    {
      openPlayerResultCard(playerId, origin) {
        calls.push({ playerId, origin });
      },
    },
    {
      get(target, property) {
        if (property in target) {
          return target[property];
        }
        return () => {};
      },
    },
  );

  try {
    bindUi(root, createEmptyState(), createUiState(), handlers);
    rankingNameButton.listeners.click();
    playersButton.listeners.click();
    assert.deepEqual(calls, [
      { playerId: 'player-1', origin: 'ranking' },
      { playerId: 'player-2', origin: 'players' },
    ]);
  } finally {
    restoreDocument();
  }
});

test('bindUi kutsuu sarakeotsikon lajittelukäsittelijää', () => {
  const restoreDocument = installDocumentStub();
  const playerSortButton = createFocusableElement();
  playerSortButton.dataset = { sortTable: 'players', sortField: 'name' };
  const tournamentSortButton = createFocusableElement();
  tournamentSortButton.dataset = { sortTable: 'tournaments', sortField: 'displayOrder' };
  const rankingSortButton = createFocusableElement();
  rankingSortButton.dataset = { sortTable: 'ranking', sortField: 'totalPoints' };
  const multipliersSortButton = createFocusableElement();
  multipliersSortButton.dataset = { sortTable: 'multipliers', sortField: 'orderNumber' };
  const pointsSortButton = createFocusableElement();
  pointsSortButton.dataset = { sortTable: 'points', sortField: 'place' };
  const root = {
    __dialogKeydownHandler: null,
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-sort-table][data-sort-field]') {
        return [playerSortButton, tournamentSortButton, rankingSortButton, multipliersSortButton, pointsSortButton];
      }
      return [];
    },
  };
  const calls = [];
  const handlers = new Proxy(
    {
      toggleColumnSort(table, field) {
        calls.push({ table, field });
      },
    },
    {
      get(target, property) {
        if (property in target) {
          return target[property];
        }
        return () => {};
      },
    },
  );

  try {
    bindUi(root, createEmptyState(), createUiState(), handlers);
    playerSortButton.listeners.click();
    tournamentSortButton.listeners.click();
    rankingSortButton.listeners.click();
    multipliersSortButton.listeners.click();
    pointsSortButton.listeners.click();
    assert.deepEqual(calls, [
      { table: 'players', field: 'name' },
      { table: 'tournaments', field: 'displayOrder' },
      { table: 'ranking', field: 'totalPoints' },
      { table: 'multipliers', field: 'orderNumber' },
      { table: 'points', field: 'place' },
    ]);
  } finally {
    restoreDocument();
  }
});

test('bindUi moves focus into the tournament dialog field', () => {
  const restoreDocument = installDocumentStub();
  const tournamentNameField = createFocusableElement();
  const root = createInteractiveRoot({
    '#tournament-name': tournamentNameField,
  });
  const uiState = createUiState({
    tournamentDialogOpen: true,
    tournamentFormFocusTarget: 'name',
  });

  bindUi(root, createEmptyState(), uiState, createNoopHandlers());

  assert.equal(global.document.activeElement, tournamentNameField);
  assert.equal(uiState.tournamentFormFocusTarget, '');
  restoreDocument();
});

test('bindUi moves focus into the score table import file field', () => {
  const restoreDocument = installDocumentStub();
  const importFileField = createFocusableElement();
  const root = createInteractiveRoot({
    '#points-import-file': importFileField,
  });
  const uiState = createUiState({
    pointsImportDialogOpen: true,
    pointsImportFocusTarget: 'file',
  });

  bindUi(root, createEmptyState(), uiState, createNoopHandlers());

  assert.equal(global.document.activeElement, importFileField);
  assert.equal(uiState.pointsImportFocusTarget, '');
});

test('bindUi moves focus into the tournament import file field', () => {
  const restoreDocument = installDocumentStub();
  const importFileField = createFocusableElement();
  const root = createInteractiveRoot({
    '#tournament-import-file': importFileField,
  });
  const uiState = createUiState({
    tournamentImportDialogOpen: true,
    tournamentImportFocusTarget: 'file',
  });

  bindUi(root, createEmptyState(), uiState, createNoopHandlers());

  assert.equal(global.document.activeElement, importFileField);
  assert.equal(uiState.tournamentImportFocusTarget, '');
  restoreDocument();
});

test('bindUi restores focus to the pending control after confirmation dialog closes', () => {
  const restoreDocument = installDocumentStub();
  const deleteButton = createFocusableElement();
  const root = createInteractiveRoot({
    '[data-delete-tournament="tournament-1"]': deleteButton,
  });
  const uiState = createUiState({
    pendingFocusSelector: '[data-delete-tournament="tournament-1"]',
  });

  bindUi(root, createEmptyState(), uiState, createNoopHandlers());

  assert.equal(global.document.activeElement, deleteButton);
  assert.equal(uiState.pendingFocusSelector, '');
  restoreDocument();
});

test('renderApp shows every navigation tab in the required fixed order', () => {
  const root = createRootStub();

  renderApp(root, createEmptyState(), createUiState({ activeView: 'help' }));

  const navOrder = [...root.innerHTML.matchAll(/data-view-target="([a-z]+)"/g)].map((match) => match[1]);

  assert.deepEqual(navOrder.slice(0, 10), [
    'summary',
    'compare',
    'ranking',
    'results',
    'players',
    'tournaments',
    'multipliers',
    'points',
    'settings',
    'help',
  ]);
  assert.match(root.innerHTML, /<nav class="main-nav" id="main-nav" aria-label="Päänavigaatio">/);
  assert.doesNotMatch(root.innerHTML, /<nav[^>]*\shidden(?:\s|>)/);
  assert.match(root.innerHTML, /<button type="button" data-view-target="help" aria-current="page">/);
  assert.equal((root.innerHTML.match(/aria-current="page"/g) || []).length, 1);
  assert.doesNotMatch(root.innerHTML, /data-toggle-nav|>Valikko<\/button>/);
});

test('renderApp renders collapsible help sections and topics from help data', () => {
  const root = createRootStub();

  renderApp(root, createEmptyState(), createUiState({ activeView: 'help' }));

  assert.match(root.innerHTML, /<section class="section" id="section-help"  aria-labelledby="help-title">/);
  assert.match(root.innerHTML, /<h2 id="help-title">Ohjeet<\/h2>/);

  HELP_SECTIONS.forEach((section) => {
    assert.match(root.innerHTML, new RegExp(`data-help-section="${section.id}"`));
    assert.match(root.innerHTML, new RegExp(`<span class="help-section-title">${section.title}</span>`));
  });

  assert.match(root.innerHTML, /<span class="help-topic-title">CSV-tuonti<\/span>/);
  assert.match(root.innerHTML, /Divisioona valitaan importin yhteydessä/);
  assert.match(root.innerHTML, /data-help-toggle aria-expanded="false" aria-controls="help-topics-players"/);
  assert.match(root.innerHTML, /class="help-topic-content" id="help-topic-players-1" hidden/);
});

test('the only Help entry point is the navigation item', () => {
  const root = createRootStub();
  renderApp(root, createEmptyState(), createUiState({ activeView: 'players' }));

  const helpTargets = [...root.innerHTML.matchAll(/data-view-target="help"/g)];
  assert.equal(helpTargets.length, 1);
  assert.match(root.innerHTML, /<nav class="main-nav"[\s\S]*data-view-target="help"[\s\S]*<\/nav>/);
  assert.doesNotMatch(root.innerHTML, /data-help-target=|action-bar-help/);
  assert.doesNotMatch(root.innerHTML, /class="help-hint"|class="import-instructions"/);
});

test('Help opens the matching page and keeps topics collapsed', () => {
  const root = createRootStub();
  renderApp(root, createEmptyState(), createUiState({ activeView: 'help', helpSectionId: 'players' }));
  assert.match(root.innerHTML, /data-help-section="players">[\s\S]*?aria-expanded="true" aria-controls="help-topics-players"/);
  assert.match(root.innerHTML, /class="help-topics" id="help-topics-players" >/);
  assert.match(root.innerHTML, /class="help-topic-content" id="help-topic-players-1" hidden/);
});

test('bindUi toggles the Help accordion with button state and panel visibility', () => {
  const panel = { hidden: true };
  const button = {
    attributes: { 'aria-controls': 'help-topics-players', 'aria-expanded': 'false' },
    addEventListener(name, listener) { this.listener = listener; },
    getAttribute(name) { return this.attributes[name]; },
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  const root = {
    querySelector(selector) { return selector === '#help-topics-players' ? panel : null; },
    querySelectorAll(selector) { return selector === '[data-help-toggle]' ? [button] : []; },
  };

  bindUi(root, createEmptyState(), createUiState({ activeView: 'help' }), createNoopHandlers());
  button.listener();
  assert.equal(panel.hidden, false);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  button.listener();
  assert.equal(panel.hidden, true);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
});

test('renderApp keeps the help section hidden when another view is active', () => {
  const root = createRootStub();

  renderApp(root, createEmptyState(), createUiState({ activeView: 'players' }));

  assert.match(root.innerHTML, /<section class="section" id="section-help" hidden aria-labelledby="help-title">/);
});

function createTestPlayer(overrides = {}) {
  return {
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
    ...overrides,
  };
}

test('renderApp näyttää pelaajasivun toimintopalkin ja erotetun Poista kaikki -toiminnon', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.players = [createTestPlayer()];
  dataState.resultCards = [{
    id: 'result-card-player-1',
    playerId: 'player-1',
    results: [{ tournamentId: 'tournament-1', placement: '1' }],
  }];

  renderApp(root, dataState, createUiState({ activeView: 'players' }));

  assert.match(root.innerHTML, /class="action-bar" role="group" aria-label="Pelaajien toiminnot"/);
  assert.match(root.innerHTML, /data-open-player-dialog>Lisää pelaaja<\/button>/);
  assert.match(root.innerHTML, /data-open-players-import-dialog>Tuo pelaajat<\/button>/);
  assert.match(
    root.innerHTML,
    /class="action-bar-group action-bar-danger" role="group" aria-label="Vaaralliset toiminnot"><button type="button" class="danger-button danger-action-button" data-request-delete-all-players><span class="danger-icon" aria-hidden="true">⚠<\/span> Poista kaikki pelaajat<\/button>/,
  );
  assert.match(root.innerHTML, /class="danger-button danger-action-button" data-request-clear-all-results><span class="danger-icon" aria-hidden="true">⚠<\/span> Poista kaikki tulokset<\/button>/);
  assert.doesNotMatch(root.innerHTML, /id="players-import-form"/);
  assert.doesNotMatch(root.innerHTML, /data-players-import-dialog-panel/);
});

test('renderApp näyttää pelaajalistan haun ja sarjasuodattimet painikkeina ilman lajitteluvalikoita', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.players = [createTestPlayer()];

  renderApp(root, dataState, createUiState({ activeView: 'players', playerDivisionFilter: 'MPO' }));

  assert.match(root.innerHTML, /class="table-toolbar" role="group" aria-label="Pelaajalistan haku ja suodatus"/);
  assert.match(root.innerHTML, /id="player-search" type="search" data-player-search/);
  assert.match(root.innerHTML, /data-player-division-filter="ALL" aria-pressed="false">Kaikki<\/button>/);
  assert.match(root.innerHTML, /data-player-division-filter="MPO" aria-pressed="true">MPO<\/button>/);
  assert.match(root.innerHTML, /data-player-division-filter="FPO" aria-pressed="false">FPO<\/button>/);
  assert.doesNotMatch(root.innerHTML, /Lajittelukenttä|Lajittelusuunta/);
  assert.doesNotMatch(root.innerHTML, /data-player-sort-field|data-player-sort-direction/);
  assert.doesNotMatch(root.innerHTML, /<select id="player-division-filter"/);
  assert.ok(root.innerHTML.indexOf('class="table-toolbar"') < root.innerHTML.indexOf('class="table players-table"'));
});

test('renderApp näyttää turnaussivun toimintopalkin, tilasuodattimet ja ilman lajitteluvalikoita', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  const [firstMultiplier] = dataState.multipliers;
  dataState.tournaments = [{
    id: 'tournament-1',
    name: 'Testi Open',
    pdgaEventId: 123456,
    startDate: '2026-07-03',
    endDate: '',
    displayOrder: 1,
    location: 'Helsinki',
    venue: 'Rata',
    multiplierId: firstMultiplier.id,
    division: '',
    externalUrl: '',
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }];

  renderApp(root, dataState, createUiState({ activeView: 'tournaments', tournamentStatusFilter: firstMultiplier.id }));

  assert.match(root.innerHTML, /aria-label="Turnausten toiminnot"/);
  assert.match(root.innerHTML, /action-bar-danger[^>]*><button type="button" class="danger-button danger-action-button" data-request-delete-all-tournaments>/);
  assert.doesNotMatch(root.innerHTML, /Vaaravyöhyke: poista kaikki turnaukset/);
  assert.match(root.innerHTML, /data-tournament-status-filter="ALL" aria-pressed="false">Kaikki<\/button>/);
  assert.match(root.innerHTML, new RegExp(`data-tournament-status-filter="${firstMultiplier.id}" aria-pressed="true"`));
  assert.doesNotMatch(root.innerHTML, /data-tournament-sort-field|data-tournament-sort-direction|<select id="tournament-status-filter"/);
  assert.match(root.innerHTML, /id="tournament-search" type="search" data-tournament-search/);
});

test('renderApp poistaa kaikki -painikkeet ovat pois käytöstä, kun poistettavaa ei ole', () => {
  const root = createRootStub();
  const dataState = createEmptyState();

  renderApp(root, dataState, createUiState({ activeView: 'players' }));
  assert.match(root.innerHTML, /data-request-delete-all-players disabled>/);
  assert.match(root.innerHTML, /data-request-clear-all-results disabled>/);
  assert.match(root.innerHTML, /data-request-delete-all-tournaments disabled>/);
  assert.match(root.innerHTML, /data-request-delete-points="MPO" disabled>/);
});

test('renderApp näyttää ranking-suodattimet taulukon yläpuolella korostettuna', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.players = [createTestPlayer()];

  renderApp(root, dataState, createUiState({ activeView: 'ranking', rankingFilter: 'FPO' }));

  assert.match(root.innerHTML, /aria-label="Ranking-taulukon suodatus"/);
  assert.match(root.innerHTML, /data-ranking-filter="FPO" aria-pressed="true">FPO<\/button>/);
  assert.match(root.innerHTML, /data-ranking-filter="ALL" aria-pressed="false">Kaikki<\/button>/);
});

test('renderApp näyttää kaikkien pelaajien poiston vahvistusdialogin', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.players = [createTestPlayer(), createTestPlayer({ id: 'player-2', pdgaNumber: 2 })];

  renderApp(root, dataState, createUiState({ activeView: 'players', confirmationDialog: { type: 'delete-all-players' } }));

  assert.match(root.innerHTML, /role="alertdialog"/);
  assert.match(root.innerHTML, /<h2 id="confirm-dialog-title">Poista kaikki pelaajat<\/h2>/);
  assert.match(root.innerHTML, /Olet poistamassa kaikki pelaajat \(2 kpl\)\./);
  assert.match(root.innerHTML, /data-confirm-delete-all-players>Poista<\/button>/);
  assert.match(root.innerHTML, /data-cancel-confirm-dialog autofocus>Peruuta<\/button>/);
});

test('renderApp näyttää kaikkien tulosten poiston vahvistusdialogin', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.resultCards = [{ playerId: 'player-1', results: [{ tournamentId: 'tournament-1', placement: '1T2' }] }];

  renderApp(root, dataState, createUiState({ activeView: 'players', confirmationDialog: { type: 'clear-all-results' } }));

  assert.match(root.innerHTML, /role="alertdialog"/);
  assert.match(root.innerHTML, /<p class="danger-banner" id="confirm-dialog-warning"><span aria-hidden="true">⚠<\/span> VAROITUS <span aria-hidden="true">⚠<\/span><\/p>/);
  assert.match(root.innerHTML, /<h2 id="confirm-dialog-title">Poista kaikki tulokset<\/h2>/);
  assert.match(root.innerHTML, /Olet poistamassa KAIKKIEN pelaajien KAIKKI turnaussijoitukset\./);
  assert.match(root.innerHTML, /Toiminto tyhjentää kaikki tuloskortit ja poistaa kaikki lasketut pisteet\./);
  assert.match(root.innerHTML, /Pelaajat, turnaukset, kertoimet ja pistetaulukot säilyvät ennallaan\./);
  assert.match(root.innerHTML, /Toimintoa ei voi perua\./);
  assert.match(root.innerHTML, /Haluatko varmasti jatkaa\?/);
  assert.match(root.innerHTML, /data-confirm-clear-all-results>Poista kaikki tulokset<\/button>/);
  assert.match(root.innerHTML, /data-cancel-confirm-dialog autofocus>Peruuta<\/button>/);
});

test('renderApp näyttää pistetaulukon rivin lisäyksen dialogina ja rivipoiston vahvistuksen', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.pointsTable = { MPO: { '1': 100 }, FPO: {} };

  renderApp(root, dataState, createUiState({
    activeView: 'points',
    pointsDialogOpen: true,
    pointsForm: { division: 'MPO', place: '1', basePoints: 100, editingKey: 'MPO:1' },
  }));
  assert.match(root.innerHTML, /<h2 id="points-dialog-title">Muokkaa pistetaulukon riviä<\/h2>/);
  assert.match(root.innerHTML, /<form id="points-form">/);
  assert.match(root.innerHTML, /data-dismiss-points-dialog>Peruuta<\/button>/);
  assert.match(root.innerHTML, /data-edit-point="MPO:1">Muokkaa<\/button>/);
  assert.match(root.innerHTML, /data-delete-point="MPO:1">Poista<\/button>/);

  renderApp(root, dataState, createUiState({
    activeView: 'points',
    confirmationDialog: { type: 'delete-point', division: 'MPO', place: '1' },
  }));
  assert.match(root.innerHTML, /<h2 id="confirm-dialog-title">Poista pistetaulukon rivi<\/h2>/);
  assert.match(root.innerHTML, /Olet poistamassa pistetaulukon rivin MPO \/ sijoitus 1\./);
  assert.match(root.innerHTML, /data-confirm-delete-point>Poista<\/button>/);
});

test('bindUi kutsuu suodatinpainikkeiden ja toimintopalkin käsittelijöitä', () => {
  const restoreDocument = installDocumentStub();
  const playerFilterButton = createFocusableElement();
  playerFilterButton.dataset = { playerDivisionFilter: 'FPO' };
  const tournamentFilterButton = createFocusableElement();
  tournamentFilterButton.dataset = { tournamentStatusFilter: 'multiplier-1' };
  const importButton = createFocusableElement();
  const deleteAllPlayersButton = createFocusableElement();
  const clearAllResultsButton = createFocusableElement();
  const openPointsDialogButton = createFocusableElement();
  const root = {
    __dialogKeydownHandler: null,
    querySelector(selector) {
      return {
        '[data-open-players-import-dialog]': importButton,
        '[data-request-delete-all-players]': deleteAllPlayersButton,
        '[data-request-clear-all-results]': clearAllResultsButton,
        '[data-open-points-dialog]': openPointsDialogButton,
      }[selector] || null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-player-division-filter]') {
        return [playerFilterButton];
      }
      if (selector === '[data-tournament-status-filter]') {
        return [tournamentFilterButton];
      }
      return [];
    },
  };
  const calls = [];
  const handlers = new Proxy(
    {},
    {
      get(target, property) {
        return (...args) => calls.push([property, ...args]);
      },
    },
  );

  try {
    bindUi(root, createEmptyState(), createUiState(), handlers);
    playerFilterButton.listeners.click();
    tournamentFilterButton.listeners.click();
    importButton.listeners.click();
    deleteAllPlayersButton.listeners.click();
    clearAllResultsButton.listeners.click();
    openPointsDialogButton.listeners.click();
    assert.deepEqual(calls, [
      ['setPlayerDivisionFilter', 'FPO'],
      ['setTournamentStatusFilter', 'multiplier-1'],
      ['openPlayersImportDialog'],
      ['requestDeleteAllPlayers'],
      ['requestClearAllResults'],
      ['openPointsDialog'],
    ]);
  } finally {
    restoreDocument();
  }
});

test('renderApp pyöristää näytettävät pisteet asetuksen mukaan suomalaisessa muodossa', () => {
  const dataState = createEmptyState();
  dataState.players = [
    {
      id: 'player-1',
      firstName: 'Tuomo',
      lastName: 'Rikman',
      name: 'Tuomo Rikman',
      division: 'MPO',
      pdgaNumber: 12345,
      pdgaRating: '',
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
      pdgaEventId: '',
      startDate: '2026-07-03',
      endDate: '',
      displayOrder: 1,
      location: '',
      venue: '',
      status: '',
      multiplierId: 'multiplier-c-tier',
      division: '',
      externalUrl: '',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  dataState.resultCards = [
    { id: 'result-card-player-1', playerId: 'player-1', results: [{ tournamentId: 'tournament-1', placement: '1' }] },
  ];
  dataState.pointsTable = { MPO: { 1: 123.45678 }, FPO: {} };

  const expectations = [
    [0, '123 p'],
    [1, '123,5 p'],
    [2, '123,46 p'],
    [3, '123,457 p'],
    [4, '123,4568 p'],
  ];

  for (const [pointDecimals, expected] of expectations) {
    dataState.settings = { ...dataState.settings, pointDecimals };

    const summaryRoot = createRootStub();
    renderApp(summaryRoot, dataState, createUiState({ activeView: 'summary' }));
    assert.ok(getSummarySectionHtml(summaryRoot.innerHTML).includes(`<td class="number">${expected}</td>`), `Yhteenveto: ${expected}`);

    const rankingRoot = createRootStub();
    renderApp(rankingRoot, dataState, createUiState({ activeView: 'ranking' }));
    assert.ok(rankingRoot.innerHTML.includes(`<td class="number">${expected}</td>`), `Ranking: ${expected}`);
  }

  assert.equal(dataState.pointsTable.MPO[1], 123.45678);
  assert.ok(!Object.hasOwn(dataState.resultCards[0].results[0], 'calculatedPoints'));
});

test('renderApp näyttää uloskirjautumisen ja Turvallisuus-osion sivuston salasanalle', () => {
  const root = createRootStub();
  renderApp(root, createEmptyState(), createUiState({ activeView: 'settings' }));

  assert.match(root.innerHTML, /data-logout>Kirjaudu ulos<\/button>/);
  assert.match(root.innerHTML, /<h3 id="security-settings-title">Turvallisuus<\/h3>/);
  assert.match(root.innerHTML, /<label for="settings-site-password">Sivuston salasana \*<\/label>/);
  assert.match(root.innerHTML, /id="settings-site-password"[^>]*type="password"/s);
  assert.match(root.innerHTML, /Tallenna salasana/);

  renderApp(root, createEmptyState(), createUiState({ activeView: 'settings', sitePasswordFormError: 'Liian lyhyt.' }));
  assert.match(root.innerHTML, /id="sitePassword-error" role="alert">Liian lyhyt\.</);
  assert.match(root.innerHTML, /aria-describedby="sitePassword-error"/);
});

test('Ranking, Yhteenveto ja Tulokset käyttävät samaa tuloksista laskettua pistelähdettä', () => {
  const dataState = createEmptyState();
  dataState.players = [
    { id: 'player-1', name: 'Matti Meikäläinen', division: 'MPO', pdgaNumber: '', pdgaRating: '', worldRank: '' },
    { id: 'player-2', name: 'Maija Meikäläinen', division: 'FPO', pdgaNumber: '', pdgaRating: '', worldRank: '' },
  ];
  dataState.tournaments = [{ id: 'tournament-1', name: 'Testi Open', startDate: '2026-07-03', multiplierId: 'multiplier-major' }];
  dataState.pointsTable = { MPO: { 1: 100 }, FPO: { 1: 90 } };
  dataState.resultCards = [
    { id: 'result-card-player-1', playerId: 'player-1', results: [{ tournamentId: 'tournament-1', placement: '1' }] },
    { id: 'result-card-player-2', playerId: 'player-2', results: [{ tournamentId: 'tournament-1', placement: '1' }] },
  ];

  const render = (activeView) => {
    const root = createRootStub();
    renderApp(root, dataState, createUiState({ activeView, resultCardPlayerId: 'player-1' }));
    return root.innerHTML;
  };

  assert.ok(getSummarySectionHtml(render('summary')).includes('<td class="number">200,00 p</td>'));
  assert.ok(getSummarySectionHtml(render('summary')).includes('<td class="number">180,00 p</td>'));
  assert.ok(render('ranking').includes('<td class="number">200,00 p</td>'));
  assert.match(render('player-result-card'), /data-result-points>200 p</);
  assert.match(render('results'), /<td data-label="Paras MPO">1 Matti Meikäläinen<\/td>/);

  dataState.pointsTable.MPO[1] = 50;
  dataState.multipliers = dataState.multipliers.map((entry) => (
    entry.id === 'multiplier-major' ? { ...entry, multiplier: 3 } : entry
  ));

  assert.ok(getSummarySectionHtml(render('summary')).includes('<td class="number">150,00 p</td>'));
  assert.ok(render('ranking').includes('<td class="number">150,00 p</td>'));
  assert.match(render('player-result-card'), /data-result-points>150 p</);
  assert.match(render('player-result-card'), /<td data-label="Kerroin" class="number">3,00<\/td>/);

  dataState.resultCards[0].results[0].placement = '';
  assert.ok(render('ranking').includes('<td class="number">0,00 p</td>'));
  assert.match(render('results'), /<td data-label="Paras MPO">-<\/td>/);
});

function createCompareDataState() {
  const dataState = createEmptyState();
  dataState.players = [
    { id: 'player-1', name: 'Tuomo Rikman', division: 'MPO', pdgaNumber: '12345', pdgaRating: '998', worldRank: '120' },
    { id: 'player-2', name: 'Leo Piironen', division: 'MPO', pdgaNumber: '54321', pdgaRating: '960', worldRank: '300' },
    { id: 'player-3', name: 'Tuomas Example', division: 'MPO', pdgaNumber: '12367' },
  ];
  dataState.multipliers = [
    { id: 'multiplier-major', name: 'Major', abbreviation: 'MAJ', multiplier: 2, orderNumber: 1 },
  ];
  dataState.tournaments = [
    { id: 'tournament-2', name: 'Tampere Open', startDate: '2026-06-01', displayOrder: 2, multiplierId: 'multiplier-major' },
    { id: 'tournament-1', name: 'European Open', startDate: '2026-07-17', displayOrder: 1, multiplierId: 'multiplier-major' },
  ];
  dataState.pointsTable.MPO = { 1: 100, 2: 90, 4: 70, 12: 20 };
  dataState.resultCards = [
    { id: 'result-card-player-1', playerId: 'player-1', results: [{ tournamentId: 'tournament-1', placement: '4' }] },
    { id: 'result-card-player-2', playerId: 'player-2', results: [{ tournamentId: 'tournament-1', placement: '12' }] },
  ];

  return dataState;
}

test('renderApp näyttää Vertaile-sivun pelaajahaun, yhteenvetokortit ja parhaan sijoituksen korostuksen', () => {
  const root = createRootStub();
  const dataState = createCompareDataState();

  renderApp(
    root,
    dataState,
    createUiState({
      activeView: 'compare',
      comparePlayerIds: ['player-1', 'player-2'],
      compareHideEmptyTournaments: true,
    }),
  );

  const compareSection = root.innerHTML.split('id="section-compare"')[1].split('</section>')[0];

  assert.match(root.innerHTML, /<section class="section" id="section-compare"  aria-labelledby="compare-title">/);
  assert.match(compareSection, /<h2 id="compare-title">Vertaile<\/h2>/);
  assert.match(compareSection, /id="compare-player-search"[\s\S]*?role="combobox"/);
  assert.match(compareSection, /aria-autocomplete="list"/);
  assert.match(compareSection, /data-remove-compare-player="player-1"/);
  assert.match(compareSection, /<dt>Maailmanranking<\/dt><dd>120<\/dd>/);
  assert.match(compareSection, /<dt>Turnauksia<\/dt><dd>1<\/dd>/);
  assert.match(compareSection, /data-compare-hide-empty checked/);
  assert.match(compareSection, /Piilota turnaukset joissa kukaan vertailtavista pelaajista ei ole pelannut/);
  assert.match(
    compareSection,
    /<td data-label="Tuomo Rikman" class="compare-placement is-best" data-compare-best="true">4<span class="visually-hidden"> \(paras sijoitus\)<\/span><\/td>/,
  );
  assert.match(compareSection, /<td data-label="Leo Piironen" class="compare-placement">12<\/td>/);
  // Suodatin piilottaa turnauksen, jossa kummallakaan pelaajalla ei ole tulosta.
  assert.doesNotMatch(compareSection, /data-compare-tournament="tournament-2"/);
  // Vertaile on lukunäkymä: sivulla ei ole muokkaus- tai syöttötoimintoja.
  assert.doesNotMatch(compareSection, /data-result-placement|data-edit-player|<input type="text"/);
});

test('renderApp näyttää Vertaile-sivun ehdotukset vasta kolmen merkin jälkeen ja piilotuksen poiston jälkeen kaikki turnaukset', () => {
  const dataState = createCompareDataState();

  const shortQueryRoot = createRootStub();
  renderApp(shortQueryRoot, dataState, createUiState({ activeView: 'compare', compareSearch: 'Tu' }));
  assert.doesNotMatch(shortQueryRoot.innerHTML, /data-add-compare-player/);
  assert.match(shortQueryRoot.innerHTML, /id="compare-player-search"[\s\S]*?aria-expanded="false"/);

  const suggestionRoot = createRootStub();
  renderApp(
    suggestionRoot,
    dataState,
    createUiState({ activeView: 'compare', compareSearch: 'Tuo', comparePlayerIds: ['player-1'] }),
  );
  assert.match(suggestionRoot.innerHTML, /aria-expanded="true"/);
  assert.match(suggestionRoot.innerHTML, /role="listbox" aria-label="Pelaajaehdotukset"/);
  assert.match(suggestionRoot.innerHTML, /data-add-compare-player="player-3"/);
  assert.doesNotMatch(suggestionRoot.innerHTML, /data-add-compare-player="player-1"/);

  const allTournamentsRoot = createRootStub();
  renderApp(
    allTournamentsRoot,
    dataState,
    createUiState({ activeView: 'compare', comparePlayerIds: ['player-1'], compareHideEmptyTournaments: false }),
  );
  const compareSection = allTournamentsRoot.innerHTML.split('id="section-compare"')[1].split('</section>')[0];
  assert.deepEqual(
    [...compareSection.matchAll(/data-compare-tournament="([a-z0-9-]+)"/g)].map((match) => match[1]),
    ['tournament-1', 'tournament-2'],
  );
  assert.match(compareSection, /<td data-label="Tuomo Rikman" class="compare-placement">—<\/td>/);
});

test('bindUi kutsuu Vertaile-sivun haku-, lisäys-, poisto- ja suodatinkäsittelijöitä', () => {
  const calls = [];
  const searchInput = { addEventListener(name, listener) { this.listener = listener; } };
  const hideEmptyCheckbox = { addEventListener(name, listener) { this.listener = listener; } };
  const addButton = { dataset: { addComparePlayer: 'player-3' }, addEventListener(name, listener) { this.listener = listener; } };
  const removeButton = { dataset: { removeComparePlayer: 'player-1' }, addEventListener(name, listener) { this.listener = listener; } };
  const root = {
    querySelector(selector) {
      if (selector === '[data-compare-player-search]') return searchInput;
      if (selector === '[data-compare-hide-empty]') return hideEmptyCheckbox;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-add-compare-player]') return [addButton];
      if (selector === '[data-remove-compare-player]') return [removeButton];
      return [];
    },
  };

  const handlers = {
    ...createNoopHandlers(),
    setCompareSearch: (value) => calls.push(['search', value]),
    addComparePlayer: (playerId) => calls.push(['add', playerId]),
    removeComparePlayer: (playerId) => calls.push(['remove', playerId]),
    setCompareHideEmptyTournaments: (value) => calls.push(['hideEmpty', value]),
  };

  bindUi(root, createEmptyState(), createUiState({ activeView: 'compare' }), handlers);

  searchInput.listener({ target: { value: 'Tuo' } });
  addButton.listener();
  removeButton.listener();
  hideEmptyCheckbox.listener({ target: { checked: false } });

  assert.deepEqual(calls, [['search', 'Tuo'], ['add', 'player-3'], ['remove', 'player-1'], ['hideEmpty', false]]);
});

test('renderApp näyttää Export ja Import Tuloskortit -toiminnot pelaajasivun toimintopalkissa', () => {
  const root = createRootStub();
  renderApp(root, createEmptyState(), createUiState({ activeView: 'players' }));

  assert.match(
    root.innerHTML,
    /data-open-rating-ranking-dialog>Päivitä Rating ja Ranking<\/button><button type="button" class="secondary-button" data-export-result-cards>Export Tuloskortit<\/button><button type="button" class="secondary-button" data-open-result-card-import-dialog>Import Tuloskortit<\/button>/,
  );
  assert.doesNotMatch(root.innerHTML, /data-result-card-import-dialog-panel/);
});

test('renderApp näyttää tuloskorttien import-dialogin ja yhteenvedon taulukkona', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  renderApp(root, dataState, createUiState({ resultCardImportDialogOpen: true }));
  assert.match(root.innerHTML, /role="dialog" aria-modal="true" aria-labelledby="result-card-import-dialog-title"/);
  assert.match(root.innerHTML, /<input id="result-card-import-file" name="file" type="file" accept=".csv,text\/csv" required \/>/);
  assert.match(root.innerHTML, /<button type="submit" class="button">Tuo<\/button>/);
  assert.match(root.innerHTML, /data-cancel-result-card-import>Peruuta<\/button>/);

  renderApp(root, dataState, createUiState({
    resultCardImportDialogOpen: true,
    resultCardImportSummary: {
      totalRows: 3,
      updatedCount: 52,
      errors: [
        { rowNumber: 4, pdgaId: '12345', column: 'T2', reason: 'Virheellinen sijoitus "<b>ABC</b>".' },
        { rowNumber: 1, pdgaId: '', column: 'T9', reason: 'Sarakkeelle T9 ei löydy turnausta.' },
      ],
      observations: [{ rowNumber: 2, pdgaId: '67890', column: '', reason: 'Ei muutoksia.' }],
    },
  }));
  assert.match(root.innerHTML, /<strong>Import valmis<\/strong>/);
  assert.match(root.innerHTML, /<dt>Päivitetyt pelaajat<\/dt><dd>52<\/dd>/);
  assert.match(root.innerHTML, /<dt>Virheet<\/dt><dd>2<\/dd>/);
  assert.match(root.innerHTML, /<dt>Huomiot<\/dt><dd>1<\/dd>/);
  assert.match(root.innerHTML, /class="message warning" role="alert"/);
  assert.match(root.innerHTML, /<table class="table result-card-import-issues-table">/);
  assert.match(root.innerHTML, /&lt;b&gt;ABC&lt;\/b&gt;/);
  assert.doesNotMatch(root.innerHTML, /<b>ABC<\/b>/);
  assert.doesNotMatch(root.innerHTML, /id="result-card-import-file"/);
  assert.match(root.innerHTML, /data-cancel-result-card-import>Sulje<\/button>/);
  const issueOrder = [...root.innerHTML.matchAll(/data-result-card-import-issue="(\w+)">\s*<td data-label="Rivi" class="number">(\d+)<\/td>/g)]
    .map((match) => `${match[2]}:${match[1]}`);
  assert.deepEqual(issueOrder, ['1:error', '2:observation', '4:error']);
});

test('bindUi kohdistaa tuloskorttien import-dialogin ja sulkee sen Escapella', () => {
  const restoreDocument = installDocumentStub();
  try {
    const fileInput = createFocusableElement();
    const closeButton = createFocusableElement();
    const root = createInteractiveRoot({
      '#result-card-import-file': fileInput,
      '[data-cancel-result-card-import]': closeButton,
    });
    const state = createUiState({ resultCardImportDialogOpen: true });
    let closed = false;
    bindUi(root, createEmptyState(), state, {
      ...createNoopHandlers(),
      closeResultCardImportDialog() { closed = true; },
    });
    assert.equal(global.document.activeElement, fileInput);

    state.resultCardImportSummary = { updatedCount: 0, errors: [], observations: [] };
    bindUi(root, createEmptyState(), state, createNoopHandlers());
    assert.equal(global.document.activeElement, closeButton);

    const event = { key: 'Escape', preventDefault() {} };
    bindUi(root, createEmptyState(), state, {
      ...createNoopHandlers(),
      closeResultCardImportDialog() { closed = true; },
    });
    root.__dialogKeydownHandler(event);
    assert.equal(closed, true);
  } finally {
    restoreDocument();
  }
});
