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
  upsertPointsTableEntry,
  removePointsTableEntry,
  clearPointsTableDivision,
  importPointsTableDivision,
  listPointsTableEntries,
  parsePointsTableCsv,
} from './scoring.js';
import {
  clearPlayerPlacement,
  getPlayerPlacement,
  removePlayerResultCard,
  removeTournamentFromResultCards,
  setPlayerPlacement,
} from './results.js';
import { renderApp, bindUi, setPlayerResultCardStatus, updatePlayerResultRow } from './ui.js';
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
  resultCardPlayerId: '',
  resultCardEditMode: false,
  resultCardDraft: null,
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

let saveQueue = Promise.resolve();
let localRevision = 0;

function cloneResultCards(resultCards = []) {
  return resultCards.map((card) => ({ ...card, results: (card.results || []).map((entry) => ({ ...entry })) }));
}

// Muokkaustilan luonnokseen tallennetaan vain sijoitukset. Pisteet lasketaan aina scoring.js:ssä.
function hasUnsavedResultCardChanges() {
  if (!uiState.resultCardEditMode || !uiState.resultCardDraft) {
    return false;
  }

  const playerId = uiState.resultCardPlayerId;
  return (dataState.tournaments || []).some((tournament) => (
    getPlayerPlacement(uiState.resultCardDraft, playerId, tournament.id)
      !== getPlayerPlacement(dataState.resultCards, playerId, tournament.id)
  ));
}

function discardPlayerResultCardEdit({ hadChanges = true, rerender = true } = {}) {
  uiState.resultCardEditMode = false;
  uiState.resultCardDraft = null;
  if (hadChanges) {
    uiState.feedback = { type: 'warning', text: '⚠ Muokkaustila suljettu ilman tallennusta' };
  }
  uiState.pendingFocusSelector = '[data-edit-player-result-card]';
  if (rerender) {
    render();
  }
}

// Kaikki tallennukset kulkevat saman jonon kautta, jotta automaattitallennukset ja muut
// tallennukset lähtevät palvelimelle järjestyksessä ja aina uusimmalla tilalla.
function enqueueSave() {
  const task = saveQueue.then(async () => {
    const revision = localRevision;
    const savedState = await saveState(dataState);
    return { savedState, revision };
  });
  saveQueue = task.catch(() => undefined);
  return task;
}

