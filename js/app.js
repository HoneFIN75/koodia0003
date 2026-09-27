import { createEmptyState, loadState, saveState } from './storage.js';
import {
  createPlayer,
  updatePlayer,
  findPlayer,
  removePlayer,
  canRequestPlayerDeletion,
  importPlayersFromCsv,
} from './players.js';
import { createTournament, updateTournament, findTournament, filterAndSortTournaments, TournamentValidationError } from './tournaments.js';
import { SettingsValidationError, validateSettingsInput } from './pdga.js';
import {
  DIVISIONS,
  upsertPointsTableEntry,
  removePointsTableEntry,
  clearPointsTableDivision,
  importPointsTableDivision,
  listPointsTableEntries,
  parsePointsTableCsv,
} from './scoring.js';
import { renderApp, bindUi } from './ui.js';
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
  tournamentSortField: 'startDate',
  tournamentSortDirection: 'asc',
  pendingFocusSelector: '',
  pointsForm: { division: 'MPO', place: '', basePoints: '', editingKey: '' },
  pointsImportDialogOpen: false,
  pointsImportDivision: 'MPO',
  pointsImportFocusTarget: '',
  confirmationDialog: null,
  feedback: null,
  settingsFormErrors: {},
  settingsFormDraft: null,
  deploymentInfo: null,
};

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
  uiState.pendingFocusSelector = `[data-open-points-import="${uiState.pointsImportDivision || 'MPO'}"]`;
}

function persistAndRender(successMessage = '') {
  dataState = saveState(dataState);
  if (successMessage) {
    uiState.feedback = { type: 'success', text: successMessage };
  }
  render();
}

function setError(error) {
  uiState.feedback = { type: 'error', text: error instanceof Error ? error.message : 'Tuntematon virhe.' };
  render();
}

function formDataToObject(formData) {
  return Object.fromEntries(formData.entries());
}

function render() {
  renderApp(root, dataState, uiState);
  bindUi(root, dataState, uiState, handlers);
}

