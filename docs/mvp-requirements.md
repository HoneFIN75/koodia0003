# SFL Pisteytystyökalu - MVP-vaatimukset

## Tarkoitus

Sovellus on Suomen frisbeegolfliiton selainkäyttöinen MVP-työkalu MPO- ja FPO-pelaajien kilpailupisteiden hallintaan, rankingin tarkasteluun ja turnaustulosten dokumentointiin.

## Tekninen malli

- staattinen HTML/CSS/JavaScript-sovellus
- ei frameworkia, ei CDN-riippuvuuksia, ei backendia MVP-vaiheessa
- localStorage versionoidulla avaimella
- build luo `dist`-hakemiston tuotantojulkaisua varten
- modulaarinen rakenne: käyttöliittymä, tallennus, pelaajat, turnaukset, ranking ja pisteiden laskenta omissa moduuleissaan

## Toiminnallisuudet

1. suomenkielinen responsiivinen sivupohja ja päänavigaatio
2. pelaajien CRUD-hallinta validointeineen
3. turnausten CRUD-hallinta validointeineen
4. asetussivu yhteisille PDGA-linkkiasetuksille
5. keskitetty MPO/FPO-pistetaulukon hallinta
6. turnaustulosten lisäys, muokkaus ja poisto
7. ranking kaikille, MPO:lle ja FPO:lle
8. yhteenveto tilastokorteilla, top 10 -visualisoinnilla ja pelaajakohtaisella tulosnäkymällä

## Tietomalli

### Player

- `id`
- `name`
- `division`
- `pdgaNumber`
- `pdgaRating`
- `worldRank`
- `notes`
- `createdAt`
- `updatedAt`

### Tournament

- `id`
- `name`
- `pdgaEventId`
- `startDate`
- `endDate`
- `location`
- `status`
- `multiplierKey`
- `multiplier`
- `division` (valinnainen sarjarajaus tulossyöttöä varten)
- `externalUrl`
- `notes`
- `createdAt`
- `updatedAt`

### PointsTableEntry

- `division`
- `place`
- `basePoints`

### TournamentResult

- `id`
- `tournamentId`
- `playerId`
- `place`
- `basePointsSnapshot`
- `multiplierSnapshot`
- `calculatedPoints`
- `createdAt`
- `updatedAt`

### Settings

- `playerBaseUrl`
- `eventBaseUrl`

## Pistelaskennan säännöt

- `turnauspisteet = 1x-peruspisteet × multiplier`
- `kokonaispisteet = kaikkien turnaustulosten summa`
- laskenta on keskitetty `js/scoring.js`-moduuliin
- pistetaulukon arvoja ei kovakoodata UI-komponentteihin
- jos sarjalle tai sijoitukselle ei ole pisteitä, tulosta ei voi tallentaa
- tuloksen snapshot-arvot säilytetään myöhempiä muutoksia varten

## Validoinnit

- pelaajalla nimi ja MPO/FPO ovat pakollisia
- PDGA-numero on yksilöllinen, jos arvo on annettu
- PDGA-linkit muodostetaan keskitettyjen perusosoitteiden ja tunnusten perusteella
- turnauksella nimi, alkamispäivä ja multiplier ovat pakollisia
- multiplier on valittava ennalta määritetyistä vaihtoehdoista
- päättymispäivä ei voi olla ennen alkamispäivää
- sijoitus on positiivinen kokonaisluku
- sama pelaaja voi esiintyä samassa turnauksessa vain kerran
- turnauksen sarjarajaus ohjaa tuloslomakkeen pelaajavalintaa

## Saavutettavuus

- kaikki näkyvät käyttöliittymätekstit ovat suomeksi
- semanttinen HTML-rakenne
- näkyvä näppäimistökohdistus
- responsiivisuus työpöydällä, tabletilla ja puhelimella
- tilaa ei ilmaista pelkällä värillä
- taulukot, lomakkeet ja navigaatio on nimetty selkeästi

## Testaus

- Node-testit kattavat vähintään pistelaskennan, puuttuvan pistetaulukon ja validointivirheet
- buildin pitää tuottaa `dist/index.html`
- merkittävistä laskentasäännöistä pidetään testit ajan tasalla

## Rajaukset

MVP ei sisällä:

- kirjautumista tai käyttöoikeuksia
- ulkoisia API-kutsuja
- PDGA-integraatiota
- import/export-toimintoja
- monikäyttäjäsynkronointia
- automaattista tasatulospisteiden jakamista
- agentin toimesta käynnistettyjä manuaalisia julkaisuja

## Turvallinen julkaisutapa

- julkaisuworkflow saa käynnistyä automaattisesti vain `main`-haaran pushista
- `workflow_dispatch` voidaan säilyttää, mutta sitä ei käynnistetä tässä tehtävässä
- deploy käyttää nykyisiä `SSH_USER`, `SSH_HOST`, `DEPLOY_PATH` ja `SSH_KEY` -salaisuuksia
- agentti ei muuta salaisuuksia, palvelinasetuksia eikä tuotantoympäristöä
