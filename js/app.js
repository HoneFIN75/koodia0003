import { loadState, saveState } from './storage.js';
import { createPlayer, updatePlayer, findPlayer } from './players.js';
import { createTournament, updateTournament, findTournament } from './tournaments.js';
import {
  createTournamentResult,
  updateTournamentResult,
  upsertPointsTableEntry,
  removePointsTableEntry,
} from './scoring.js';
import { renderApp, bindUi } from './ui.js';

const root = document.querySelector('#app');

let dataState = loadState();
let uiState = {
  activeView: 'summary',
  navOpen: false,
  rankingFilter: 'ALL',
  summaryFilter: 'ALL',
  summaryPlayerId: '',
  playerFormId: null,
  tournamentFormId: null,
  selectedTournamentId: '',
  resultFormId: null,
  pointsForm: { division: 'MPO', place: '', basePoints: '', editingKey: '' },
  feedback: null,
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
  submitPlayer(formData) {
    try {
      const values = formDataToObject(formData);
      if (values.id) {
        dataState.players = dataState.players.map((player) =>
          player.id === values.id ? updatePlayer(dataState.players, values.id, values) : player,
        );
        uiState.playerFormId = null;
        persistAndRender('Pelaajan tiedot päivitettiin.');
      } else {
        const newPlayer = createPlayer(dataState.players, values);
        dataState.players = [...dataState.players, newPlayer];
        uiState.summaryPlayerId = newPlayer.id;
        persistAndRender('Pelaaja lisättiin.');
      }
    } catch (error) {
      setError(error);
    }
  },
  resetPlayerForm() {
    uiState.playerFormId = null;
    render();
  },
  editPlayer(playerId) {
    uiState.activeView = 'players';
    uiState.playerFormId = playerId;
    uiState.feedback = null;
    render();
  },
  deletePlayer(playerId) {
    const player = findPlayer(dataState.players, playerId);
    if (!player) {
      return;
    }

    const confirmed = window.confirm(`Poistetaanko pelaaja ${player.name}? Samalla poistuvat kaikki pelaajan turnaustulokset.`);
    if (!confirmed) {
      return;
    }

    dataState.players = dataState.players.filter((entry) => entry.id !== playerId);
    dataState.tournamentResults = dataState.tournamentResults.filter((result) => result.playerId !== playerId);
    if (uiState.playerFormId === playerId) {
      uiState.playerFormId = null;
    }
    if (uiState.summaryPlayerId === playerId) {
      uiState.summaryPlayerId = '';
    }
    if (uiState.resultFormId && dataState.tournamentResults.every((result) => result.id !== uiState.resultFormId)) {
      uiState.resultFormId = null;
    }
    persistAndRender('Pelaaja poistettiin.');
  },
  submitTournament(formData) {
    try {
      const values = formDataToObject(formData);
      if (values.id) {
        dataState.tournaments = dataState.tournaments.map((tournament) =>
          tournament.id === values.id ? updateTournament(dataState.tournaments, values.id, values) : tournament,
        );
        uiState.tournamentFormId = null;
        persistAndRender('Turnauksen tiedot päivitettiin.');
      } else {
        const tournament = createTournament(values);
        dataState.tournaments = [...dataState.tournaments, tournament];
        uiState.selectedTournamentId = tournament.id;
        persistAndRender('Turnaus lisättiin.');
      }
    } catch (error) {
      setError(error);
    }
  },
  resetTournamentForm() {
    uiState.tournamentFormId = null;
    render();
  },
  editTournament(tournamentId) {
    uiState.activeView = 'tournaments';
    uiState.tournamentFormId = tournamentId;
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
      uiState.tournamentFormId = null;
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

window.addEventListener('resize', () => {
  if (window.innerWidth > 780 && !uiState.navOpen) {
    render();
  }
});

render();
