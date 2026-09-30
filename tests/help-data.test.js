import test from 'node:test';
import assert from 'node:assert/strict';
import { HELP_SECTIONS, findHelpSection, listHelpSections } from '../js/helpData.js';

test('help data covers the documented sections in navigation order', () => {
  assert.deepEqual(
    HELP_SECTIONS.map((section) => section.id),
    ['summary', 'ranking', 'results', 'players', 'tournaments', 'points', 'multipliers'],
  );
  assert.deepEqual(
    HELP_SECTIONS.map((section) => section.title),
    ['Yhteenveto', 'Ranking', 'Tulokset', 'Pelaajat', 'Turnaukset', 'Pistetaulukot', 'Kertoimet'],
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
});

test('findHelpSection returns null for unknown sections and listHelpSections exposes the data', () => {
  assert.equal(findHelpSection('unknown'), null);
  assert.equal(listHelpSections(), HELP_SECTIONS);
});
