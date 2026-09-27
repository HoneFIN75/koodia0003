import { DIVISIONS, getVisiblePlayers } from './players.js';
import { DEFAULT_TOURNAMENT_DISPLAY_ORDER, sortTournaments, filterAndSortTournaments } from './tournaments.js';
import { buildPdgaEventUrl, buildPdgaPlayerUrl, DEFAULT_PDGA_SETTINGS } from './pdga.js';
import { listPointsTableEntries } from './scoring.js';
import { buildRanking, getTopRanking } from './ranking.js';
import { findMultiplier, formatMultiplier, sortMultipliers } from './multipliers.js';
import { sortTableRows } from './table-sorting.js';

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
    minimumFractionDigits: 0,
    maximumFractionDigits: 20,
  }).format(parsed);
}

function formatDeploymentTimestamp(value) {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return escapeHtml(value);
  }

  const formatterOptions = {
    timeZone: 'Europe/Helsinki',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  };
  const formatter = new Intl.DateTimeFormat('fi-FI', formatterOptions);

  if (typeof formatter.formatToParts === 'function') {
    const parts = formatter.formatToParts(parsedDate);
    const partMap = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
    return `${partMap.day}.${partMap.month}.${partMap.year} ${partMap.hour}:${partMap.minute}`;
  }

  const date = new Intl.DateTimeFormat('fi-FI', {
    timeZone: 'Europe/Helsinki',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsedDate);
  const time = new Intl.DateTimeFormat('fi-FI', {
    timeZone: 'Europe/Helsinki',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(parsedDate)
    .replace(/^(\d{2})\.(\d{2})$/, '$1:$2');
  return `${date} ${time}`;
}

function renderDeploymentInfo(deploymentInfo) {
  const versionIdentifier = deploymentInfo?.version || '';
  const buildIdentifier = deploymentInfo?.commit || versionIdentifier;
  if (!buildIdentifier || !deploymentInfo?.deployedAt) {
    return '';
  }

  return `
    <dl class="deployment-meta" aria-label="Julkaisun versiotiedot">
      ${versionIdentifier ? `<div><dt>Versio:</dt><dd>${escapeHtml(versionIdentifier)}</dd></div>` : ''}
      <div><dt>Koonti:</dt><dd>${escapeHtml(buildIdentifier)}</dd></div>
      <div><dt>Päivitetty:</dt><dd>${formatDeploymentTimestamp(deploymentInfo.deployedAt)}</dd></div>
    </dl>
  `;
}

function renderEmptyState(message) {
  return `<div class="message warning" role="status">${escapeHtml(message)}</div>`;
}

function renderValueOrDash(value) {
  return value === '' || value === null || value === undefined ? '—' : String(value);
}

function renderFieldError(fieldErrors, fieldName) {
  const message = fieldErrors?.[fieldName];
  if (!message) {
    return '';
  }

  return `<span class="field-error" id="${escapeHtml(fieldName)}-error" role="alert">${escapeHtml(message)}</span>`;
}

function getFieldAttributes(fieldErrors, fieldName) {
  if (!fieldErrors?.[fieldName]) {
    return '';
  }

  return `aria-invalid="true" aria-describedby="${escapeHtml(fieldName)}-error"`;
}

function getTournamentFormValue(formValues, editingTournament, fieldName, fallback = '') {
  if (Object.hasOwn(formValues, fieldName)) {
    return formValues[fieldName];
  }

  return editingTournament?.[fieldName] ?? fallback;
}

function getTournamentFieldSelector(fieldName) {
  const fieldSelectors = {
    name: '#tournament-name',
    startDate: '#tournament-start-date',
    endDate: '#tournament-end-date',
    displayOrder: '#tournament-display-order',
    location: '#tournament-location',
    venue: '#tournament-venue',
    multiplierId: '#tournament-multiplier-id',
    division: '#tournament-division',
    externalUrl: '#tournament-external-url',
    pdgaEventId: '#tournament-pdga-event-id',
    notes: '#tournament-notes',
  };

  return fieldSelectors[fieldName] || '#tournament-name';
}

function getMultiplierFieldSelector(fieldName) {
  const selectors = {
    orderNumber: '#multiplier-order-number',
    name: '#multiplier-name',
    abbreviation: '#multiplier-abbreviation',
    multiplier: '#multiplier-value',
  };

  return selectors[fieldName] || '#multiplier-order-number';
}

function getPointsImportFieldSelector(fieldName) {
  return fieldName === 'file' ? '#points-import-file' : '[data-points-import-dialog-panel]';
}

function getTournamentImportFieldSelector(fieldName) {
  return fieldName === 'file' ? '#tournament-import-file' : '[data-tournament-import-dialog-panel]';
}

function getFocusableElements(container) {
  if (!container) {
    return [];
  }

  return [...container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
    (element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true',
  );
}

function trapFocusInDialog(event, dialogPanel) {
  if (event.key !== 'Tab') {
    return;
  }

  const focusableElements = getFocusableElements(dialogPanel);
  if (!focusableElements.length) {
    event.preventDefault();
    dialogPanel?.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function renderLinkButton(url, label, ariaLabel = '') {
  if (!url) {
    return '—';
  }

  return `<a class="secondary-link-button" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"${ariaLabel ? ` aria-label="${escapeHtml(ariaLabel)}"` : ''}>${escapeHtml(label)}</a>`;
}

function getAriaSort(sortField, sortDirection, fieldName) {
  return getSortState(sortField, sortDirection, fieldName).ariaSort;
}

function getSortState(sortField, sortDirection, fieldName) {
  if (sortField !== fieldName) {
    return {
      isActive: false,
      ariaSort: 'none',
      indicator: '',
    };
  }

  return {
    isActive: true,
    ariaSort: sortDirection === 'desc' ? 'descending' : 'ascending',
    indicator: sortDirection === 'desc' ? '▼' : '▲',
  };
}

function renderSortableHeader({ table, field, label, sortField, sortDirection, className = '' }) {
  const sortState = getSortState(sortField, sortDirection, field);

  return `
    <th${className ? ` class="${escapeHtml(className)}"` : ''} aria-sort="${sortState.ariaSort}">
      <button type="button" class="table-sort-button${sortState.isActive ? ' is-active' : ''}" data-sort-table="${escapeHtml(table)}" data-sort-field="${escapeHtml(field)}">
        <span>${escapeHtml(label)}</span>
        <span class="table-sort-indicator" aria-hidden="true">${sortState.indicator}</span>
      </button>
    </th>
  `;
}

function renderPlayerDetailCard(player, settings) {
  if (!player) {
    return renderEmptyState('Valitse pelaaja listalta nähdäksesi tietosivun.');
  }

  const pdgaProfileUrl = buildPdgaPlayerUrl(settings, player);

  return `
    <div class="player-detail-layout">
      <dl class="definition-list">
        <div><dt>Nimi</dt><dd>${escapeHtml(player.name)}</dd></div>
        <div><dt>Sarja</dt><dd>${escapeHtml(player.division)}</dd></div>
        <div><dt>PDGA-tunnus</dt><dd>${escapeHtml(player.pdgaNumber || '—')}</dd></div>
        <div><dt>PDGA-rating</dt><dd>${escapeHtml(player.pdgaRating || '—')}</dd></div>
        <div><dt>Maailman ranking sijoitus</dt><dd>${escapeHtml(player.worldRank || '—')}</dd></div>
        <div><dt>PDGA-profiili</dt><dd>${renderLinkButton(pdgaProfileUrl, 'Avaa PDGA')}</dd></div>
      </dl>
    </div>
  `;
}

function renderTournamentMultiplierOptions(multipliers, selectedValue) {
  return multipliers
    .map(
      (multiplier) =>
        `<option value="${escapeHtml(multiplier.id)}" ${selectedValue === multiplier.id ? 'selected' : ''}>${escapeHtml(multiplier.name)} (${escapeHtml(multiplier.abbreviation)} · ${formatMultiplier(multiplier.multiplier)})</option>`,
    )
    .join('');
}

function getMultiplierLabel(tournament, multipliers) {
  const multiplier = findMultiplier(multipliers, tournament.multiplierId);
  return multiplier?.name || '';
}

function getMultiplierAbbreviation(tournament, multipliers) {
  const multiplier = findMultiplier(multipliers, tournament.multiplierId);
  return multiplier?.abbreviation || '';
}

function renderNav(activeView) {
  const items = [
    { id: 'summary', label: 'Yhteenveto' },
    { id: 'ranking', label: 'Ranking' },
    { id: 'players', label: 'Pelaajat' },
    { id: 'tournaments', label: 'Turnaukset' },
    { id: 'points', label: 'Pistetaulukot' },
    { id: 'multipliers', label: 'Kertoimet' },
    { id: 'settings', label: 'Asetukset' },
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
  return `
    <div class="stats-grid">
      <article class="card stat-card">
        <span class="eyebrow">Pelaajat</span>
        <strong>${formatNumber(dataState.players.length)}</strong>
      </article>
      <article class="card stat-card">
        <span class="eyebrow">Turnaukset</span>
        <strong>${formatNumber(dataState.tournaments.length)}</strong>
      </article>
    </div>
  `;
}

function renderTopTenCard(title, ranking, division) {
  const topTen = getTopRanking(ranking, 10);
  const maxPoints = topTen[0]?.totalPoints || 0;

  return `
    <article class="card">
      <div class="section-heading">
        <h3>${escapeHtml(title)}</h3>
      </div>
      ${
        topTen.length
          ? `<div class="chart" role="img" aria-label="${escapeHtml(title)} kokonaispisteiden perusteella">
              ${topTen
                .map((entry, index) => {
                  const width = maxPoints > 0 ? (entry.totalPoints / maxPoints) * 100 : 0;
                  return `
                    <div class="chart-row">
                      <div class="chart-meta chart-meta-dashboard">
                        <span><strong>${index + 1}.</strong> ${escapeHtml(entry.name)}</span>
                        <span>${formatNumber(entry.totalPoints)} p</span>
                      </div>
                      <div class="chart-bar-track">
                        <div class="chart-bar" style="width: ${width}%" aria-hidden="true"></div>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>`
          : renderEmptyState(`Sarjassa ${division} ei ole vielä pisteellisiä pelaajia.`)
      }
    </article>
  `;
}

function renderSummarySection(dataState, uiState) {
  const mpoRanking = buildRanking(dataState.players, dataState.tournamentResults, 'MPO');
  const fpoRanking = buildRanking(dataState.players, dataState.tournamentResults, 'FPO');

  return `
    <section class="section" id="section-summary" ${uiState.activeView === 'summary' ? '' : 'hidden'} aria-labelledby="summary-title">
      <h1 id="summary-title">Yhteenveto</h1>
      ${renderStats(dataState)}
      <div class="two-column">
        ${renderTopTenCard('TOP 10 MPO', mpoRanking, 'MPO')}
        ${renderTopTenCard('TOP 10 FPO', fpoRanking, 'FPO')}
      </div>
    </section>
  `;
}

function renderRankingSection(dataState, uiState) {
  const ranking = sortTableRows(
    buildRanking(dataState.players, dataState.tournamentResults, uiState.rankingFilter).map((entry, index) => ({
      ...entry,
      rankPosition: index + 1,
    })),
    {
      field: uiState.rankingSortField,
      direction: uiState.rankingSortDirection,
    },
    {
      rankPosition: { type: 'number' },
      name: { type: 'text' },
      division: { type: 'text' },
      pdgaRating: { type: 'number' },
      worldRank: { type: 'number' },
      tournamentCount: { type: 'number' },
      totalPoints: { type: 'number' },
    },
  );

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
                      ${renderSortableHeader({
                        table: 'ranking',
                        field: 'rankPosition',
                        label: '#',
                        sortField: uiState.rankingSortField,
                        sortDirection: uiState.rankingSortDirection,
                      })}
                      ${renderSortableHeader({
                        table: 'ranking',
                        field: 'name',
                        label: 'Pelaaja',
                        sortField: uiState.rankingSortField,
                        sortDirection: uiState.rankingSortDirection,
                      })}
                      ${renderSortableHeader({
                        table: 'ranking',
                        field: 'division',
                        label: 'Sarja',
                        sortField: uiState.rankingSortField,
                        sortDirection: uiState.rankingSortDirection,
                      })}
                      ${renderSortableHeader({
                        table: 'ranking',
                        field: 'pdgaRating',
                        label: 'PDGA-rating',
                        sortField: uiState.rankingSortField,
                        sortDirection: uiState.rankingSortDirection,
                      })}
                      ${renderSortableHeader({
                        table: 'ranking',
                        field: 'worldRank',
                        label: 'Maailmanranking',
                        sortField: uiState.rankingSortField,
                        sortDirection: uiState.rankingSortDirection,
                      })}
                      ${renderSortableHeader({
                        table: 'ranking',
                        field: 'tournamentCount',
                        label: 'Turnauksia',
                        sortField: uiState.rankingSortField,
                        sortDirection: uiState.rankingSortDirection,
                      })}
                      ${renderSortableHeader({
                        table: 'ranking',
                        field: 'totalPoints',
                        label: 'Kokonaispisteet',
                        sortField: uiState.rankingSortField,
                        sortDirection: uiState.rankingSortDirection,
                        className: 'number',
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    ${ranking
                      .map(
                        (entry) => `
                          <tr>
                            <td>${entry.rankPosition}</td>
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

function getPlayerNameParts(player = {}) {
  const firstName = String(player.firstName || '').trim();
  const lastName = String(player.lastName || '').trim();
  if (firstName || lastName) {
    return { firstName, lastName };
  }

  const [fallbackFirstName = '', ...fallbackLastNameParts] = String(player.name || '').trim().split(/\s+/);
  return {
    firstName: fallbackFirstName,
    lastName: fallbackLastNameParts.join(' '),
  };
}

function getPlayerFieldSelector(fieldName) {
  const fieldSelectors = {
    firstName: '#player-first-name',
    lastName: '#player-last-name',
    pdgaNumber: '#player-pdga-number',
    division: '#player-division',
    pdgaRating: '#player-pdga-rating',
    worldRank: '#player-world-rank',
  };

  return fieldSelectors[fieldName] || '#player-first-name';
}

function renderPlayerSection(dataState, uiState) {
  const visiblePlayers = sortTableRows(getVisiblePlayers(dataState.players, {
    division: uiState.playerDivisionFilter,
    query: uiState.playerSearch,
    sortField: 'name',
    sortDirection: 'asc',
  }), {
    field: uiState.playerSortField,
    direction: uiState.playerSortDirection,
  }, {
    name: { type: 'text' },
    pdgaNumber: { type: 'number' },
    division: { type: 'text' },
    pdgaRating: { type: 'number' },
    worldRank: { type: 'number' },
  });
  const importSummary = uiState.playerImportSummary;
  const importSummaryType = importSummary
    ? importSummary.failedCount > 0
      ? 'warning'
      : 'success'
    : '';
  const importSummaryRole = importSummary?.failedCount > 0 ? 'alert' : 'status';
  const importSummaryAriaLive = importSummary?.failedCount > 0 ? 'assertive' : 'polite';

  return `
    <section class="section" id="section-players" ${uiState.activeView === 'players' ? '' : 'hidden'} aria-labelledby="players-title">
      <div class="section-heading">
        <div>
          <h2 id="players-title">Pelaajat</h2>
          <p class="section-subtitle">Pelaajalista on tämän sivun pääsisältö. Hae ja lajittele nimellä tai PDGA-tunnuksella.</p>
        </div>
        <button type="button" class="button" data-open-player-dialog>Lisää pelaaja</button>
      </div>
      <article class="panel">
        <div class="section-heading">
          <div>
            <h3>Pelaajien CSV-tuonti</h3>
            <p class="section-subtitle">Tuo uusia pelaajia massana valittuun divisioonaan.</p>
          </div>
        </div>
        <p>
          Voit tuoda pelaajia CSV-tiedostosta.<br />
          Sarake-erottimena tulee käyttää puolipistettä (;).
        </p>
        <p>
          Pakollinen tieto:
        </p>
        <ul>
          <li>PDGA ID</li>
        </ul>
        <p>
          Muut kentät voivat olla tyhjiä.
        </p>
        <p>
          Esimerkki:
        </p>
        <pre>Etunimi;Sukunimi;PDGA ID;PDGA-rating;Maailmanranking
Matti;Meikäläinen;12345;950;1250
Maija;Mallikas;54321;890;2450</pre>
        <form id="players-import-form">
          <div class="form-grid compact-grid">
            <div class="form-field">
              <label for="players-import-division">Importoi divisioonaan *</label>
              <select id="players-import-division" name="division" required>
                <option value="">Valitse divisioona</option>
                ${DIVISIONS.map(
                  (division) =>
                    `<option value="${division}" ${uiState.playerImportDivision === division ? 'selected' : ''}>${division}</option>`,
                ).join('')}
              </select>
            </div>
            <div class="form-field">
              <label for="players-import-file">CSV-tiedosto *</label>
              <input id="players-import-file" name="file" type="file" accept=".csv,text/csv" required />
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="button">Tuo</button>
          </div>
        </form>
        ${
          importSummary
            ? `
              <div class="message ${importSummaryType}" role="${importSummaryRole}" aria-live="${importSummaryAriaLive}">
                <strong>Importti valmis</strong><br />
                Yhteensä rivejä: ${formatNumber(importSummary.totalRows)}<br />
                Onnistuneesti tuotu: ${formatNumber(importSummary.importedCount)}<br />
                Epäonnistuneet: ${formatNumber(importSummary.failedCount)}
                ${
                  importSummary.failures.length
                    ? `
                      <p>Epäonnistuneet rivit:</p>
                      <ul>
                        ${importSummary.failures
                          .map(
                            (failure) =>
                              `<li>${escapeHtml(failure.pdgaId ? `PDGA ID ${failure.pdgaId}` : `Rivi ${failure.rowNumber}`)} — Syy: ${escapeHtml(failure.reason)}</li>`,
                          )
                          .join('')}
                      </ul>
                    `
                    : ''
                }
              </div>
            `
            : ''
        }
      </article>
      <article class="panel">
        <div class="section-heading">
          <div class="status-chip">${formatNumber(visiblePlayers.length)} / ${formatNumber(dataState.players.length)} pelaajaa</div>
        </div>
        <div class="form-grid compact-grid">
          <div class="form-field">
            <label for="player-search">Haku</label>
            <input
              id="player-search"
              type="search"
              data-player-search
              value="${escapeHtml(uiState.playerSearch)}"
              placeholder="Hae nimellä tai PDGA ID:llä"
            />
          </div>
          <div class="form-field">
            <label for="player-sort-field">Lajittelukenttä</label>
            <select id="player-sort-field" data-player-sort-field>
              <option value="name" ${uiState.playerSortField === 'name' ? 'selected' : ''}>Pelaajan nimi</option>
              <option value="pdgaNumber" ${uiState.playerSortField === 'pdgaNumber' ? 'selected' : ''}>PDGA ID</option>
              <option value="division" ${uiState.playerSortField === 'division' ? 'selected' : ''}>Sarja</option>
              <option value="pdgaRating" ${uiState.playerSortField === 'pdgaRating' ? 'selected' : ''}>PDGA-rating</option>
              <option value="worldRank" ${uiState.playerSortField === 'worldRank' ? 'selected' : ''}>Maailmanranking</option>
            </select>
          </div>
          <div class="form-field">
            <label for="player-sort-direction">Lajittelusuunta</label>
            <select id="player-sort-direction" data-player-sort-direction>
              <option value="asc" ${uiState.playerSortDirection === 'asc' ? 'selected' : ''}>Nouseva</option>
              <option value="desc" ${uiState.playerSortDirection === 'desc' ? 'selected' : ''}>Laskeva</option>
            </select>
          </div>
          <div class="form-field">
            <label for="player-division-filter">Sarja</label>
            <select id="player-division-filter" data-player-division-filter>
              <option value="ALL" ${uiState.playerDivisionFilter === 'ALL' ? 'selected' : ''}>Kaikki</option>
              ${DIVISIONS.map(
                (division) => `<option value="${division}" ${uiState.playerDivisionFilter === division ? 'selected' : ''}>${division}</option>`,
              ).join('')}
            </select>
          </div>
        </div>
        ${
          uiState.playersStatus === 'loading'
            ? '<div class="message" role="status" aria-live="polite">Ladataan pelaajalistaa…</div>'
            : uiState.playersStatus === 'error'
              ? `
                <div class="message error" role="alert">
                  <p>Pelaajien lataaminen epäonnistui.</p>
                  <p>${escapeHtml(uiState.playersError || 'Yritä ladata näkymä uudelleen.')}</p>
                  <div class="form-actions">
                    <button type="button" class="secondary-button" data-retry-players-load>Lataa uudelleen</button>
                  </div>
                </div>
              `
              : dataState.players.length === 0
                ? renderEmptyState('Pelaajia ei ole vielä lisätty.')
                : visiblePlayers.length
                  ? `
                    <div class="table-wrap">
                      <table class="table players-table">
                        <thead>
                          <tr>
                            ${renderSortableHeader({
                              table: 'players',
                              field: 'name',
                              label: 'Pelaajan nimi',
                              sortField: uiState.playerSortField,
                              sortDirection: uiState.playerSortDirection,
                            })}
                            ${renderSortableHeader({
                              table: 'players',
                              field: 'pdgaNumber',
                              label: 'PDGA ID',
                              sortField: uiState.playerSortField,
                              sortDirection: uiState.playerSortDirection,
                            })}
                            ${renderSortableHeader({
                              table: 'players',
                              field: 'division',
                              label: 'Sarja',
                              sortField: uiState.playerSortField,
                              sortDirection: uiState.playerSortDirection,
                            })}
                            ${renderSortableHeader({
                              table: 'players',
                              field: 'pdgaRating',
                              label: 'PDGA-rating',
                              sortField: uiState.playerSortField,
                              sortDirection: uiState.playerSortDirection,
                            })}
                            ${renderSortableHeader({
                              table: 'players',
                              field: 'worldRank',
                              label: 'Maailmanranking',
                              sortField: uiState.playerSortField,
                              sortDirection: uiState.playerSortDirection,
                            })}
                            <th>Muokkaa</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${visiblePlayers
                            .map((player) => {
                              const playerPdgaUrl = buildPdgaPlayerUrl(dataState.settings, player);
                              return `
                                <tr>
                                  <td data-label="Pelaajan nimi">${
                                    playerPdgaUrl
                                      ? `<a href="${escapeHtml(playerPdgaUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(player.name)}</a>`
                                      : escapeHtml(player.name)
                                  }</td>
                                  <td data-label="PDGA ID">${escapeHtml(renderValueOrDash(player.pdgaNumber))}</td>
                                  <td data-label="Sarja">${escapeHtml(player.division)}</td>
                                  <td data-label="PDGA-rating">${escapeHtml(renderValueOrDash(player.pdgaRating))}</td>
                                  <td data-label="Maailmanranking">${escapeHtml(renderValueOrDash(player.worldRank))}</td>
                                  <td data-label="Muokkaa"><button type="button" class="secondary-button" data-edit-player="${escapeHtml(player.id)}">Muokkaa</button></td>
                                </tr>
                              `;
                            })
                            .join('')}
                        </tbody>
                      </table>
                    </div>
                  `
                  : renderEmptyState('Hakuehdoilla ei löytynyt pelaajia.')
        }
      </article>
    </section>
  `;
}

function renderPlayerDialog(dataState, uiState) {
  if (!uiState.playerDialogOpen) {
    return '';
  }

  const editingPlayer = dataState.players.find((player) => player.id === uiState.playerFormId) || null;
  const draftPlayer = uiState.playerFormDraft || {};
  const formPlayer = editingPlayer ? { ...editingPlayer, ...draftPlayer } : draftPlayer;
  const nameParts = getPlayerNameParts(formPlayer);

  return `
    <div class="dialog-backdrop" data-player-dialog-backdrop>
      <div class="dialog-panel dialog-panel-wide" role="dialog" aria-modal="true" aria-labelledby="player-dialog-title" data-player-dialog-panel tabindex="-1">
        <div class="section-heading">
          <div>
            <h2 id="player-dialog-title">${editingPlayer ? 'Muokkaa pelaajaa' : 'Lisää pelaaja'}</h2>
            <p class="section-subtitle">Täytä pelaajan tiedot. Pakolliset kentät on merkitty tähdellä.</p>
          </div>
        </div>
        <form id="player-form">
          <input type="hidden" name="id" value="${escapeHtml(formPlayer?.id || editingPlayer?.id || '')}" />
          <div class="form-grid">
            <div class="form-field">
              <label for="player-first-name">Etunimi *</label>
              <input id="player-first-name" name="firstName" required ${getFieldAttributes(uiState.playerFormErrors, 'firstName')} value="${escapeHtml(nameParts.firstName)}" />
              ${renderFieldError(uiState.playerFormErrors, 'firstName')}
            </div>
            <div class="form-field">
              <label for="player-last-name">Sukunimi *</label>
              <input id="player-last-name" name="lastName" required ${getFieldAttributes(uiState.playerFormErrors, 'lastName')} value="${escapeHtml(nameParts.lastName)}" />
              ${renderFieldError(uiState.playerFormErrors, 'lastName')}
            </div>
            <div class="form-field">
              <label for="player-pdga-number">PDGA ID *</label>
              <input
                id="player-pdga-number"
                name="pdgaNumber"
                required
                type="number"
                inputmode="numeric"
                min="1"
                step="1"
                ${getFieldAttributes(uiState.playerFormErrors, 'pdgaNumber')}
                value="${escapeHtml(formPlayer?.pdgaNumber || '')}"
              />
              ${renderFieldError(uiState.playerFormErrors, 'pdgaNumber')}
            </div>
            <div class="form-field">
              <label for="player-division">Sarja *</label>
              <select id="player-division" name="division" required ${getFieldAttributes(uiState.playerFormErrors, 'division')}>
                <option value="">Valitse sarja</option>
                ${DIVISIONS.map(
                  (division) => `<option value="${division}" ${formPlayer?.division === division ? 'selected' : ''}>${division}</option>`,
                ).join('')}
              </select>
              ${renderFieldError(uiState.playerFormErrors, 'division')}
            </div>
            <div class="form-field">
              <label for="player-pdga-rating">PDGA-rating</label>
              <input
                id="player-pdga-rating"
                name="pdgaRating"
                type="number"
                inputmode="numeric"
                min="1"
                step="1"
                ${getFieldAttributes(uiState.playerFormErrors, 'pdgaRating')}
                value="${escapeHtml(formPlayer?.pdgaRating || '')}"
              />
              ${renderFieldError(uiState.playerFormErrors, 'pdgaRating')}
            </div>
            <div class="form-field">
              <label for="player-world-rank">Maailmanranking</label>
              <input
                id="player-world-rank"
                name="worldRank"
                type="number"
                inputmode="numeric"
                min="1"
                step="1"
                ${getFieldAttributes(uiState.playerFormErrors, 'worldRank')}
                value="${escapeHtml(formPlayer?.worldRank || '')}"
              />
              ${renderFieldError(uiState.playerFormErrors, 'worldRank')}
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="button">${editingPlayer ? 'Tallenna muutokset' : 'Lisää pelaaja'}</button>
            <button type="button" class="ghost-button" data-dismiss-player-dialog>Peruuta</button>
            ${editingPlayer ? `<button type="button" class="danger-button" data-delete-player="${escapeHtml(editingPlayer.id)}">Poista pelaaja</button>` : ''}
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderTournamentSection(dataState, uiState) {
  const orderedMultipliers = sortMultipliers(dataState.multipliers || []);
  const visibleTournamentsWithMultipliers = sortTableRows(filterAndSortTournaments(dataState.tournaments, {
    search: uiState.tournamentSearch,
    status: uiState.tournamentStatusFilter,
    sortField: 'displayOrder',
    sortDirection: 'asc',
  }).map((tournament) => ({
    ...tournament,
    multiplierName: getMultiplierLabel(tournament, orderedMultipliers),
    multiplierAbbreviation: getMultiplierAbbreviation(tournament, orderedMultipliers),
  })), {
    field: uiState.tournamentSortField,
    direction: uiState.tournamentSortDirection,
  }, {
    displayOrder: { type: 'number' },
    name: { type: 'text' },
    multiplierAbbreviation: { type: 'text' },
    pdgaEventId: { type: 'number' },
    startDate: { type: 'date' },
    endDate: { type: 'date' },
    location: { type: 'text' },
    venue: { type: 'text' },
  });
  const orderedTournaments = sortTournaments(dataState.tournaments);
  const availableStatuses = orderedMultipliers;

  return `
    <section class="section" id="section-tournaments" ${uiState.activeView === 'tournaments' ? '' : 'hidden'} aria-labelledby="tournaments-title">
      <div class="section-heading">
        <div>
          <h2 id="tournaments-title">Turnaukset</h2>
          <p class="section-subtitle">Hallinnoi turnauksia, suodata listaa ja pidä turnaustiedot ajan tasalla.</p>
        </div>
        <div class="section-actions">
          <button type="button" class="secondary-button" data-open-tournament-import-dialog>Tuo turnaukset</button>
          <button type="button" class="button" data-open-tournament-dialog>Lisää turnaus</button>
        </div>
      </div>
      <article class="panel">
        <h3>CSV-tuonnin ohje</h3>
        <p>
          Muoto:
        </p>
        <pre>Järjestysnumero;PDGA Event ID;Turnauksen nimi

1;123456;European Open 2027
2;123457;Finnish Nationals 2027</pre>
        <ul>
          <li>Erotin on puolipiste (;).</li>
          <li>UTF-8-koodaus on suositeltu (å, ä, ö).</li>
          <li>Otsikkorivi on sallittu.</li>
          <li>Pakolliset kentät: Järjestysnumero, PDGA Event ID ja Turnauksen nimi.</li>
        </ul>
      </article>
      <article class="panel danger-zone" aria-labelledby="delete-all-tournaments-title">
        <div>
          <h3 id="delete-all-tournaments-title">Vaaravyöhyke: poista kaikki turnaukset</h3>
          <p class="section-subtitle">Toiminto poistaa kaikki turnaukset ja niihin liittyvät turnaustulokset pysyvästi.</p>
        </div>
        <button type="button" class="danger-button" data-request-delete-all-tournaments>
          ⚠ Poista kaikki turnaukset
        </button>
      </article>
      <article class="panel">
        <div class="section-heading">
          <div>
            <h3>Turnauslista</h3>
            <p class="section-subtitle">Listaa voi suodattaa nimen, tilan, paikkakunnan ja radan perusteella.</p>
          </div>
        </div>
        <div class="form-grid compact-grid">
          <div class="form-field full-width">
            <label for="tournament-search">Haku</label>
            <input
              id="tournament-search"
              data-tournament-search
              value="${escapeHtml(uiState.tournamentSearch || '')}"
              placeholder="Hae nimellä, paikkakunnalla tai radalla"
            />
          </div>
          <div class="form-field">
            <label for="tournament-status-filter">Tila</label>
            <select id="tournament-status-filter" data-tournament-status-filter>
              <option value="ALL">Kaikki tilat</option>
              ${availableStatuses
                .map(
                  (status) =>
                   `<option value="${escapeHtml(status.id)}" ${uiState.tournamentStatusFilter === status.id ? 'selected' : ''}>${escapeHtml(status.name)} (${escapeHtml(status.abbreviation)})</option>`,
                )
                .join('')}
            </select>
          </div>
          <div class="form-field">
            <label for="tournament-sort-field">Lajittelu</label>
            <select id="tournament-sort-field" data-tournament-sort-field>
              <option value="displayOrder" ${uiState.tournamentSortField === 'displayOrder' ? 'selected' : ''}>Järjestysnumero</option>
              <option value="name" ${uiState.tournamentSortField === 'name' ? 'selected' : ''}>Turnauksen nimi</option>
              <option value="multiplierAbbreviation" ${uiState.tournamentSortField === 'multiplierAbbreviation' ? 'selected' : ''}>Tila</option>
              <option value="pdgaEventId" ${uiState.tournamentSortField === 'pdgaEventId' ? 'selected' : ''}>PDGA Event ID</option>
              <option value="startDate" ${uiState.tournamentSortField === 'startDate' ? 'selected' : ''}>Alkamispäivä</option>
              <option value="endDate" ${uiState.tournamentSortField === 'endDate' ? 'selected' : ''}>Päättymispäivä</option>
              <option value="location" ${uiState.tournamentSortField === 'location' ? 'selected' : ''}>Paikkakunta</option>
              <option value="venue" ${uiState.tournamentSortField === 'venue' ? 'selected' : ''}>Rata</option>
            </select>
          </div>
          <div class="form-field">
            <label for="tournament-sort-direction">Järjestys</label>
            <select id="tournament-sort-direction" data-tournament-sort-direction>
              <option value="asc" ${uiState.tournamentSortDirection === 'asc' ? 'selected' : ''}>Nouseva</option>
              <option value="desc" ${uiState.tournamentSortDirection === 'desc' ? 'selected' : ''}>Laskeva</option>
            </select>
          </div>
        </div>
        ${
          orderedTournaments.length
            ? visibleTournamentsWithMultipliers.length
             ? `
               <div class="table-wrap">
                 <table class="table tournaments-table">
                   <thead>
                     <tr>
                       ${renderSortableHeader({
                         table: 'tournaments',
                         field: 'displayOrder',
                         label: 'Järjestysnumero',
                         sortField: uiState.tournamentSortField,
                         sortDirection: uiState.tournamentSortDirection,
                       })}
                       ${renderSortableHeader({
                         table: 'tournaments',
                         field: 'name',
                         label: 'Turnauksen nimi',
                         sortField: uiState.tournamentSortField,
                         sortDirection: uiState.tournamentSortDirection,
                       })}
                       ${renderSortableHeader({
                         table: 'tournaments',
                         field: 'multiplierAbbreviation',
                         label: 'Tila',
                         sortField: uiState.tournamentSortField,
                         sortDirection: uiState.tournamentSortDirection,
                       })}
                       ${renderSortableHeader({
                         table: 'tournaments',
                         field: 'pdgaEventId',
                         label: 'PDGA Event ID',
                         sortField: uiState.tournamentSortField,
                         sortDirection: uiState.tournamentSortDirection,
                       })}
                       ${renderSortableHeader({
                         table: 'tournaments',
                         field: 'startDate',
                         label: 'Alkamispäivä',
                         sortField: uiState.tournamentSortField,
                         sortDirection: uiState.tournamentSortDirection,
                       })}
                       ${renderSortableHeader({
                         table: 'tournaments',
                         field: 'endDate',
                         label: 'Päättymispäivä',
                         sortField: uiState.tournamentSortField,
                         sortDirection: uiState.tournamentSortDirection,
                       })}
                       ${renderSortableHeader({
                         table: 'tournaments',
                         field: 'location',
                         label: 'Paikkakunta',
                         sortField: uiState.tournamentSortField,
                         sortDirection: uiState.tournamentSortDirection,
                       })}
                       ${renderSortableHeader({
                         table: 'tournaments',
                         field: 'venue',
                         label: 'Rata',
                         sortField: uiState.tournamentSortField,
                         sortDirection: uiState.tournamentSortDirection,
                       })}
                       <th>Muokkaa</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${visibleTournamentsWithMultipliers
                        .map((tournament) => {
                          const pdgaEventUrl = buildPdgaEventUrl(dataState.settings, tournament);
                          return `
                            <tr>
                              <td data-label="Järjestysnumero">${escapeHtml(renderValueOrDash(tournament.displayOrder))}</td>
                              <td data-label="Turnauksen nimi">
                                ${
                                  pdgaEventUrl
                                    ? `<a class="tournament-name-link" href="${escapeHtml(pdgaEventUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(tournament.name)}</a>`
                                    : `<span class="tournament-name-text">${escapeHtml(tournament.name)}</span>`
                                }
                              </td>
                              <td data-label="Tila">${escapeHtml(renderValueOrDash(tournament.multiplierAbbreviation))}</td>
                              <td data-label="PDGA Event ID">${escapeHtml(renderValueOrDash(tournament.pdgaEventId))}</td>
                              <td data-label="Alkamispäivä">${formatDate(tournament.startDate)}</td>
                              <td data-label="Päättymispäivä">${formatDate(tournament.endDate)}</td>
                              <td data-label="Paikkakunta">${escapeHtml(renderValueOrDash(tournament.location))}</td>
                              <td data-label="Rata">${escapeHtml(renderValueOrDash(tournament.venue))}</td>
                              <td data-label="Muokkaa">
                                <button type="button" class="secondary-button" data-edit-tournament="${escapeHtml(tournament.id)}">Muokkaa</button>
                              </td>
                            </tr>
                          `;
                        })
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
              : renderEmptyState('Yhtään hakua vastaavaa turnausta ei löytynyt.')
            : renderEmptyState('Turnauksia ei ole vielä lisätty.')
        }
      </article>
    </section>
  `;
}

function renderTournamentImportDialog(uiState) {
  if (!uiState.tournamentImportDialogOpen) {
    return '';
  }

  const importSummary = uiState.tournamentImportSummary;
  const importSummaryType = importSummary
    ? importSummary.validationErrorCount > 0 || importSummary.duplicateCount > 0
      ? 'warning'
      : 'success'
    : '';
  const importSummaryRole = importSummary && (importSummary.validationErrorCount > 0 || importSummary.duplicateCount > 0) ? 'alert' : 'status';
  const importSummaryAriaLive =
    importSummary && (importSummary.validationErrorCount > 0 || importSummary.duplicateCount > 0) ? 'assertive' : 'polite';

  return `
    <div class="dialog-backdrop" data-close-tournament-import-dialog>
      <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="tournament-import-dialog-title" aria-describedby="tournament-import-dialog-description" data-tournament-import-dialog-panel tabindex="-1">
        <form id="tournament-import-form">
          <div class="section-heading">
            <div>
              <h2 id="tournament-import-dialog-title">Tuo turnaukset</h2>
              <p id="tournament-import-dialog-description" class="section-subtitle">Tuonti luo vain uusia turnauksia eikä koskaan ylikirjoita olemassa olevia.</p>
            </div>
          </div>
          <article class="panel import-instructions" aria-label="CSV-tuonnin ohjeet">
            <h3>Tuonnin tuettu muoto</h3>
            <p><code>Järjestysnumero;PDGA Event ID;Turnauksen nimi</code></p>
            <pre>1;123456;European Open 2027
2;123457;Finnish Nationals 2027
3;123458;Tyyni 2027</pre>
            <ul>
              <li>Erotin on puolipiste (;).</li>
              <li>Otsikkorivi on sallittu.</li>
              <li>UTF-8-koodaus on suositeltu (å, ä, ö).</li>
              <li>Pakolliset kentät: Järjestysnumero, PDGA Event ID ja Turnauksen nimi.</li>
            </ul>
          </article>
          <div class="form-grid">
            <div class="form-field full-width">
              <label for="tournament-import-file">CSV-tiedosto *</label>
              <input id="tournament-import-file" name="file" type="file" accept=".csv,text/csv" required />
              <p id="tournament-import-file-hint" class="form-help">Valitse tiedosto, niin Tuo-painike aktivoituu.</p>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="secondary-button" data-cancel-tournament-import>${importSummary ? 'Sulje' : 'Peruuta'}</button>
            ${
              importSummary
                ? ''
                : '<button type="submit" class="button" data-submit-tournament-import disabled aria-describedby="tournament-import-file-hint">Tuo</button>'
            }
          </div>
        </form>
        ${
          importSummary
            ? `
              <div class="message ${importSummaryType}" role="${importSummaryRole}" aria-live="${importSummaryAriaLive}">
                <strong>Turnausten tuonti valmis</strong>
                <dl>
                  <div><dt>Tuotu</dt><dd>${formatNumber(importSummary.importedCount)}</dd></div>
                  <div><dt>Ohitetut duplikaatit</dt><dd>${formatNumber(importSummary.duplicateCount)}</dd></div>
                  <div><dt>Validointivirheet</dt><dd>${formatNumber(importSummary.validationErrorCount)}</dd></div>
                </dl>
                ${
                  importSummary.failures.length
                    ? `
                      <p>Virheet:</p>
                      <ul>
                        ${importSummary.failures
                          .map((failure) => `<li>Rivi ${formatNumber(failure.rowNumber)}: ${escapeHtml(failure.reason)}</li>`)
                          .join('')}
                      </ul>
                    `
                    : ''
                }
              </div>
            `
            : ''
        }
      </div>
    </div>
  `;
}

function renderTournamentDialog(dataState, uiState) {
  if (!uiState.tournamentDialogOpen) {
    return '';
  }

  const editingTournament = dataState.tournaments.find((tournament) => tournament.id === uiState.tournamentFormId) || null;
  const formValues = uiState.tournamentFormDraft || {};
  const fieldErrors = uiState.tournamentFormErrors || {};
  const orderedMultipliers = sortMultipliers(dataState.multipliers || []);

  return `
    <div class="dialog-backdrop" data-tournament-dialog-backdrop>
      <div
        class="dialog-panel dialog-panel-wide"
        data-tournament-dialog-panel
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        aria-labelledby="tournament-dialog-title"
        aria-describedby="tournament-dialog-description"
      >
        <div class="section-heading">
          <div>
            <h2 id="tournament-dialog-title">${editingTournament ? 'Muokkaa turnausta' : 'Lisää turnaus'}</h2>
            <p id="tournament-dialog-description" class="section-subtitle">
              Syötä turnauksen perustiedot. Järjestys määräytyy järjestysnumeron mukaan nousevasti.
            </p>
          </div>
        </div>
        <form id="tournament-form">
          <input type="hidden" name="id" value="${escapeHtml(editingTournament?.id || '')}" />
          <div class="form-grid">
            <div class="form-field">
              <label for="tournament-name">Turnauksen nimi *</label>
              <input
                id="tournament-name"
                name="name"
                required
                ${getFieldAttributes(fieldErrors, 'name')}
                value="${escapeHtml(getTournamentFormValue(formValues, editingTournament, 'name'))}"
              />
              ${renderFieldError(fieldErrors, 'name')}
            </div>
            <div class="form-field">
              <label for="tournament-start-date">Päivämäärä *</label>
              <input
                id="tournament-start-date"
                name="startDate"
                type="date"
                required
                ${getFieldAttributes(fieldErrors, 'startDate')}
                value="${escapeHtml(getTournamentFormValue(formValues, editingTournament, 'startDate'))}"
              />
              ${renderFieldError(fieldErrors, 'startDate')}
            </div>
            <div class="form-field">
              <label for="tournament-display-order">Järjestysnumero *</label>
              <input
                id="tournament-display-order"
                name="displayOrder"
                type="number"
                required
                inputmode="numeric"
                min="1"
                step="1"
                ${getFieldAttributes(fieldErrors, 'displayOrder')}
                value="${escapeHtml(String(getTournamentFormValue(formValues, editingTournament, 'displayOrder', DEFAULT_TOURNAMENT_DISPLAY_ORDER)))}"
              />
              ${renderFieldError(fieldErrors, 'displayOrder')}
            </div>
            <div class="form-field">
              <label for="tournament-multiplier-id">Tila *</label>
              <select id="tournament-multiplier-id" name="multiplierId" required ${getFieldAttributes(fieldErrors, 'multiplierId')}>
                <option value="">Valitse tila</option>
                ${renderTournamentMultiplierOptions(
                  orderedMultipliers,
                  getTournamentFormValue(formValues, editingTournament, 'multiplierId'),
                )}
              </select>
              ${renderFieldError(fieldErrors, 'multiplierId')}
              ${orderedMultipliers.length ? '' : '<span class="help-text">Lisää ensin vähintään yksi tila Kertoimet-välilehdellä.</span>'}
            </div>
            <div class="form-field">
              <label for="tournament-location">Paikkakunta</label>
              <input id="tournament-location" name="location" value="${escapeHtml(getTournamentFormValue(formValues, editingTournament, 'location'))}" />
            </div>
            <div class="form-field">
              <label for="tournament-venue">Kilpailupaikka / rata</label>
              <input id="tournament-venue" name="venue" value="${escapeHtml(getTournamentFormValue(formValues, editingTournament, 'venue'))}" />
            </div>
            <div class="form-field">
              <label for="tournament-division">Sarjarajaus</label>
              <select id="tournament-division" name="division" ${getFieldAttributes(fieldErrors, 'division')}>
                <option value="">Ei rajattu</option>
                ${DIVISIONS.map(
                  (division) =>
                    `<option value="${division}" ${getTournamentFormValue(formValues, editingTournament, 'division') === division ? 'selected' : ''}>${division}</option>`,
                ).join('')}
              </select>
              ${renderFieldError(fieldErrors, 'division')}
            </div>
            <div class="form-field">
              <label for="tournament-external-url">Linkki kilpailusivulle</label>
              <input
                id="tournament-external-url"
                name="externalUrl"
                type="url"
                ${getFieldAttributes(fieldErrors, 'externalUrl')}
                value="${escapeHtml(getTournamentFormValue(formValues, editingTournament, 'externalUrl'))}"
              />
              ${renderFieldError(fieldErrors, 'externalUrl')}
            </div>
            <div class="form-field">
              <label for="tournament-end-date">Päättymispäivä</label>
              <input
                id="tournament-end-date"
                name="endDate"
                type="date"
                ${getFieldAttributes(fieldErrors, 'endDate')}
                value="${escapeHtml(getTournamentFormValue(formValues, editingTournament, 'endDate'))}"
              />
              ${renderFieldError(fieldErrors, 'endDate')}
            </div>
            <div class="form-field">
              <label for="tournament-pdga-event-id">PDGA-kilpailutunnus</label>
              <input
                id="tournament-pdga-event-id"
                name="pdgaEventId"
                inputmode="numeric"
                ${getFieldAttributes(fieldErrors, 'pdgaEventId')}
                value="${escapeHtml(getTournamentFormValue(formValues, editingTournament, 'pdgaEventId'))}"
              />
              <span class="help-text">Syötä vain tunnus. PDGA-linkki muodostetaan keskitetysti asetuksista.</span>
              ${renderFieldError(fieldErrors, 'pdgaEventId')}
            </div>
            <div class="form-field full-width">
              <label for="tournament-notes">Kuvaus</label>
              <textarea id="tournament-notes" name="notes">${escapeHtml(getTournamentFormValue(formValues, editingTournament, 'notes'))}</textarea>
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="button">${editingTournament ? 'Tallenna muutokset' : 'Tallenna turnaus'}</button>
            <button type="button" class="secondary-button" data-reset-tournament-form>Tyhjennä lomake</button>
            <button type="button" class="ghost-button" data-dismiss-tournament-dialog>Peruuta</button>
          </div>
          ${
            editingTournament
              ? `
                <div class="danger-zone" aria-labelledby="tournament-delete-title">
                  <div>
                    <h3 id="tournament-delete-title">Poista turnaus</h3>
                    <p class="section-subtitle">Poisto poistaa myös kaikki turnaukselle tallennetut tulokset. Toimintoa ei voi peruuttaa.</p>
                  </div>
                  <button type="button" class="danger-button" data-delete-tournament="${escapeHtml(editingTournament.id)}">Poista turnaus</button>
                </div>
              `
              : ''
          }
        </form>
      </div>
    </div>
  `;
}

function renderMultipliersSection(dataState, uiState) {
  const multipliers = sortTableRows(sortMultipliers(dataState.multipliers || []), {
    field: uiState.multipliersSortField,
    direction: uiState.multipliersSortDirection,
  }, {
    orderNumber: { type: 'number' },
    name: { type: 'text' },
    abbreviation: { type: 'text' },
    multiplier: { type: 'number' },
  });

  return `
    <section class="section" id="section-multipliers" ${uiState.activeView === 'multipliers' ? '' : 'hidden'} aria-labelledby="multipliers-title">
      <div class="section-heading">
        <div>
          <h2 id="multipliers-title">Kertoimet</h2>
          <p class="section-subtitle">Hallinnoi turnausten tilat ja pistekertoimet keskitetysti yhdestä paikasta.</p>
        </div>
        <button type="button" class="button" data-open-multiplier-dialog>Lisää</button>
      </div>
      <article class="panel">
        ${
          multipliers.length
            ? `
              <div class="table-wrap">
                <table class="table tournaments-table">
                  <thead>
                    <tr>
                      ${renderSortableHeader({
                        table: 'multipliers',
                        field: 'orderNumber',
                        label: 'Järjestysnumero',
                        sortField: uiState.multipliersSortField,
                        sortDirection: uiState.multipliersSortDirection,
                      })}
                      ${renderSortableHeader({
                        table: 'multipliers',
                        field: 'name',
                        label: 'Nimi',
                        sortField: uiState.multipliersSortField,
                        sortDirection: uiState.multipliersSortDirection,
                      })}
                      ${renderSortableHeader({
                        table: 'multipliers',
                        field: 'abbreviation',
                        label: 'Lyhenne',
                        sortField: uiState.multipliersSortField,
                        sortDirection: uiState.multipliersSortDirection,
                      })}
                      ${renderSortableHeader({
                        table: 'multipliers',
                        field: 'multiplier',
                        label: 'Kerroin',
                        sortField: uiState.multipliersSortField,
                        sortDirection: uiState.multipliersSortDirection,
                      })}
                      <th>Muokkaa</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${multipliers
                      .map(
                        (multiplier) => `
                          <tr>
                            <td data-label="Järjestysnumero">${formatNumber(multiplier.orderNumber)}</td>
                            <td data-label="Nimi">${escapeHtml(multiplier.name)}</td>
                            <td data-label="Lyhenne">${escapeHtml(multiplier.abbreviation)}</td>
                            <td data-label="Kerroin">${formatMultiplier(multiplier.multiplier)}</td>
                            <td data-label="Muokkaa">
                              <button type="button" class="secondary-button" data-edit-multiplier="${escapeHtml(multiplier.id)}">Muokkaa</button>
                            </td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
            : renderEmptyState('Kertoimia ei ole vielä lisätty.')
        }
      </article>
    </section>
  `;
}

function getMultiplierFormValue(formValues, editingMultiplier, fieldName, fallback = '') {
  if (Object.hasOwn(formValues, fieldName)) {
    return formValues[fieldName];
  }

  return editingMultiplier?.[fieldName] ?? fallback;
}

function renderMultiplierDialog(dataState, uiState) {
  if (!uiState.multiplierDialogOpen) {
    return '';
  }

  const editingMultiplier = dataState.multipliers.find((multiplier) => multiplier.id === uiState.multiplierFormId) || null;
  const formValues = uiState.multiplierFormDraft || {};
  const fieldErrors = uiState.multiplierFormErrors || {};

  return `
    <div class="dialog-backdrop" data-multiplier-dialog-backdrop>
      <div
        class="dialog-panel"
        data-multiplier-dialog-panel
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        aria-labelledby="multiplier-dialog-title"
      >
        <div class="section-heading">
          <div>
            <h2 id="multiplier-dialog-title">${editingMultiplier ? 'Muokkaa kerrointa' : 'Lisää kerroin'}</h2>
          </div>
        </div>
        <form id="multiplier-form">
          <input type="hidden" name="id" value="${escapeHtml(editingMultiplier?.id || '')}" />
          <div class="form-grid">
            <div class="form-field">
              <label for="multiplier-order-number">Järjestysnumero *</label>
              <input
                id="multiplier-order-number"
                name="orderNumber"
                required
                inputmode="numeric"
                min="1"
                step="1"
                ${getFieldAttributes(fieldErrors, 'orderNumber')}
                value="${escapeHtml(String(getMultiplierFormValue(formValues, editingMultiplier, 'orderNumber')))}"
              />
              ${renderFieldError(fieldErrors, 'orderNumber')}
            </div>
            <div class="form-field">
              <label for="multiplier-name">Nimi *</label>
              <input
                id="multiplier-name"
                name="name"
                required
                ${getFieldAttributes(fieldErrors, 'name')}
                value="${escapeHtml(getMultiplierFormValue(formValues, editingMultiplier, 'name'))}"
              />
              ${renderFieldError(fieldErrors, 'name')}
            </div>
            <div class="form-field">
              <label for="multiplier-abbreviation">Lyhenne *</label>
              <input
                id="multiplier-abbreviation"
                name="abbreviation"
                required
                ${getFieldAttributes(fieldErrors, 'abbreviation')}
                value="${escapeHtml(getMultiplierFormValue(formValues, editingMultiplier, 'abbreviation'))}"
              />
              ${renderFieldError(fieldErrors, 'abbreviation')}
            </div>
            <div class="form-field">
              <label for="multiplier-value">Kerroin *</label>
              <input
                id="multiplier-value"
                name="multiplier"
                required
                inputmode="decimal"
                ${getFieldAttributes(fieldErrors, 'multiplier')}
                value="${escapeHtml(String(getMultiplierFormValue(formValues, editingMultiplier, 'multiplier'))).replace('.', ',')}"
              />
              ${renderFieldError(fieldErrors, 'multiplier')}
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="button">${editingMultiplier ? 'Tallenna muutokset' : 'Lisää kerroin'}</button>
            <button type="button" class="secondary-button" data-reset-multiplier-form>Tyhjennä lomake</button>
            <button type="button" class="ghost-button" data-dismiss-multiplier-dialog>Peruuta</button>
          </div>
          ${
            editingMultiplier
              ? `
                <div class="danger-zone" aria-labelledby="multiplier-delete-title">
                  <div>
                    <h3 id="multiplier-delete-title">Poista kerroin</h3>
                    <p class="section-subtitle">Poistaminen vaatii aina erillisen vahvistuksen.</p>
                  </div>
                  <button type="button" class="danger-button" data-delete-multiplier="${escapeHtml(editingMultiplier.id)}">Poista</button>
                </div>
              `
              : ''
          }
        </form>
      </div>
    </div>
  `;
}

function renderSettingsSection(dataState, uiState) {
  const formValues = {
    ...DEFAULT_PDGA_SETTINGS,
    ...dataState.settings,
    ...(uiState.settingsFormDraft || {}),
  };
  const fieldErrors = uiState.settingsFormErrors || {};

  return `
    <section class="section" id="section-settings" ${uiState.activeView === 'settings' ? '' : 'hidden'} aria-labelledby="settings-title">
      <div class="section-heading">
        <div>
          <h2 id="settings-title">Asetukset</h2>
          <p class="section-subtitle">Yhteiset asetukset vaikuttavat kaikkiin nykyisiin ja tuleviin PDGA-linkkeihin.</p>
        </div>
      </div>
      <div class="two-column">
        <form id="settings-form" class="panel">
          <h3>PDGA-linkkien perusosoitteet</h3>
          <div class="form-grid">
            <div class="form-field full-width">
              <label for="settings-player-base-url">PDGA-pelaajaosoitteen perus-URL *</label>
              <input
                id="settings-player-base-url"
                name="playerBaseUrl"
                type="url"
                required
                ${getFieldAttributes(fieldErrors, 'playerBaseUrl')}
                value="${escapeHtml(formValues.playerBaseUrl)}"
              />
              <span class="help-text">Oletus: ${escapeHtml(DEFAULT_PDGA_SETTINGS.playerBaseUrl)}</span>
              ${renderFieldError(fieldErrors, 'playerBaseUrl')}
            </div>
            <div class="form-field full-width">
              <label for="settings-event-base-url">PDGA-kilpailuosoitteen perus-URL *</label>
              <input
                id="settings-event-base-url"
                name="eventBaseUrl"
                type="url"
                required
                ${getFieldAttributes(fieldErrors, 'eventBaseUrl')}
                value="${escapeHtml(formValues.eventBaseUrl)}"
              />
              <span class="help-text">Oletus: ${escapeHtml(DEFAULT_PDGA_SETTINGS.eventBaseUrl)}</span>
              ${renderFieldError(fieldErrors, 'eventBaseUrl')}
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="button">Tallenna asetukset</button>
            <button type="button" class="secondary-button" data-reset-settings-form>Palauta tallennetut arvot</button>
          </div>
        </form>
        <article class="panel">
          <h3>Miten PDGA-linkit toimivat?</h3>
          <ul>
            <li>Pelaajille tallennetaan vain PDGA-pelaajatunnus.</li>
            <li>Turnauksille tallennetaan vain PDGA-kilpailutunnus.</li>
            <li>Linkit muodostetaan automaattisesti muodossa perusosoite + tunnus.</li>
            <li>Vanhoista täydellisistä PDGA-osoitteista poimitaan tunnus automaattisesti latauksen yhteydessä.</li>
          </ul>
        </article>
      </div>
    </section>
  `;
}

function renderPointsSection(dataState, uiState) {
  const editingPoint = uiState.pointsForm || { division: 'MPO', place: '', basePoints: '', editingKey: '' };
  const mpoEntries = sortTableRows(listPointsTableEntries(dataState.pointsTable, 'MPO'), {
    field: uiState.pointsSortField,
    direction: uiState.pointsSortDirection,
  }, {
    place: { type: 'number' },
    basePoints: { type: 'number' },
  });
  const fpoEntries = sortTableRows(listPointsTableEntries(dataState.pointsTable, 'FPO'), {
    field: uiState.pointsSortField,
    direction: uiState.pointsSortDirection,
  }, {
    place: { type: 'number' },
    basePoints: { type: 'number' },
  });

  return `
    <section class="section" id="section-points" ${uiState.activeView === 'points' ? '' : 'hidden'} aria-labelledby="points-title">
      <div class="section-heading">
        <div>
          <h2 id="points-title">Pistetaulukot</h2>
          <p class="section-subtitle">Pisteet tallennetaan keskitettyyn pointsTable-rakenteeseen sarjan ja sijoituksen perusteella.</p>
        </div>
      </div>
      <article class="panel">
        <h3>CSV-tuonnin ohje</h3>
        <ul>
          <li>Muoto: <code>Sijoitus;Pisteet</code></li>
          <li>Esimerkit: <code>1;100</code>, <code>2;85</code>, <code>3;75</code>, <code>4;10,5</code></li>
          <li>Erotin on puolipiste (;).</li>
          <li>Otsikkorivi on sallittu.</li>
          <li>UTF-8-koodaus on suositeltu.</li>
          <li>Sijoitusten tulee alkaa 1:stä ja edetä peräkkäin ilman aukkoja.</li>
        </ul>
      </article>
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
                <div class="section-heading">
                  <div>
                    <h3>${division}-pistetaulukko</h3>
                  </div>
                  <div class="section-actions">
                    <button type="button" class="secondary-button" data-open-points-import="${division}">Tuo ${division} CSV</button>
                    <button type="button" class="danger-button" data-request-delete-points="${division}">Poista ${division}-pisteet</button>
                  </div>
                </div>
                ${
                  entries.length
                    ? `
                      <div class="table-wrap">
                        <table class="table">
                          <thead>
                            <tr>
                              ${renderSortableHeader({
                                table: 'points',
                                field: 'place',
                                label: 'Sijoitus',
                                sortField: uiState.pointsSortField,
                                sortDirection: uiState.pointsSortDirection,
                              })}
                              ${renderSortableHeader({
                                table: 'points',
                                field: 'basePoints',
                                label: '1x-peruspisteet',
                                sortField: uiState.pointsSortField,
                                sortDirection: uiState.pointsSortDirection,
                              })}
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

function renderPointsImportDialog(uiState) {
  if (!uiState.pointsImportDialogOpen) {
    return '';
  }

  const selectedDivision = uiState.pointsImportDivision || 'MPO';

  return `
    <div class="dialog-backdrop" data-close-points-import-dialog>
      <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="points-import-dialog-title" aria-describedby="points-import-dialog-description" data-points-import-dialog-panel tabindex="-1">
        <form id="points-import-form">
          <div class="section-heading">
            <div>
              <h2 id="points-import-dialog-title">Tuo pistetaulukko CSV-tiedostosta</h2>
              <p id="points-import-dialog-description" class="section-subtitle">Valitse kohdesarja ja tuotava CSV-tiedosto. Tuonti sallitaan vain tyhjään pistetaulukkoon.</p>
            </div>
          </div>
          <div class="form-grid">
            <fieldset class="form-field full-width">
              <legend>Sarja *</legend>
              <div class="segmented-control">
                ${DIVISIONS.map(
                  (division) => `
                    <label>
                      <input type="radio" name="division" value="${division}" ${selectedDivision === division ? 'checked' : ''} />
                      <span>${division}</span>
                    </label>
                  `,
                ).join('')}
              </div>
            </fieldset>
            <div class="form-field full-width">
              <label for="points-import-file">CSV-tiedosto *</label>
              <input id="points-import-file" name="file" type="file" accept=".csv,text/csv" required />
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="secondary-button" data-cancel-points-import>Peruuta</button>
            <button type="submit" class="button">Tuo</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderConfirmationDialog(dataState, uiState) {
  if (!uiState.confirmationDialog) {
    return '';
  }

  if (uiState.confirmationDialog.type === 'delete-player') {
    const player = dataState.players.find((entry) => entry.id === uiState.confirmationDialog.playerId);
    if (!player) {
      return '';
    }

    return `
      <div class="dialog-backdrop" data-close-confirm-dialog>
        <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" data-confirm-dialog-panel tabindex="-1">
          <div class="section-heading">
            <div>
              <h2 id="confirm-dialog-title">Poista pelaaja</h2>
              <p id="confirm-dialog-description" class="section-subtitle">
                Haluatko varmasti poistaa pelaajan ${escapeHtml(player.name)}?<br />
                Toimintoa ei voi peruuttaa.
              </p>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="secondary-button" data-cancel-confirm-dialog autofocus>Peruuta</button>
            <button type="button" class="danger-button" data-confirm-delete-player="${escapeHtml(player.id)}">Poista pelaaja</button>
          </div>
        </div>
      </div>
    `;
  }

  if (uiState.confirmationDialog.type === 'delete-points-division') {
    const division = uiState.confirmationDialog.division;

    return `
      <div class="dialog-backdrop" data-close-confirm-dialog>
        <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" data-confirm-dialog-panel tabindex="-1">
          <div class="section-heading">
            <div>
              <h2 id="confirm-dialog-title">Poista sarjan ${escapeHtml(division)} pisteet</h2>
              <p id="confirm-dialog-description" class="section-subtitle">
                Haluatko varmasti poistaa kaikki sarjan ${escapeHtml(division)} pistetaulukon rivit?<br />
                Tätä toimintoa ei voi perua.
              </p>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="secondary-button" data-cancel-confirm-dialog autofocus>Peruuta</button>
            <button type="button" class="danger-button" data-confirm-delete-points-division="${escapeHtml(division)}">Poista</button>
          </div>
        </div>
      </div>
    `;
  }

  if (uiState.confirmationDialog.type === 'delete-all-tournaments') {
    const tournamentCount = dataState.tournaments.length;
    const resultCount = dataState.tournamentResults.length;
    return `
      <div class="dialog-backdrop" data-close-confirm-dialog>
        <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" data-confirm-dialog-panel tabindex="-1">
          <div class="section-heading">
            <div>
              <h2 id="confirm-dialog-title">VAROITUS</h2>
              <p class="warning-text"><span aria-hidden="true">⚠</span> Tämä toiminto on pysyvä.</p>
              <div id="confirm-dialog-description" class="section-subtitle">
                <p>Olet poistamassa kaikki turnaukset (${formatNumber(tournamentCount)} kpl) ja turnaustulokset (${formatNumber(resultCount)} kpl).</p>
                <p>Toimintoa ei voi peruuttaa.</p>
              </div>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="secondary-button" data-cancel-confirm-dialog>Peruuta</button>
            <button type="button" class="danger-button" data-confirm-delete-all-tournaments>Poista kaikki turnaukset</button>
          </div>
        </div>
      </div>
    `;
  }

  if (uiState.confirmationDialog.type === 'delete-multiplier') {
    const multiplier = dataState.multipliers.find((entry) => entry.id === uiState.confirmationDialog.multiplierId);
    if (!multiplier) {
      return '';
    }

    return `
      <div class="dialog-backdrop" data-close-confirm-dialog>
        <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" data-confirm-dialog-panel tabindex="-1">
          <div class="section-heading">
            <div>
              <h2 id="confirm-dialog-title">Varoitus: poista kerroin</h2>
              <div id="confirm-dialog-description" class="section-subtitle">
                <p>Tämä on pysyvä poistotoiminto.</p>
                <p>Olet poistamassa kertoimen.</p>
                <p>Tätä toimintoa ei voi perua.</p>
                <p>Haluatko varmasti jatkaa?</p>
              </div>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="danger-button" data-confirm-delete-multiplier="${escapeHtml(multiplier.id)}">Poista</button>
            <button type="button" class="secondary-button" data-cancel-confirm-dialog>Peruuta</button>
          </div>
        </div>
      </div>
    `;
  }

  if (uiState.confirmationDialog.type !== 'delete-tournament') {
    return '';
  }

  const tournament = dataState.tournaments.find((entry) => entry.id === uiState.confirmationDialog.tournamentId);
  if (!tournament) {
    return '';
  }

  const resultCount = dataState.tournamentResults.filter((result) => result.tournamentId === tournament.id).length;
  return `
    <div class="dialog-backdrop" data-close-confirm-dialog>
      <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" data-confirm-dialog-panel tabindex="-1">
        <div class="section-heading">
          <div>
            <h2 id="confirm-dialog-title">Poista turnaus</h2>
            <p id="confirm-dialog-description" class="section-subtitle">
              Haluatko varmasti poistaa turnauksen ${escapeHtml(tournament.name)}?<br />
              Samalla poistetaan ${formatNumber(resultCount)} turnaustulosta eikä toimintoa voi peruuttaa.
            </p>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="secondary-button" data-cancel-confirm-dialog autofocus>Peruuta</button>
          <button type="button" class="danger-button" data-confirm-delete-tournament="${escapeHtml(tournament.id)}">Poista turnaus</button>
        </div>
      </div>
    </div>
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
              ${renderDeploymentInfo(uiState.deploymentInfo)}
            </div>
          </div>
          <button class="nav-toggle" type="button" data-toggle-nav aria-expanded="${uiState.navOpen}" aria-controls="main-nav">Valikko</button>
          ${renderNav(uiState.activeView)}
        </div>
      </header>
      <main id="main-content" class="main-inner" tabindex="-1">
        ${uiState.feedback ? `<div class="message ${uiState.feedback.type}" role="status" aria-live="polite">${escapeHtml(uiState.feedback.text)}</div>` : ''}
        ${renderSummarySection(dataState, uiState)}
        ${renderRankingSection(dataState, uiState)}
        ${renderPlayerSection(dataState, uiState)}
        ${renderTournamentSection(dataState, uiState)}
        ${renderPointsSection(dataState, uiState)}
        ${renderMultipliersSection(dataState, uiState)}
        ${renderSettingsSection(dataState, uiState)}
      </main>
      <footer class="site-footer">
        <div class="site-footer-inner">
          <div>SFL Pisteytystyökalu on MVP-versio. Tiedot tallennetaan selaimen localStorageen eikä niitä synkronoida käyttäjien välillä.</div>
          <div>Lopullinen brändivahvistus, logoaineisto ja mahdollinen backend-tietokanta toteutetaan myöhemmässä vaiheessa.</div>
        </div>
      </footer>
      ${renderPlayerDialog(dataState, uiState)}
      ${renderTournamentDialog(dataState, uiState)}
      ${renderMultiplierDialog(dataState, uiState)}
      ${renderTournamentImportDialog(uiState)}
      ${renderPointsImportDialog(uiState)}
      ${renderConfirmationDialog(dataState, uiState)}
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

  root.querySelectorAll('[data-sort-table][data-sort-field]').forEach((button) => {
    button.addEventListener('click', () => handlers.toggleColumnSort(button.dataset.sortTable, button.dataset.sortField));
  });

  root.querySelector('#settings-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submitSettings(new FormData(event.currentTarget));
  });

  root.querySelector('[data-reset-settings-form]')?.addEventListener('click', () => handlers.resetSettingsForm());

  root.querySelectorAll('[data-ranking-filter]').forEach((button) => {
    button.addEventListener('click', () => handlers.setRankingFilter(button.dataset.rankingFilter));
  });

  root.querySelectorAll('[data-summary-filter]').forEach((button) => {
    button.addEventListener('click', () => handlers.setSummaryFilter(button.dataset.summaryFilter));
  });

  root.querySelector('[data-summary-player]')?.addEventListener('change', (event) => {
    handlers.setSummaryPlayer(event.target.value);
  });

  root.querySelector('[data-player-search]')?.addEventListener('input', (event) => {
    handlers.setPlayerSearch(event.target.value);
  });

  root.querySelector('[data-player-division-filter]')?.addEventListener('change', (event) => {
    handlers.setPlayerDivisionFilter(event.target.value);
  });

  root.querySelector('[data-player-sort-field]')?.addEventListener('change', (event) => {
    handlers.setPlayerSortField(event.target.value);
  });

  root.querySelector('[data-player-sort-direction]')?.addEventListener('change', (event) => {
    handlers.setPlayerSortDirection(event.target.value);
  });

  root.querySelector('[data-open-player-dialog]')?.addEventListener('click', () => handlers.openPlayerDialog());
  root.querySelector('[data-retry-players-load]')?.addEventListener('click', () => handlers.retryPlayersLoad());
  root.querySelector('#players-import-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submitPlayersImport(new FormData(event.currentTarget));
  });

  root.querySelector('#player-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submitPlayer(new FormData(event.currentTarget));
  });

  root.querySelector('[data-dismiss-player-dialog]')?.addEventListener('click', () => handlers.closePlayerDialog());
  root.querySelector('[data-player-dialog-backdrop]')?.addEventListener('click', () => handlers.closePlayerDialog());
  root.querySelector('[data-player-dialog-panel]')?.addEventListener('click', (event) => event.stopPropagation());

  root.querySelectorAll('[data-edit-player]').forEach((button) => {
    button.addEventListener('click', () => handlers.editPlayer(button.dataset.editPlayer));
  });

  root.querySelectorAll('[data-delete-player]').forEach((button) => {
    button.addEventListener('click', () => handlers.requestDeletePlayer(button.dataset.deletePlayer));
  });

  root.querySelector('#tournament-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submitTournament(new FormData(event.currentTarget));
  });

  root.querySelector('[data-open-tournament-dialog]')?.addEventListener('click', () => handlers.openTournamentDialog());
  root.querySelector('[data-open-tournament-import-dialog]')?.addEventListener('click', () => handlers.openTournamentImportDialog());
  root.querySelector('[data-reset-tournament-form]')?.addEventListener('click', () => handlers.resetTournamentForm());
  root.querySelector('[data-dismiss-tournament-dialog]')?.addEventListener('click', () => handlers.closeTournamentDialog());
  root.querySelector('[data-tournament-dialog-backdrop]')?.addEventListener('click', () => handlers.closeTournamentDialog());
  root.querySelector('[data-tournament-dialog-panel]')?.addEventListener('click', (event) => event.stopPropagation());
  root.querySelector('#tournament-import-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submitTournamentImport(new FormData(event.currentTarget));
  });
  root.querySelector('#tournament-import-file')?.addEventListener('change', (event) => {
    const submitButton = root.querySelector('[data-submit-tournament-import]');
    if (!submitButton) {
      return;
    }
    const hasFile = Boolean(event.target?.files?.length);
    submitButton.disabled = !hasFile;
  });
  root.querySelector('[data-cancel-tournament-import]')?.addEventListener('click', () => handlers.closeTournamentImportDialog());
  root.querySelector('[data-close-tournament-import-dialog]')?.addEventListener('click', () => handlers.closeTournamentImportDialog());
  root.querySelector('[data-tournament-import-dialog-panel]')?.addEventListener('click', (event) => event.stopPropagation());
  root
    .querySelector('[data-request-delete-all-tournaments]')
    ?.addEventListener('click', () => handlers.requestDeleteAllTournaments());

  root.querySelectorAll('[data-edit-tournament]').forEach((button) => {
    button.addEventListener('click', () => handlers.editTournament(button.dataset.editTournament));
  });

  root.querySelector('[data-tournament-search]')?.addEventListener('input', (event) => {
    handlers.setTournamentSearch(event.target.value);
  });

  root.querySelector('[data-tournament-status-filter]')?.addEventListener('change', (event) => {
    handlers.setTournamentStatusFilter(event.target.value);
  });

  root.querySelector('[data-tournament-sort-field]')?.addEventListener('change', (event) => {
    handlers.setTournamentSortField(event.target.value);
  });

  root.querySelector('[data-tournament-sort-direction]')?.addEventListener('change', (event) => {
    handlers.setTournamentSortDirection(event.target.value);
  });

  root.querySelectorAll('[data-delete-tournament]').forEach((button) => {
    button.addEventListener('click', () => handlers.requestDeleteTournament(button.dataset.deleteTournament));
  });

  root.querySelector('#multiplier-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submitMultiplier(new FormData(event.currentTarget));
  });

  root.querySelector('[data-open-multiplier-dialog]')?.addEventListener('click', () => handlers.openMultiplierDialog());
  root.querySelector('[data-reset-multiplier-form]')?.addEventListener('click', () => handlers.resetMultiplierForm());
  root.querySelector('[data-dismiss-multiplier-dialog]')?.addEventListener('click', () => handlers.closeMultiplierDialog());
  root.querySelector('[data-multiplier-dialog-backdrop]')?.addEventListener('click', () => handlers.closeMultiplierDialog());
  root.querySelector('[data-multiplier-dialog-panel]')?.addEventListener('click', (event) => event.stopPropagation());
  root.querySelectorAll('[data-edit-multiplier]').forEach((button) => {
    button.addEventListener('click', () => handlers.editMultiplier(button.dataset.editMultiplier));
  });
  root.querySelectorAll('[data-delete-multiplier]').forEach((button) => {
    button.addEventListener('click', () => handlers.requestDeleteMultiplier(button.dataset.deleteMultiplier));
  });

  root.querySelector('#points-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submitPoints(new FormData(event.currentTarget));
  });

  root.querySelector('[data-reset-points-form]')?.addEventListener('click', () => handlers.resetPointsForm());

  root.querySelector('#points-import-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submitPointsImport(new FormData(event.currentTarget));
  });

  root.querySelectorAll('[data-open-points-import]').forEach((button) => {
    button.addEventListener('click', () => handlers.openPointsImportDialog(button.dataset.openPointsImport));
  });

  root.querySelector('[data-cancel-points-import]')?.addEventListener('click', () => handlers.closePointsImportDialog());
  root.querySelector('[data-close-points-import-dialog]')?.addEventListener('click', () => handlers.closePointsImportDialog());
  root.querySelector('[data-points-import-dialog-panel]')?.addEventListener('click', (event) => event.stopPropagation());

  root.querySelectorAll('[data-edit-point]').forEach((button) => {
    button.addEventListener('click', () => handlers.editPoint(button.dataset.editPoint));
  });

  root.querySelectorAll('[data-delete-point]').forEach((button) => {
    button.addEventListener('click', () => handlers.deletePoint(button.dataset.deletePoint));
  });

  root.querySelectorAll('[data-request-delete-points]').forEach((button) => {
    button.addEventListener('click', () => handlers.requestDeletePointsDivision(button.dataset.requestDeletePoints));
  });

  root.querySelector('[data-close-confirm-dialog]')?.addEventListener('click', () => handlers.closeConfirmationDialog());
  root.querySelector('[data-confirm-dialog-panel]')?.addEventListener('click', (event) => event.stopPropagation());
  root.querySelector('[data-confirm-dialog-panel]')?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handlers.closeConfirmationDialog();
    }
  });
  root.querySelector('[data-cancel-confirm-dialog]')?.addEventListener('click', () => handlers.closeConfirmationDialog());
  root.querySelector('[data-confirm-delete-player]')?.addEventListener('click', () => handlers.confirmDeletePlayer());
  root.querySelector('[data-confirm-delete-tournament]')?.addEventListener('click', () => handlers.confirmDeleteTournament());
  root.querySelector('[data-confirm-delete-all-tournaments]')?.addEventListener('click', () => handlers.confirmDeleteAllTournaments());
  root.querySelector('[data-confirm-delete-multiplier]')?.addEventListener('click', () => handlers.confirmDeleteMultiplier());
  root.querySelector('[data-confirm-delete-points-division]')?.addEventListener('click', () => handlers.confirmDeletePointsDivision());

  if (root.__dialogKeydownHandler) {
    document.removeEventListener('keydown', root.__dialogKeydownHandler);
    root.__dialogKeydownHandler = null;
  }

  if (
    uiState.tournamentDialogOpen ||
    uiState.multiplierDialogOpen ||
    uiState.playerDialogOpen ||
    uiState.tournamentImportDialogOpen ||
    uiState.pointsImportDialogOpen ||
    uiState.confirmationDialog
  ) {
    root.__dialogKeydownHandler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (uiState.confirmationDialog) {
          handlers.closeConfirmationDialog();
          return;
        }
        if (uiState.pointsImportDialogOpen) {
          handlers.closePointsImportDialog();
          return;
        }
        if (uiState.tournamentImportDialogOpen) {
          handlers.closeTournamentImportDialog();
          return;
        }
        if (uiState.playerDialogOpen) {
          handlers.closePlayerDialog();
          return;
        }
        if (uiState.multiplierDialogOpen) {
          handlers.closeMultiplierDialog();
          return;
        }
        handlers.closeTournamentDialog();
        return;
      }

      if (
        !uiState.confirmationDialog &&
        !uiState.playerDialogOpen &&
        !uiState.tournamentDialogOpen &&
        !uiState.multiplierDialogOpen &&
        !uiState.tournamentImportDialogOpen &&
        !uiState.pointsImportDialogOpen
      ) {
        return;
      }

      const activeDialogPanel = uiState.confirmationDialog
        ? root.querySelector('[data-confirm-dialog-panel]')
        : uiState.tournamentImportDialogOpen
          ? root.querySelector('[data-tournament-import-dialog-panel]')
        : uiState.pointsImportDialogOpen
          ? root.querySelector('[data-points-import-dialog-panel]')
        : uiState.multiplierDialogOpen
          ? root.querySelector('[data-multiplier-dialog-panel]')
        : uiState.playerDialogOpen
          ? root.querySelector('[data-player-dialog-panel]')
          : root.querySelector('[data-tournament-dialog-panel]');
      trapFocusInDialog(event, activeDialogPanel);
    };
    document.addEventListener('keydown', root.__dialogKeydownHandler);
  }

  if (uiState.tournamentDialogOpen && uiState.tournamentFormFocusTarget) {
    root.querySelector(getTournamentFieldSelector(uiState.tournamentFormFocusTarget))?.focus();
    uiState.tournamentFormFocusTarget = '';
  } else if (uiState.tournamentDialogOpen) {
    root.querySelector('[data-tournament-dialog-panel]')?.focus();
  } else if (uiState.multiplierDialogOpen && uiState.multiplierFormFocusTarget) {
    root.querySelector(getMultiplierFieldSelector(uiState.multiplierFormFocusTarget))?.focus();
    uiState.multiplierFormFocusTarget = '';
  } else if (uiState.multiplierDialogOpen) {
    root.querySelector('[data-multiplier-dialog-panel]')?.focus();
  } else if (uiState.tournamentImportDialogOpen && uiState.tournamentImportFocusTarget) {
    root.querySelector(getTournamentImportFieldSelector(uiState.tournamentImportFocusTarget))?.focus();
    uiState.tournamentImportFocusTarget = '';
  } else if (uiState.tournamentImportDialogOpen) {
    root.querySelector('[data-tournament-import-dialog-panel]')?.focus();
  } else if (uiState.pointsImportDialogOpen && uiState.pointsImportFocusTarget) {
    root.querySelector(getPointsImportFieldSelector(uiState.pointsImportFocusTarget))?.focus();
    uiState.pointsImportFocusTarget = '';
  } else if (uiState.pointsImportDialogOpen) {
    root.querySelector('[data-points-import-dialog-panel]')?.focus();
  } else if (uiState.playerDialogOpen && uiState.playerDialogFocusTarget) {
    root.querySelector(getPlayerFieldSelector(uiState.playerDialogFocusTarget))?.focus();
    uiState.playerDialogFocusTarget = '';
  } else if (uiState.playerDialogOpen) {
    root.querySelector('[data-player-dialog-panel]')?.focus();
  } else if (uiState.confirmationDialog) {
    root.querySelector('[data-cancel-confirm-dialog]')?.focus();
  } else if (uiState.pendingFocusSelector) {
    root.querySelector(uiState.pendingFocusSelector)?.focus();
    uiState.pendingFocusSelector = '';
  }
}
