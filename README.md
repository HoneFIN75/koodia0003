# SFL Pisteytystyökalu

SFL Pisteytystyökalu on Suomen frisbeegolfliiton selainpohjainen MVP suomalaisen MPO- ja FPO-pelaajaringingin, turnausten, pistetaulukoiden ja turnaustulosten hallintaan.

## Teknologia

Ratkaisu on tarkoituksella kevyt ja jatkokehitettävä:

- semanttinen HTML5-sivupohja
- erillinen CSS-tiedosto design tokeneilla
- modulaarinen vanilla JavaScript
- minimaalinen Node.js-palvelin paikalliskehitykseen ja vaihtoehtoinen PHP-API Apache-ympäristöön
- palvelimen `jsondb/`-hakemistoon tallennettavat JSON-tiedostot
- Node.js-pohjainen testaus (`node --test`)
- yksinkertainen build-skripti julkaistavan `dist`-hakemiston luontiin

Ratkaisu säilyy kevyenä, mutta data kulkee nyt selaimesta REST API:n kautta palvelimen JSON-tiedostoihin. Tallennus on erotettu omaksi kerroksekseen, jotta JSON-tallennus voidaan myöhemmin korvata tietokantaratkaisulla ilman käyttöliittymän täydellistä uudelleenkirjoitusta.

## MVP-toiminnallisuudet

- suomenkielinen responsiivinen käyttöliittymä ja päänavigaatio
- pelaajien CRUD-hallinta (MPO/FPO)
- turnausten CRUD-hallinta ennalta määritetyillä multiplier-vaihtoehdoilla
- asetussivu yhteisille PDGA-linkkiasetuksille
- keskitetty MPO/FPO-pistetaulukkonäkymä ja ylläpito
- Tulokset-sivun turnausyhteenveto (Paras MPO / Paras FPO) turnausten järjestysnumeron mukaisessa järjestyksessä
- pelaajakohtaiset tuloskortit (Pelaajat → Tuloskortti): sijoitusten syöttö turnauksittain, automaattitallennus, Tallenna-painike ja Tab-siirtymä seuraavalle riville
- tuloskortit ovat ainoa pistelähde: turnaus- ja kokonaispisteet lasketaan aina dynaamisesti sijoituksista, pistetaulukoista ja kertoimista
- ranking kaikille, MPO:lle ja FPO:lle
- yhteenvetonäkymä tilastokorteilla, top 10 -pylväillä ja pelaajakohtaisella tulostaulukolla
- Ohjeet-näkymä, johon kaikki käyttöohjeet on koottu

## Ohjeet-näkymä

Kaikki käyttöohjeet, tuontiohjeet ja selitykset ylläpidetään keskitetysti tiedostossa `js/helpData.js`.

- rakenne on `{ id, title, topics: [{ title, content }] }`
- Ohjeet-näkymä renderöi osiot ja ohjeaiheet automaattisesti `details`/`summary`-rakenteena
- ohjeen lisääminen, muokkaaminen tai poistaminen vaatii vain muutoksen `js/helpData.js`-tiedostoon eikä lainkaan käyttöliittymäkehitystä
- ohjeita ei muokata käyttöliittymästä eikä niitä tallenneta tietovarastoon

## Pistelaskenta

- `turnauspisteet = sijoituksen 1x-peruspisteet × turnauksen multiplier`
- `kokonaispisteet = pelaajan kaikkien turnauspisteiden summa`
- tuloskortti on pelaajakohtainen (`resultCards: [{ id, playerId, results: [{ tournamentId, placement }] }]`) ja sille tallennetaan vain sijoitus
- pisteitä, peruspisteitä tai kertoimia ei tallenneta: ne lasketaan aina nykyisestä pistetaulukosta ja turnauksen nykyisestä kertoimesta
- vanhat turnauskohtaiset tuloskortit ja `tournamentResults`-rivit migroidaan pelaajakohtaisiksi tuloskorteiksi datan normalisoinnissa

Pisteet haetaan keskitetysti `js/scoring.js`-moduulista. Pistearvoja ei kovakoodata käyttöliittymäkomponentteihin.

## PDGA-asetukset ja tunnukset

- Asetukset-näkymässä hallitaan yhteisiä PDGA-perusosoitteita:
  - `PDGA-pelaajaosoitteen perus-URL` (oletus `https://www.pdga.com/player/`)
  - `PDGA-kilpailuosoitteen perus-URL` (oletus `https://www.pdga.com/tour/event/`)
- Pelaajalle tallennetaan vain PDGA-pelaajatunnus.
- Turnaukselle tallennetaan vain PDGA-kilpailutunnus.
- Käyttöliittymä muodostaa PDGA-linkit automaattisesti muodossa `perusosoite + tunnus`.
- Vanhoista täydellisistä PDGA-osoitteista poimitaan tunnus automaattisesti tallennusdatan normalisoinnissa aina kun se on mahdollista.

## Väliaikainen salasanasuojaus

Kehitysvaiheessa sovellus on suojattu yhteisellä sivuston salasanalla. Kyseessä ei ole tuotantotason käyttäjähallinta, vaan kevyt portti satunnaisen käytön estämiseksi.

