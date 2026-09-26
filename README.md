# SFL Pisteytystyökalu

SFL Pisteytystyökalu on Suomen frisbeegolfliiton selainpohjainen MVP suomalaisen MPO- ja FPO-pelaajaringingin, turnausten, pistetaulukoiden ja turnaustulosten hallintaan.

## Teknologia

Ratkaisu on tarkoituksella kevyt ja jatkokehitettävä:

- semanttinen HTML5-sivupohja
- erillinen CSS-tiedosto design tokeneilla
- modulaarinen vanilla JavaScript
- selaimen `localStorage` versionoidulla avaimella
- Node.js-pohjainen testaus (`node --test`)
- yksinkertainen build-skripti staattisen `dist`-hakemiston luontiin

Tämä linjaus sopii nykyiseen tyhjään staattiseen projektiin ja nykyiseen julkaisutapaan. Moduulit on erotettu niin, että localStorage voidaan myöhemmin korvata API- ja tietokantaratkaisulla ilman käyttöliittymän täydellistä uudelleenkirjoitusta.

## MVP-toiminnallisuudet

- suomenkielinen responsiivinen käyttöliittymä ja päänavigaatio
- pelaajien CRUD-hallinta (MPO/FPO)
- turnausten CRUD-hallinta ennalta määritetyillä multiplier-vaihtoehdoilla
- keskitetty MPO/FPO-pistetaulukkonäkymä ja ylläpito
- turnaustulosten lisäys, muokkaus ja poisto snapshot-pisteillä
- ranking kaikille, MPO:lle ja FPO:lle
- yhteenvetonäkymä tilastokorteilla, top 10 -pylväillä ja pelaajakohtaisella tulostaulukolla
- Asetukset-näkymä PDGA-pelaaja- ja tapahtumalinkkien perus-URL-osoitteille

## PDGA-asetukset ja tietomalli

- Pelaajille tallennetaan `PDGA-pelaaja-ID`, ei täyttä URL-osoitetta.
- Turnauksille tallennetaan `PDGA-tapahtuma-ID`, ei täyttä URL-osoitetta.
- Klikattavat PDGA-linkit muodostetaan keskitetysti asetuksista:
  - `PDGA-pelaaja-ID:n perus-URL` + `PDGA-pelaaja-ID`
  - `PDGA-tapahtuma-ID:n perus-URL` + `PDGA-tapahtuma-ID`
- Asetukset ovat sovelluksen yhteisiä ja tallennetaan localStorage-tilaan muun datan rinnalle.
- Vanha data migroidaan automaattisesti latauksen yhteydessä: aiemmista täysistä PDGA-URL-osoitteista poimitaan ID-arvo uuteen malliin aina kun se on mahdollista.

## Pistelaskenta

- `turnauspisteet = sijoituksen 1x-peruspisteet × turnauksen multiplier`
- `kokonaispisteet = pelaajan kaikkien turnauspisteiden summa`
- tulosta tallennettaessa mukaan tallennetaan:
  - käytetty 1x-peruspistemäärä
  - käytetty multiplier
  - laskettu turnauspistemäärä

Pisteet haetaan keskitetysti `js/scoring.js`-moduulista. Pistearvoja ei kovakoodata käyttöliittymäkomponentteihin.

## localStorage-rajoitukset

Tämä MVP-versio tallentaa kaiken datan selaimen `localStorageen`.

- tiedot ovat selain- ja laitekohtaisia
- ratkaisu ei ole monikäyttäjäratkaisu
- tietoja ei synkronoida käyttäjien välillä
- tietokantapohjainen backend on myöhempi kehitysvaihe
- importia ja exportia ei ole vielä toteutettu
- tietojen varmuuskopiointi jää käyttäjän vastuulle tässä vaiheessa

## Käynnistys paikallisesti

Edellytykset:

- Node.js 20+
- npm

Asennus ja komennot:

```bash
npm install
npm test
npm run build
```

Avaa tämän jälkeen `index.html` selaimessa tai tarjoile projekti haluamallasi staattisella palvelimella.

## Julkaisu

`.github/workflows/deploy.yml` rakentaa staattisen `dist`-hakemiston ja julkaisee sen SSH/rsync-mallilla. Workflow saa käynnistyä automaattisesti vain `main`-haaran pushista. Tässä MVP-vaiheessa ei käytetä ulkoisia API-kutsuja eikä agentti käynnistä julkaisuja manuaalisesti.

## Brändi ja logo

Käyttöliittymän värit ja typografinen ilme on johdettu varovaisesti Suomen frisbeegolfliiton verkkosivuston yleisestä virallisesta ja urheilullisesta tunnelmasta. Väriarvoja ei pidä tulkita liiton virallisiksi brändiväreiksi.

Tässä MVP:ssä käytetään tekstimuotoista logo-paikkavarausta “Suomen frisbeegolfliitto”. Lopullinen SVG- tai PNG-logo sekä viralliset väriarvot pitää varmistaa erillisestä hyväksytystä logoaineistosta ja graafisesta ohjeistosta ennen lopullista tuotantoviimeistelyä.

## Seuraavat kehitysvaiheet

- backend- ja tietokantaratkaisu localStoragen tilalle
- import/export-toiminnot
- tarkempi audit trail ja mahdolliset käyttäjäroolit
- varsinainen logoaineisto ja brändivahvistus
