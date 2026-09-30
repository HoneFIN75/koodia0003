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
    resultFormId: null,
    pointsForm: { division: 'MPO', place: '', basePoints: '', editingKey: '' },
    pointsImportDialogOpen: false,
    pointsImportDivision: 'MPO',
    pointsImportFocusTarget: '',
    resultCardDialogOpen: false,
    resultCardForm: { tournamentId: '', playerIds: [] },
    resultCardPlayersDialogOpen: false,
    resultCardPlayersDialog: { cardId: '', playerIds: [] },
    resultCardSorts: {},
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
  dataState.resultCards = [{
    id: 'card-1',
    tournamentId: 'tournament-1',
    tournamentName: 'Testi Open',
    location: '',
    startDate: '2026-07-03',
    endDate: '',
    status: 'MAJ',
    multiplier: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    results: [
      { playerId: 'player-1', division: 'MPO', placement: '1', calculatedPoints: 100 },
      { playerId: 'player-2', division: 'FPO', placement: '1', calculatedPoints: 90 },
    ],
  }];

  renderApp(root, dataState, createUiState({ activeView: 'summary' }));

  assert.match(
    root.innerHTML,
    /id="section-summary"[\s\S]*<span class="player-name-text">Linkki Pelaaja<\/span>[\s\S]*<span class="player-name-text">Teksti Pelaaja<\/span>/,
  );
  assert.match(
    root.innerHTML,
    /id="section-ranking"[\s\S]*<span class="player-name-text">Linkki Pelaaja<\/span>[\s\S]*<a class="pdga-id-link" href="https:\/\/example\.com\/player\/12345" target="_blank" rel="noopener noreferrer" title="Avaa PDGA-profiili" aria-label="Avaa pelaajan Linkki Pelaaja PDGA-profiili">12345<\/a>/,
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
  dataState.resultCards = [{
    id: 'card-1',
    tournamentId: 'tournament-1',
    tournamentName: 'Testi Open',
    location: '',
    startDate: '2026-07-03',
    endDate: '',
    status: 'MAJ',
    multiplier: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    results: [
      { playerId: 'player-1', division: 'MPO', placement: '1', calculatedPoints: 100 },
      { playerId: 'player-2', division: 'FPO', placement: '1', calculatedPoints: 90 },
    ],
  }];
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

test('renderApp näyttää deployment-metatiedot otsikon alla commit-buildillä Suomen ajassa', () => {
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

  assert.match(root.innerHTML, /SFL Pisteytystyökalu/);
  assert.match(root.innerHTML, /<dt>Versio:<\/dt><dd>1\.0\.15<\/dd>/);
  assert.match(root.innerHTML, /<dt>Koonti:<\/dt><dd>84f2c71<\/dd>/);
  assert.match(root.innerHTML, /<dt>Päivitetty:<\/dt><dd>27\.09\.2026 14:15<\/dd>/);
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
  dataState.resultCards = [{
    id: 'card-1',
    tournamentId: 'tournament-1',
    tournamentName: 'Testi Open',
    location: '',
    startDate: '2026-07-03',
    endDate: '',
    status: 'MAJ',
    multiplier: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    results: [{ playerId: 'player-1', division: 'MPO', placement: '1', calculatedPoints: 100 }],
  }];

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
  dataState.resultCards = [{
    id: 'card-1',
    tournamentId: 'tournament-1',
    tournamentName: 'Testi Open',
    location: '',
    startDate: '2026-07-03',
    endDate: '',
    status: 'MAJ',
    multiplier: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    results: [{ playerId: 'player-1', division: 'MPO', placement: '1', calculatedPoints: 100 }],
  }];

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
  assert.match(root.innerHTML, /<th>Muokkaa<\/th>/);
  assert.match(root.innerHTML, /data-edit-player="player-1">Muokkaa<\/button>/);
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

test('renderApp shows players CSV import instructions, required fields and summary', () => {
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
  assert.match(root.innerHTML, /Tarkemmat ohjeet löytyvät Ohjeet-osion kohdasta Pelaajat\./);
  assert.match(root.innerHTML, /<code>Etunimi;Sukunimi;PDGA ID;PDGA-rating;Maailmanranking<\/code>/);
  assert.match(root.innerHTML, /<strong>Erotin:<\/strong> puolipiste <code>;<\/code>/);
  assert.match(root.innerHTML, /id="players-import-division" name="division" required/);
  assert.match(root.innerHTML, /id="players-import-file" name="file" type="file" accept="\.csv,text\/csv" required/);
  assert.match(root.innerHTML, /data-cancel-players-import>Sulje<\/button>/);
  assert.match(root.innerHTML, /Importti valmis/);
  assert.match(root.innerHTML, /class="message warning" role="alert" aria-live="assertive"/);
  assert.match(root.innerHTML, /Yhteensä rivejä: 4/);
  assert.match(root.innerHTML, /PDGA ID 67890 — Syy: Virheellinen PDGA-rating/);
  assert.match(root.innerHTML, /Rivi 18 — Syy: PDGA ID puuttuu/);
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

test('renderApp shows tournament table with required column order and PDGA name link', () => {
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
  ];

  renderApp(root, dataState, createUiState({ activeView: 'tournaments' }));

  assert.match(root.innerHTML, /data-open-tournament-dialog>Lisää turnaus<\/button>/);
  assert.match(root.innerHTML, /data-open-tournament-import-dialog>Tuo turnaukset<\/button>/);
  assert.match(root.innerHTML, /Tarkemmat ohjeet löytyvät Ohjeet-osion kohdasta Turnaukset\./);
  assert.match(root.innerHTML, /Järjestysnumero;PDGA Event ID;Turnauksen nimi/);
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
  assert.match(root.innerHTML, /href="https:\/\/example\.com\/event\/123456"/);
  assert.match(root.innerHTML, /target="_blank"/);
  assert.match(root.innerHTML, /rel="noopener noreferrer"/);
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
  assert.match(root.innerHTML, /id="tournament-import-file-hint"/);
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
    /data-submit-tournament-import disabled aria-describedby="tournament-import-file-hint">Tuo<\/button>/,
  );
});

test('renderApp shows delete all tournaments confirmation dialog copy', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.tournaments = [{ id: 't1' }, { id: 't2' }];
  dataState.resultCards = [{ id: 'card-1', results: [{ playerId: 'player-1', placement: '1', calculatedPoints: 100 }] }];

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
    id: 'card-1',
    tournamentId: 'tournament-1',
    tournamentName: 'Testi Open',
    location: 'Helsinki',
    startDate: '2026-07-03',
    endDate: '',
    status: 'MAJ',
    multiplier: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    results: [{ playerId: 'player-1', division: 'MPO', placement: '1', calculatedPoints: 100 }],
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
  dataState.resultCards = [{
    id: 'card-1',
    tournamentId: 'tournament-1',
    tournamentName: 'Testi Open',
    location: 'Helsinki',
    startDate: '2026-07-03',
    endDate: '',
    status: 'MAJ',
    multiplier: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    results: [
      { playerId: 'player-1', division: 'MPO', placement: '1', calculatedPoints: 100 },
      { playerId: 'player-2', division: 'MPO', placement: '2', calculatedPoints: 90 },
    ],
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

  assert.match(root.innerHTML, /Samalla poistetaan 2 turnaustulosta eikä toimintoa voi peruuttaa\./);
});

test('renderApp shows score table import instructions, division actions and Finnish decimals', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.pointsTable = {
    MPO: { '1': 100, '2': 10.5 },
    FPO: { '1': 7.25 },
  };

  renderApp(root, dataState, createUiState({ activeView: 'points' }));

  assert.match(root.innerHTML, /Tarkemmat ohjeet löytyvät Ohjeet-osion kohdasta Pistetaulukot\./);
  assert.match(root.innerHTML, /Sijoitus;Pisteet/);
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
  assert.match(root.innerHTML, /<code>Sijoitus;Pisteet<\/code>/);
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

test('renderApp näyttää tuloskortin taulukossa lajittelupainikkeet ja PDGA-linkin', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.settings = {
    playerBaseUrl: 'https://example.com/player/',
    eventBaseUrl: 'https://example.com/event/',
  };
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
  dataState.resultCards = [{
    id: 'card-1',
    tournamentId: 'tournament-1',
    tournamentName: 'European Open 2027',
    location: 'Nokia, Finland',
    startDate: '2027-07-20',
    endDate: '2027-07-23',
    status: 'MAJ',
    multiplier: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    results: [{ playerId: 'player-1', division: 'MPO', placement: '1', calculatedPoints: 200 }],
  }];

  renderApp(root, dataState, createUiState({ activeView: 'results' }));

  assert.match(root.innerHTML, /data-open-result-card-dialog>Lisää tuloskortti<\/button>/);
  assert.match(root.innerHTML, /data-sort-table="result-card" data-sort-field="name" data-result-card-id="card-1"/);
  assert.match(root.innerHTML, /data-sort-table="result-card" data-sort-field="placement" data-result-card-id="card-1"/);
  assert.match(root.innerHTML, /data-sort-table="result-card" data-sort-field="calculatedPoints" data-result-card-id="card-1"/);
  assert.match(root.innerHTML, /href="https:\/\/example\.com\/player\/12345"/);
});

test('renderApp näyttää tuloskortin luonti- ja pelaajalisäysdialogit', () => {
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
      pdgaRating: '',
      worldRank: '',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'player-2',
      firstName: 'Bea',
      lastName: 'Berg',
      name: 'Bea Berg',
      division: 'FPO',
      pdgaNumber: 200,
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
      pdgaEventId: 123,
      startDate: '2027-07-20',
      endDate: '2027-07-23',
      displayOrder: 1,
      location: 'Nokia',
      venue: '',
      multiplierId: 'multiplier-major',
      division: '',
      externalUrl: '',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  dataState.resultCards = [{
    id: 'card-1',
    tournamentId: 'tournament-1',
    tournamentName: 'Testi Open',
    location: 'Nokia',
    startDate: '2027-07-20',
    endDate: '2027-07-23',
    status: 'MAJ',
    multiplier: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    results: [{ playerId: 'player-1', division: 'MPO', placement: '1', calculatedPoints: 200 }],
  }];

  renderApp(root, dataState, createUiState({
    activeView: 'results',
    resultCardDialogOpen: true,
    resultCardForm: { tournamentId: 'tournament-1', playerIds: ['player-1'] },
    resultCardPlayersDialogOpen: true,
    resultCardPlayersDialog: { cardId: 'card-1', playerIds: ['player-2'] },
  }));

  assert.match(root.innerHTML, /<h2 id="result-card-dialog-title">Lisää tuloskortti<\/h2>/);
  assert.match(root.innerHTML, /id="result-card-tournament" name="tournamentId"/);
  assert.match(root.innerHTML, /name="playerIds" value="player-1" checked/);
  assert.match(root.innerHTML, /<h2 id="result-card-players-dialog-title">Lisää pelaajia<\/h2>/);
  assert.match(root.innerHTML, /name="playerIds" value="player-2" checked/);
});

test('renderApp näyttää tuloskortin poiston ja rivipoiston vahvistusdialogit', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.players = [{ id: 'player-1', name: 'Ari Aalto', division: 'MPO' }];
  dataState.resultCards = [{
    id: 'card-1',
    tournamentId: 'tournament-1',
    tournamentName: 'Testi Open',
    location: 'Nokia',
    startDate: '2027-07-20',
    endDate: '2027-07-23',
    status: 'MAJ',
    multiplier: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    results: [{ playerId: 'player-1', division: 'MPO', placement: '1', calculatedPoints: 200 }],
  }];

  renderApp(root, dataState, createUiState({
    activeView: 'results',
    confirmationDialog: { type: 'remove-result-player', cardId: 'card-1', playerId: 'player-1' },
  }));
  assert.match(root.innerHTML, /Poista pelaaja tuloskortilta/);
  assert.match(root.innerHTML, /data-confirm-remove-result-player>Poista<\/button>/);

  renderApp(root, dataState, createUiState({
    activeView: 'results',
    confirmationDialog: { type: 'delete-result-card', cardId: 'card-1' },
  }));
  assert.match(root.innerHTML, /⚠<\/span> VAROITUS <span aria-hidden="true">⚠/);
  assert.match(root.innerHTML, /Kaikki tämän kortin tulosrivit poistetaan\./);
  assert.match(root.innerHTML, /data-confirm-delete-result-card>Poista<\/button>/);
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

test('renderApp shows Ohjeet tab between Kertoimet and Asetukset', () => {
  const root = createRootStub();

  renderApp(root, createEmptyState(), createUiState({ activeView: 'help' }));

  const navOrder = [...root.innerHTML.matchAll(/data-view-target="([a-z]+)"/g)].map((match) => match[1]);

  assert.deepEqual(navOrder.slice(0, 9), [
    'summary',
    'ranking',
    'results',
    'players',
    'tournaments',
    'points',
    'multipliers',
    'help',
    'settings',
  ]);
  assert.match(root.innerHTML, /<button type="button" data-view-target="help" aria-current="page">/);
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
  assert.doesNotMatch(root.innerHTML, /<details class="help-section" data-help-section="[a-z]+" open/);
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

  renderApp(root, dataState, createUiState({ activeView: 'players' }));

  assert.match(root.innerHTML, /class="action-bar" role="group" aria-label="Pelaajien toiminnot"/);
  assert.match(root.innerHTML, /data-open-player-dialog>Lisää pelaaja<\/button>/);
  assert.match(root.innerHTML, /data-open-players-import-dialog>Tuo pelaajat<\/button>/);
  assert.match(
    root.innerHTML,
    /class="action-bar-group action-bar-danger" role="group" aria-label="Vaaralliset toiminnot"><button type="button" class="danger-button danger-action-button" data-request-delete-all-players><span class="danger-icon" aria-hidden="true">⚠<\/span> Poista kaikki pelaajat<\/button>/,
  );
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
  assert.match(root.innerHTML, /data-request-delete-all-tournaments disabled>/);
  assert.match(root.innerHTML, /data-request-delete-all-result-cards disabled>/);
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

test('renderApp näyttää tulossivun toimintopalkin ja kaikkien tuloskorttien poiston vahvistuksen', () => {
  const root = createRootStub();
  const dataState = createEmptyState();
  dataState.resultCards = [{
    id: 'card-1',
    tournamentId: 'tournament-1',
    tournamentName: 'Testi Open',
    results: [{ playerId: 'player-1', division: 'MPO', placement: '1', calculatedPoints: 100 }],
  }];

  renderApp(root, dataState, createUiState({ activeView: 'results' }));
  assert.match(root.innerHTML, /aria-label="Tulosten toiminnot"/);
  assert.match(root.innerHTML, /data-request-delete-all-result-cards><span class="danger-icon" aria-hidden="true">⚠<\/span> Poista kaikki tuloskortit<\/button>/);
  assert.match(root.innerHTML, /data-request-delete-result-card="card-1">Poista tuloskortti<\/button>/);

  renderApp(root, dataState, createUiState({ activeView: 'results', confirmationDialog: { type: 'delete-all-result-cards' } }));
  assert.match(root.innerHTML, /VAROITUS/);
  assert.match(root.innerHTML, /<h2 id="confirm-dialog-title">Poista kaikki tuloskortit<\/h2>/);
  assert.match(root.innerHTML, /Olet poistamassa kaikki tuloskortit \(1 kpl\) ja niiden tulosrivit \(1 kpl\)\./);
  assert.match(root.innerHTML, /Tätä toimintoa ei voi perua\./);
  assert.match(root.innerHTML, /data-confirm-delete-all-result-cards>Poista<\/button>/);
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
  const deleteAllResultCardsButton = createFocusableElement();
  const openPointsDialogButton = createFocusableElement();
  const root = {
    __dialogKeydownHandler: null,
    querySelector(selector) {
      return {
        '[data-open-players-import-dialog]': importButton,
        '[data-request-delete-all-players]': deleteAllPlayersButton,
        '[data-request-delete-all-result-cards]': deleteAllResultCardsButton,
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
    deleteAllResultCardsButton.listeners.click();
    openPointsDialogButton.listeners.click();
    assert.deepEqual(calls, [
      ['setPlayerDivisionFilter', 'FPO'],
      ['setTournamentStatusFilter', 'multiplier-1'],
      ['openPlayersImportDialog'],
      ['requestDeleteAllPlayers'],
      ['requestDeleteAllResultCards'],
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
      multiplierId: '',
      division: '',
      externalUrl: '',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  dataState.resultCards = [
    {
      id: 'card-1',
      tournamentId: 'tournament-1',
      tournamentName: 'Testi Open',
      location: '',
      startDate: '2026-07-03',
      endDate: '',
      status: '',
      multiplier: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      results: [{ playerId: 'player-1', division: 'MPO', placement: '1', calculatedPoints: 123.45678 }],
    },
  ];

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
    assert.ok(summaryRoot.innerHTML.includes(`<span>${expected}</span>`), `Yhteenveto: ${expected}`);

    const rankingRoot = createRootStub();
    renderApp(rankingRoot, dataState, createUiState({ activeView: 'ranking' }));
    assert.ok(rankingRoot.innerHTML.includes(`<td class="number">${expected}</td>`), `Ranking: ${expected}`);
  }

  assert.equal(dataState.resultCards[0].results[0].calculatedPoints, 123.45678);
});