- Sovellus näyttää ensin kirjautumisnäkymän (`js/login.js`). Salasana tarkistetaan palvelimella (`POST /api/login`), ja onnistuneesta kirjautumisesta tallennetaan selaimen localStorageen allekirjoitettu tunniste.
- Tunniste säilyy sivun päivitysten ja selaimen uudelleenkäynnistysten yli, kunnes käyttäjä valitsee **Kirjaudu ulos** tai selaimen tallennustila tyhjennetään.
- `GET /api/state` ja `PUT /api/state` vaativat voimassa olevan tunnisteen (`X-SFL-Auth-Token`-otsake).
- Salasanaa vaihdetaan kohdassa **Asetukset → Turvallisuus → Sivuston salasana** (`PUT /api/site-password`, vähintään 8 merkkiä). Uusi salasana koskee tulevia kirjautumisia; jo kirjautuneet käyttäjät pysyvät kirjautuneina.
- Salasana säilytetään vain palvelimella tiedostossa `jsondb/settings.json` tiivisteenä (`sitePasswordHash`, PHP:ssä `password_hash`). Samassa tiedostossa on tunnisteiden allekirjoitusavain `authSecret`. Näitä kenttiä ei koskaan palauteta selaimelle.
- **Oletussalasana on `sfl-pisteet-2026`.** Palvelin kirjoittaa sen tiivisteen `settings.json`-tiedostoon ensimmäisellä kirjautumiskerralla, jos salasanaa ei ole asetettu. Vaihda salasana heti käyttöönoton jälkeen.
- Salasanan voi asettaa myös käsin lisäämällä `settings.json`-tiedostoon kentän `"sitePassword": "..."` ja poistamalla `sitePasswordHash`-kentän. Selväkielinen arvo muutetaan tiivisteeksi ensimmäisellä onnistuneella kirjautumisella.
- Kaikkien istuntojen mitätöimiseksi poista `authSecret` tiedostosta `settings.json`; palvelin luo uuden avaimen automaattisesti.
- Tunnistautuminen on eristetty moduuleihin `js/auth.js` ja `js/login.js`, jotta se voidaan myöhemmin korvata varsinaisella kirjautumisella (esim. Microsoft/Google ja roolipohjainen käyttöoikeus) ilman laajoja muutoksia muuhun sovellukseen.

## Tallennus

Tämä MVP-versio tallentaa kaiken datan palvelimen `jsondb/`-hakemistoon JSON-tiedostoina REST API:n kautta.

- tiedot ovat yhteisiä kaikille käyttäjille
- palvelin luo puuttuvat JSON-tiedostot automaattisesti
- palvelin ylläpitää lisäksi sisäistä atomista `state.json`-snapshotia, jotta kirjoitus pysyy eheänä
- `jsondb/`-hakemisto pitää säilyttää deployjen yli
- API-endpointit ovat `GET /api/state`, `PUT /api/state`, `GET /api/health`, `POST /api/login` ja `PUT /api/site-password`
- tietokantapohjainen backend on myöhempi kehitysvaihe
- importia ja exportia ei ole vielä toteutettu
- JSON-tiedostojen varmuuskopiointi kuuluu palvelinympäristölle

## Käynnistys paikallisesti

Edellytykset:

- Node.js 20+
- npm

Asennus ja komennot:

```bash
npm install
npm test
npm run build
npm start
```

Avaa tämän jälkeen sovellus osoitteesta `http://localhost:3000`.

Palvelin kuuntelee oletuksena vain paikallista rajapintaa (`127.0.0.1`). Julkisessa ympäristössä Node-palvelin kannattaa sijoittaa autentikoidun tai muuten suojatun reverse proxyn taakse. Jos proxy ei yhdistä Node-palvelimeen loopback-osoitteesta, write-pyyntöjen pitää välittää sekä `X-SFL-Proxy-Authenticated: true` että `X-SFL-Write-Token`, kun `SFL_API_WRITE_TOKEN` on asetettu Node-palvelimelle.

## Julkaisu

`.github/workflows/deploy.yml` rakentaa julkaistavan `dist`-hakemiston ja julkaisee sen SSH/rsync-mallilla. Workflow suojaa palvelimen `jsondb/`-hakemiston rsync-poistoilta, jotta data säilyy deployjen yli. Workflow saa käynnistyä automaattisesti vain `main`-haaran pushista.

### Apache/PHP-ympäristö

- Lataa webhotelliin `dist/`-hakemiston sisältö kokonaisuudessaan (ml. `api/` ja juuren `.htaccess`).
- Varmista, että `jsondb/` on kirjoitettavissa PHP-prosessille (hakemisto luodaan automaattisesti tarvittaessa).
- Suositus: aseta ympäristömuuttuja `SFL_JSONDB_PATH` osoittamaan web-juuren ulkopuoliseen hakemistoon.
- Tarkista toimivuus avaamalla `https://oma-domain.fi/api/health` — vastauksen tulee olla JSON, jossa `status` on `ok`.

## Brändi ja logo

Käyttöliittymän värit ja typografinen ilme on johdettu varovaisesti Suomen frisbeegolfliiton verkkosivuston yleisestä virallisesta ja urheilullisesta tunnelmasta. Väriarvoja ei pidä tulkita liiton virallisiksi brändiväreiksi.

Tässä MVP:ssä käytetään tekstimuotoista logo-paikkavarausta “Suomen frisbeegolfliitto”. Lopullinen SVG- tai PNG-logo sekä viralliset väriarvot pitää varmistaa erillisestä hyväksytystä logoaineistosta ja graafisesta ohjeistosta ennen lopullista tuotantoviimeistelyä.

## Seuraavat kehitysvaiheet

- tietokantapohjainen tallennus JSON-välivaiheen tilalle
- import/export-toiminnot
- tarkempi audit trail ja mahdolliset käyttäjäroolit
- varsinainen logoaineisto ja brändivahvistus