const handlers = {
  toggleNav() {
    uiState.navOpen = !uiState.navOpen;
    render();
  },
  changeView(view) {
    uiState.activeView = view;
    uiState.navOpen = false;
    render();
  },
  submitSettings(formData) {
    try {
      dataState.settings = validateSettingsInput(formDataToObject(formData));
      uiState.settingsFormErrors = {};
      uiState.settingsFormDraft = null;
      persistAndRender('Asetukset tallennettiin.');
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
    uiState.rankingFilter = filter;
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
    render();
  },
  setPlayerDivisionFilter(filter) {
    uiState.playerDivisionFilter = filter;
    render();
  },
  setPlayerSortField(sortField) {
    uiState.playerSortField = sortField === 'pdgaNumber' ? 'pdgaNumber' : 'name';
    render();
  },
  setPlayerSortDirection(sortDirection) {
    uiState.playerSortDirection = sortDirection === 'desc' ? 'desc' : 'asc';
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
  submitPlayer(formData) {
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
      persistAndRender('Pelaajan tiedot tallennettu onnistuneesti.');
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
        dataState.players = [...dataState.players, ...importedPlayers];
        dataState = saveState(dataState);
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
    } else if (uiState.confirmationDialog?.type === 'delete-points-division') {
      uiState.pendingFocusSelector = `[data-request-delete-points="${uiState.confirmationDialog.division}"]`;
    }
    uiState.confirmationDialog = null;
    render();
  },
  confirmDeletePlayer() {
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
      persistAndRender('Pelaaja poistettu onnistuneesti.');
    } catch (error) {
      uiState.confirmationDialog = null;
      setError(error);
    }
  },
  retryPlayersLoad() {
    initializeDataState();
  },
  submitTournament(formData) {
    try {
      const values = formDataToObject(formData);
      uiState.tournamentFormErrors = {};
      uiState.tournamentFormDraft = null;
      if (values.id) {
        dataState.tournaments = dataState.tournaments.map((tournament) =>
          tournament.id === values.id ? updateTournament(dataState.tournaments, values.id, values) : tournament,
        );
        uiState.tournamentDialogOpen = false;
        uiState.tournamentFormId = null;
        uiState.tournamentFormFocusTarget = '';
        uiState.pendingFocusSelector = `[data-edit-tournament="${values.id}"]`;
        persistAndRender('Turnauksen tiedot päivitettiin.');
      } else {
        const tournament = createTournament(values);
        dataState.tournaments = [...dataState.tournaments, tournament];
        uiState.tournamentDialogOpen = false;
        uiState.tournamentFormFocusTarget = '';
        uiState.pendingFocusSelector = `[data-edit-tournament="${tournament.id}"]`;
        persistAndRender('Turnaus lisätty onnistuneesti.');
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
    render();
  },
  setTournamentStatusFilter(filter) {
    uiState.tournamentStatusFilter = filter || 'ALL';
    render();
  },
  setTournamentSortField(sortField) {
    uiState.tournamentSortField = sortField;
    render();
  },
  setTournamentSortDirection(sortDirection) {
    uiState.tournamentSortDirection = sortDirection === 'desc' ? 'desc' : 'asc';
    render();
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
  confirmDeleteTournament() {
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

    dataState.tournaments = remainingTournaments;
    dataState.tournamentResults = dataState.tournamentResults.filter((result) => result.tournamentId !== tournamentId);
    uiState.tournamentDialogOpen = false;
    uiState.tournamentFormId = null;
    uiState.tournamentFormErrors = {};
    uiState.tournamentFormDraft = null;
    uiState.tournamentFormFocusTarget = '';
    uiState.confirmationDialog = null;
    uiState.pendingFocusSelector = nextTournamentId
      ? `[data-edit-tournament="${nextTournamentId}"]`
      : '[data-open-tournament-dialog]';
    persistAndRender('Turnaus poistettiin.');
  },
  submitPoints(formData) {
    try {
      const values = formDataToObject(formData);
      if (values.editingKey) {
        const [oldDivision, oldPlace] = values.editingKey.split(':');
        dataState.pointsTable = removePointsTableEntry(dataState.pointsTable, oldDivision, oldPlace);
      }

      dataState.pointsTable = upsertPointsTableEntry(dataState.pointsTable, values);
      uiState.pointsForm = { division: 'MPO', place: '', basePoints: '', editingKey: '' };
      persistAndRender('Pistetaulukon rivi tallennettiin.');
    } catch (error) {
      setError(error);
    }
  },
  resetPointsForm() {
    uiState.pointsForm = { division: 'MPO', place: '', basePoints: '', editingKey: '' };
    render();
  },
  openPointsImportDialog(division) {
    uiState.activeView = 'points';
    uiState.pointsImportDialogOpen = true;
    uiState.pointsImportDivision = division || 'MPO';
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
      persistAndRender(`Sarjan ${division} pistetaulukko tuotiin onnistuneesti.`);
    } catch (error) {
      setError(error);
    }
  },
  editPoint(editingKey) {
    const [division, place] = editingKey.split(':');
    const basePoints = dataState.pointsTable[division]?.[place];
    uiState.activeView = 'points';
    uiState.pointsForm = { division, place, basePoints, editingKey };
    uiState.feedback = null;
    render();
  },
  deletePoint(editingKey) {
    const [division, place] = editingKey.split(':');
    const confirmed = window.confirm(`Poistetaanko pistetaulukon rivi ${division} / sijoitus ${place}?`);
    if (!confirmed) {
      return;
    }

    dataState.pointsTable = removePointsTableEntry(dataState.pointsTable, division, place);
    if (uiState.pointsForm.editingKey === editingKey) {
      uiState.pointsForm = { division: 'MPO', place: '', basePoints: '', editingKey: '' };
    }
    persistAndRender('Pistetaulukon rivi poistettiin.');
  },
  requestDeletePointsDivision(division) {
    uiState.confirmationDialog = { type: 'delete-points-division', division };
    uiState.pendingFocusSelector = '';
    uiState.feedback = null;
    render();
  },
  confirmDeletePointsDivision() {
    const division = uiState.confirmationDialog?.division;
    if (!division) {
      return;
    }

    dataState.pointsTable = clearPointsTableDivision(dataState.pointsTable, division);
    if (uiState.pointsForm.division === division) {
      uiState.pointsForm = { division, place: '', basePoints: '', editingKey: '' };
    }
    uiState.confirmationDialog = null;
    persistAndRender(`Sarjan ${division} kaikki pistetaulukon rivit poistettiin.`);
  },
};

function initializeDataState() {
  uiState.playersStatus = 'loading';
  uiState.playersError = '';
  render();

  window.setTimeout(() => {
    try {
      dataState = loadState();
      uiState.playersStatus = 'ready';
    } catch (error) {
      dataState = createEmptyState();
      uiState.playersStatus = 'error';
      uiState.playersError = error instanceof Error ? error.message : 'Pelaajien lataaminen epäonnistui.';
    }
    render();
  }, 0);
}

window.addEventListener('resize', () => {
  if (window.innerWidth > 780 && !uiState.navOpen) {
    render();
  }
});

render();
initializeDataState();

loadDeploymentMetadata().then((deploymentInfo) => {
  if (!deploymentInfo) {
    return;
  }

  uiState.deploymentInfo = deploymentInfo;
  render();
});
