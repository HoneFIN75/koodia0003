import { createEmptyState, loadState, saveState } from './storage.js';
import {
  createPlayer,
  updatePlayer,
  findPlayer,
  removePlayer,
  canRequestPlayerDeletion,
  importPlayersFromCsv,
} from './players.js';
import {
  createTournament,
  updateTournament,
  findTournament,
  filterAndSortTournaments,
  TournamentValidationError,
  importTournamentsFromCsv,
} from './tournaments.js';
import {
  createMultiplier,
  updateMultiplier,
  findMultiplier,
  removeMultiplier,
  sortMultipliers,
  MultiplierValidationError,
} from './multipliers.js';
import { SettingsValidationError, validateSettingsInput } from './pdga.js';
import { toggleSortState } from './table-sorting.js';
import {
  DIVISIONS,
  recalculateResultCard,
  upsertPointsTableEntry,
  removePointsTableEntry,
  clearPointsTableDivision,
  importPointsTableDivision,
  listPointsTableEntries,
  parsePointsTableCsv,
} from './scoring.js';
import { renderApp, bindUi } from './ui.js';
import {
  AuthRequiredError,
  changeSitePassword,
  isAuthenticated,
  login,
  logout,
  validateSitePasswordInput,
} from './auth.js';
import { renderLoginView, bindLoginView } from './login.js';
import { loadDeploymentMetadata } from './version.js';

const root = document.querySelector('#app');

let dataState = createEmptyState();
let uiState = {
  activeView: 'summary',
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
  playerImportDialogOpen: false,
  playerImportDivision: '',
  playerImportSummary: null,
  playersStatus: 'loading',
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
  pointsForm: { division: 'MPO', place: '', basePoints: '', editingKey: '' },
  pointsDialogOpen: false,
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
  sitePasswordFormError: '',
  deploymentInfo: null,
};
const INITIAL_UI_STATE = JSON.parse(JSON.stringify(uiState));
let authState = {
  authenticated: isAuthenticated(),
  pending: false,
  errorMessage: '',
  infoMessage: '',
};

function showLoginView(infoMessage = '') {
  logout();
  dataState = createEmptyState();
  uiState = { ...JSON.parse(JSON.stringify(INITIAL_UI_STATE)), deploymentInfo: uiState.deploymentInfo };
  authState = { authenticated: false, pending: false, errorMessage: '', infoMessage };
  render();
}

function clearPlayerDialogState() {
  uiState.playerDialogOpen = false;
  uiState.playerDialogFocusTarget = '';
  uiState.playerFormId = null;
  uiState.playerFormErrors = {};
  uiState.playerFormDraft = null;
}

function closePointsImportDialogState() {
  uiState.pointsImportDialogOpen = false;
  uiState.pointsImportFocusTarget = '';
  uiState.pendingFocusSelector = '[data-open-points-import]';
}

function closePointsDialogState() {
  const editingKey = uiState.pointsForm?.editingKey;
  uiState.pointsDialogOpen = false;
  uiState.pointsForm = { division: 'MPO', place: '', basePoints: '', editingKey: '' };
  uiState.pendingFocusSelector = editingKey ? `[data-edit-point="${editingKey}"]` : '[data-open-points-dialog]';
}

function closePlayersImportDialogState() {
  uiState.playerImportDialogOpen = false;
  uiState.playerImportSummary = null;
  uiState.pendingFocusSelector = '[data-open-players-import-dialog]';
}

function closeTournamentImportDialogState() {
  uiState.tournamentImportDialogOpen = false;
  uiState.tournamentImportFocusTarget = '';
  uiState.tournamentImportSummary = null;
  uiState.pendingFocusSelector = '[data-open-tournament-import-dialog]';
}

async function persistAndRender(successMessage = '') {
  dataState = await saveState(dataState);
  if (successMessage) {
    uiState.feedback = { type: 'success', text: successMessage };
  }
  render();
}

function setError(error) {
  if (error instanceof AuthRequiredError) {
    showLoginView('Kirjautumisesi on vanhentunut. Kirjaudu sisään uudelleen.');
    return;
  }

  uiState.feedback = { type: 'error', text: error instanceof Error ? error.message : 'Tuntematon virhe.' };
  render();
}

function formDataToObject(formData) {
  return Object.fromEntries(formData.entries());
}