async function persistAndRender(successMessage = '') {
  const { savedState, revision } = await enqueueSave();
  if (revision === localRevision) {
    dataState = savedState;
  }
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

// Keskitetty ilmoituslogiikka: ilmoitus piilotetaan automaattisesti viiden sekunnin kuluttua.
const FEEDBACK_TIMEOUT_MS = 5000;
let feedbackTimeoutId = null;
let scheduledFeedback = null;

function scheduleFeedbackDismissal() {
  if (uiState.feedback === scheduledFeedback) {
    return;
  }

  if (feedbackTimeoutId) {
    window.clearTimeout(feedbackTimeoutId);
    feedbackTimeoutId = null;
  }

  scheduledFeedback = uiState.feedback;
  if (!uiState.feedback) {
    return;
  }

  const dismissedFeedback = uiState.feedback;
  feedbackTimeoutId = window.setTimeout(() => {
    feedbackTimeoutId = null;
    if (uiState.feedback !== dismissedFeedback) {
      return;
    }

    uiState.feedback = null;
    render();
  }, FEEDBACK_TIMEOUT_MS);
}

function render() {
  if (!authState.authenticated) {
    renderLoginView(root, authState);
    bindLoginView(root, { onSubmit: (password) => handlers.submitLogin(password) });
    return;
  }

  renderApp(root, dataState, uiState);
  bindUi(root, dataState, uiState, handlers);
  scheduleFeedbackDismissal();
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
    if (view !== 'player-result-card' && uiState.resultCardEditMode) {
      // Muokkaustila ei jää päälle, jos käyttäjä siirtyy toiselle sivulle navigaatiosta.
      discardPlayerResultCardEdit({ hadChanges: hasUnsavedResultCardChanges(), rerender: false });
    }

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
      dataState.resultCards = [];
      uiState.resultCardPlayerId = '';
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
    } else if (uiState.confirmationDialog?.type === 'clear-player-placement') {
      uiState.pendingFocusSelector = `[data-clear-player-placement="${uiState.confirmationDialog.tournamentId}"]`;
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
      dataState.resultCards = removePlayerResultCard(dataState.resultCards, playerId);
      if (uiState.resultCardPlayerId === playerId) {
        uiState.resultCardPlayerId = '';
      }
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
  toggleColumnSort(table, field) {
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
      dataState.resultCards = removeTournamentFromResultCards(dataState.resultCards, tournamentId);
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
  // Tuloskortti avataan aina lukutilaan, jotta sijoituksia ei muuteta vahingossa.
  openPlayerResultCard(playerId) {
    if (!findPlayer(dataState.players, playerId)) {
      return;
    }

    uiState.activeView = 'player-result-card';
    uiState.resultCardPlayerId = playerId;
    uiState.resultCardEditMode = false;
    uiState.resultCardDraft = null;
    uiState.navOpen = false;
    uiState.feedback = null;
    uiState.pendingFocusSelector = '[data-edit-player-result-card]';
    render();
  },
  closePlayerResultCard() {
    const playerId = uiState.resultCardPlayerId;
    uiState.activeView = 'players';
    uiState.resultCardPlayerId = '';
    uiState.resultCardEditMode = false;
    uiState.resultCardDraft = null;
    uiState.pendingFocusSelector = playerId ? `[data-open-player-result-card="${playerId}"]` : '[data-open-player-dialog]';
    render();
  },
  enterPlayerResultCardEdit() {
    if (!uiState.resultCardPlayerId || uiState.resultCardEditMode) {
      return;
    }

    uiState.resultCardEditMode = true;
    uiState.resultCardDraft = cloneResultCards(dataState.resultCards);
    uiState.feedback = null;
    uiState.pendingFocusSelector = 'input[data-result-placement]';
    render();
  },
  exitPlayerResultCardEdit() {
    if (!uiState.resultCardEditMode) {
      return;
    }

    if (hasUnsavedResultCardChanges()) {
      uiState.confirmationDialog = { type: 'exit-player-result-card-edit' };
      uiState.pendingFocusSelector = '';
      uiState.feedback = null;
      render();
      return;
    }

    discardPlayerResultCardEdit({ hadChanges: false });
  },
  confirmExitPlayerResultCardEdit() {
    if (uiState.confirmationDialog?.type !== 'exit-player-result-card-edit') {
      return;
    }

    uiState.confirmationDialog = null;
    discardPlayerResultCardEdit();
  },
  // Muokkaustilassa sijoitus validoidaan ja pisteet lasketaan heti luonnokseen, mutta mitään ei
  // tallenneta ennen Tallenna ja poistu -painiketta. Rivi päivitetään paikallaan, jotta
  // Tab-siirtymä seuraavaan kenttään ei katkea.
  updatePlayerPlacement(playerId, tournamentId, placement) {
    if (!uiState.resultCardEditMode || !uiState.resultCardDraft) {
      return;
    }

    const draftState = { ...dataState, resultCards: uiState.resultCardDraft };
    let outcome;
    try {
      outcome = setPlayerPlacement(draftState, { playerId, tournamentId, placement });
    } catch (error) {
      updatePlayerResultRow(root, draftState, playerId, tournamentId, {
        error: error instanceof Error ? error.message : 'Sijoitusta ei voitu tallentaa.',
      });
      setPlayerResultCardStatus(root, 'error', '✕ Sijoitusta ei hyväksytty. Korjaa merkityn rivin sijoitus.');
      return;
    }

    uiState.resultCardDraft = outcome.resultCards;
    updatePlayerResultRow(root, { ...dataState, resultCards: outcome.resultCards }, playerId, tournamentId);
    if (hasUnsavedResultCardChanges()) {
      setPlayerResultCardStatus(root, 'pending', 'Tallentamattomia muutoksia. Tallenna muutokset Tallenna ja poistu -painikkeella.');
    } else {
      setPlayerResultCardStatus(root, 'none', '');
    }
  },
  // Tallenna ja poistu: kaikki kortin sijoitukset validoidaan ja tallennetaan kerralla,
  // minkä jälkeen kortti palaa lukutilaan.
  async savePlayerResultCard(playerId, entries = []) {
    let nextState = { ...dataState, resultCards: cloneResultCards(dataState.resultCards) };
    const failedTournamentIds = [];

    entries.forEach(({ tournamentId, placement }) => {
      try {
        const outcome = setPlayerPlacement(nextState, { playerId, tournamentId, placement });
        nextState = { ...nextState, resultCards: outcome.resultCards };
        updatePlayerResultRow(root, nextState, playerId, tournamentId);
      } catch (error) {
        failedTournamentIds.push(tournamentId);
        updatePlayerResultRow(root, nextState, playerId, tournamentId, {
          error: error instanceof Error ? error.message : 'Sijoitusta ei voitu tallentaa.',
        });
      }
    });

    if (failedTournamentIds.length) {
      setPlayerResultCardStatus(root, 'error', '✕ Tallennus epäonnistui. Korjaa merkityt sijoitukset ja yritä uudelleen.');
      root.querySelector(`input[data-result-placement][data-tournament-id="${failedTournamentIds[0]}"]`)?.focus();
      return;
    }

    const previousResultCards = dataState.resultCards;
    try {
      dataState.resultCards = nextState.resultCards;
      localRevision += 1;
      uiState.resultCardEditMode = false;
      uiState.resultCardDraft = null;
      uiState.pendingFocusSelector = '[data-edit-player-result-card]';
      await persistAndRender('✓ Tuloskortti tallennettu onnistuneesti');
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        setError(error);
        return;
      }

      // Tallennus epäonnistui: palautetaan tallennettu tila ja jäädään muokkaustilaan,
      // jotta käyttäjä voi yrittää tallennusta uudelleen samoilla muutoksilla.
      dataState.resultCards = previousResultCards;
      localRevision += 1;
      uiState.resultCardEditMode = true;
      uiState.resultCardDraft = nextState.resultCards;
      uiState.feedback = {
        type: 'error',
        text: `✕ Tallennus epäonnistui: ${error instanceof Error ? error.message : 'Tuntematon virhe.'}`,
      };
      render();
    }
  },
  requestClearPlayerPlacement(playerId, tournamentId) {
    uiState.confirmationDialog = { type: 'clear-player-placement', playerId, tournamentId };
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  async confirmClearPlayerPlacement() {
    const { type, playerId, tournamentId } = uiState.confirmationDialog || {};
    if (type !== 'clear-player-placement' || !playerId || !tournamentId) {
      return;
    }

    // Muokkaustilassa tyhjennys koskee vain luonnosta: mitään ei tallenneta ennen
    // Tallenna ja poistu -painiketta.
    if (uiState.resultCardEditMode && uiState.resultCardDraft) {
      uiState.resultCardDraft = clearPlayerPlacement(uiState.resultCardDraft, playerId, tournamentId);
      uiState.confirmationDialog = null;
      uiState.pendingFocusSelector = `input[data-result-placement][data-tournament-id="${tournamentId}"]`;
      render();
      return;
    }

    try {
      dataState.resultCards = clearPlayerPlacement(dataState.resultCards, playerId, tournamentId);
      localRevision += 1;
      uiState.confirmationDialog = null;
      uiState.pendingFocusSelector = `input[data-result-placement][data-tournament-id="${tournamentId}"]`;
      await persistAndRender('Sijoitus ja lasketut pisteet tyhjennettiin.');
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
