import test from 'node:test';
import assert from 'node:assert/strict';
import { HELP_SECTIONS, findHelpSection, listHelpSections } from '../js/helpData.js';

test('help data covers the documented sections in navigation order', () => {
  assert.deepEqual(
    HELP_SECTIONS.map((section) => section.id),
    ['summary', 'compare', 'ranking', 'results', 'players', 'tournaments', 'points', 'multipliers', 'settings'],
  );
  assert.deepEqual(
    HELP_SECTIONS.map((section) => section.title),
    ['Yhteenveto', 'Vertaile', 'Ranking', 'Tulokset', 'Pelaajat', 'Turnaukset', 'Pistetaulukot', 'Kertoimet', 'Asetukset'],
  );
});

test('every help topic has a title and content', () => {
  HELP_SECTIONS.forEach((section) => {
    assert.ok(section.topics.length > 0, `Osiolla ${section.id} ei ole ohjeita.`);
    section.topics.forEach((topic) => {
      assert.equal(typeof topic.title, 'string');
      assert.ok(topic.title.trim().length > 0);
      assert.equal(typeof topic.content, 'string');
      assert.ok(topic.content.trim().length > 0);
    });
  });
});

test('help topic titles are unique inside a section', () => {
  HELP_SECTIONS.forEach((section) => {
    const titles = section.topics.map((topic) => topic.title);
    assert.equal(new Set(titles).size, titles.length, `Osiossa ${section.id} on päällekkäisiä ohjeotsikoita.`);
  });
});

test('migrated import instructions are available in the help data', () => {
  const players = findHelpSection('players');
  const csvTopic = players.topics.find((topic) => topic.title === 'CSV-tuonti');
  assert.match(csvTopic.content, /PDGA ID on pakollinen/);
  assert.match(csvTopic.content, /Etunimi;Sukunimi;PDGA ID;PDGA-rating;Maailmanranking/);

  const tournaments = findHelpSection('tournaments');
  assert.ok(
    tournaments.topics.some((topic) => /Järjestysnumero;PDGA Event ID;Turnauksen nimi/.test(topic.content)),
  );

  const points = findHelpSection('points');
  assert.ok(points.topics.some((topic) => /Sijoitus;Pisteet/.test(topic.content)));
  const settings = findHelpSection('settings');
  assert.ok(settings.topics.some((topic) => /perusosoitteesta ja tunnuksesta/.test(topic.content)));
  assert.ok(settings.topics.some((topic) => /vain näyttöön/.test(topic.content)));
  assert.ok(settings.topics.some((topic) => /vähintään 8 merkkiä/.test(topic.content)));
});

test('rating ja ranking -ohje kuvaa tyhjien arvojen käsittelyn', () => {
  const topic = findHelpSection('players').topics.find((entry) => entry.title === 'Rating ja Ranking -päivitysimportti');
  assert.match(topic.content, /Puuttuva Rating.*sallittu.*tallennetaan tyhjänä/);
  assert.match(topic.content, /Puuttuva World Ranking.*sallittu.*tallennetaan tyhjänä/);
  assert.match(topic.content, /tyhjät Rating-arvot korostetaan hillityllä varoitusvärillä/);
});

test('tuloskortin lukutila ja muokkaustila on dokumentoitu Pelaajat-osiossa', () => {
  const players = findHelpSection('players');
  const topic = players.topics.find((entry) => entry.title === 'Tuloskortti: lukutila ja muokkaustila');
  assert.ok(topic, 'Pelaajat-osiosta puuttuu tuloskortin tilaohje.');
  ['Lukutila', 'Muokkaustila', 'Muokkaa-painike', 'Tallenna ja poistu', 'Poistu', 'Sijoitusten muuttaminen', 'Pisteiden automaattinen laskenta'].forEach((heading) => {
    assert.ok(topic.content.includes(heading), `Ohjeesta puuttuu kohta ${heading}.`);
  });
  assert.match(topic.content, /✓ Tuloskortti tallennettu onnistuneesti/);
  assert.match(topic.content, /Poistu ilman tallennusta/);
});

