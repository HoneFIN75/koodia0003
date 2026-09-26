import { createEmptyState, loadState, saveState } from './storage.js';
import { createPlayer, updatePlayer, findPlayer, removePlayer, canRequestPlayerDeletion } from './players.js';
import { createTournament, updateTournament, findTournament, TournamentValidationError } from './tournaments.js';
import { SettingsValidationError, validateSettingsInput } from './pdga.js';
import {
  createTournamentResult,
  updateTournamentResult,
  upsertPointsTableEntry,
  removePointsTableEntry,
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
  playerFormId: null,
  playerFormErrors: {},
  playerFormDraft: null,
  playersStatus: 'loading',
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
};

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
        uiState.playerFormId = null;
        uiState.selectedPlayerId = values.id;
        persistAndRender('Pelaajan tiedot päivitettiin.');
      } else {
        const newPlayer = createPlayer(dataState.players, values);
        dataState.players = [...dataState.players, newPlayer];
        uiState.summaryPlayerId = newPlayer.id;
        uiState.selectedPlayerId = newPlayer.id;
        persistAndRender('Pelaaja lisättiin.');
      }
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
  resetPlayerForm() {
    uiState.playerFormId = null;
    uiState.playerFormErrors = {};
    uiState.playerFormDraft = null;
    render();
  },
  editPlayer(playerId) {
    uiState.activeView = 'players';
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
        uiState.playerFormId = null;
        uiState.playerFormErrors = {};
        uiState.playerFormDraft = null;
      }
      if (uiState.summaryPlayerId === playerId) {
        uiState.summaryPlayerId = '';
      }
      if (uiState.selectedPlayerId === playerId) {
        uiState.selectedPlayerId = '';
      }
      if (uiState.resultFormId) {
        const editingResult = dataState.tournamentResults.find((result) => result.id === uiState.resultFormId);
        if (editingResult?.playerId === playerId) {
          uiState.resultFormId = null;
        }
      }
      if (uiState.resultFormId && dataState.tournamentResults.every((result) => result.id !== uiState.resultFormId)) {
        uiState.resultFormId = null;
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
        persistAndRender('Turnauksen tiedot päivitettiin.');
      } else {
        const tournament = createTournament(values);
        dataState.tournaments = [...dataState.tournaments, tournament];
        uiState.tournamentDialogOpen = false;
        uiState.selectedTournamentId = tournament.id;
        uiState.tournamentFormFocusTarget = '';
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
    uiState.feedback = null;
    render();
  },
  closeTournamentDialog() {
    uiState.tournamentDialogOpen = false;
    uiState.tournamentFormId = null;
    uiState.tournamentFormErrors = {};
    uiState.tournamentFormDraft = null;
    uiState.tournamentFormFocusTarget = '';
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
    uiState.feedback = null;
    render();
  },
  deleteTournament(tournamentId) {
    const tournament = findTournament(dataState.tournaments, tournamentId);
    if (!tournament) {
      return;
    }

    const confirmed = window.confirm(`Poistetaanko turnaus ${tournament.name}? Samalla poistuvat turnauksen kaikki tulokset.`);
    if (!confirmed) {
      return;
    }

    dataState.tournaments = dataState.tournaments.filter((entry) => entry.id !== tournamentId);
    dataState.tournamentResults = dataState.tournamentResults.filter((result) => result.tournamentId !== tournamentId);
    if (uiState.tournamentFormId === tournamentId) {
      uiState.tournamentDialogOpen = false;
      uiState.tournamentFormId = null;
      uiState.tournamentFormErrors = {};
      uiState.tournamentFormDraft = null;
      uiState.tournamentFormFocusTarget = '';
    }
    if (uiState.selectedTournamentId === tournamentId) {
      uiState.selectedTournamentId = '';
    }
    persistAndRender('Turnaus poistettiin.');
  },
  selectTournament(tournamentId) {
    uiState.selectedTournamentId = tournamentId;
    uiState.resultFormId = null;
    uiState.feedback = null;
    render();
  },
  submitResult(formData) {
    try {
      const values = formDataToObject(formData);
      const selectedTournament = findTournament(dataState.tournaments, uiState.selectedTournamentId);
      const selectedPlayer = findPlayer(dataState.players, values.playerId);

      if (!selectedTournament) {
        throw new Error('Valitse turnaus ennen tuloksen tallentamista.');
      }

      if (!selectedPlayer) {
        throw new Error('Valitse pelaaja ennen tuloksen tallentamista.');
      }

      if (selectedTournament.division && selectedTournament.division !== selectedPlayer.division) {
        throw new Error('Valitun turnauksen sarjarajaus ei salli tämän pelaajan lisäämistä.');
      }

      if (values.id) {
        dataState.tournamentResults = dataState.tournamentResults.map((result) =>
          result.id === values.id
            ? updateTournamentResult({
                results: dataState.tournamentResults,
                resultId: values.id,
                tournamentId: selectedTournament.id,
                playerId: selectedPlayer.id,
                place: values.place,
                division: selectedPlayer.division,
                pointsTable: dataState.pointsTable,
                multiplier: selectedTournament.multiplier,
              })
            : result,
        );
        uiState.resultFormId = null;
        persistAndRender('Turnaustulos päivitettiin.');
      } else {
        const newResult = createTournamentResult({
          tournamentId: selectedTournament.id,
          playerId: selectedPlayer.id,
          place: values.place,
          division: selectedPlayer.division,
          pointsTable: dataState.pointsTable,
          multiplier: selectedTournament.multiplier,
          existingResults: dataState.tournamentResults,
        });
        dataState.tournamentResults = [...dataState.tournamentResults, newResult];
        persistAndRender('Turnaustulos lisättiin.');
      }
    } catch (error) {
      setError(error);
    }
  },
  resetResultForm() {
    uiState.resultFormId = null;
    render();
  },
  editResult(resultId) {
    uiState.resultFormId = resultId;
    uiState.feedback = null;
    render();
  },
  deleteResult(resultId) {
    const result = dataState.tournamentResults.find((entry) => entry.id === resultId);
    if (!result) {
      return;
    }

    const player = findPlayer(dataState.players, result.playerId);
    const confirmed = window.confirm(`Poistetaanko ${player?.name || 'pelaajan'} turnaustulos?`);
    if (!confirmed) {
      return;
    }

    dataState.tournamentResults = dataState.tournamentResults.filter((entry) => entry.id !== resultId);
    if (uiState.resultFormId === resultId) {
      uiState.resultFormId = null;
    }
    persistAndRender('Turnaustulos poistettiin.');
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