function createId(prefix = 'result-card') {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function toStoredResult({ playerId, division, placement }) {
  return { playerId, division, placement };
}

function listSelectedPlayerIds(formData) {
  return [...new Set(formData.getAll('playerIds').map((playerId) => String(playerId || '').trim()).filter(Boolean))];
}

function createResultCardFromTournament(tournament, multipliers, playerIds, players) {
  const multiplier = findMultiplier(multipliers, tournament.multiplierId);
  if (!multiplier) {
    throw new Error('Turnauksen tila tai kerroin puuttuu. Päivitä turnauksen tiedot ennen tuloskortin luontia.');
  }

  const multiplierValue = Number(multiplier.multiplier);
  if (!Number.isFinite(multiplierValue) || multiplierValue <= 0) {
    throw new Error('Turnauksen kerroin ei ole kelvollinen.');
  }

  const now = new Date().toISOString();
  const playerById = new Map(players.map((player) => [player.id, player]));
  const results = playerIds
    .map((playerId) => playerById.get(playerId))
    .filter(Boolean)
    .map((player) => ({
      playerId: player.id,
      division: player.division,
      placement: '',
    }));

  return {
    id: createId(),
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    location: tournament.location || '',
    startDate: tournament.startDate || '',
    endDate: tournament.endDate || '',
    status: multiplier.abbreviation || '',
    multiplierId: multiplier.id,
    createdAt: now,
    updatedAt: now,
    results,
  };
}

function closeResultCardDialogState() {
  uiState.resultCardDialogOpen = false;
  uiState.resultCardForm = { tournamentId: '', playerIds: [] };
  uiState.pendingFocusSelector = '[data-open-result-card-dialog]';
}

function closeResultCardPlayersDialogState() {
  const cardId = uiState.resultCardPlayersDialog.cardId;
  uiState.resultCardPlayersDialogOpen = false;
  uiState.resultCardPlayersDialog = { cardId: '', playerIds: [] };
  uiState.pendingFocusSelector = cardId ? `[data-open-result-card-players-dialog="${cardId}"]` : '[data-open-result-card-dialog]';
}

function render() {
  if (!authState.authenticated) {
    renderLoginView(root, authState);
    bindLoginView(root, { onSubmit: (password) => handlers.submitLogin(password) });
    return;
  }

  renderApp(root, dataState, uiState);
  bindUi(root, dataState, uiState, handlers);
}

const handlers = {
  async submitLogin(password) {
    if (authState.pending) {
      return;
    }

    authState = { ...authState, pending: true, errorMessage: '', infoMessage: '' };
    render();

    try {
      await login(password);
      authState = { authenticated: true, pending: false, errorMessage: '', infoMessage: '' };
      initializeDataState();
    } catch (error) {
      authState = {
        ...authState,
        pending: false,
        errorMessage: error instanceof Error ? error.message : 'Kirjautuminen epäonnistui.',
      };
      render();
    }
  },
  logout() {
    showLoginView();
  },
  async submitSitePassword(formData) {
    const password = String(formData.get('sitePassword') || '');
    const validationError = validateSitePasswordInput(password);
    if (validationError) {
      uiState.sitePasswordFormError = validationError;
      uiState.feedback = { type: 'error', text: 'Korjaa salasanan tiedot ja yritä uudelleen.' };
      render();
      return;
    }

    try {
      await changeSitePassword(password);
      uiState.sitePasswordFormError = '';
      uiState.feedback = {
        type: 'success',
        text: 'Sivuston salasana tallennettiin. Uusi salasana on käytössä seuraavissa kirjautumisissa.',
      };
      render();
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        setError(error);
        return;
      }

      uiState.sitePasswordFormError = error instanceof Error ? error.message : 'Salasanan tallentaminen epäonnistui.';
      uiState.feedback = { type: 'error', text: uiState.sitePasswordFormError };
      render();
    }
  },
  toggleNav() {
    uiState.navOpen = !uiState.navOpen;
    render();
  },
  changeView(view) {
    uiState.activeView = view;
    uiState.navOpen = false;
    render();
  },
  async submitSettings(formData) {
    try {
      dataState.settings = validateSettingsInput(formDataToObject(formData));
      uiState.settingsFormErrors = {};
      uiState.settingsFormDraft = null;
      await persistAndRender('Asetukset tallennettiin.');
    } catch (error) {
      if (error instanceof SettingsValidationError) {
        uiState.settingsFormErrors = error.fieldErrors;
        uiState.settingsFormDraft = formDataToObject(formData);
        uiState.feedback = { type: 'error', text: 'Korjaa asetusten tiedot ja yritä uudelleen.' };
        render();
        return;
      }

      setError(error);
    }
  },
  resetSettingsForm() {
    uiState.settingsFormErrors = {};
    uiState.settingsFormDraft = null;
    render();
  },
  setRankingFilter(filter) {
    uiState.rankingFilter = ['ALL', ...DIVISIONS].includes(filter) ? filter : 'ALL';
    uiState.pendingFocusSelector = `[data-ranking-filter="${uiState.rankingFilter}"]`;
    render();
  },
  openResultCardDialog() {
    uiState.activeView = 'results';
    uiState.resultCardDialogOpen = true;
    uiState.resultCardForm = { tournamentId: '', playerIds: [] };
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  closeResultCardDialog() {
    closeResultCardDialogState();
    render();
  },
  updateResultCardTournament(tournamentId) {
    uiState.resultCardForm = {
      ...uiState.resultCardForm,
      tournamentId,
    };
    render();
  },
  async submitResultCard(formData) {
    try {
      const tournamentId = String(formData.get('tournamentId') || '').trim();
      const tournament = findTournament(dataState.tournaments, tournamentId);
      if (!tournament) {
        throw new Error('Valitse tuloskortille turnaus.');
      }

      const playerIds = listSelectedPlayerIds(formData);
      const card = createResultCardFromTournament(tournament, dataState.multipliers, playerIds, dataState.players);
      dataState.resultCards = [...dataState.resultCards, card];
      closeResultCardDialogState();
      await persistAndRender('Tuloskortti luotiin.');
    } catch (error) {
      uiState.resultCardForm = {
        tournamentId: String(formData.get('tournamentId') || '').trim(),
        playerIds: listSelectedPlayerIds(formData),
      };
      setError(error);
    }
  },
  openResultCardPlayersDialog(cardId) {
    const card = dataState.resultCards.find((entry) => entry.id === cardId);
    if (!card) {
      return;
    }

    uiState.resultCardPlayersDialogOpen = true;
    uiState.resultCardPlayersDialog = { cardId, playerIds: [] };
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  closeResultCardPlayersDialog() {
    closeResultCardPlayersDialogState();
    render();
  },
  async submitResultCardPlayers(formData) {
    const cardId = String(formData.get('cardId') || '').trim();
    const playerIds = listSelectedPlayerIds(formData);

    try {
      const card = dataState.resultCards.find((entry) => entry.id === cardId);
      if (!card) {
        throw new Error('Tuloskorttia ei löytynyt.');
      }

      const existingPlayerIds = new Set((card.results || []).map((result) => result.playerId));
      const playerById = new Map(dataState.players.map((player) => [player.id, player]));
      const appendedResults = playerIds
        .filter((playerId) => !existingPlayerIds.has(playerId) && playerById.has(playerId))
        .map((playerId) => ({
          playerId,
          division: playerById.get(playerId).division,
          placement: '',
        }));

      dataState.resultCards = dataState.resultCards.map((entry) => (
        entry.id === cardId
          ? {
              ...entry,
              results: [...(entry.results || []), ...appendedResults],
              updatedAt: new Date().toISOString(),
            }
          : entry
      ));
      closeResultCardPlayersDialogState();
      await persistAndRender('Pelaajat lisättiin tuloskortille.');
    } catch (error) {
      uiState.resultCardPlayersDialog = { cardId, playerIds };
      setError(error);
    }
  },
  setSummaryFilter(filter) {
    uiState.summaryFilter = filter;
    render();
  },
  setSummaryPlayer(playerId) {
    uiState.summaryPlayerId = playerId;
    render();
  },
  setPlayerSearch(query) {
    uiState.playerSearch = query;
    uiState.pendingFocusSelector = '#player-search';
    render();
  },
  setPlayerDivisionFilter(filter) {
    uiState.playerDivisionFilter = ['ALL', ...DIVISIONS].includes(filter) ? filter : 'ALL';
    uiState.pendingFocusSelector = `[data-player-division-filter="${uiState.playerDivisionFilter}"]`;
    render();
  },
  openPlayerDialog() {
    uiState.activeView = 'players';
    uiState.playerDialogOpen = true;
    uiState.playerDialogFocusTarget = 'firstName';
    uiState.playerFormId = null;
    uiState.playerFormErrors = {};
    uiState.playerFormDraft = null;
    uiState.feedback = null;
    render();
  },
  closePlayerDialog() {
    clearPlayerDialogState();
    render();
  },
  viewPlayer(playerId) {
    uiState.activeView = 'players';
    uiState.selectedPlayerId = playerId;
    uiState.feedback = null;
    render();
  },
  async submitPlayer(formData) {
    try {
      const values = formDataToObject(formData);
      uiState.playerFormErrors = {};
      uiState.playerFormDraft = null;
      if (values.id) {
        dataState.players = dataState.players.map((player) =>
          player.id === values.id ? updatePlayer(dataState.players, values.id, values) : player,
        );
        uiState.selectedPlayerId = values.id;
      } else {
        const newPlayer = createPlayer(dataState.players, values);
        dataState.players = [...dataState.players, newPlayer];
        uiState.summaryPlayerId = newPlayer.id;
        uiState.selectedPlayerId = newPlayer.id;
      }
      clearPlayerDialogState();
      await persistAndRender('Pelaajan tiedot tallennettu onnistuneesti.');
    } catch (error) {
      if (error?.fieldErrors) {
        uiState.playerFormErrors = error.fieldErrors;
        uiState.playerFormDraft = formDataToObject(formData);
        uiState.feedback = { type: 'error', text: 'Korjaa pelaajan tiedot ja yritä uudelleen.' };
        render();
        return;
      }
      setError(error);
    }
  },
  openPlayersImportDialog() {
    uiState.activeView = 'players';
    uiState.playerImportDialogOpen = true;
    uiState.playerImportSummary = null;
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  closePlayersImportDialog() {
    closePlayersImportDialogState();
    render();
  },
  requestDeleteAllPlayers() {
    if (!dataState.players.length) {
      return;
    }

    uiState.confirmationDialog = { type: 'delete-all-players' };
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  async confirmDeleteAllPlayers() {
    if (uiState.confirmationDialog?.type !== 'delete-all-players') {
      return;
    }

    try {
      dataState.players = [];
      clearPlayerDialogState();
      uiState.summaryPlayerId = '';
      uiState.selectedPlayerId = '';
      uiState.confirmationDialog = null;
      uiState.pendingFocusSelector = '[data-open-player-dialog]';
      await persistAndRender('Kaikki pelaajat on poistettu onnistuneesti.');
    } catch (error) {
      uiState.confirmationDialog = null;
      setError(error);
    }
  },
  async submitPlayersImport(formData) {
    uiState.playerImportSummary = null;
    try {
      const division = String(formData.get('division') || '').trim().toUpperCase();
      const file = formData.get('file');
      if (!file || typeof file.text !== 'function' || !file.name) {
        throw new Error('Valitse tuotava CSV-tiedosto.');
      }

      const { importedPlayers, summary } = importPlayersFromCsv(dataState.players, await file.text(), division);
      if (importedPlayers.length) {
        dataState = await saveState({
          ...dataState,
          players: [...dataState.players, ...importedPlayers],
        });
      }

      uiState.playerImportDivision = division;
      uiState.playerImportSummary = summary;
      uiState.feedback = null;
      render();
    } catch (error) {
      setError(error);
    }
  },
  editPlayer(playerId) {
    uiState.activeView = 'players';
    uiState.playerDialogOpen = true;
    uiState.playerDialogFocusTarget = 'firstName';
    uiState.playerFormId = playerId;
    uiState.selectedPlayerId = playerId;
    uiState.playerFormErrors = {};
    uiState.playerFormDraft = null;
    uiState.feedback = null;
    render();
  },
  requestDeletePlayer(playerId) {
    const player = findPlayer(dataState.players, playerId);
    if (!player || !canRequestPlayerDeletion(uiState.playerFormId, playerId)) {
      return;
    }

    uiState.confirmationDialog = { type: 'delete-player', playerId };
    uiState.feedback = null;
    render();
  },
  closeConfirmationDialog() {
    if (uiState.confirmationDialog?.type === 'delete-tournament') {
      uiState.pendingFocusSelector = uiState.tournamentFormId
        ? `[data-delete-tournament="${uiState.tournamentFormId}"]`
        : '[data-open-tournament-dialog]';
    } else if (uiState.confirmationDialog?.type === 'delete-all-tournaments') {
      uiState.pendingFocusSelector = '[data-request-delete-all-tournaments]';
    } else if (uiState.confirmationDialog?.type === 'delete-multiplier') {
      uiState.pendingFocusSelector = uiState.multiplierFormId
        ? `[data-edit-multiplier="${uiState.multiplierFormId}"]`
        : '[data-open-multiplier-dialog]';
    } else if (uiState.confirmationDialog?.type === 'delete-points-division') {
      uiState.pendingFocusSelector = `[data-request-delete-points="${uiState.confirmationDialog.division}"]`;
    } else if (uiState.confirmationDialog?.type === 'remove-result-player') {
      uiState.pendingFocusSelector = `[data-open-result-card-players-dialog="${uiState.confirmationDialog.cardId}"]`;
    } else if (uiState.confirmationDialog?.type === 'delete-result-card') {
      uiState.pendingFocusSelector = '[data-open-result-card-dialog]';
    } else if (uiState.confirmationDialog?.type === 'delete-all-result-cards') {
      uiState.pendingFocusSelector = '[data-request-delete-all-result-cards]';
    } else if (uiState.confirmationDialog?.type === 'delete-all-players') {
      uiState.pendingFocusSelector = '[data-request-delete-all-players]';
    } else if (uiState.confirmationDialog?.type === 'delete-point') {
      uiState.pendingFocusSelector = `[data-delete-point="${uiState.confirmationDialog.division}:${uiState.confirmationDialog.place}"]`;
    }
    uiState.confirmationDialog = null;
    render();
  },
  async confirmDeletePlayer() {
    const playerId = uiState.confirmationDialog?.playerId;
    if (!playerId) {
      return;
    }

    try {
      dataState.players = removePlayer(dataState.players, playerId);
      if (uiState.playerFormId === playerId) {
        clearPlayerDialogState();
      }
      if (uiState.summaryPlayerId === playerId) {
        uiState.summaryPlayerId = '';
      }
      if (uiState.selectedPlayerId === playerId) {
        uiState.selectedPlayerId = '';
      }
      uiState.confirmationDialog = null;
      await persistAndRender('Pelaaja poistettu onnistuneesti.');
    } catch (error) {
      uiState.confirmationDialog = null;
      setError(error);
    }
  },
  retryPlayersLoad() {
    initializeDataState();
  },
  async submitTournament(formData) {
    try {
      const values = formDataToObject(formData);
      uiState.tournamentFormErrors = {};
      uiState.tournamentFormDraft = null;
      if (values.id) {
        dataState.tournaments = dataState.tournaments.map((tournament) =>
          tournament.id === values.id
            ? updateTournament(dataState.tournaments, dataState.multipliers, values.id, values)
            : tournament,
        );
        uiState.tournamentDialogOpen = false;
        uiState.tournamentFormId = null;
        uiState.tournamentFormFocusTarget = '';
        uiState.pendingFocusSelector = `[data-edit-tournament="${values.id}"]`;
        await persistAndRender('Turnauksen tiedot päivitettiin.');
      } else {
        const tournament = createTournament(dataState.tournaments, dataState.multipliers, values);
        dataState.tournaments = [...dataState.tournaments, tournament];
        uiState.tournamentDialogOpen = false;
        uiState.tournamentFormFocusTarget = '';
        uiState.pendingFocusSelector = `[data-edit-tournament="${tournament.id}"]`;
        await persistAndRender('Turnaus lisätty onnistuneesti.');
      }
    } catch (error) {
      if (error instanceof TournamentValidationError) {
        uiState.tournamentFormErrors = error.fieldErrors;
        uiState.tournamentFormDraft = formDataToObject(formData);
        uiState.tournamentFormFocusTarget = Object.keys(error.fieldErrors)[0] || 'name';
        uiState.feedback = { type: 'error', text: 'Korjaa turnauksen tiedot ja yritä uudelleen.' };
        render();
        return;
      }
      setError(error);
    }
  },
  openTournamentDialog() {
    uiState.activeView = 'tournaments';
    uiState.tournamentDialogOpen = true;
    uiState.tournamentFormId = null;
    uiState.tournamentFormErrors = {};
    uiState.tournamentFormDraft = null;
    uiState.tournamentFormFocusTarget = 'name';
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  closeTournamentDialog() {
    const returnFocusSelector = uiState.tournamentFormId
      ? `[data-edit-tournament="${uiState.tournamentFormId}"]`
      : '[data-open-tournament-dialog]';
    uiState.tournamentDialogOpen = false;
    uiState.tournamentFormId = null;
    uiState.tournamentFormErrors = {};
    uiState.tournamentFormDraft = null;
    uiState.tournamentFormFocusTarget = '';
    uiState.pendingFocusSelector = returnFocusSelector;
    render();
  },
  resetTournamentForm() {
    uiState.tournamentFormErrors = {};
    uiState.tournamentFormDraft = null;
    uiState.tournamentFormFocusTarget = '';
    render();
  },
  editTournament(tournamentId) {
    uiState.activeView = 'tournaments';
    uiState.tournamentDialogOpen = true;
    uiState.tournamentFormId = tournamentId;
    uiState.tournamentFormErrors = {};
    uiState.tournamentFormDraft = null;
    uiState.tournamentFormFocusTarget = 'name';
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  setTournamentSearch(query) {
    uiState.tournamentSearch = query;
    uiState.pendingFocusSelector = '#tournament-search';
    render();
  },
  setTournamentStatusFilter(filter) {
    uiState.tournamentStatusFilter = filter || 'ALL';
    uiState.pendingFocusSelector = `[data-tournament-status-filter="${CSS.escape(uiState.tournamentStatusFilter)}"]`;
    render();
  },
  openMultiplierDialog() {
    uiState.activeView = 'multipliers';
    uiState.multiplierDialogOpen = true;
    uiState.multiplierFormId = null;
    uiState.multiplierFormErrors = {};
    uiState.multiplierFormDraft = null;
    uiState.multiplierFormFocusTarget = 'orderNumber';
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  closeMultiplierDialog() {
    const returnFocusSelector = uiState.multiplierFormId
      ? `[data-edit-multiplier="${uiState.multiplierFormId}"]`
      : '[data-open-multiplier-dialog]';
    uiState.multiplierDialogOpen = false;
    uiState.multiplierFormId = null;
    uiState.multiplierFormErrors = {};
    uiState.multiplierFormDraft = null;
    uiState.multiplierFormFocusTarget = '';
    uiState.pendingFocusSelector = returnFocusSelector;
    render();
  },
  resetMultiplierForm() {
    uiState.multiplierFormErrors = {};
    uiState.multiplierFormDraft = null;
    uiState.multiplierFormFocusTarget = '';
    render();
  },
  editMultiplier(multiplierId) {
    uiState.activeView = 'multipliers';
    uiState.multiplierDialogOpen = true;
    uiState.multiplierFormId = multiplierId;
    uiState.multiplierFormErrors = {};
    uiState.multiplierFormDraft = null;
    uiState.multiplierFormFocusTarget = 'orderNumber';
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  async submitMultiplier(formData) {
    try {
      const values = formDataToObject(formData);
      uiState.multiplierFormErrors = {};
      uiState.multiplierFormDraft = null;
      if (values.id) {
        dataState.multipliers = sortMultipliers(
          dataState.multipliers.map((multiplier) =>
            multiplier.id === values.id ? updateMultiplier(dataState.multipliers, values.id, values) : multiplier,
          ),
        );
        uiState.multiplierDialogOpen = false;
        uiState.multiplierFormId = null;
        uiState.multiplierFormFocusTarget = '';
        uiState.pendingFocusSelector = `[data-edit-multiplier="${values.id}"]`;
        await persistAndRender('Kertoimen tiedot päivitettiin.');
      } else {
        const multiplier = createMultiplier(dataState.multipliers, values);
        dataState.multipliers = sortMultipliers([...dataState.multipliers, multiplier]);
        uiState.multiplierDialogOpen = false;
        uiState.multiplierFormFocusTarget = '';
        uiState.pendingFocusSelector = `[data-edit-multiplier="${multiplier.id}"]`;
        await persistAndRender('Kerroin lisätty onnistuneesti.');
      }
    } catch (error) {
      if (error instanceof MultiplierValidationError) {
        uiState.multiplierFormErrors = error.fieldErrors;
        uiState.multiplierFormDraft = formDataToObject(formData);
        uiState.multiplierFormFocusTarget = Object.keys(error.fieldErrors)[0] || 'orderNumber';
        uiState.feedback = { type: 'error', text: 'Korjaa kertoimen tiedot ja yritä uudelleen.' };
        render();
        return;
      }
      setError(error);
    }
  },
  requestDeleteMultiplier(multiplierId) {
    const multiplier = findMultiplier(dataState.multipliers, multiplierId);
    if (!multiplier) {
      return;
    }

    const linkedTournament = dataState.tournaments.find((tournament) => tournament.multiplierId === multiplierId);
    if (linkedTournament) {
      setError(new Error('Kerrointa ei voi poistaa, koska se on käytössä turnauksissa.'));
      return;
    }

    uiState.confirmationDialog = { type: 'delete-multiplier', multiplierId };
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  async confirmDeleteMultiplier() {
    const multiplierId = uiState.confirmationDialog?.multiplierId;
    if (!multiplierId) {
      return;
    }

    const linkedTournament = dataState.tournaments.find((tournament) => tournament.multiplierId === multiplierId);
    if (linkedTournament) {
      uiState.confirmationDialog = null;
      setError(new Error('Kerrointa ei voi poistaa, koska se on käytössä turnauksissa.'));
      return;
    }

    try {
      dataState.multipliers = removeMultiplier(dataState.multipliers, multiplierId);
      uiState.multiplierDialogOpen = false;
      uiState.multiplierFormId = null;
      uiState.multiplierFormErrors = {};
      uiState.multiplierFormDraft = null;
      uiState.multiplierFormFocusTarget = '';
      uiState.confirmationDialog = null;
      uiState.pendingFocusSelector = '[data-open-multiplier-dialog]';
      await persistAndRender('Kerroin poistettiin.');
    } catch (error) {
      uiState.confirmationDialog = null;
      setError(error);
    }
  },
  toggleColumnSort(table, field, contextId = '') {
    const applySort = (fieldKey, directionKey, allowedFields, defaultField, defaultDirection = 'asc') => {
      if (!allowedFields.includes(field)) {
        return;
      }
      const currentSort = {
        field: uiState[fieldKey] || defaultField,
        direction: uiState[directionKey] || defaultDirection,
      };
      const nextSort = toggleSortState(currentSort, field, defaultDirection);
      uiState[fieldKey] = nextSort.field;
      uiState[directionKey] = nextSort.direction;
    };

    if (table === 'players') {
      applySort('playerSortField', 'playerSortDirection', ['name', 'pdgaNumber', 'division', 'pdgaRating', 'worldRank'], 'name');
    } else if (table === 'tournaments') {
      applySort(
        'tournamentSortField',
        'tournamentSortDirection',
        ['displayOrder', 'name', 'multiplierAbbreviation', 'pdgaEventId', 'startDate', 'endDate', 'location', 'venue'],
        'displayOrder',
      );
    } else if (table === 'ranking') {
      applySort(
        'rankingSortField',
        'rankingSortDirection',
        ['rankPosition', 'name', 'division', 'pdgaRating', 'worldRank', 'tournamentCount', 'totalPoints'],
        'totalPoints',
        'desc',
      );
    } else if (table === 'multipliers') {
      applySort('multipliersSortField', 'multipliersSortDirection', ['orderNumber', 'name', 'abbreviation', 'multiplier'], 'orderNumber');
    } else if (table === 'points') {
      applySort('pointsSortField', 'pointsSortDirection', ['place', 'basePoints'], 'place');
    } else if (table === 'result-card') {
      if (!contextId) {
        render();
        return;
      }

      const currentSort = uiState.resultCardSorts[contextId] || { field: 'name', direction: 'asc' };
      const nextSort = toggleSortState(currentSort, field, 'asc');
      if (!['name', 'placement', 'calculatedPoints'].includes(nextSort.field)) {
        render();
        return;
      }
      uiState.resultCardSorts = {
        ...uiState.resultCardSorts,
        [contextId]: nextSort,
      };
    }

    render();
  },
  openTournamentImportDialog() {
    uiState.activeView = 'tournaments';
    uiState.tournamentImportDialogOpen = true;
    uiState.tournamentImportFocusTarget = 'file';
    uiState.tournamentImportSummary = null;
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  closeTournamentImportDialog() {
    closeTournamentImportDialogState();
    render();
  },
  async submitTournamentImport(formData) {
    try {
      const file = formData.get('file');
      if (!file || typeof file.text !== 'function' || !file.name) {
        throw new Error('Valitse tuotava CSV-tiedosto.');
      }

      const { importedTournaments, summary } = importTournamentsFromCsv(dataState.tournaments, await file.text());
      uiState.tournamentImportSummary = summary;
      if (importedTournaments.length) {
        dataState = await saveState({
          ...dataState,
          tournaments: [...dataState.tournaments, ...importedTournaments],
        });
      }

      uiState.feedback = null;
      render();
    } catch (error) {
      setError(error);
    }
  },
  requestDeleteTournament(tournamentId) {
    const tournament = findTournament(dataState.tournaments, tournamentId);
    if (!tournament) {
      return;
    }

    uiState.confirmationDialog = { type: 'delete-tournament', tournamentId };
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  requestDeleteAllTournaments() {
    if (!dataState.tournaments.length) {
      return;
    }

    uiState.confirmationDialog = { type: 'delete-all-tournaments' };
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  async confirmDeleteTournament() {
    const tournamentId = uiState.confirmationDialog?.tournamentId;
    if (!tournamentId) {
      return;
    }

    const currentVisibleTournamentIds = filterAndSortTournaments(dataState.tournaments, {
      search: uiState.tournamentSearch,
      status: uiState.tournamentStatusFilter,
      sortField: uiState.tournamentSortField,
      sortDirection: uiState.tournamentSortDirection,
    }).map((tournament) => tournament.id);
    const deletedTournamentIndex = currentVisibleTournamentIds.indexOf(tournamentId);
    const remainingTournaments = dataState.tournaments.filter((entry) => entry.id !== tournamentId);
    const nextVisibleTournamentIds = filterAndSortTournaments(remainingTournaments, {
      search: uiState.tournamentSearch,
      status: uiState.tournamentStatusFilter,
      sortField: uiState.tournamentSortField,
      sortDirection: uiState.tournamentSortDirection,
    }).map((tournament) => tournament.id);
    const nextTournamentId = nextVisibleTournamentIds[
      Math.min(deletedTournamentIndex === -1 ? 0 : deletedTournamentIndex, Math.max(nextVisibleTournamentIds.length - 1, 0))
    ];

    try {
      dataState.tournaments = remainingTournaments;
      dataState.resultCards = dataState.resultCards.filter((card) => card.tournamentId !== tournamentId);
      uiState.tournamentDialogOpen = false;
      uiState.tournamentFormId = null;
      uiState.tournamentFormErrors = {};
      uiState.tournamentFormDraft = null;
      uiState.tournamentFormFocusTarget = '';
      uiState.confirmationDialog = null;
      uiState.pendingFocusSelector = nextTournamentId
        ? `[data-edit-tournament="${nextTournamentId}"]`
        : '[data-open-tournament-dialog]';
      await persistAndRender('Turnaus poistettiin.');
    } catch (error) {
      uiState.confirmationDialog = null;
      setError(error);
    }
  },
  async confirmDeleteAllTournaments() {
    if (!uiState.confirmationDialog || uiState.confirmationDialog.type !== 'delete-all-tournaments') {
      return;
    }

    try {
      dataState.tournaments = [];
      dataState.resultCards = [];
      uiState.tournamentDialogOpen = false;
      uiState.tournamentFormId = null;
      uiState.tournamentFormErrors = {};
      uiState.tournamentFormDraft = null;
      uiState.tournamentFormFocusTarget = '';
      uiState.confirmationDialog = null;
      uiState.pendingFocusSelector = '[data-open-tournament-dialog]';
      await persistAndRender('Kaikki turnaukset on poistettu onnistuneesti.');
    } catch (error) {
      uiState.confirmationDialog = null;
      setError(error);
    }
  },
  async submitPoints(formData) {
    try {
      const values = formDataToObject(formData);
      if (values.editingKey) {
        const [oldDivision, oldPlace] = values.editingKey.split(':');
        dataState.pointsTable = removePointsTableEntry(dataState.pointsTable, oldDivision, oldPlace);
      }

      dataState.pointsTable = upsertPointsTableEntry(dataState.pointsTable, values);
      closePointsDialogState();
      await persistAndRender('Pistetaulukon rivi tallennettiin.');
    } catch (error) {
      setError(error);
    }
  },
  openPointsDialog() {
    uiState.activeView = 'points';
    uiState.pointsDialogOpen = true;
    uiState.pointsForm = { division: 'MPO', place: '', basePoints: '', editingKey: '' };
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  closePointsDialog() {
    closePointsDialogState();
    render();
  },
  openPointsImportDialog(division) {
    uiState.activeView = 'points';
    uiState.pointsImportDialogOpen = true;
    uiState.pointsImportDivision = DIVISIONS.includes(division) ? division : uiState.pointsImportDivision || 'MPO';
    uiState.pointsImportFocusTarget = 'file';
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  closePointsImportDialog() {
    closePointsImportDialogState();
    render();
  },
  async submitPointsImport(formData) {
    try {
      const division = String(formData.get('division') || '').trim().toUpperCase();
      if (!DIVISIONS.includes(division)) {
        throw new Error('Sarjan pitää olla MPO tai FPO.');
      }

      const file = formData.get('file');
      const existingEntries = listPointsTableEntries(dataState.pointsTable, division);
      if (existingEntries.length) {
        throw new Error('Tuonti on sallittu vain tyhjään pistetaulukkoon. Poista olemassa olevat pisteet ennen tuontia.');
      }
      if (!file || typeof file.text !== 'function' || !file.name) {
        throw new Error('Valitse tuotava CSV-tiedosto.');
      }
      const entries = parsePointsTableCsv(await file.text());
      dataState.pointsTable = importPointsTableDivision(dataState.pointsTable, division, entries);
      uiState.pointsImportDivision = division;
      closePointsImportDialogState();
      await persistAndRender(`Sarjan ${division} pistetaulukko tuotiin onnistuneesti.`);
    } catch (error) {
      setError(error);
    }
  },
  editPoint(editingKey) {
    const [division, place] = editingKey.split(':');
    const basePoints = dataState.pointsTable[division]?.[place];
    uiState.activeView = 'points';
    uiState.pointsDialogOpen = true;
    uiState.pointsForm = { division, place, basePoints, editingKey };
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  requestDeletePoint(editingKey) {
    const [division, place] = String(editingKey || '').split(':');
    if (!division || !place) {
      return;
    }

    uiState.confirmationDialog = { type: 'delete-point', division, place };
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  async confirmDeletePoint() {
    const { division, place, type } = uiState.confirmationDialog || {};
    if (type !== 'delete-point' || !division || !place) {
      return;
    }

    try {
      dataState.pointsTable = removePointsTableEntry(dataState.pointsTable, division, place);
      uiState.confirmationDialog = null;
      uiState.pendingFocusSelector = '[data-open-points-dialog]';
      await persistAndRender('Pistetaulukon rivi poistettiin.');
    } catch (error) {
      uiState.confirmationDialog = null;
      setError(error);
    }
  },
  requestDeletePointsDivision(division) {
    uiState.confirmationDialog = { type: 'delete-points-division', division };
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  async confirmDeletePointsDivision() {
    const division = uiState.confirmationDialog?.division;
    if (!division) {
      return;
    }

    try {
      dataState.pointsTable = clearPointsTableDivision(dataState.pointsTable, division);
      if (uiState.pointsForm.division === division) {
        uiState.pointsForm = { division, place: '', basePoints: '', editingKey: '' };
      }
      uiState.confirmationDialog = null;
      await persistAndRender(`Sarjan ${division} kaikki pistetaulukon rivit poistettiin.`);
    } catch (error) {
      uiState.confirmationDialog = null;
      setError(error);
    }
  },
  async updateResultPlacement(cardId, playerId, placement) {
    try {
      const card = dataState.resultCards.find((entry) => entry.id === cardId);
      if (!card) {
        throw new Error('Tuloskorttia ei löytynyt.');
      }

      const updatedResults = (card.results || []).map((result) => (
        result.playerId === playerId
          ? {
              ...result,
              placement: String(placement ?? '').trim().toUpperCase(),
            }
          : result
      ));
      const recalculatedResults = recalculateResultCard({
        card,
        results: updatedResults,
        players: dataState.players,
        pointsTable: dataState.pointsTable,
        multipliers: dataState.multipliers,
        tournaments: dataState.tournaments,
      }).map(toStoredResult);

      dataState.resultCards = dataState.resultCards.map((entry) =>
        entry.id === cardId
          ? {
              ...entry,
              results: recalculatedResults,
              updatedAt: new Date().toISOString(),
            }
          : entry,
      );
      await persistAndRender('Sijoitus tallennettiin.');
    } catch (error) {
      setError(error);
    }
  },
  async saveResultCard(cardId) {
    try {
      const card = dataState.resultCards.find((entry) => entry.id === cardId);
      if (!card) {
        throw new Error('Tuloskorttia ei löytynyt.');
      }

      const recalculatedResults = recalculateResultCard({
        card,
        players: dataState.players,
        pointsTable: dataState.pointsTable,
        multipliers: dataState.multipliers,
        tournaments: dataState.tournaments,
      }).map(toStoredResult);

      dataState.resultCards = dataState.resultCards.map((entry) =>
        entry.id === cardId
          ? {
              ...entry,
              results: recalculatedResults,
              updatedAt: new Date().toISOString(),
            }
          : entry,
      );
      await persistAndRender('Tuloskortti tallennettiin.');
    } catch (error) {
      setError(error);
    }
  },
  requestRemoveResultPlayer(cardId, playerId) {
    const card = dataState.resultCards.find((entry) => entry.id === cardId);
    if (!card) {
      return;
    }

    uiState.confirmationDialog = { type: 'remove-result-player', cardId, playerId };
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  async confirmRemoveResultPlayer() {
    const cardId = uiState.confirmationDialog?.cardId;
    const playerId = uiState.confirmationDialog?.playerId;
    if (!cardId || !playerId) {
      return;
    }

    try {
      dataState.resultCards = dataState.resultCards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              results: (card.results || []).filter((result) => result.playerId !== playerId),
              updatedAt: new Date().toISOString(),
            }
          : card,
      );
      uiState.confirmationDialog = null;
      await persistAndRender('Pelaaja poistettiin tuloskortilta.');
    } catch (error) {
      uiState.confirmationDialog = null;
      setError(error);
    }
  },
  requestDeleteResultCard(cardId) {
    const card = dataState.resultCards.find((entry) => entry.id === cardId);
    if (!card) {
      return;
    }

    uiState.confirmationDialog = { type: 'delete-result-card', cardId };
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  requestDeleteAllResultCards() {
    if (!dataState.resultCards.length) {
      return;
    }

    uiState.confirmationDialog = { type: 'delete-all-result-cards' };
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  async confirmDeleteAllResultCards() {
    if (uiState.confirmationDialog?.type !== 'delete-all-result-cards') {
      return;
    }

    try {
      dataState.resultCards = [];
      uiState.resultCardSorts = {};
      uiState.confirmationDialog = null;
      uiState.pendingFocusSelector = '[data-open-result-card-dialog]';
      await persistAndRender('Kaikki tuloskortit on poistettu onnistuneesti.');
    } catch (error) {
      uiState.confirmationDialog = null;
      setError(error);
    }
  },
  async confirmDeleteResultCard() {
    const cardId = uiState.confirmationDialog?.cardId;
    if (!cardId) {
      return;
    }

    try {
      dataState.resultCards = dataState.resultCards.filter((card) => card.id !== cardId);
      uiState.confirmationDialog = null;
      await persistAndRender('Tuloskortti poistettiin.');
    } catch (error) {
      uiState.confirmationDialog = null;
      setError(error);
    }
  },
};

function initializeDataState() {
  uiState.playersStatus = 'loading';
  uiState.playersError = '';
  render();

  window.setTimeout(async () => {
    try {
      dataState = await loadState();
      uiState.playersStatus = 'ready';
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        setError(error);
        return;
      }

      dataState = createEmptyState();
      uiState.playersStatus = 'error';
      uiState.playersError = error instanceof Error ? error.message : 'Pelaajien lataaminen epäonnistui.';
    }
    render();
  }, 0);
}

window.addEventListener('resize', () => {
  if (authState.authenticated && window.innerWidth > 780 && !uiState.navOpen) {
    render();
  }
});

if (authState.authenticated) {
  initializeDataState();
} else {
  render();
}

loadDeploymentMetadata().then((deploymentInfo) => {
  if (!deploymentInfo) {
    return;
  }

  uiState.deploymentInfo = deploymentInfo;
  if (authState.authenticated) {
    render();
  }
});