test('pelaajan tuloskortin avaaminen Rankingista on dokumentoitu Ranking-osiossa', () => {
  const ranking = findHelpSection('ranking');
  const topic = ranking.topics.find((entry) => entry.title === 'Pelaajan Tuloskortin avaaminen');
  assert.ok(topic, 'Ranking-osiosta puuttuu tuloskortin avausohje.');
  ['pelaajan nimi on painike', 'lukutilaan', 'Muokkaa', 'Tallenna ja poistu', 'Takaisin Rankingiin', 'PDGA-profiiliin'].forEach((part) => {
    assert.ok(topic.content.includes(part), `Ohjeesta puuttuu kohta ${part}.`);
  });
});

test('turnauksen tulokset on dokumentoitu Tulokset-osiossa', () => {
  const results = findHelpSection('results');
  const topic = results.topics.find((entry) => entry.title === 'Turnauksen tulokset');
  assert.ok(topic, 'Tulokset-osiosta puuttuu Turnauksen tulokset -ohje.');
  ['Tulokset-painike', 'Turnauksen tuloskortti', 'Turnauksen tiedot', 'MPO-tulokset', 'FPO-tulokset', 'Mitalikorostukset', 'Lajittelu', 'Tyhjät sarjat', 'PDGA Event ID -linkit', '000000'].forEach((part) => {
    assert.ok(topic.content.includes(part), `Ohjeesta puuttuu kohta ${part}.`);
  });
});

test('findHelpSection returns null for unknown sections and listHelpSections exposes the data', () => {
  assert.equal(findHelpSection('unknown'), null);
  assert.equal(listHelpSections(), HELP_SECTIONS);
});

test('TOP 10 -taulukot on dokumentoitu Yhteenveto-osiossa', () => {
  const summary = findHelpSection('summary');
  assert.equal(summary.topics.some((entry) => entry.title.startsWith('World Ranking')), false);
  ['TOP 10 MPO', 'TOP 10 FPO'].forEach((title) => {
    const topic = summary.topics.find((entry) => entry.title === title);
    assert.ok(topic, `Yhteenveto-osiosta puuttuu ohje ${title}.`);
    ['Lajittelu', 'laskevasti', '#, Nimi, Rating, WR ja Pts', 'WR =', 'Pts =', '▲', '▼', 'tuloskortin lukutilaan', 'Takaisin yhteenvetoon'].forEach((part) => {
      assert.ok(topic.content.includes(part), `Ohjeesta ${title} puuttuu kohta ${part}.`);
    });
  });
});

test('tuloskorttien Import ja Export on dokumentoitu Pelaajat-osiossa', () => {
  const topic = findHelpSection('players').topics.find((entry) => entry.title === 'Tuloskorttien Import ja Export');
  assert.ok(topic, 'Pelaajat-osiosta puuttuu tuloskorttien Import ja Export -ohje.');
  [
    'Export-työnkulku',
    'Excel-työnkulku',
    'CSV UTF-8 (puolipisteellä erotettu)',
    'UTF-8',
    'puolipiste (;)',
    'PDGA ID;Nimi;T1;T2;T3',
    'T1 = järjestysnumero 1',
    'PDGA ID -tunnistus',
    '0 = pelaaja ei osallistunut',
    '3T4',
    '100T10',
    'ABC, 1TT2 tai 3-T-4',
    'Import valmis',
    '✓ Tuloskortit päivitetty onnistuneesti',
    '⚠ Osa riveistä ohitettiin',
    '✕ Import epäonnistui',
  ].forEach((part) => {
    assert.ok(topic.content.includes(part), `Ohjeesta puuttuu kohta ${part}.`);
  });
});

test('kaikkien tulosten tyhjennys on dokumentoitu Pelaajat-osiossa', () => {
  const topic = findHelpSection('players').topics.find((entry) => entry.title === 'Poista kaikki tulokset');
  assert.ok(topic, 'Pelaajat-osiosta puuttuu tulosten tyhjennysohje.');
  ['nollata kaikkien pelaajien turnaussijoitukset', 'tyhjentää kaikkien pelaajien tuloskortit', 'lasketut pisteet', 'Pelaajien tiedot', 'turnaukset', 'kertoimet', 'pistetaulukot', 'Rating', 'World Ranking', 'uuden kauden', 'tuonneista', 'laajamittaiset korjaukset'].forEach((part) => {
    assert.ok(topic.content.includes(part), `Ohjeesta puuttuu kohta ${part}.`);
  });
});
