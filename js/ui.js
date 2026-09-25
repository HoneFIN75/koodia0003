import { DIVISIONS } from './players.js';
import { MULTIPLIER_OPTIONS } from './tournaments.js';
import { listPointsTableEntries, getBasePoints } from './scoring.js';
import { buildRanking, getTopRanking, getPlayerResults } from './ranking.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(value) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('fi-FI', { dateStyle: 'medium' }).format(new Date(value));
}

function formatNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '—';
  }

  return new Intl.NumberFormat('fi-FI', {
    minimumFractionDigits: parsed % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(parsed);
}

function getMultiplierLabel(multiplier) {
  return (
    MULTIPLIER_OPTIONS.find((option) => option.key === multiplier || option.value === Number(multiplier))?.label ||
    `Multiplier ${multiplier}`
  );
}

function renderEmptyState(message) {
  return `<div class="message warning" role="status">${escapeHtml(message)}</div>`;
}

function renderPlayerOptions(players, selectedId = '', allowedDivision = 'ALL', existingResultPlayerIds = [], currentResultPlayerId = null) {
  const options = players
    .filter((player) => allowedDivision === 'ALL' || player.division === allowedDivision)
    .filter((player) => currentResultPlayerId === player.id || !existingResultPlayerIds.includes(player.id))
    .map(
      (player) =>
        `<option value="${escapeHtml(player.id)}" ${player.id === selectedId ? 'selected' : ''}>${escapeHtml(player.name)} (${player.division})</option>`,
    )
    .join('');

  return `<option value="">Valitse pelaaja</option>${options}`;
}

function renderMultiplierOptions(selectedValue) {
  return MULTIPLIER_OPTIONS.map(
    (option) =>
      `<option value="${option.key}" ${selectedValue === option.key ? 'selected' : ''}>${escapeHtml(option.label)} (${formatNumber(option.value)}x)</option>`,
  ).join('');
}

function renderNav(activeView) {
  const items = [
    { id: 'summary', label: 'Yhteenveto' },
    { id: 'ranking', label: 'Ranking' },
    { id: 'players', label: 'Pelaajat' },
    { id: 'tournaments', label: 'Turnaukset' },
    { id: 'points', label: 'Pistetaulukot' },
  ];

  return `
    <nav class="main-nav" id="main-nav" aria-label="Päänavigaatio">
      <ul>
        ${items
          .map(
            (item) => `
              <li>
                <button type="button" data-view-target="${item.id}" aria-current="${activeView === item.id ? 'page' : 'false'}">
                  ${escapeHtml(item.label)}
                </button>
              </li>
            `,
          )
          .join('')}
      </ul>
    </nav>
  `;
}

function renderStats(dataState) {
  const pointEntries = listPointsTableEntries(dataState.pointsTable).length;
  const scoredResults = dataState.tournamentResults.length;

  return `
    <div class="stats-grid">
      <article class="card stat-card">
        <span class="eyebrow">Pelaajat</span>
        <strong>${formatNumber(dataState.players.length)}</strong>
        <span class="section-subtitle">Tallennetut MPO- ja FPO-pelaajat</span>
      </article>
      <article class="card stat-card">
        <span class="eyebrow">Turnaukset</span>
        <strong>${formatNumber(dataState.tournaments.length)}</strong>
        <span class="section-subtitle">Hallinnoidut kilpailut ja multiplierit</span>
      </article>
      <article class="card stat-card">
        <span class="eyebrow">Tulokset</span>
        <strong>${formatNumber(scoredResults)}</strong>
        <span class="section-subtitle">Tallennetut sijoitukset snapshot-pisteillä</span>
      </article>
      <article class="card stat-card">
        <span class="eyebrow">Pistetaulukot</span>
        <strong>${formatNumber(pointEntries)}</strong>
        <span class="section-subtitle">MPO- ja FPO-sijoitukset, joille on syötetty pisteet</span>
      </article>
    </div>
  `;
}

function renderSummarySection(dataState, uiState) {
  const ranking = buildRanking(dataState.players, dataState.tournamentResults, uiState.summaryFilter);
  const topTen = getTopRanking(ranking, 10);
  const maxPoints = topTen[0]?.totalPoints || 0;
  const selectedPlayerId = uiState.summaryPlayerId || ranking[0]?.id || dataState.players[0]?.id || '';
  const selectedPlayer = dataState.players.find((player) => player.id === selectedPlayerId) || null;
  const selectedPlayerResults = selectedPlayer
    ? getPlayerResults({
        playerId: selectedPlayer.id,
        tournamentResults: dataState.tournamentResults,
        tournaments: dataState.tournaments,
      })
    : [];
  const selectedRankingEntry = ranking.find((player) => player.id === selectedPlayerId) || null;

  return `
    <section class="section" id="section-summary" ${uiState.activeView === 'summary' ? '' : 'hidden'} aria-labelledby="summary-title">
      <div class="hero">
        <article class="hero-card">
          <div class="eyebrow">Suomen frisbeegolfliiton työkalu</div>
          <h1 id="summary-title">SFL Pisteytystyökalu</h1>
          <p>
            Selainpohjainen MVP pelaajien, turnausten, pistetaulukoiden ja rankingin hallintaan. Kaikki tiedot
            tallennetaan tässä vaiheessa paikallisesti selaimen localStorageen.
          </p>
          <div class="badge-row">
            <span class="badge">Käyttöliittymä suomeksi</span>
            <span class="badge">Ei ulkoisia palveluita</span>
            <span class="badge">Valmius myöhempään API-vaiheeseen</span>
          </div>
        </article>
        <aside class="hero-side card" aria-label="Brändihuomiot">
          <div class="brand-copy">
            <span>Logo-paikkavaraus</span>
            <strong>Suomen frisbeegolfliitto</strong>
          </div>
          <p class="section-subtitle">
            Tämä MVP käyttää tekstimuotoista tunnistetta. Lopullinen SVG- tai PNG-logo sekä viralliset väriarvot tulee
            varmistaa erikseen.
          </p>
          <div class="hero-note">Automaattinen julkaisu on sallittu vain main-haaran pushista.</div>
        </aside>
      </div>
      ${renderStats(dataState)}
      <div class="two-column">
        <article class="card">
          <div class="section-heading">
            <div>
              <h3>Top 10 -pistevisualisointi</h3>
              <p class="section-subtitle">Päivittyy sarjasuodatuksen mukaan ilman ulkoisia kirjastoja.</p>
            </div>
            <div class="filter-row" role="group" aria-label="Yhteenvedon sarjasuodatus">
              ${['ALL', ...DIVISIONS]
                .map(
                  (filter) => `
                    <button
                      type="button"
                      class="secondary-button"
                      data-summary-filter="${filter}"
                      aria-pressed="${uiState.summaryFilter === filter}"
                    >
                      ${filter === 'ALL' ? 'Kaikki' : filter}
                    </button>
                  `,
                )
                .join('')}
            </div>
          </div>
          ${
            topTen.length
              ? `<div class="chart" role="img" aria-label="Top 10 pelaajat kokonaispisteiden perusteella">
                  ${topTen
                    .map((entry) => {
                      const width = maxPoints > 0 ? (entry.totalPoints / maxPoints) * 100 : 0;
                      return `
                        <div class="chart-row">
                          <div class="chart-meta">
                            <strong>${escapeHtml(entry.name)}</strong>
                            <span>${formatNumber(entry.totalPoints)} p</span>
                          </div>
                          <div class="chart-bar-track"><div class="chart-bar" style="width: ${width}%"></div></div>
                        </div>
                      `;
                    })
                    .join('')}
                </div>`
              : renderEmptyState('Top 10 -näkymä täyttyy, kun pelaajille lisätään pisteellisiä turnaustuloksia.')
          }
        </article>
        <article class="card">
          <div class="section-heading">
            <div>
              <h3>Pelaajan perustiedot</h3>
              <p class="section-subtitle">Valitse pelaaja nähdäksesi kortin ja turnaustulokset.</p>
            </div>
          </div>
          <div class="form-field">
            <label for="summary-player-select">Valittu pelaaja</label>
            <select id="summary-player-select" data-summary-player>
              <option value="">Valitse pelaaja</option>
              ${dataState.players
                .map(
                  (player) =>
                    `<option value="${escapeHtml(player.id)}" ${player.id === selectedPlayerId ? 'selected' : ''}>${escapeHtml(player.name)} (${player.division})</option>`,
                )
                .join('')}
            </select>
          </div>
          ${
            selectedPlayer
              ? `
                <dl class="definition-list">
                  <div><dt>Nimi</dt><dd>${escapeHtml(selectedPlayer.name)}</dd></div>
                  <div><dt>Sarja</dt><dd>${escapeHtml(selectedPlayer.division)}</dd></div>
                  <div><dt>PDGA-rating</dt><dd>${escapeHtml(selectedPlayer.pdgaRating || '—')}</dd></div>
                  <div><dt>Maailmanrankingsijoitus</dt><dd>${escapeHtml(selectedPlayer.worldRank || '—')}</dd></div>
                  <div><dt>Maa</dt><dd>${escapeHtml(selectedPlayer.country || '—')}</dd></div>
                  <div><dt>Turnauksia</dt><dd>${formatNumber(selectedRankingEntry?.tournamentCount || 0)}</dd></div>
                  <div><dt>Kokonaispisteet</dt><dd>${formatNumber(selectedRankingEntry?.totalPoints || 0)} p</dd></div>
                  <div><dt>PDGA-profiili</dt><dd>${
                    selectedPlayer.pdgaProfileUrl
                      ? `<a href="${escapeHtml(selectedPlayer.pdgaProfileUrl)}" target="_blank" rel="noreferrer">Avaa profiili</a>`
                      : '—'
                  }</dd></div>
                </dl>
              `
              : renderEmptyState('Lisää ensin pelaajia, jotta perustietokortti voidaan näyttää.')
          }
        </article>
      </div>
      <article class="card">
        <div class="section-heading">
          <div>
            <h3>Valitun pelaajan turnaustulokset</h3>
            <p class="section-subtitle">Snapshot-pisteet säilyvät, vaikka pistetaulukkoa muokattaisiin myöhemmin.</p>
          </div>
        </div>
        ${
          selectedPlayerResults.length
            ? `
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Turnaus</th>
                      <th>Sijoitus</th>
                      <th>1x-pisteet</th>
                      <th>Multiplier</th>
                      <th>Kokonaispisteet</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${selectedPlayerResults
                      .map(
                        (result) => `
                          <tr>
                            <td>${escapeHtml(result.tournament?.name || 'Poistettu turnaus')}<br /><span class="muted">${formatDate(result.tournament?.startDate)}</span></td>
                            <td>${formatNumber(result.place)}</td>
                            <td>${formatNumber(result.basePointsSnapshot)}</td>
                            <td>${formatNumber(result.multiplierSnapshot)}x</td>
                            <td>${formatNumber(result.calculatedPoints)} p</td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
            : renderEmptyState('Valitulle pelaajalle ei ole vielä tallennettu turnaustuloksia.')
        }
      </article>
    </section>
  `;
}

function renderRankingSection(dataState, uiState) {
  const ranking = buildRanking(dataState.players, dataState.tournamentResults, uiState.rankingFilter);

  return `
    <section class="section" id="section-ranking" ${uiState.activeView === 'ranking' ? '' : 'hidden'} aria-labelledby="ranking-title">
      <div class="section-heading">
        <div>
          <h2 id="ranking-title">Ranking</h2>
          <p class="section-subtitle">Kokonaispisteet lasketaan kaikista pelaajan turnaustuloksista.</p>
        </div>
        <div class="filter-row" role="group" aria-label="Ranking-suodatus">
          ${['ALL', ...DIVISIONS]
            .map(
              (filter) => `
                <button type="button" class="secondary-button" data-ranking-filter="${filter}" aria-pressed="${uiState.rankingFilter === filter}">
                  ${filter === 'ALL' ? 'Kaikki' : filter}
                </button>
              `,
            )
            .join('')}
        </div>
      </div>
      <article class="card">
        ${
          ranking.length
            ? `
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Pelaaja</th>
                      <th>Sarja</th>
                      <th>PDGA-rating</th>
                      <th>World rank</th>
                      <th>Turnauksia</th>
                      <th class="number">Kokonaispisteet</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${ranking
                      .map(
                        (entry, index) => `
                          <tr>
                            <td>${index + 1}</td>
                            <td>${escapeHtml(entry.name)}</td>
                            <td>${escapeHtml(entry.division)}</td>
                            <td>${escapeHtml(entry.pdgaRating || '—')}</td>
                            <td>${escapeHtml(entry.worldRank || '—')}</td>
                            <td>${formatNumber(entry.tournamentCount)}</td>
                            <td class="number">${formatNumber(entry.totalPoints)} p</td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
            : renderEmptyState('Ranking muodostuu, kun lisäät vähintään yhden pelaajan.')
        }
      </article>
    </section>
  `;
}

function renderPlayerSection(dataState, uiState) {
  const editingPlayer = dataState.players.find((player) => player.id === uiState.playerFormId) || null;

  return `
    <section class="section" id="section-players" ${uiState.activeView === 'players' ? '' : 'hidden'} aria-labelledby="players-title">
      <div class="section-heading">
        <div>
          <h2 id="players-title">Pelaajat</h2>
          <p class="section-subtitle">Pakolliset kentät ovat nimi ja sarja. Poisto pyytää vahvistuksen.</p>
        </div>
      </div>
      <div class="two-column">
        <article class="panel">
          <h3>${editingPlayer ? 'Muokkaa pelaajaa' : 'Lisää pelaaja'}</h3>
          <form id="player-form">
            <input type="hidden" name="id" value="${escapeHtml(editingPlayer?.id || '')}" />
            <div class="form-grid">
              <div class="form-field">
                <label for="player-name">Nimi *</label>
                <input id="player-name" name="name" required value="${escapeHtml(editingPlayer?.name || '')}" />
              </div>
              <div class="form-field">
                <label for="player-division">Sarja *</label>
                <select id="player-division" name="division" required>
                  <option value="">Valitse sarja</option>
                  ${DIVISIONS.map(
                    (division) => `<option value="${division}" ${editingPlayer?.division === division ? 'selected' : ''}>${division}</option>`,
                  ).join('')}
                </select>
              </div>
              <div class="form-field"><label for="player-pdga-number">PDGA-numero</label><input id="player-pdga-number" name="pdgaNumber" inputmode="numeric" value="${escapeHtml(editingPlayer?.pdgaNumber || '')}" /></div>
              <div class="form-field"><label for="player-pdga-rating">PDGA-rating</label><input id="player-pdga-rating" name="pdgaRating" inputmode="numeric" value="${escapeHtml(editingPlayer?.pdgaRating || '')}" /></div>
              <div class="form-field"><label for="player-world-rank">Maailmanrankingsijoitus</label><input id="player-world-rank" name="worldRank" inputmode="numeric" value="${escapeHtml(editingPlayer?.worldRank || '')}" /></div>
              <div class="form-field"><label for="player-country">Maa</label><input id="player-country" name="country" value="${escapeHtml(editingPlayer?.country || '')}" /></div>
              <div class="form-field"><label for="player-birth-year">Syntymävuosi</label><input id="player-birth-year" name="birthYear" inputmode="numeric" value="${escapeHtml(editingPlayer?.birthYear || '')}" /></div>
              <div class="form-field"><label for="player-profile-url">PDGA-profiilin URL</label><input id="player-profile-url" name="pdgaProfileUrl" type="url" value="${escapeHtml(editingPlayer?.pdgaProfileUrl || '')}" /></div>
              <div class="form-field full-width"><label for="player-notes">Muistiinpano</label><textarea id="player-notes" name="notes">${escapeHtml(editingPlayer?.notes || '')}</textarea></div>
            </div>
            <div class="form-actions">
              <button type="submit" class="button">${editingPlayer ? 'Tallenna muutokset' : 'Lisää pelaaja'}</button>
              <button type="button" class="secondary-button" data-reset-player-form>Tyhjennä lomake</button>
            </div>
          </form>
        </article>
        <article class="panel">
          <h3>Pelaajalista</h3>
          ${
            dataState.players.length
              ? `
                <div class="table-wrap">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>Nimi</th>
                        <th>Sarja</th>
                        <th>PDGA</th>
                        <th>Rating</th>
                        <th>Toiminnot</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${dataState.players
                        .slice()
                        .sort((left, right) => left.name.localeCompare(right.name, 'fi'))
                        .map(
                          (player) => `
                            <tr>
                              <td>${escapeHtml(player.name)}</td>
                              <td>${escapeHtml(player.division)}</td>
                              <td>${escapeHtml(player.pdgaNumber || '—')}</td>
                              <td>${escapeHtml(player.pdgaRating || '—')}</td>
                              <td>
                                <div class="table-actions">
                                  <button type="button" class="secondary-button" data-edit-player="${escapeHtml(player.id)}">Muokkaa</button>
                                  <button type="button" class="danger-button" data-delete-player="${escapeHtml(player.id)}">Poista</button>
                                </div>
                              </td>
                            </tr>
                          `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
              : renderEmptyState('Pelaajia ei ole vielä lisätty.')
          }
        </article>
      </div>
    </section>
  `;
}

function renderTournamentSection(dataState, uiState) {
  const editingTournament = dataState.tournaments.find((tournament) => tournament.id === uiState.tournamentFormId) || null;
  const selectedTournament = dataState.tournaments.find((tournament) => tournament.id === uiState.selectedTournamentId) || null;
  const editingResult = dataState.tournamentResults.find((result) => result.id === uiState.resultFormId) || null;
  const tournamentResults = selectedTournament
    ? dataState.tournamentResults.filter((result) => result.tournamentId === selectedTournament.id)
    : [];
  const allowedDivision = selectedTournament?.division || 'ALL';
  const existingResultPlayerIds = tournamentResults.map((result) => result.playerId);
  const selectedPlayer = editingResult
    ? dataState.players.find((player) => player.id === editingResult.playerId) || null
    : null;
  const resultPreviewBasePoints = selectedTournament && selectedPlayer
    ? getBasePoints(dataState.pointsTable, selectedPlayer.division, editingResult?.place || 1)
    : null;

  return `
    <section class="section" id="section-tournaments" ${uiState.activeView === 'tournaments' ? '' : 'hidden'} aria-labelledby="tournaments-title">
      <div class="section-heading">
        <div>
          <h2 id="tournaments-title">Turnaukset</h2>
          <p class="section-subtitle">Multiplier määrittää, kuinka paljon 1x-pisteet kasvavat turnauksessa.</p>
        </div>
      </div>
      <div class="two-column">
        <article class="panel">
          <h3>${editingTournament ? 'Muokkaa turnausta' : 'Lisää turnaus'}</h3>
          <form id="tournament-form">
            <input type="hidden" name="id" value="${escapeHtml(editingTournament?.id || '')}" />
            <div class="form-grid">
              <div class="form-field"><label for="tournament-name">Nimi *</label><input id="tournament-name" name="name" required value="${escapeHtml(editingTournament?.name || '')}" /></div>
              <div class="form-field"><label for="tournament-multiplier">Multiplier *</label><select id="tournament-multiplier" name="multiplierKey" required><option value="">Valitse multiplier</option>${renderMultiplierOptions(editingTournament?.multiplierKey || '')}</select></div>
              <div class="form-field"><label for="tournament-start-date">Alkamispäivä *</label><input id="tournament-start-date" name="startDate" type="date" required value="${escapeHtml(editingTournament?.startDate || '')}" /></div>
              <div class="form-field"><label for="tournament-end-date">Päättymispäivä</label><input id="tournament-end-date" name="endDate" type="date" value="${escapeHtml(editingTournament?.endDate || '')}" /></div>
              <div class="form-field"><label for="tournament-division">Sarjarajaus</label><select id="tournament-division" name="division"><option value="">Ei rajattu</option>${DIVISIONS.map((division) => `<option value="${division}" ${editingTournament?.division === division ? 'selected' : ''}>${division}</option>`).join('')}</select><span class="form-help">Tulosten pelaajavalinta rajataan tähän sarjaan, jos arvo on annettu.</span></div>
              <div class="form-field"><label for="tournament-pdga-event-id">PDGA-kilpailutunnus</label><input id="tournament-pdga-event-id" name="pdgaEventId" value="${escapeHtml(editingTournament?.pdgaEventId || '')}" /></div>
              <div class="form-field"><label for="tournament-location">Sijainti</label><input id="tournament-location" name="location" value="${escapeHtml(editingTournament?.location || '')}" /></div>
              <div class="form-field"><label for="tournament-country">Maa</label><input id="tournament-country" name="country" value="${escapeHtml(editingTournament?.country || '')}" /></div>
              <div class="form-field"><label for="tournament-status">Status</label><input id="tournament-status" name="status" value="${escapeHtml(editingTournament?.status || '')}" /></div>
              <div class="form-field"><label for="tournament-external-url">Ulkoinen URL</label><input id="tournament-external-url" name="externalUrl" type="url" value="${escapeHtml(editingTournament?.externalUrl || '')}" /></div>
              <div class="form-field full-width"><label for="tournament-notes">Muistiinpano</label><textarea id="tournament-notes" name="notes">${escapeHtml(editingTournament?.notes || '')}</textarea></div>
            </div>
            <div class="form-actions">
              <button type="submit" class="button">${editingTournament ? 'Tallenna muutokset' : 'Lisää turnaus'}</button>
              <button type="button" class="secondary-button" data-reset-tournament-form>Tyhjennä lomake</button>
            </div>
          </form>
        </article>
        <article class="panel">
          <h3>Turnauslista</h3>
          ${
            dataState.tournaments.length
              ? `
                <div class="table-wrap">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>Nimi</th>
                        <th>Päivä</th>
                        <th>Multiplier</th>
                        <th>Tulokset</th>
                        <th>Toiminnot</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${dataState.tournaments
                        .slice()
                        .sort((left, right) => right.startDate.localeCompare(left.startDate))
                        .map((tournament) => {
                          const resultCount = dataState.tournamentResults.filter((result) => result.tournamentId === tournament.id).length;
                          return `
                            <tr>
                              <td>${escapeHtml(tournament.name)}<br /><span class="muted">${escapeHtml(tournament.division || 'MPO/FPO')}</span></td>
                              <td>${formatDate(tournament.startDate)}</td>
                              <td>${formatNumber(tournament.multiplier)}x</td>
                              <td>${formatNumber(resultCount)}</td>
                              <td>
                                <div class="table-actions">
                                  <button type="button" class="secondary-button" data-select-tournament="${escapeHtml(tournament.id)}">Tulokset</button>
                                  <button type="button" class="secondary-button" data-edit-tournament="${escapeHtml(tournament.id)}">Muokkaa</button>
                                  <button type="button" class="danger-button" data-delete-tournament="${escapeHtml(tournament.id)}">Poista</button>
                                </div>
                              </td>
                            </tr>
                          `;
                        })
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
              : renderEmptyState('Turnauksia ei ole vielä lisätty.')
          }
        </article>
      </div>
      <article class="panel">
        <div class="section-heading">
          <div>
            <h3>Turnaustulokset</h3>
            <p class="section-subtitle">Valitse turnaus, lisää sijoituksia ja laske pisteet keskitetystä pistetaulukosta.</p>
          </div>
        </div>
        <div class="form-field">
          <label for="selected-tournament">Hallittava turnaus</label>
          <select id="selected-tournament" data-selected-tournament>
            <option value="">Valitse turnaus</option>
            ${dataState.tournaments
              .map(
                (tournament) =>
                  `<option value="${escapeHtml(tournament.id)}" ${tournament.id === selectedTournament?.id ? 'selected' : ''}>${escapeHtml(tournament.name)} (${formatDate(tournament.startDate)})</option>`,
              )
              .join('')}
          </select>
        </div>
        ${
          selectedTournament
            ? `
              <div class="three-column">
                <div class="card stat-card"><span class="eyebrow">Turnaus</span><strong>${escapeHtml(selectedTournament.name)}</strong><span class="section-subtitle">${formatDate(selectedTournament.startDate)}${selectedTournament.endDate ? ` – ${formatDate(selectedTournament.endDate)}` : ''}</span></div>
                <div class="card stat-card"><span class="eyebrow">Multiplier</span><strong>${formatNumber(selectedTournament.multiplier)}x</strong><span class="section-subtitle">${escapeHtml(getMultiplierLabel(selectedTournament.multiplierKey || selectedTournament.multiplier))}</span></div>
                <div class="card stat-card"><span class="eyebrow">Sarjarajaus</span><strong>${escapeHtml(selectedTournament.division || 'Ei rajattu')}</strong><span class="section-subtitle">Tuloksiin voi valita vain sallitun sarjan pelaajia.</span></div>
              </div>
              <div class="two-column">
                <form id="result-form" class="panel">
                  <h4>${editingResult ? 'Muokkaa turnaustulosta' : 'Lisää turnaustulos'}</h4>
                  <input type="hidden" name="id" value="${escapeHtml(editingResult?.id || '')}" />
                  <div class="form-grid">
                    <div class="form-field full-width">
                      <label for="result-player-id">Pelaaja *</label>
                      <select id="result-player-id" name="playerId" required>
                        ${renderPlayerOptions(dataState.players, editingResult?.playerId || '', allowedDivision, existingResultPlayerIds, editingResult?.playerId || null)}
                      </select>
                    </div>
                    <div class="form-field">
                      <label for="result-place">Sijoitus *</label>
                      <input id="result-place" name="place" required inputmode="numeric" min="1" value="${escapeHtml(editingResult?.place || '')}" />
                    </div>
                    <div class="form-field">
                      <label>Laskentasääntö</label>
                      <div class="message">1x-pisteet × ${formatNumber(selectedTournament.multiplier)} = turnauspisteet</div>
                    </div>
                  </div>
                  <div class="form-actions">
                    <button type="submit" class="button">${editingResult ? 'Tallenna tulos' : 'Lisää tulos'}</button>
                    <button type="button" class="secondary-button" data-reset-result-form>Tyhjennä lomake</button>
                  </div>
                  <p class="form-help">${resultPreviewBasePoints !== null ? `Esimerkkiperuspiste: ${formatNumber(resultPreviewBasePoints)}.` : 'Lisää sarjan pistetaulukko ennen tulosten tallentamista.'}</p>
                </form>
                <div class="panel">
                  <h4>Nykyiset turnaustulokset</h4>
                  ${
                    tournamentResults.length
                      ? `
                        <div class="table-wrap">
                          <table class="table">
                            <thead>
                              <tr>
                                <th>Pelaaja</th>
                                <th>Sijoitus</th>
                                <th>1x-pisteet</th>
                                <th>Multiplier</th>
                                <th>Kokonaispisteet</th>
                                <th>Toiminnot</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${tournamentResults
                                .slice()
                                .sort((left, right) => left.place - right.place)
                                .map((result) => {
                                  const player = dataState.players.find((entry) => entry.id === result.playerId);
                                  return `
                                    <tr>
                                      <td>${escapeHtml(player?.name || 'Poistettu pelaaja')}<br /><span class="muted">${escapeHtml(player?.division || '—')}</span></td>
                                      <td>${formatNumber(result.place)}</td>
                                      <td>${formatNumber(result.basePointsSnapshot)}</td>
                                      <td>${formatNumber(result.multiplierSnapshot)}x</td>
                                      <td>${formatNumber(result.calculatedPoints)} p</td>
                                      <td>
                                        <div class="table-actions">
                                          <button type="button" class="secondary-button" data-edit-result="${escapeHtml(result.id)}">Muokkaa</button>
                                          <button type="button" class="danger-button" data-delete-result="${escapeHtml(result.id)}">Poista</button>
                                        </div>
                                      </td>
                                    </tr>
                                  `;
                                })
                                .join('')}
                            </tbody>
                          </table>
                        </div>
                      `
                      : renderEmptyState('Valitulle turnaukselle ei ole vielä tallennettu tuloksia.')
                  }
                </div>
              </div>
            `
            : renderEmptyState('Valitse ensin turnaus, jotta voit hallita turnaustuloksia.')
        }
      </article>
    </section>
  `;
}

function renderPointsSection(dataState, uiState) {
  const editingPoint = uiState.pointsForm || { division: 'MPO', place: '', basePoints: '', editingKey: '' };
  const mpoEntries = listPointsTableEntries(dataState.pointsTable, 'MPO');
  const fpoEntries = listPointsTableEntries(dataState.pointsTable, 'FPO');

  return `
    <section class="section" id="section-points" ${uiState.activeView === 'points' ? '' : 'hidden'} aria-labelledby="points-title">
      <div class="section-heading">
        <div>
          <h2 id="points-title">Pistetaulukot</h2>
          <p class="section-subtitle">Pisteet tallennetaan keskitettyyn pointsTable-rakenteeseen sarjan ja sijoituksen perusteella.</p>
        </div>
      </div>
      <article class="message warning">
        Pistetaulukot on alustettu tyhjiksi. Pisteitä ei oleteta eikä kovakoodata käyttöliittymään.
      </article>
      <div class="two-column">
        <form id="points-form" class="panel">
          <h3>${editingPoint.editingKey ? 'Muokkaa pistetaulukon riviä' : 'Lisää pistetaulukon rivi'}</h3>
          <input type="hidden" name="editingKey" value="${escapeHtml(editingPoint.editingKey || '')}" />
          <div class="form-grid">
            <div class="form-field">
              <label for="points-division">Sarja *</label>
              <select id="points-division" name="division" required>
                ${DIVISIONS.map(
                  (division) => `<option value="${division}" ${editingPoint.division === division ? 'selected' : ''}>${division}</option>`,
                ).join('')}
              </select>
            </div>
            <div class="form-field">
              <label for="points-place">Sijoitus *</label>
              <input id="points-place" name="place" required inputmode="numeric" min="1" value="${escapeHtml(editingPoint.place || '')}" />
            </div>
            <div class="form-field full-width">
              <label for="points-base-points">1x-peruspisteet *</label>
              <input id="points-base-points" name="basePoints" required inputmode="decimal" min="0" step="0.1" value="${escapeHtml(editingPoint.basePoints || '')}" />
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="button">${editingPoint.editingKey ? 'Tallenna rivi' : 'Lisää rivi'}</button>
            <button type="button" class="secondary-button" data-reset-points-form>Tyhjennä lomake</button>
          </div>
        </form>
        <div class="panel">
          <h3>Miksi keskitetty pistetaulukko?</h3>
          <ul>
            <li>UI-komponentit eivät sisällä kovakoodattuja pistearvoja.</li>
            <li>Tulokselle tallennetaan käytetyt snapshotit, jotta historiallinen laskenta säilyy.</li>
            <li>Pistetaulukon voi myöhemmin korvata API- tai tietokantaratkaisulla.</li>
          </ul>
        </div>
      </div>
      <div class="two-column">
        ${['MPO', 'FPO']
          .map((division) => {
            const entries = division === 'MPO' ? mpoEntries : fpoEntries;
            return `
              <article class="panel">
                <h3>${division}-pistetaulukko</h3>
                ${
                  entries.length
                    ? `
                      <div class="table-wrap">
                        <table class="table">
                          <thead>
                            <tr>
                              <th>Sijoitus</th>
                              <th>1x-peruspisteet</th>
                              <th>Toiminnot</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${entries
                              .map(
                                (entry) => `
                                  <tr>
                                    <td>${formatNumber(entry.place)}</td>
                                    <td>${formatNumber(entry.basePoints)}</td>
                                    <td>
                                      <div class="table-actions">
                                        <button type="button" class="secondary-button" data-edit-point="${division}:${entry.place}">Muokkaa</button>
                                        <button type="button" class="danger-button" data-delete-point="${division}:${entry.place}">Poista</button>
                                      </div>
                                    </td>
                                  </tr>
                                `,
                              )
                              .join('')}
                          </tbody>
                        </table>
                      </div>
                    `
                    : renderEmptyState(`${division}-sarjalle ei ole vielä lisätty pistetaulukon rivejä.`)
                }
              </article>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
}

export function renderApp(root, dataState, uiState) {
  root.innerHTML = `
    <div class="app-shell">
      <header class="site-header">
        <div class="header-inner">
          <div class="brand" aria-label="Sovelluksen tunniste">
            <div class="brand-mark" aria-hidden="true">SFL</div>
            <div class="brand-copy">
              <span>Suomen frisbeegolfliitto</span>
              <strong>SFL Pisteytystyökalu</strong>
            </div>
          </div>
          <button class="nav-toggle" type="button" data-toggle-nav aria-expanded="${uiState.navOpen}" aria-controls="main-nav">Valikko</button>
          ${renderNav(uiState.activeView)}
        </div>
      </header>
      <main id="main-content" class="main-inner" tabindex="-1">
        ${uiState.feedback ? `<div class="message ${uiState.feedback.type}" role="status">${escapeHtml(uiState.feedback.text)}</div>` : ''}
        ${renderSummarySection(dataState, uiState)}
        ${renderRankingSection(dataState, uiState)}
        ${renderPlayerSection(dataState, uiState)}
        ${renderTournamentSection(dataState, uiState)}
        ${renderPointsSection(dataState, uiState)}
      </main>
      <footer class="site-footer">
        <div class="site-footer-inner">
          <div>SFL Pisteytystyökalu on MVP-versio. Tiedot tallennetaan selaimen localStorageen eikä niitä synkronoida käyttäjien välillä.</div>
          <div>Lopullinen brändivahvistus, logoaineisto ja mahdollinen backend-tietokanta toteutetaan myöhemmässä vaiheessa.</div>
        </div>
      </footer>
    </div>
  `;

  const navElement = root.querySelector('#main-nav');
  if (navElement && window.innerWidth <= 780) {
    navElement.hidden = !uiState.navOpen;
  }
}

export function bindUi(root, dataState, uiState, handlers) {
  root.querySelector('[data-toggle-nav]')?.addEventListener('click', () => handlers.toggleNav());

  root.querySelectorAll('[data-view-target]').forEach((button) => {
    button.addEventListener('click', () => handlers.changeView(button.dataset.viewTarget));
  });

  root.querySelectorAll('[data-ranking-filter]').forEach((button) => {
    button.addEventListener('click', () => handlers.setRankingFilter(button.dataset.rankingFilter));
  });

  root.querySelectorAll('[data-summary-filter]').forEach((button) => {
    button.addEventListener('click', () => handlers.setSummaryFilter(button.dataset.summaryFilter));
  });

  root.querySelector('[data-summary-player]')?.addEventListener('change', (event) => {
    handlers.setSummaryPlayer(event.target.value);
  });

  root.querySelector('#player-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submitPlayer(new FormData(event.currentTarget));
  });

  root.querySelector('[data-reset-player-form]')?.addEventListener('click', () => handlers.resetPlayerForm());

  root.querySelectorAll('[data-edit-player]').forEach((button) => {
    button.addEventListener('click', () => handlers.editPlayer(button.dataset.editPlayer));
  });

  root.querySelectorAll('[data-delete-player]').forEach((button) => {
    button.addEventListener('click', () => handlers.deletePlayer(button.dataset.deletePlayer));
  });

  root.querySelector('#tournament-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submitTournament(new FormData(event.currentTarget));
  });

  root.querySelector('[data-reset-tournament-form]')?.addEventListener('click', () => handlers.resetTournamentForm());

  root.querySelectorAll('[data-edit-tournament]').forEach((button) => {
    button.addEventListener('click', () => handlers.editTournament(button.dataset.editTournament));
  });

  root.querySelectorAll('[data-delete-tournament]').forEach((button) => {
    button.addEventListener('click', () => handlers.deleteTournament(button.dataset.deleteTournament));
  });

  root.querySelectorAll('[data-select-tournament]').forEach((button) => {
    button.addEventListener('click', () => handlers.selectTournament(button.dataset.selectTournament));
  });

  root.querySelector('[data-selected-tournament]')?.addEventListener('change', (event) => {
    handlers.selectTournament(event.target.value);
  });

  root.querySelector('#result-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submitResult(new FormData(event.currentTarget));
  });

  root.querySelector('[data-reset-result-form]')?.addEventListener('click', () => handlers.resetResultForm());

  root.querySelectorAll('[data-edit-result]').forEach((button) => {
    button.addEventListener('click', () => handlers.editResult(button.dataset.editResult));
  });

  root.querySelectorAll('[data-delete-result]').forEach((button) => {
    button.addEventListener('click', () => handlers.deleteResult(button.dataset.deleteResult));
  });

  root.querySelector('#points-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submitPoints(new FormData(event.currentTarget));
  });

  root.querySelector('[data-reset-points-form]')?.addEventListener('click', () => handlers.resetPointsForm());

  root.querySelectorAll('[data-edit-point]').forEach((button) => {
    button.addEventListener('click', () => handlers.editPoint(button.dataset.editPoint));
  });

  root.querySelectorAll('[data-delete-point]').forEach((button) => {
    button.addEventListener('click', () => handlers.deletePoint(button.dataset.deletePoint));
  });
}
