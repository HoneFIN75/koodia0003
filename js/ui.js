import { DIVISIONS, getVisiblePlayers } from './players.js';
import { DEFAULT_TOURNAMENT_DISPLAY_ORDER, sortTournaments, filterAndSortTournaments, formatTournamentDateRange } from './tournaments.js';
import { buildPdgaEventUrl, buildPdgaPlayerUrl, DEFAULT_PDGA_SETTINGS, isUnassignedPdgaEventId, POINT_DECIMALS_OPTIONS, sanitizePointDecimals } from './pdga.js';
import { listPointsTableEntries } from './scoring.js';
import {
  buildPlayerResultCardRows,
  buildTournamentStandings,
  countResults,
  formatBestResult,
  getBestTournamentResults,
  getPlayerResultRow,
} from './results.js';
import { buildRanking, getTopRanking } from './ranking.js';
import { findMultiplier, formatMultiplier, sortMultipliers } from './multipliers.js';
import { sortTableRows } from './table-sorting.js';
import { HELP_SECTIONS } from './helpData.js';

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

export function formatPoints(value, settings) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '—';
  }

  const decimals = sanitizePointDecimals(settings?.pointDecimals);

  return new Intl.NumberFormat('fi-FI', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(parsed);
}

function formatDeploymentTimestamp(value) {  const parsedDate = new Date(value);
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

function renderPlayerName(player) {
  return `<span class="player-name-text">${escapeHtml(player?.name || '—')}</span>`;
}

// Rankingissa pelaajan nimi on sovelluksen sisäinen painike, joka avaa pelaajan tuloskortin.
// Näkyvä teksti on pelaajan nimi ja aria-label täydentää sen toiminnon kuvauksella. Alleviivaus ja
// osoitinkursori kertovat klikattavuudesta, joten käyttö ei perustu pelkkään väriin.
function renderPlayerNameResultCardButton(player, origin) {
  const playerId = player?.id;
  const playerName = String(player?.name || '').trim();
  if (!playerId || !playerName) {
    return renderPlayerName(player);
  }

  const escapedName = escapeHtml(playerName);
  return `<button type="button" class="player-name-button" data-open-player-result-card="${escapeHtml(playerId)}" data-result-card-origin="${escapeHtml(origin)}" title="Avaa tuloskortti" aria-label="Avaa pelaajan ${escapedName} tuloskortti">${escapedName}</button>`;
}

function renderPdgaPlayerIdLink(player, settings) {
  const pdgaNumber = renderValueOrDash(player?.pdgaNumber);
  const playerPdgaUrl = buildPdgaPlayerUrl(settings, player);
  if (!playerPdgaUrl) {
    return escapeHtml(pdgaNumber);
  }

  const playerName = escapeHtml(player?.name || '');
  return `<a class="pdga-id-link" href="${escapeHtml(playerPdgaUrl)}" target="_blank" rel="noopener noreferrer" title="Avaa PDGA-profiili" aria-label="Avaa pelaajan ${playerName} PDGA-profiili">${escapeHtml(pdgaNumber)}</a>`;
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

function renderSortableHeader({ table, field, label, sortField, sortDirection, className = '', ariaLabel = '', attributes = {} }) {
  const sortState = getSortState(sortField, sortDirection, field);
  const serializedAttributes = Object.entries(attributes)
    .map(([key, value]) => `${escapeHtml(key)}="${escapeHtml(value)}"`)
    .join(' ');

  return `
    <th${className ? ` class="${escapeHtml(className)}"` : ''} aria-sort="${sortState.ariaSort}">
      <button type="button" class="table-sort-button${sortState.isActive ? ' is-active' : ''}" data-sort-table="${escapeHtml(table)}" data-sort-field="${escapeHtml(field)}"${serializedAttributes ? ` ${serializedAttributes}` : ''}${ariaLabel ? ` aria-label="${escapeHtml(ariaLabel)}"` : ''}>
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
        <div><dt>Nimi</dt><dd>${renderPlayerName(player)}</dd></div>
        <div><dt>Sarja</dt><dd>${escapeHtml(player.division)}</dd></div>
        <div><dt>PDGA-tunnus</dt><dd>${renderPdgaPlayerIdLink(player, settings)}</dd></div>
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

// Tuloskortin lähtönäkymä rajataan tuettuihin näkymiin, jotta navigaatio ja paluu pysyvät ehjinä.
export function resolveResultCardOriginView(origin) {
  return origin === 'ranking' ? 'ranking' : 'players';
}

function renderNav(activeView, resultCardOrigin = 'players') {
  // Tuloskortti on alanäkymä: aktiivinen navigaatiokohta säilyy siinä näkymässä, josta kortti avattiin.
  // Turnauksen tuloskortti avataan aina Tulokset-sivulta.
  const currentView = activeView === 'player-result-card'
    ? resolveResultCardOriginView(resultCardOrigin)
    : activeView === 'tournament-result-card' ? 'results' : activeView;
  const items = [
    { id: 'summary', label: 'Yhteenveto' },
    { id: 'ranking', label: 'Ranking' },
    { id: 'results', label: 'Tulokset' },
    { id: 'players', label: 'Pelaajat' },
    { id: 'tournaments', label: 'Turnaukset' },
    { id: 'points', label: 'Pistetaulukot' },
    { id: 'multipliers', label: 'Kertoimet' },
    { id: 'help', label: 'Ohjeet' },
    { id: 'settings', label: 'Asetukset' },
  ];

  return `
    <nav class="main-nav" id="main-nav" aria-label="Päänavigaatio">
      <ul>
        ${items
          .map(
            (item) => `
              <li>
                <button type="button" data-view-target="${item.id}" aria-current="${currentView === item.id ? 'page' : 'false'}">
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

function renderHelpHint(sectionTitle, { showLink = true } = {}) {
  return `
    <p class="help-hint">
      <span>Tarkemmat ohjeet löytyvät Ohjeet-osion kohdasta ${escapeHtml(sectionTitle)}.</span>
      ${showLink ? '<button type="button" class="secondary-button" data-view-target="help">Avaa Ohjeet</button>' : ''}
    </p>
  `;
}

function renderActionBar({ label, actions = [], dangerActions = [] }) {
  const normalActions = actions.filter(Boolean);
  const destructiveActions = dangerActions.filter(Boolean);
  if (!normalActions.length && !destructiveActions.length) {
    return '';
  }

  return `
    <div class="action-bar" role="group" aria-label="${escapeHtml(label)}">
      ${normalActions.length ? `<div class="action-bar-group">${normalActions.join('')}</div>` : ''}
      ${
        destructiveActions.length
          ? `<div class="action-bar-group action-bar-danger" role="group" aria-label="Vaaralliset toiminnot">${destructiveActions.join('')}</div>`
          : ''
      }
    </div>
  `;
}

function renderDangerActionButton({ attribute, value = '', label, disabled = false }) {
  const attributeMarkup = value ? `${attribute}="${escapeHtml(value)}"` : attribute;
  return `<button type="button" class="danger-button danger-action-button" ${attributeMarkup}${disabled ? ' disabled' : ''}><span class="danger-icon" aria-hidden="true">⚠</span> ${escapeHtml(label)}</button>`;
}

function renderFilterButtons({ label, attribute, options, activeValue }) {
  return `
    <div class="filter-group" role="group" aria-label="${escapeHtml(label)}">
      ${options
        .map(
          (option) => `
            <button type="button" class="filter-button" ${attribute}="${escapeHtml(option.value)}" aria-pressed="${activeValue === option.value}"${option.title ? ` title="${escapeHtml(option.title)}"` : ''}>${escapeHtml(option.label)}</button>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderTableSearch({ id, attribute, value, label = 'Haku', placeholder }) {
  return `
    <div class="table-search">
      <label for="${escapeHtml(id)}">${escapeHtml(label)}</label>
      <input id="${escapeHtml(id)}" type="search" ${attribute} value="${escapeHtml(value || '')}" placeholder="${escapeHtml(placeholder)}" />
    </div>
  `;
}

function renderTableToolbar({ label, search = '', filters = '', meta = '' }) {
  if (!search && !filters && !meta) {
    return '';
  }

  return `
    <div class="table-toolbar" role="group" aria-label="${escapeHtml(label)}">
      ${search}
      ${filters}
      ${meta ? `<div class="table-toolbar-meta">${meta}</div>` : ''}
    </div>
  `;
}

function renderImportInstructions({ id, format, requirements = [], example = [] }) {
  return `
    <section class="import-instructions" aria-labelledby="${escapeHtml(id)}-title">
      <h3 id="${escapeHtml(id)}-title"><span class="import-icon" aria-hidden="true">📄</span> Tuettu CSV-muoto</h3>
      <p class="import-format"><code>${escapeHtml(format)}</code></p>
      <p class="import-delimiter"><strong>Erotin:</strong> puolipiste <code>;</code></p>
      ${
        requirements.length
          ? `
            <h4>Vaatimukset</h4>
            <ul class="import-requirements">
              ${requirements.map((requirement) => `<li><span aria-hidden="true">✓</span> ${escapeHtml(requirement)}</li>`).join('')}
            </ul>
          `
          : ''
      }
      ${
        example.length
          ? `
            <h4>Esimerkki</h4>
            <pre class="import-example"><code>${example.map((line) => escapeHtml(line)).join('\n')}</code></pre>
          `
          : ''
      }
    </section>
  `;
}

function renderDangerConfirmDialog({ title, body, confirmAttribute, confirmLabel = 'Poista' }) {
  return `
    <div class="dialog-backdrop" data-close-confirm-dialog>
      <div class="dialog-panel dialog-panel-danger" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-warning confirm-dialog-title" aria-describedby="confirm-dialog-description" data-confirm-dialog-panel tabindex="-1">
        <p class="danger-banner" id="confirm-dialog-warning"><span aria-hidden="true">⚠</span> VAROITUS <span aria-hidden="true">⚠</span></p>
        <h2 id="confirm-dialog-title">${escapeHtml(title)}</h2>
        <div id="confirm-dialog-description" class="confirm-dialog-body">
          ${body}
        </div>
        <div class="form-actions">
          <button type="button" class="danger-button danger-action-button" ${confirmAttribute}>${escapeHtml(confirmLabel)}</button>
          <button type="button" class="secondary-button" data-cancel-confirm-dialog autofocus>Peruuta</button>
        </div>
      </div>
    </div>
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

function renderTopTenCard(title, ranking, division, dataState) {
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
                        <span class="chart-player-meta">
                          <strong>${index + 1}.</strong>
                          <span>${renderPlayerName(entry)}</span>
                        </span>
                        <span>${formatPoints(entry.totalPoints, dataState.settings)} p</span>
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
  const mpoRanking = buildRanking(dataState, 'MPO');
  const fpoRanking = buildRanking(dataState, 'FPO');

  return `
    <section class="section" id="section-summary" ${uiState.activeView === 'summary' ? '' : 'hidden'} aria-labelledby="summary-title">
      <h1 id="summary-title">Yhteenveto</h1>
      ${renderStats(dataState)}
      <div class="two-column">
        ${renderTopTenCard('TOP 10 MPO', mpoRanking, 'MPO', dataState)}
        ${renderTopTenCard('TOP 10 FPO', fpoRanking, 'FPO', dataState)}
      </div>
    </section>
  `;
}

function renderRankingSection(dataState, uiState) {
  const ranking = sortTableRows(
    buildRanking(dataState, uiState.rankingFilter).map((entry, index) => ({
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
      pdgaNumber: { type: 'number' },
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
      </div>
      <article class="card">
        ${renderTableToolbar({
          label: 'Ranking-taulukon suodatus',
          filters: renderFilterButtons({
            label: 'Suodata sarjan mukaan',
            attribute: 'data-ranking-filter',
            options: [{ value: 'ALL', label: 'Kaikki' }, ...DIVISIONS.map((division) => ({ value: division, label: division }))],
            activeValue: uiState.rankingFilter,
          }),
          meta: `<span class="status-chip">${formatNumber(ranking.length)} pelaajaa</span>`,
        })}
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
                        ariaLabel: 'Sijoitus',
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
                        field: 'pdgaNumber',
                        label: 'PDGA ID',
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
                        (entry, index) => `
                          <tr>
                            <td>${index + 1}</td>
                            <td>${renderPlayerNameResultCardButton(entry, 'ranking')}</td>
                            <td>${renderPdgaPlayerIdLink(entry, dataState.settings)}</td>
                            <td>${escapeHtml(entry.division)}</td>
                            <td>${escapeHtml(entry.pdgaRating || '—')}</td>
                            <td>${escapeHtml(entry.worldRank || '—')}</td>
                            <td>${formatNumber(entry.tournamentCount)}</td>
                            <td class="number">${formatPoints(entry.totalPoints, dataState.settings)} p</td>
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

function renderTournamentName(tournament) {
  return `<span class="tournament-name-text">${escapeHtml(tournament?.name || '—')}</span>`;
}

function renderPdgaEventIdLink(tournament, settings) {
  const rawId = tournament?.pdgaEventId;
  if (isUnassignedPdgaEventId(rawId)) {
    const displayText = rawId === 0 ? '000000' : String(rawId);
    return `<span class="pdga-id-unassigned">${escapeHtml(displayText)}</span>`;
  }

  const pdgaEventUrl = buildPdgaEventUrl(settings, tournament);
  if (!pdgaEventUrl) {
    return escapeHtml(renderValueOrDash(rawId));
  }

  const tournamentName = escapeHtml(tournament?.name || '');
  return `<a class="pdga-id-link" href="${escapeHtml(pdgaEventUrl)}" target="_blank" rel="noopener noreferrer" title="Avaa PDGA-turnaussivu" aria-label="Avaa turnauksen ${tournamentName} PDGA-sivu (${escapeHtml(String(rawId))})">${escapeHtml(String(rawId))}</a>`;
}

function renderResultsSection(dataState, uiState) {
  const tournaments = sortTournaments(dataState.tournaments || []);

  return `
    <section class="section" id="section-results" ${uiState.activeView === 'results' ? '' : 'hidden'} aria-labelledby="results-title">
      <div class="section-heading">
        <div>
          <h2 id="results-title">Tulokset</h2>
          <p class="section-subtitle">Turnausten tulosyhteenveto. Sijoitukset syötetään pelaajakohtaisesti Pelaajat-sivun Tuloskortti-painikkeella.</p>
        </div>
      </div>
      ${renderHelpHint('Tulokset')}
      <article class="panel">
        ${
          tournaments.length
            ? `
              <div class="table-wrap">
                <table class="table results-overview-table">
                  <thead>
                    <tr>
                      <th scope="col">Turnauksen nimi</th>
                      <th scope="col">Tila</th>
                      <th scope="col" class="number">Kerroin</th>
                      <th scope="col">PDGA Event ID</th>
                      <th scope="col">Alkupäivä</th>
                      <th scope="col">Loppupäivä</th>
                      <th scope="col">Paras MPO</th>
                      <th scope="col">Paras FPO</th>
                      <th scope="col"><span class="visually-hidden">Turnauksen tulokset</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tournaments
                      .map((tournament) => {
                        const multiplier = findMultiplier(dataState.multipliers || [], tournament.multiplierId);
                        const best = getBestTournamentResults(dataState, tournament.id);
                        return `
                          <tr>
                            <td data-label="Turnauksen nimi">${renderTournamentName(tournament)}</td>
                            <td data-label="Tila">${escapeHtml(renderValueOrDash(multiplier?.abbreviation))}</td>
                            <td data-label="Kerroin" class="number">${multiplier ? escapeHtml(formatMultiplier(multiplier.multiplier)) : '—'}</td>
                            <td data-label="PDGA Event ID">${renderPdgaEventIdLink(tournament, dataState.settings)}</td>
                            <td data-label="Alkupäivä">${formatDate(tournament.startDate)}</td>
                            <td data-label="Loppupäivä">${formatDate(tournament.endDate)}</td>
                            <td data-label="Paras MPO">${escapeHtml(formatBestResult(best.MPO))}</td>
                            <td data-label="Paras FPO">${escapeHtml(formatBestResult(best.FPO))}</td>
                            <td data-label="Turnauksen tulokset"><button type="button" class="secondary-button" data-open-tournament-result-card="${escapeHtml(tournament.id)}" aria-label="Avaa turnauksen ${escapeHtml(tournament.name || 'Nimetön turnaus')} tulokset">Tulokset</button></td>
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
    </section>
  `;
}

const MEDAL_DETAILS = {
  gold: { icon: '🥇', label: 'Kultamitali' },
  silver: { icon: '🥈', label: 'Hopeamitali' },
  bronze: { icon: '🥉', label: 'Pronssimitali' },
};

function renderTournamentStandingsRow(row) {
  const medal = MEDAL_DETAILS[row.medal];
  // Mitali kerrotaan kuvakkeella ja tekstivastineella, jotta korostus ei perustu pelkkään väriin.
  const medalIcon = medal
    ? `<span class="medal-icon" role="img" aria-label="${medal.label}">${medal.icon}</span>`
    : '<span class="medal-icon medal-icon-empty" aria-hidden="true"></span>';

  return `
    <tr class="standings-row${medal ? ` medal-${row.medal}` : ''}"${medal ? ` data-medal="${row.medal}"` : ''}>
      <td data-label="Sijoitus" class="standings-placement">${medalIcon}<span class="standings-placement-value">${escapeHtml(row.placement)}</span></td>
      <td data-label="Kilpailija" class="standings-player">${escapeHtml(row.name)}</td>
    </tr>
  `;
}

function renderTournamentStandingsDivision({ division, rows }) {
  const headingId = `tournament-standings-${division}`;

  return `
    <section class="tournament-standings-division" aria-labelledby="${headingId}" data-tournament-standings-division="${division}">
      <h3 id="${headingId}" class="tournament-standings-title">${division}</h3>
      <table class="table standings-table">
        <thead>
          <tr>
            <th scope="col">Sijoitus</th>
            <th scope="col">Kilpailija</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(renderTournamentStandingsRow).join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderTournamentResultCardEventId(tournament, settings) {
  if (isUnassignedPdgaEventId(tournament?.pdgaEventId)) {
    return `<span class="pdga-id-unassigned pdga-id-warning" title="PDGA Event ID:tä ei ole vielä määritetty"><span aria-hidden="true">⚠</span> ${renderPdgaEventIdLink(tournament, settings)}<span class="visually-hidden"> (PDGA Event ID:tä ei ole vielä määritetty)</span></span>`;
  }

  return renderPdgaEventIdLink(tournament, settings);
}

function renderTournamentResultCardSection(dataState, uiState) {
  if (uiState.activeView !== 'tournament-result-card') {
    return '';
  }

  const backButton = '<button type="button" class="secondary-button" data-close-tournament-result-card>← Takaisin tuloksiin</button>';
  const tournament = (dataState.tournaments || []).find((entry) => entry.id === uiState.tournamentResultCardId);
  if (!tournament) {
    return `
      <section class="section" id="section-tournament-result-card" aria-labelledby="tournament-result-card-title">
        <h2 id="tournament-result-card-title">Turnauksen tulokset</h2>
        ${renderEmptyState('Turnausta ei löytynyt.')}
        ${renderActionBar({ label: 'Turnauksen tuloskortin toiminnot', actions: [backButton] })}
      </section>
    `;
  }

  const multiplier = findMultiplier(dataState.multipliers || [], tournament.multiplierId);
  const standings = buildTournamentStandings(dataState, tournament.id);
  const dateRange = formatTournamentDateRange(tournament.startDate, tournament.endDate);

  return `
    <section class="section" id="section-tournament-result-card" aria-labelledby="tournament-result-card-title">
      ${renderActionBar({ label: 'Turnauksen tuloskortin toiminnot', actions: [backButton] })}
      ${renderHelpHint('Tulokset → Turnauksen tulokset')}
      <article class="panel tournament-result-card" data-tournament-result-card="${escapeHtml(tournament.id)}">
        <header class="tournament-result-card-header">
          <p class="eyebrow">Turnauksen tuloskortti</p>
          <h2 id="tournament-result-card-title" class="tournament-result-card-title">${escapeHtml(tournament.name || 'Nimetön turnaus')}</h2>
          <dl class="tournament-result-card-meta">
            <div><dt>Päivämäärä</dt><dd data-tournament-result-card-date>${escapeHtml(dateRange || '—')}</dd></div>
            <div><dt>Paikkakunta</dt><dd>${escapeHtml(renderValueOrDash(tournament.location))}</dd></div>
            <div><dt>Tila</dt><dd><span class="status-chip tournament-result-card-status">${escapeHtml(renderValueOrDash(multiplier?.abbreviation))}</span></dd></div>
            <div><dt>PDGA Event ID</dt><dd>${renderTournamentResultCardEventId(tournament, dataState.settings)}</dd></div>
          </dl>
        </header>
        ${
          standings.length
            ? `<div class="tournament-standings">${standings.map(renderTournamentStandingsDivision).join('')}</div>`
            : renderEmptyState('Turnaukseen ei ole vielä syötetty tuloksia.')
        }
      </article>
    </section>
  `;
}

function renderPlayerResultPoints(calculatedPoints) {
  return typeof calculatedPoints === 'number' ? `${formatNumber(calculatedPoints)} p` : '—';
}

function renderPlayerResultCardRow(dataState, player, row, editMode = false) {
  const { tournament, placement, calculatedPoints } = row;
  const tournamentId = escapeHtml(tournament.id);
  const multiplier = findMultiplier(dataState.multipliers || [], tournament.multiplierId);
  const tournamentName = escapeHtml(tournament.name || 'Nimetön turnaus');

  return `
    <tr data-player-result-row="${tournamentId}">
      <td data-label="Turnauksen nimi">${escapeHtml(tournament.name || 'Nimetön turnaus')}</td>
      <td data-label="Tila">${escapeHtml(renderValueOrDash(multiplier?.abbreviation))}</td>
      <td data-label="Kerroin" class="number">${multiplier ? escapeHtml(formatMultiplier(multiplier.multiplier)) : '—'}</td>
      <td data-label="PDGA Event ID">${renderPdgaEventIdLink(tournament, dataState.settings)}</td>
      <td data-label="Sijoitus">
        <input
          type="text"
          class="placement-input"
          inputmode="text"
          maxlength="6"
          autocomplete="off"
          spellcheck="false"
          value="${escapeHtml(placement)}"
          placeholder="3 tai 3T4"
          aria-label="Sijoitus: ${tournamentName}"
          aria-describedby="result-placement-error-${tournamentId}"
          data-result-placement
          data-player-id="${escapeHtml(player.id)}"
          data-tournament-id="${tournamentId}"
          ${editMode ? '' : 'readonly aria-readonly="true"'}
        />
        <span class="field-error" id="result-placement-error-${tournamentId}" data-result-placement-error role="alert" hidden></span>
      </td>
      <td data-label="Lasketut pisteet" class="number" data-result-points>${renderPlayerResultPoints(calculatedPoints)}</td>
      <td data-label="Tyhjennä">
        <button type="button" class="danger-button" data-clear-player-placement="${tournamentId}" data-player-id="${escapeHtml(player.id)}" aria-label="Tyhjennä sijoitus: ${tournamentName}"${placement && editMode ? '' : ' disabled'}>Tyhjennä</button>
      </td>
    </tr>
  `;
}

function renderPlayerResultCardModeBadge(editMode) {
  // Tila kerrotaan aina tekstillä ja symbolilla, jotta käyttö ei perustu pelkkään väriin.
  const mode = editMode
    ? { key: 'edit', label: 'Muokkaustila', symbol: '✎', chipClass: 'status-chip warning' }
    : { key: 'read-only', label: 'Lukutila', symbol: '🔒', chipClass: 'status-chip' };

  return `
    <p class="result-card-mode" id="player-result-card-mode">
      <span class="${mode.chipClass}" data-result-card-mode="${mode.key}">
        <span aria-hidden="true">${mode.symbol}</span> ${mode.label}
      </span>
    </p>
  `;
}

function renderPlayerResultCardSection(dataState, uiState) {
  if (uiState.activeView !== 'player-result-card') {
    return '';
  }

  const player = (dataState.players || []).find((entry) => entry.id === uiState.resultCardPlayerId);
  // Paluupainike seuraa sitä näkymää, josta tuloskortti avattiin (Pelaajat tai Ranking).
  const backLabel = resolveResultCardOriginView(uiState.resultCardOrigin) === 'ranking'
    ? '← Takaisin Rankingiin'
    : '← Takaisin pelaajiin';
  const backButton = `<button type="button" class="secondary-button" data-close-player-result-card>${backLabel}</button>`;
  if (!player) {
    return `
      <section class="section" id="section-player-result-card" aria-labelledby="player-result-card-title">
        <h2 id="player-result-card-title">Tuloskortti</h2>
        ${renderEmptyState('Pelaajaa ei löytynyt.')}
        ${renderActionBar({ label: 'Tuloskortin toiminnot', actions: [backButton] })}
      </section>
    `;
  }

  // Tuloskortti avautuu aina lukutilaan. Muokkaustilassa näytetään kesken olevat
  // muutokset (luonnos), jotta pisteet lasketaan heti mutta mitään ei tallenneta
  // ennen Tallenna ja poistu -painiketta.
  const editMode = Boolean(uiState.resultCardEditMode);
  const viewState = editMode && uiState.resultCardDraft
    ? { ...dataState, resultCards: uiState.resultCardDraft }
    : dataState;
  const rows = buildPlayerResultCardRows(viewState, player.id);

  return `
    <section class="section" id="section-player-result-card" aria-labelledby="player-result-card-title">
      <div class="section-heading">
        <div>
          <h2 id="player-result-card-title">Tuloskortti: ${escapeHtml(player.name)}</h2>
          <p class="section-subtitle">Sarja: ${escapeHtml(player.division)} · PDGA ID: ${renderPdgaPlayerIdLink(player, dataState.settings)}</p>
        </div>
        ${renderPlayerResultCardModeBadge(editMode)}
      </div>
      ${renderActionBar({
        label: 'Tuloskortin toiminnot',
        actions: editMode
          ? [
            '<button type="button" class="button" data-save-player-result-card>Tallenna ja poistu</button>',
            '<button type="button" class="secondary-button" data-exit-player-result-card-edit>Poistu</button>',
          ]
          : [
            backButton,
            '<button type="button" class="button" data-edit-player-result-card>Muokkaa</button>',
          ],
      })}
      ${renderHelpHint('Pelaajat → Tuloskortti')}
      <p class="result-card-save-status" data-result-card-save-status role="status" aria-live="polite"></p>
      <article class="panel">
        ${
          rows.length
            ? `
              <div class="table-wrap">
                <table class="table player-result-card-table" aria-describedby="player-result-card-mode">
                  <thead>
                    <tr>
                      <th scope="col">Turnauksen nimi</th>
                      <th scope="col">Tila</th>
                      <th scope="col" class="number">Kerroin</th>
                      <th scope="col">PDGA Event ID</th>
                      <th scope="col">Sijoitus</th>
                      <th scope="col" class="number">Lasketut pisteet</th>
                      <th scope="col">Tyhjennä</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows.map((row) => renderPlayerResultCardRow(viewState, player, row, editMode)).join('')}
                  </tbody>
                </table>
              </div>
            `
            : renderEmptyState('Turnauksia ei ole vielä lisätty. Lisää turnaukset Turnaukset-sivulla.')
        }
      </article>
    </section>
  `;
}

function escapeAttributeSelectorValue(value) {
  return String(value ?? '').replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

// Päivittää tuloskortin yksittäisen rivin paikallaan (pisteet, virhe, Tyhjennä-painike)
// ilman koko näkymän uudelleenpiirtoa. Pisteet lasketaan samasta lähteestä kuin rankingissa.
export function updatePlayerResultRow(root, dataState, playerId, tournamentId, { error = '' } = {}) {
  const row = root?.querySelector?.(`[data-player-result-row="${escapeAttributeSelectorValue(tournamentId)}"]`);
  if (!row) {
    return;
  }

  const input = row.querySelector('input[data-result-placement]');
  const errorElement = row.querySelector('[data-result-placement-error]');
  if (error) {
    input?.setAttribute('aria-invalid', 'true');
    if (errorElement) {
      errorElement.textContent = error;
      errorElement.hidden = false;
    }
    return;
  }

  input?.removeAttribute('aria-invalid');
  if (errorElement) {
    errorElement.textContent = '';
    errorElement.hidden = true;
  }

  const tournament = (dataState.tournaments || []).find((entry) => entry.id === tournamentId);
  const { placement, calculatedPoints } = getPlayerResultRow(dataState, playerId, tournament);
  const pointsElement = row.querySelector('[data-result-points]');
  if (pointsElement) {
    pointsElement.textContent = renderPlayerResultPoints(calculatedPoints);
  }

  const clearButton = row.querySelector('[data-clear-player-placement]');
  if (clearButton) {
    clearButton.disabled = !placement;
  }
}

export function setPlayerResultCardStatus(root, type, text) {
  const statusElement = root?.querySelector?.('[data-result-card-save-status]');
  if (!statusElement) {
    return;
  }

  statusElement.textContent = text;
  statusElement.dataset.statusType = type;
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

  return `
    <section class="section" id="section-players" ${uiState.activeView === 'players' ? '' : 'hidden'} aria-labelledby="players-title">
      <div class="section-heading">
        <div>
          <h2 id="players-title">Pelaajat</h2>
          <p class="section-subtitle">Pelaajalista on tämän sivun pääsisältö. Hae nimellä tai PDGA-tunnuksella ja lajittele sarakeotsikoista.</p>
        </div>
      </div>
      ${renderActionBar({
        label: 'Pelaajien toiminnot',
        actions: [
          '<button type="button" class="button" data-open-player-dialog>Lisää pelaaja</button>',
          '<button type="button" class="secondary-button" data-open-players-import-dialog>Tuo pelaajat</button>',
          '<button type="button" class="secondary-button" data-open-rating-ranking-dialog>Päivitä Rating ja Ranking</button>',
        ],
        dangerActions: [
          renderDangerActionButton({
            attribute: 'data-request-delete-all-players',
            label: 'Poista kaikki pelaajat',
            disabled: !dataState.players.length,
          }),
        ],
      })}
      ${renderHelpHint('Pelaajat')}
      <article class="panel">
        ${renderTableToolbar({
          label: 'Pelaajalistan haku ja suodatus',
          search: renderTableSearch({
            id: 'player-search',
            attribute: 'data-player-search',
            value: uiState.playerSearch,
            placeholder: 'Hae nimellä tai PDGA ID:llä',
          }),
          filters: renderFilterButtons({
            label: 'Suodata sarjan mukaan',
            attribute: 'data-player-division-filter',
            options: [{ value: 'ALL', label: 'Kaikki' }, ...DIVISIONS.map((division) => ({ value: division, label: division }))],
            activeValue: uiState.playerDivisionFilter,
          }),
          meta: `<span class="status-chip">${formatNumber(visiblePlayers.length)} / ${formatNumber(dataState.players.length)} pelaajaa</span>`,
        })}
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
                            <th>Tuloskortti</th>
                            <th>Tiedot</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${visiblePlayers
                            .map((player) => {
                              return `
                                <tr>
                                  <td data-label="Pelaajan nimi">${renderPlayerName(player)}</td>
                                  <td data-label="PDGA ID">${renderPdgaPlayerIdLink(player, dataState.settings)}</td>
                                  <td data-label="Sarja">${escapeHtml(player.division)}</td>
                                  <td data-label="PDGA-rating">${escapeHtml(renderValueOrDash(player.pdgaRating))}</td>
                                  <td data-label="Maailmanranking">${escapeHtml(renderValueOrDash(player.worldRank))}</td>
                                  <td data-label="Tuloskortti"><button type="button" class="secondary-button" data-open-player-result-card="${escapeHtml(player.id)}" aria-label="Avaa pelaajan ${escapeHtml(player.name)} tuloskortti">Tuloskortti</button></td>
                                  <td data-label="Tiedot"><button type="button" class="secondary-button" data-edit-player="${escapeHtml(player.id)}" aria-label="Muokkaa pelaajan ${escapeHtml(player.name)} tietoja">Tiedot</button></td>
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

function renderPlayersImportDialog(uiState) {
  if (!uiState.playerImportDialogOpen) {
    return '';
  }

  const importSummary = uiState.playerImportSummary;
  const hasFailures = importSummary?.failedCount > 0;
  const importSummaryType = hasFailures ? 'warning' : 'success';
  const importSummaryRole = hasFailures ? 'alert' : 'status';
  const importSummaryAriaLive = hasFailures ? 'assertive' : 'polite';

  return `
    <div class="dialog-backdrop" data-close-players-import-dialog>
      <div class="dialog-panel dialog-panel-wide" role="dialog" aria-modal="true" aria-labelledby="players-import-dialog-title" aria-describedby="players-import-dialog-description" data-players-import-dialog-panel tabindex="-1">
        <form id="players-import-form">
          <div class="section-heading">
            <div>
              <h2 id="players-import-dialog-title">Tuo pelaajat</h2>
              <p id="players-import-dialog-description" class="section-subtitle">Tuo uusia pelaajia CSV-tiedostosta valittuun divisioonaan. Olemassa olevia pelaajia ei ylikirjoiteta.</p>
            </div>
          </div>
          ${renderImportInstructions({
            id: 'players-import-instructions',
            format: 'Etunimi;Sukunimi;PDGA ID;PDGA-rating;Maailmanranking',
            requirements: [
              'PDGA ID on pakollinen ja yksilöllinen',
              'Muut kentät voivat olla tyhjiä',
              'Divisioona valitaan alla olevasta valikosta',
              'Otsikkorivi on sallittu, UTF-8-koodaus suositeltu',
            ],
            example: ['Etunimi;Sukunimi;PDGA ID;PDGA-rating;Maailmanranking', 'Matti;Meikäläinen;12345;950;1250'],
          })}
          <div class="form-grid">
            <div class="form-field">
              <label for="players-import-division">Divisioona *</label>
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
          ${renderHelpHint('Pelaajat', { showLink: false })}
          <div class="form-actions">
            ${importSummary ? '' : '<button type="submit" class="button">Tuo</button>'}
            <button type="button" class="secondary-button" data-cancel-players-import>${importSummary ? 'Sulje' : 'Peruuta'}</button>
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
      </div>
    </div>
  `;
}

function renderRatingRankingDialog(uiState) {
  if (!uiState.ratingRankingDialogOpen) return '';
  const summary = uiState.ratingRankingSummary;
  return `
    <div class="dialog-backdrop" data-close-rating-ranking-dialog>
      <div class="dialog-panel dialog-panel-wide" role="dialog" aria-modal="true" aria-labelledby="rating-ranking-title" aria-describedby="rating-ranking-description" data-rating-ranking-dialog-panel tabindex="-1">
        <h2 id="rating-ranking-title">Päivitä Rating ja Ranking</h2>
        <p id="rating-ranking-description">Liitä puolipisteillä eroteltu CSV-data. Vain olemassa olevien pelaajien Rating ja World Ranking päivittyvät.</p>
        ${renderImportInstructions({
          id: 'rating-ranking-instructions',
          format: 'PDGA ID;Rating;Ranking',
          requirements: ['Otsikkorivi ja molemmat positiiviset kokonaisluvut ovat pakollisia', 'Sama PDGA ID saa esiintyä vain kerran'],
          example: ['PDGA ID;Rating;Ranking', '12345;998;120', '56789;1021;34'],
        })}
        ${summary ? '' : `
          <form id="rating-ranking-form">
            <div class="form-field">
              <label for="rating-ranking-csv">CSV-data *</label>
              <textarea id="rating-ranking-csv" name="csv" rows="6" required aria-describedby="rating-ranking-description"></textarea>
            </div>
            <div class="form-actions">
              <button type="submit" class="button">Päivitä</button>
              <button type="button" class="secondary-button" data-cancel-rating-ranking-dialog>Peruuta</button>
            </div>
          </form>
        `}
        ${summary ? `
          <div class="message ${summary.errors.length ? 'warning' : 'success'}" role="status" aria-live="polite">
            <h3>Importin yhteenveto</h3>
            <p>Onnistuneesti päivitetyt: ${formatNumber(summary.updatedCount)}</p>
            <p>Virheet: ${formatNumber(summary.errors.length)}</p>
            ${summary.errors.length ? `<ul>${summary.errors.map((error) => `<li>Rivi ${formatNumber(error.rowNumber)}, PDGA ID ${escapeHtml(error.pdgaId || 'puuttuu')}: ${escapeHtml(error.reason)}</li>`).join('')}</ul>` : ''}
            <p>Huomiot: ${formatNumber(summary.observations.length)}</p>
            ${summary.observations.length ? `<ul>${summary.observations.map((observation) => `<li>Rivi ${formatNumber(observation.rowNumber)}, PDGA ID ${escapeHtml(observation.pdgaId)}: ${escapeHtml(observation.reason)}</li>`).join('')}</ul>` : ''}
          </div>
          <div class="form-actions"><button type="button" class="secondary-button" data-cancel-rating-ranking-dialog>Sulje</button></div>
        ` : ''}
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
      </div>
      ${renderActionBar({
        label: 'Turnausten toiminnot',
        actions: [
          '<button type="button" class="button" data-open-tournament-dialog>Lisää turnaus</button>',
          '<button type="button" class="secondary-button" data-open-tournament-import-dialog>Tuo turnaukset</button>',
        ],
        dangerActions: [
          renderDangerActionButton({
            attribute: 'data-request-delete-all-tournaments',
            label: 'Poista kaikki turnaukset',
            disabled: !dataState.tournaments.length,
          }),
        ],
      })}
      ${renderHelpHint('Turnaukset')}
      <article class="panel">
        <div class="section-heading">
          <div>
            <h3>Turnauslista</h3>
            <p class="section-subtitle">Listaa voi hakea nimen, paikkakunnan ja radan perusteella sekä suodattaa tilan mukaan.</p>
          </div>
        </div>
        ${renderTableToolbar({
          label: 'Turnauslistan haku ja suodatus',
          search: renderTableSearch({
            id: 'tournament-search',
            attribute: 'data-tournament-search',
            value: uiState.tournamentSearch,
            placeholder: 'Hae nimellä, paikkakunnalla tai radalla',
          }),
          filters: renderFilterButtons({
            label: 'Suodata tilan mukaan',
            attribute: 'data-tournament-status-filter',
            options: [
              { value: 'ALL', label: 'Kaikki' },
              ...availableStatuses.map((status) => ({ value: status.id, label: status.abbreviation || status.name, title: status.name })),
            ],
            activeValue: uiState.tournamentStatusFilter,
          }),
          meta: `<span class="status-chip">${formatNumber(visibleTournamentsWithMultipliers.length)} / ${formatNumber(dataState.tournaments.length)} turnausta</span>`,
        })}
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
                          return `
                            <tr>
                              <td data-label="Järjestysnumero">${escapeHtml(renderValueOrDash(tournament.displayOrder))}</td>
                              <td data-label="Turnauksen nimi">${renderTournamentName(tournament)}</td>
                              <td data-label="Tila">${escapeHtml(renderValueOrDash(tournament.multiplierAbbreviation))}</td>
                              <td data-label="PDGA Event ID">${renderPdgaEventIdLink(tournament, dataState.settings)}</td>
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
      <div class="dialog-panel dialog-panel-wide" role="dialog" aria-modal="true" aria-labelledby="tournament-import-dialog-title" aria-describedby="tournament-import-dialog-description" data-tournament-import-dialog-panel tabindex="-1">
        <form id="tournament-import-form">
          <div class="section-heading">
            <div>
              <h2 id="tournament-import-dialog-title">Tuo turnaukset</h2>
              <p id="tournament-import-dialog-description" class="section-subtitle">Tuonti luo vain uusia turnauksia eikä koskaan ylikirjoita olemassa olevia.</p>
            </div>
          </div>
          ${renderImportInstructions({
            id: 'tournament-import-instructions',
            format: 'Järjestysnumero;PDGA Event ID;Turnauksen nimi',
            requirements: [
              'Kaikki kolme kenttää ovat pakollisia',
              'PDGA Event ID on yksilöllinen: jo olemassa olevat turnaukset ohitetaan',
              'Otsikkorivi on sallittu, UTF-8-koodaus suositeltu',
            ],
            example: ['Järjestysnumero;PDGA Event ID;Turnauksen nimi', '1;123456;European Open 2027'],
          })}
          <div class="form-grid">
            <div class="form-field full-width">
              <label for="tournament-import-file">CSV-tiedosto *</label>
              <input id="tournament-import-file" name="file" type="file" accept=".csv,text/csv" required />
              <p id="tournament-import-file-hint" class="form-help">Valitse tiedosto, niin Tuo-painike aktivoituu.</p>
            </div>
          </div>
          ${renderHelpHint('Turnaukset', { showLink: false })}
          <div class="form-actions">
            ${
              importSummary
                ? ''
                : '<button type="submit" class="button" data-submit-tournament-import disabled aria-describedby="tournament-import-file-hint">Tuo</button>'
            }
            <button type="button" class="secondary-button" data-cancel-tournament-import>${importSummary ? 'Sulje' : 'Peruuta'}</button>
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
      </div>
      ${renderActionBar({
        label: 'Kertoimien toiminnot',
        actions: ['<button type="button" class="button" data-open-multiplier-dialog>Lisää kerroin</button>'],
      })}
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

function renderHelpTopicCount(topicCount) {
  return `${formatNumber(topicCount)} ${topicCount === 1 ? 'ohje' : 'ohjetta'}`;
}

function renderHelpTopic(sectionId, topic, topicIndex) {
  const topicId = `help-topic-${escapeHtml(sectionId)}-${topicIndex + 1}`;

  return `
    <details class="help-topic">
      <summary class="help-topic-summary">
        <span class="help-marker" aria-hidden="true"></span>
        <span class="help-topic-title">${escapeHtml(topic.title)}</span>
      </summary>
      <div class="help-topic-content" id="${topicId}">${escapeHtml(topic.content)}</div>
    </details>
  `;
}

function renderHelpSection(uiState) {
  return `
    <section class="section" id="section-help" ${uiState.activeView === 'help' ? '' : 'hidden'} aria-labelledby="help-title">
      <div class="section-heading">
        <div>
          <h2 id="help-title">Ohjeet</h2>
          <p class="section-subtitle">Kaikki sovelluksen ohjeet on koottu tähän osioon. Avaa ensin osio ja sitten haluamasi ohje.</p>
        </div>
      </div>
      ${
        HELP_SECTIONS.length
          ? `<div class="help-sections">
              ${HELP_SECTIONS.map(
                (section) => `
                  <details class="help-section" data-help-section="${escapeHtml(section.id)}">
                    <summary class="help-section-summary">
                      <span class="help-marker" aria-hidden="true"></span>
                      <span class="help-section-title">${escapeHtml(section.title)}</span>
                      <span class="help-topic-count">${renderHelpTopicCount(section.topics.length)}</span>
                    </summary>
                    ${
                      section.topics.length
                        ? `<div class="help-topics">
                            ${section.topics.map((topic, topicIndex) => renderHelpTopic(section.id, topic, topicIndex)).join('')}
                          </div>`
                        : renderEmptyState('Tälle osiolle ei ole vielä lisätty ohjeita.')
                    }
                  </details>
                `,
              ).join('')}
            </div>`
          : renderEmptyState('Ohjeita ei ole vielä lisätty.')
      }
    </section>
  `;
}

function renderSecuritySettingsPanel(uiState) {
  const fieldErrors = uiState.sitePasswordFormError ? { sitePassword: uiState.sitePasswordFormError } : {};

  return `
      <div class="two-column security-settings">
        <form id="site-password-form" class="panel" aria-labelledby="security-settings-title" novalidate>
          <h3 id="security-settings-title">Turvallisuus</h3>
          <div class="form-grid">
            <div class="form-field full-width">
              <label for="settings-site-password">Sivuston salasana *</label>
              <input
                id="settings-site-password"
                name="sitePassword"
                type="password"
                autocomplete="new-password"
                minlength="8"
                maxlength="200"
                required
                ${fieldErrors.sitePassword ? 'aria-invalid="true"' : ''}
                aria-describedby="settings-site-password-help${fieldErrors.sitePassword ? ' sitePassword-error' : ''}"
              />
              <span class="help-text" id="settings-site-password-help">Syötä uusi jaettu salasana (vähintään 8 merkkiä). Nykyistä salasanaa ei näytetä.</span>
              ${renderFieldError(fieldErrors, 'sitePassword')}
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="button">Tallenna salasana</button>
          </div>
        </form>
        <article class="panel">
          <h3>Miten salasanasuojaus toimii?</h3>
          <ul>
            <li>Sovellukseen kirjaudutaan yhteisellä sivuston salasanalla.</li>
            <li>Salasana tarkistetaan palvelimella, eikä sitä tallenneta selaimeen.</li>
            <li>Uusi salasana otetaan käyttöön heti seuraavissa kirjautumisissa. Jo kirjautuneet käyttäjät pysyvät kirjautuneina.</li>
            <li>Kirjaudu ulos -painike poistaa kirjautumisen tästä selaimesta.</li>
          </ul>
        </article>
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
          <h3>Pisteiden näyttö</h3>
          <div class="form-grid">
            <div class="form-field full-width">
              <label for="settings-point-decimals">Pyöristys *</label>
              <select
                id="settings-point-decimals"
                name="pointDecimals"
                required
                ${getFieldAttributes(fieldErrors, 'pointDecimals')}
              >
                ${POINT_DECIMALS_OPTIONS.map(
                  (option) =>
                    `<option value="${option}" ${sanitizePointDecimals(formValues.pointDecimals) === option ? 'selected' : ''}>${option}</option>`,
                ).join('')}
              </select>
              <span class="help-text">Näytettävien desimaalien määrä ranking- ja yhteenvetopisteissä. Oletus: ${DEFAULT_PDGA_SETTINGS.pointDecimals}. Pyöristys vaikuttaa vain näyttöön, ei laskentaan tai tallennettuihin arvoihin.</span>
              ${renderFieldError(fieldErrors, 'pointDecimals')}
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
            <li>Pelaajan PDGA-profiili avautuu uuteen välilehteen PDGA ID -kentästä, ei pelaajan nimestä.</li>
            <li>Vanhoista täydellisistä PDGA-osoitteista poimitaan tunnus automaattisesti latauksen yhteydessä.</li>
          </ul>
        </article>
      </div>
      ${renderSecuritySettingsPanel(uiState)}
    </section>
  `;
}

function renderPointsSection(dataState, uiState) {
  const pointsColumns = {
    place: { type: 'number' },
    basePoints: { type: 'number' },
  };
  const pointsSort = {
    field: uiState.pointsSortField,
    direction: uiState.pointsSortDirection,
  };
  const entriesByDivision = Object.fromEntries(
    DIVISIONS.map((division) => [division, sortTableRows(listPointsTableEntries(dataState.pointsTable, division), pointsSort, pointsColumns)]),
  );

  return `
    <section class="section" id="section-points" ${uiState.activeView === 'points' ? '' : 'hidden'} aria-labelledby="points-title">
      <div class="section-heading">
        <div>
          <h2 id="points-title">Pistetaulukot</h2>
          <p class="section-subtitle">Pisteet tallennetaan keskitettyyn pointsTable-rakenteeseen sarjan ja sijoituksen perusteella.</p>
        </div>
      </div>
      ${renderActionBar({
        label: 'Pistetaulukoiden toiminnot',
        actions: [
          '<button type="button" class="button" data-open-points-dialog>Lisää rivi</button>',
          '<button type="button" class="secondary-button" data-open-points-import>Tuo pistetaulukko</button>',
        ],
        dangerActions: DIVISIONS.map((division) =>
          renderDangerActionButton({
            attribute: 'data-request-delete-points',
            value: division,
            label: `Poista kaikki ${division}-pisteet`,
            disabled: !entriesByDivision[division].length,
          }),
        ),
      })}
      ${renderHelpHint('Pistetaulukot')}
      <div class="two-column">
        ${DIVISIONS.map((division) => {
          const entries = entriesByDivision[division];
          return `
              <article class="panel">
                <div class="section-heading">
                  <div>
                    <h3>${division}-pistetaulukko</h3>
                  </div>
                  <span class="status-chip">${formatNumber(entries.length)} riviä</span>
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
        }).join('')}
      </div>
    </section>
  `;
}

function renderPointsDialog(uiState) {
  if (!uiState.pointsDialogOpen) {
    return '';
  }

  const editingPoint = uiState.pointsForm || { division: 'MPO', place: '', basePoints: '', editingKey: '' };
  const isEditing = Boolean(editingPoint.editingKey);

  return `
    <div class="dialog-backdrop" data-points-dialog-backdrop>
      <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="points-dialog-title" aria-describedby="points-dialog-description" data-points-dialog-panel tabindex="-1">
        <form id="points-form">
          <div class="section-heading">
            <div>
              <h2 id="points-dialog-title">${isEditing ? 'Muokkaa pistetaulukon riviä' : 'Lisää pistetaulukon rivi'}</h2>
              <p id="points-dialog-description" class="section-subtitle">Pakolliset kentät on merkitty tähdellä. 1x-peruspisteet voivat olla desimaalilukuja (esim. 10,5).</p>
            </div>
          </div>
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
              <input id="points-place" name="place" required inputmode="numeric" min="1" value="${escapeHtml(editingPoint.place ?? '')}" />
            </div>
            <div class="form-field full-width">
              <label for="points-base-points">1x-peruspisteet *</label>
              <input id="points-base-points" name="basePoints" required inputmode="decimal" min="0" step="0.1" value="${escapeHtml(editingPoint.basePoints ?? '')}" />
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="button">${isEditing ? 'Tallenna rivi' : 'Lisää rivi'}</button>
            <button type="button" class="ghost-button" data-dismiss-points-dialog>Peruuta</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderPointsImportDialog(uiState) {
  if (!uiState.pointsImportDialogOpen) {
    return '';
  }

  const selectedDivision = uiState.pointsImportDivision || 'MPO';

  return `
    <div class="dialog-backdrop" data-close-points-import-dialog>
      <div class="dialog-panel dialog-panel-wide" role="dialog" aria-modal="true" aria-labelledby="points-import-dialog-title" aria-describedby="points-import-dialog-description" data-points-import-dialog-panel tabindex="-1">
        <form id="points-import-form">
          <div class="section-heading">
            <div>
              <h2 id="points-import-dialog-title">Tuo pistetaulukko</h2>
              <p id="points-import-dialog-description" class="section-subtitle">Valitse kohdesarja ja tuotava CSV-tiedosto. Tuonti sallitaan vain tyhjään pistetaulukkoon.</p>
            </div>
          </div>
          ${renderImportInstructions({
            id: 'points-import-instructions',
            format: 'Sijoitus;Pisteet',
            requirements: [
              'Sijoitusten tulee alkaa 1:stä ja edetä peräkkäin ilman aukkoja',
              'Pisteet voivat olla desimaalilukuja (esim. 10,5)',
              'Kohdesarjan pistetaulukon pitää olla tyhjä',
              'Otsikkorivi on sallittu, UTF-8-koodaus suositeltu',
            ],
            example: ['Sijoitus;Pisteet', '1;100', '2;85', '3;10,5'],
          })}
          <div class="form-grid">
            <div class="form-field">
              <label for="points-import-division">Divisioona *</label>
              <select id="points-import-division" name="division" required>
                ${DIVISIONS.map(
                  (division) => `<option value="${division}" ${selectedDivision === division ? 'selected' : ''}>${division}</option>`,
                ).join('')}
              </select>
            </div>
            <div class="form-field">
              <label for="points-import-file">CSV-tiedosto *</label>
              <input id="points-import-file" name="file" type="file" accept=".csv,text/csv" required />
            </div>
          </div>
          ${renderHelpHint('Pistetaulukot', { showLink: false })}
          <div class="form-actions">
            <button type="submit" class="button">Tuo</button>
            <button type="button" class="secondary-button" data-cancel-points-import>Peruuta</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderConfirmationDialog(dataState, uiState) {
  const dialog = uiState.confirmationDialog;
  if (!dialog) {
    return '';
  }

  if (dialog.type === 'delete-player') {
    const player = dataState.players.find((entry) => entry.id === dialog.playerId);
    if (!player) {
      return '';
    }

    const resultCount = countResults(dataState.resultCards, { playerId: player.id });
    const resultNotice = resultCount > 0
      ? `<p>Samalla poistetaan pelaajan tuloskortilta ${formatNumber(resultCount)} sijoitusta.</p>`
      : '';

    return renderDangerConfirmDialog({
      title: 'Poista pelaaja',
      body: `<p>Haluatko varmasti poistaa pelaajan ${escapeHtml(player.name)}?<br />
                Toimintoa ei voi peruuttaa.</p>${resultNotice}`,
      confirmAttribute: `data-confirm-delete-player="${escapeHtml(player.id)}"`,
      confirmLabel: 'Poista pelaaja',
    });
  }

  if (dialog.type === 'delete-all-players') {
    return renderDangerConfirmDialog({
      title: 'Poista kaikki pelaajat',
      body: `
        <p>Olet poistamassa kaikki pelaajat (${formatNumber(dataState.players.length)} kpl).</p>
        <p>Samalla poistetaan pelaajien tuloskortit ja niille tallennetut sijoitukset (${formatNumber(countResults(dataState.resultCards))} kpl).</p>
        <p><strong>Tätä toimintoa ei voi perua.</strong></p>
      `,
      confirmAttribute: 'data-confirm-delete-all-players',
    });
  }

  if (dialog.type === 'delete-points-division') {
    const division = dialog.division;

    return renderDangerConfirmDialog({
      title: `Poista sarjan ${division} pisteet`,
      body: `<p>Haluatko varmasti poistaa kaikki sarjan ${escapeHtml(division)} pistetaulukon rivit?<br />
                Tätä toimintoa ei voi perua.</p>`,
      confirmAttribute: `data-confirm-delete-points-division="${escapeHtml(division)}"`,
    });
  }

  if (dialog.type === 'delete-point') {
    return renderDangerConfirmDialog({
      title: 'Poista pistetaulukon rivi',
      body: `
        <p>Olet poistamassa pistetaulukon rivin ${escapeHtml(dialog.division)} / sijoitus ${escapeHtml(dialog.place)}.</p>
        <p><strong>Tätä toimintoa ei voi perua.</strong></p>
      `,
      confirmAttribute: 'data-confirm-delete-point',
    });
  }

  if (dialog.type === 'clear-player-placement') {
    const player = dataState.players.find((entry) => entry.id === dialog.playerId);
    const tournament = dataState.tournaments.find((entry) => entry.id === dialog.tournamentId);
    if (!player || !tournament) {
      return '';
    }

    return renderDangerConfirmDialog({
      title: 'Tyhjennetäänkö sijoitus ja lasketut pisteet?',
      body: `<p>Pelaaja: ${escapeHtml(player.name)}<br />
                Turnaus: ${escapeHtml(tournament.name)}</p>`,
      confirmAttribute: 'data-confirm-clear-player-placement',
      confirmLabel: 'Tyhjennä',
    });
  }

  if (dialog.type === 'exit-player-result-card-edit') {
    return renderDangerConfirmDialog({
      title: 'Tallentamattomia muutoksia',
      body: `
        <p>Tuloskortilla on tallentamattomia muutoksia.</p>
        <p>Haluatko poistua muokkaustilasta tallentamatta muutoksia?</p>
      `,
      confirmAttribute: 'data-confirm-exit-player-result-card-edit',
      confirmLabel: 'Poistu ilman tallennusta',
    });
  }

  if (dialog.type === 'delete-all-tournaments') {
    const tournamentCount = dataState.tournaments.length;
    const resultCount = countResults(dataState.resultCards);
    return renderDangerConfirmDialog({
      title: 'Poista kaikki turnaukset',
      body: `
        <p>Olet poistamassa kaikki turnaukset (${formatNumber(tournamentCount)} kpl) ja turnaustulokset (${formatNumber(resultCount)} kpl).</p>
        <p><strong>Tätä toimintoa ei voi perua.</strong></p>
      `,
      confirmAttribute: 'data-confirm-delete-all-tournaments',
    });
  }

  if (dialog.type === 'delete-multiplier') {
    const multiplier = dataState.multipliers.find((entry) => entry.id === dialog.multiplierId);
    if (!multiplier) {
      return '';
    }

    return renderDangerConfirmDialog({
      title: 'Varoitus: poista kerroin',
      body: `
        <p>Tämä on pysyvä poistotoiminto.</p>
        <p>Olet poistamassa kertoimen.</p>
        <p>Tätä toimintoa ei voi perua.</p>
        <p>Haluatko varmasti jatkaa?</p>
      `,
      confirmAttribute: `data-confirm-delete-multiplier="${escapeHtml(multiplier.id)}"`,
    });
  }

  if (dialog.type !== 'delete-tournament') {
    return '';
  }

  const tournament = dataState.tournaments.find((entry) => entry.id === dialog.tournamentId);
  if (!tournament) {
    return '';
  }

  const resultCount = countResults(dataState.resultCards, { tournamentId: tournament.id });
  return renderDangerConfirmDialog({
    title: 'Poista turnaus',
    body: `<p>Haluatko varmasti poistaa turnauksen ${escapeHtml(tournament.name)}?<br />
              Samalla poistetaan ${formatNumber(resultCount)} turnaustulosta eikä toimintoa voi peruuttaa.</p>`,
    confirmAttribute: `data-confirm-delete-tournament="${escapeHtml(tournament.id)}"`,
    confirmLabel: 'Poista turnaus',
  });
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
          ${renderNav(uiState.activeView, uiState.resultCardOrigin)}
          <button class="secondary-button logout-button" type="button" data-logout>Kirjaudu ulos</button>
        </div>
      </header>
      <main id="main-content" class="main-inner" tabindex="-1">
        ${uiState.feedback ? `<div class="message ${uiState.feedback.type}" role="status" aria-live="polite">${escapeHtml(uiState.feedback.text)}</div>` : ''}
        ${renderSummarySection(dataState, uiState)}
        ${renderRankingSection(dataState, uiState)}
        ${renderResultsSection(dataState, uiState)}
        ${renderTournamentResultCardSection(dataState, uiState)}
        ${renderPlayerResultCardSection(dataState, uiState)}
        ${renderPlayerSection(dataState, uiState)}
        ${renderTournamentSection(dataState, uiState)}
        ${renderPointsSection(dataState, uiState)}
        ${renderMultipliersSection(dataState, uiState)}
        ${renderHelpSection(uiState)}
        ${renderSettingsSection(dataState, uiState)}
      </main>
      <footer class="site-footer">
        <div class="site-footer-inner">
          <div>SFL Pisteytystyökalu on MVP-versio. Tiedot tallennetaan palvelimen JSON-tiedostoihin ja ovat yhteisiä kaikille käyttäjille.</div>
          <div>Lopullinen brändivahvistus, logoaineisto ja mahdollinen tietokantapohjainen tallennus toteutetaan myöhemmässä vaiheessa.</div>
        </div>
      </footer>
      ${renderPlayerDialog(dataState, uiState)}
      ${renderTournamentDialog(dataState, uiState)}
      ${renderMultiplierDialog(dataState, uiState)}
      ${renderPlayersImportDialog(uiState)}
      ${renderRatingRankingDialog(uiState)}
      ${renderTournamentImportDialog(uiState)}
      ${renderPointsDialog(uiState)}
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
    button.addEventListener('click', () =>
      handlers.toggleColumnSort(button.dataset.sortTable, button.dataset.sortField),
    );
  });

  root.querySelector('#settings-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submitSettings(new FormData(event.currentTarget));
  });

  root.querySelector('[data-reset-settings-form]')?.addEventListener('click', () => handlers.resetSettingsForm());

  root.querySelector('#site-password-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submitSitePassword(new FormData(event.currentTarget));
  });

  root.querySelector('[data-logout]')?.addEventListener('click', () => handlers.logout());

  root.querySelectorAll('[data-ranking-filter]').forEach((button) => {
    button.addEventListener('click', () => handlers.setRankingFilter(button.dataset.rankingFilter));
  });

  root.querySelectorAll('[data-open-player-result-card]').forEach((button) => {
    button.addEventListener('click', () => handlers.openPlayerResultCard(button.dataset.openPlayerResultCard, button.dataset.resultCardOrigin || 'players'));
  });
  root.querySelector('[data-close-player-result-card]')?.addEventListener('click', () => handlers.closePlayerResultCard());
  root.querySelectorAll('[data-open-tournament-result-card]').forEach((button) => {
    button.addEventListener('click', () => handlers.openTournamentResultCard(button.dataset.openTournamentResultCard));
  });
  root.querySelector('[data-close-tournament-result-card]')?.addEventListener('click', () => handlers.closeTournamentResultCard());
  root.querySelector('[data-edit-player-result-card]')?.addEventListener('click', () => handlers.enterPlayerResultCardEdit());
  root.querySelector('[data-exit-player-result-card-edit]')?.addEventListener('click', () => handlers.exitPlayerResultCardEdit());

  // Sijoituskenttiin ei sidota muokkaustoimintoja lukutilassa, jotta arvoja ei voi muuttaa vahingossa.
  const placementInputs = uiState.resultCardEditMode ? [...root.querySelectorAll('input[data-result-placement]')] : [];
  placementInputs.forEach((input, index) => {
    input.addEventListener('change', () =>
      handlers.updatePlayerPlacement(input.dataset.playerId, input.dataset.tournamentId, input.value),
    );
    // Taulukkolaskentamainen syöttö: Tab ja Enter siirtävät seuraavan turnauksen Sijoitus-kenttään.
    // Kentän arvoa ei valita, jotta olemassa olevaa sijoitusta ei ylikirjoiteta vahingossa.
    input.addEventListener('keydown', (event) => {
      const isForwardTab = event.key === 'Tab' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;
      if (!isForwardTab && event.key !== 'Enter') {
        return;
      }

      const nextInput = placementInputs[index + 1];
      const nextTarget = nextInput || (event.key === 'Enter' ? root.querySelector('[data-save-player-result-card]') : null);
      if (!nextTarget) {
        return;
      }

      event.preventDefault();
      nextTarget.focus();
      if (nextInput && typeof nextInput.setSelectionRange === 'function') {
        const caretPosition = String(nextInput.value || '').length;
        nextInput.setSelectionRange(caretPosition, caretPosition);
      }
    });
  });
  root.querySelector('[data-save-player-result-card]')?.addEventListener('click', () => {
    handlers.savePlayerResultCard(
      uiState.resultCardPlayerId,
      placementInputs.map((input) => ({ tournamentId: input.dataset.tournamentId, placement: input.value })),
    );
  });
  root.querySelectorAll('[data-clear-player-placement]').forEach((button) => {
    button.addEventListener('click', () =>
      handlers.requestClearPlayerPlacement(button.dataset.playerId, button.dataset.clearPlayerPlacement),
    );
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

  root.querySelectorAll('[data-player-division-filter]').forEach((button) => {
    button.addEventListener('click', () => handlers.setPlayerDivisionFilter(button.dataset.playerDivisionFilter));
  });

  root.querySelector('[data-open-player-dialog]')?.addEventListener('click', () => handlers.openPlayerDialog());
  root.querySelector('[data-retry-players-load]')?.addEventListener('click', () => handlers.retryPlayersLoad());
  root.querySelector('[data-open-players-import-dialog]')?.addEventListener('click', () => handlers.openPlayersImportDialog());
  root.querySelector('#players-import-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submitPlayersImport(new FormData(event.currentTarget));
  });
  root.querySelector('[data-cancel-players-import]')?.addEventListener('click', () => handlers.closePlayersImportDialog());
  root.querySelector('[data-close-players-import-dialog]')?.addEventListener('click', () => handlers.closePlayersImportDialog());
  root.querySelector('[data-players-import-dialog-panel]')?.addEventListener('click', (event) => event.stopPropagation());
  root.querySelector('[data-open-rating-ranking-dialog]')?.addEventListener('click', () => handlers.openRatingRankingDialog());
  root.querySelector('#rating-ranking-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.submitRatingRankingImport(new FormData(event.currentTarget));
  });
  root.querySelector('[data-cancel-rating-ranking-dialog]')?.addEventListener('click', () => handlers.closeRatingRankingDialog());
  root.querySelector('[data-close-rating-ranking-dialog]')?.addEventListener('click', () => handlers.closeRatingRankingDialog());
  root.querySelector('[data-rating-ranking-dialog-panel]')?.addEventListener('click', (event) => event.stopPropagation());
  root.querySelector('[data-request-delete-all-players]')?.addEventListener('click', () => handlers.requestDeleteAllPlayers());

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

  root.querySelectorAll('[data-tournament-status-filter]').forEach((button) => {
    button.addEventListener('click', () => handlers.setTournamentStatusFilter(button.dataset.tournamentStatusFilter));
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

  root.querySelector('[data-open-points-dialog]')?.addEventListener('click', () => handlers.openPointsDialog());
  root.querySelector('[data-dismiss-points-dialog]')?.addEventListener('click', () => handlers.closePointsDialog());
  root.querySelector('[data-points-dialog-backdrop]')?.addEventListener('click', () => handlers.closePointsDialog());
  root.querySelector('[data-points-dialog-panel]')?.addEventListener('click', (event) => event.stopPropagation());

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
    button.addEventListener('click', () => handlers.requestDeletePoint(button.dataset.deletePoint));
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
  root.querySelector('[data-confirm-delete-all-players]')?.addEventListener('click', () => handlers.confirmDeleteAllPlayers());
  root.querySelector('[data-confirm-delete-point]')?.addEventListener('click', () => handlers.confirmDeletePoint());
  root.querySelector('[data-confirm-delete-tournament]')?.addEventListener('click', () => handlers.confirmDeleteTournament());
  root.querySelector('[data-confirm-delete-all-tournaments]')?.addEventListener('click', () => handlers.confirmDeleteAllTournaments());
  root.querySelector('[data-confirm-delete-multiplier]')?.addEventListener('click', () => handlers.confirmDeleteMultiplier());
  root.querySelector('[data-confirm-delete-points-division]')?.addEventListener('click', () => handlers.confirmDeletePointsDivision());
  root.querySelector('[data-confirm-clear-player-placement]')?.addEventListener('click', () => handlers.confirmClearPlayerPlacement());
  root.querySelector('[data-confirm-exit-player-result-card-edit]')?.addEventListener('click', () => handlers.confirmExitPlayerResultCardEdit());

  if (root.__dialogKeydownHandler) {
    document.removeEventListener('keydown', root.__dialogKeydownHandler);
    root.__dialogKeydownHandler = null;
  }

  if (
    uiState.tournamentDialogOpen ||
    uiState.multiplierDialogOpen ||
    uiState.playerDialogOpen ||
    uiState.tournamentImportDialogOpen ||
    uiState.playerImportDialogOpen ||
    uiState.ratingRankingDialogOpen ||
    uiState.pointsDialogOpen ||
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
        if (uiState.pointsDialogOpen) {
          handlers.closePointsDialog();
          return;
        }
        if (uiState.playerImportDialogOpen) {
          handlers.closePlayersImportDialog();
          return;
        }
        if (uiState.ratingRankingDialogOpen) {
          handlers.closeRatingRankingDialog();
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
        !uiState.playerImportDialogOpen &&
        !uiState.ratingRankingDialogOpen &&
        !uiState.pointsDialogOpen &&
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
        : uiState.pointsDialogOpen
          ? root.querySelector('[data-points-dialog-panel]')
        : uiState.playerImportDialogOpen
          ? root.querySelector('[data-players-import-dialog-panel]')
        : uiState.ratingRankingDialogOpen
          ? root.querySelector('[data-rating-ranking-dialog-panel]')
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
  } else if (uiState.pointsDialogOpen) {
    (root.querySelector('#points-place') || root.querySelector('[data-points-dialog-panel]'))?.focus();
  } else if (uiState.playerImportDialogOpen) {
    (root.querySelector('#players-import-division') || root.querySelector('[data-players-import-dialog-panel]'))?.focus();
  } else if (uiState.ratingRankingDialogOpen) {
    (uiState.ratingRankingSummary
      ? root.querySelector('[data-cancel-rating-ranking-dialog]')
      : root.querySelector('#rating-ranking-csv') || root.querySelector('[data-rating-ranking-dialog-panel]'))?.focus();
  } else if (uiState.playerDialogOpen && uiState.playerDialogFocusTarget) {
    root.querySelector(getPlayerFieldSelector(uiState.playerDialogFocusTarget))?.focus();
    uiState.playerDialogFocusTarget = '';
  } else if (uiState.playerDialogOpen) {
    root.querySelector('[data-player-dialog-panel]')?.focus();
  } else if (uiState.confirmationDialog) {
    root.querySelector('[data-cancel-confirm-dialog]')?.focus();
  } else if (uiState.pendingFocusSelector) {
    const pendingFocusElement = root.querySelector(uiState.pendingFocusSelector);
    pendingFocusElement?.focus();
    if (pendingFocusElement?.type === 'search' && typeof pendingFocusElement.setSelectionRange === 'function') {
      const caretPosition = String(pendingFocusElement.value || '').length;
      pendingFocusElement.setSelectionRange(caretPosition, caretPosition);
    }
    uiState.pendingFocusSelector = '';
  }
}
