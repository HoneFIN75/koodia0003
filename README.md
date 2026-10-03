# 🥏 SFL Pisteytystyökalu

> Suomen frisbeegolfliiton selainpohjainen MVP MPO- ja FPO-kilpailupisteiden hallintaan — pelaajista ja turnauksista tuloskortteihin ja ajantasaiseen rankingiin.

Työkalu on tarkoitettu kilpailutietojen ylläpitäjille ja rankingin seuraajille. Sen päätarkoitus on pitää perustiedot yhdessä paikassa ja laskea pisteet yhdenmukaisesti nykyisistä sijoituksista, pistetaulukoista ja turnauskertoimista.

**Pähkinänkuoressa:** suomenkielinen käyttöliittymä · ei frontend-kehystä · oma JSON-API · palvelimen tiedostotallennus.

## 🛠️ Keskeiset teknologiat

| Osa | Nykyinen toteutus |
| --- | --- |
| Frontend | Semanttinen HTML5, CSS design tokeneilla ja modulaarinen vanilla JavaScript (ES-moduulit). |
| Backend | Node.js:n oma HTTP-palvelin paikalliskehitykseen; vaihtoehtoinen PHP-API Apache-ympäristöön. |
| Tietovarasto | Palvelimen `jsondb/`-hakemiston JSON-tiedostot. Varsinaista tietokantamoottoria ei vielä käytetä. |
| Integraatiot | PDGA-pelaaja- ja kilpailulinkit sekä rajatut CSV-tuonnit ja tuloskorttien CSV-vienti. Ei automaattista PDGA-API-hakua. |
| Testaus ja build | Node.js:n `node --test` ja oma tiedostot kopioiva build-skripti; ei bundleria. |
| Infra / hosting | GitHub Actions rakentaa julkaisun ja siirtää `dist/`-sisällön nykyiselle palvelimelle SSH/rsync-mallilla. Apache/PHP-julkaisua tuetaan `.htaccess`-reitityksellä. |
| Ulkoiset palvelut | Sovelluksen toiminta ei edellytä ulkoista API-palvelua. PDGA-linkit avautuvat ulkoiselle sivustolle. Hosting-palveluntarjoajaa ei määritellä repositoriossa. |

## 🏗️ Järjestelmän rakenne

Sovellus on yhden HTML-sivun käyttöliittymä, jonka näkymät renderöidään JavaScriptillä. Selain ja API palvellaan samasta alkuperästä. Node.js ja PHP ovat **vaihtoehtoisia palvelintoteutuksia**, eivät peräkkäisiä kerroksia.

```text
Käyttäjän toiminto
  → app.js: tapahtumat ja sovellustila
  → toimialamoduulit: validointi ja tietojen muutokset
  → storage.js: GET / PUT /api/state
  → Node.js- tai PHP-API
  → jsondb/: state.json + erilliset JSON-tiedostot
  → scoring.js / ranking.js: pisteiden laskenta
  → ui.js: päivitetty näkymä
```

| Kerros | Tärkeimmät tiedostot ja vastuut |
| --- | --- |
| Käyttöliittymä | `index.html`, `css/styles.css`, `js/ui.js`: sivupohja, ulkoasu ja komponenttien renderöinti. |
| Sovellusohjaus | `js/app.js`: tapahtumankäsittely, käyttöliittymätila ja tallennuksen koordinointi. |
| Toimialalogiikka | `js/players.js`, `js/tournaments.js`, `js/multipliers.js`, `js/results.js`: perustiedot, validoinnit ja tuloskortit. |
| Laskenta | `js/scoring.js`, `js/ranking.js`, `js/summary.js`, `js/compare.js`: pisteet, ranking ja johdetut näkymät. |
| Tallennus ja tunnistautuminen | `js/storage.js`, `js/auth.js`, `js/login.js`; palvelimella `server/` tai `api/index.php`. |
| Yhteiset komponentit | `js/table-sorting.js`, `js/pdga.js`, `js/errorLog.js`, `js/version.js` ja keskitetty ohjesisältö `js/helpData.js`. |

### Pistelaskennan ydin

- **Tuloskortit ovat ainoa pistelähde:** `resultCards: [{ id, playerId, results: [{ tournamentId, placement }] }]`.
- Tuloskortille tallennetaan sijoitus, ei pisteitä tai kerrointa. Turnaus viittaa kertoimeen `multiplierId`-kentällä.
- `turnauspisteet = sijoituksen 1x-peruspisteet × turnauksen kerroin`.
- `kokonaispisteet = pelaajan kaikkien turnauspisteiden summa`.
- Tasatulosmerkintä, esimerkiksi `3T4`, käyttää sijojen 3–6 peruspisteiden keskiarvoa ennen kertoimella kertomista. Tasatulokset syötetään erikseen, niitä ei päätellä automaattisesti.
- Puuttuva pistetaulukon arvo estää tuloksen tallennuksen. Pistetaulukon tai kertoimen muutos vaikuttaa pisteisiin heti.

`js/storage.js` normalisoi datan ja migroi vanhoja tulos- ja kerroinrakenteita. Palvelimen atomisesti kirjoitettava `state.json` on tallennuksen snapshot-lähde; erilliset JSON-tiedostot synkronoidaan sen rinnalle. Sovellusdata ei ole selaimen localStoragessa, mutta kirjautumistunniste on.

## 📄 Sivut ja komponentit

Näkymät ovat saman sovelluksen sisäisiä, eivät erillisiä HTML-sivuja. Sovellusdata ladataan ja tallennetaan yhteisesti `/api/state`-rajapinnan kautta; lukunäkymille ei ole omia API-endpointteja.

| Sivu / näkymä | Tarkoitus | Keskeiset toiminnot | Käytettävät palvelut tai API:t |
| --- | --- | --- | --- |
| Kirjautuminen | Yhteinen salasanasuojaus | Kirjautuminen ja uloskirjautuminen | `POST /api/login`, `js/auth.js` |
| Yhteenveto | Nopea ranking-tilanne | MPO- ja FPO-TOP 10, lajittelu, pelaajan tuloskortin avaaminen | Ladattu tila, `js/summary.js`, `js/ranking.js` |
| Vertaile | Pelaajien sijoitusten vertailu | Pelaajahaku, vertailukortit ja tyhjien turnausrivien piilotus | Ladattu tila, `js/compare.js` |
| Ranking | Kokonaispisteiden seuranta | Kaikki/MPO/FPO-suodatus, lajittelu ja tuloskortit | Ladattu tila, `js/ranking.js`, `js/scoring.js` |
| Tulokset | Turnauskohtainen yhteenveto | Paras MPO/FPO ja turnauksen tuloskortin avaaminen | Ladattu tila, `js/results.js` |
| Pelaajat | Pelaajarekisterin ylläpito | Lisäys, muokkaus, poisto, CSV-tuonti, Rating ja Ranking -päivitys sekä tuloskorttien massa-Import/Export | `/api/state`, `js/players.js`, `js/resultCardCsv.js`, PDGA-linkit |
| Tuloskortit | Sijoitusten ylläpito ja tarkastelu | Pelaajan tuloskortin luku ja muokkaus; turnauksen tuloskortti vain lukutilassa | `/api/state`, `js/results.js`, `js/scoring.js` |
| Turnaukset | Turnauslistan ylläpito | Perustiedot, järjestysnumerot, kerroinvalinta ja CSV-tuonti; ei tulosten syöttöä tällä sivulla | `/api/state`, `js/tournaments.js`, PDGA-linkit |
| Kertoimet | Pistekertoimien ylläpito | Kertoimen nimi, lyhenne, järjestys ja arvo | `/api/state`, `js/multipliers.js` |
| Pistetaulukot | MPO/FPO-peruspisteiden ylläpito | Sijoituskohtaiset pisteet ja CSV-tuonti | `/api/state`, `js/scoring.js` |
| Asetukset | Yhteiset määritykset | PDGA-perusosoitteet, pisteiden näyttötarkkuus ja salasanan vaihto | `/api/state`, `PUT /api/site-password`, `js/pdga.js` |
| Ohjeet | Käyttö- ja tuontiohjeet | Painikkeilla avattavat ohjeosiot ja aiheet | `js/helpData.js`; ei erillistä API:a |

Tuloskorttien CSV-muoto on `PDGA ID;Nimi;T1;T2;…` (UTF-8, puolipiste-erotin). Pelaaja tunnistetaan PDGA ID:llä ja `T<n>` turnauksen järjestysnumerolla. Tuonti päivittää vain sijoituksia. Muut CSV-muodot on kuvattu sovelluksen **Ohjeet**-näkymässä.

## 🧭 Perusperiaatteet

| Periaate | Toteutus ja kehityslinja |
| --- | --- |
| Responsiivisuus | CSS:n mukautuvat asettelut ja taulukoiden vieritys tukevat eri näyttökokoja. |
| Saavutettavuus | Semanttiset rakenteet, kenttien nimet, näppäimistökäyttö, näkyvä focus ja ARIA-tilat. Merkitys ei saa perustua pelkkään väriin. |
| Tietoturva | Syötteiden validointi, renderöitävän tekstin HTML-escapetus ja palvelimella tarkistettava kirjautumistunniste. Tallennus ja varmuuskopiot pidetään poissa julkisesta web-juuresta. |
| Suorituskyky | Ei frontend-kehystä tai kolmannen osapuolen ajonaikaisia paketteja. Ranking lasketaan nykyisestä tilasta; koko tilan siirto ja JSON-tallennus rajaavat skaalautuvuutta. |
| Lokitus | `js/errorLog.js` lähettää raportoitavat virheet `POST /api/errors` -rajapintaan. `jsondb/errors.json` säilyttää enintään 1 000 uusinta merkintää; lokitusvirhe ei keskeytä käyttäjän toimintoa. Ei kattavaa audit trailia. |
| Virheenkäsittely | Suomenkieliset kenttävirheet ja toimintopalautteet, API:n JSON-virhevastaukset ja kirjautumiseen ohjaus tunnisteen puuttuessa tai ollessa virheellinen. |

### Salasanasuojaus ei ole käyttäjähallinta

Yhteinen sivuston salasana on kehitysvaiheen portti, ei käyttäjäkohtainen oikeusmalli. Vaihda koodissa määritetty ensikäynnistyksen oletussalasana heti käyttöönotossa kohdassa **Asetukset → Turvallisuus → Sivuston salasana** (8–200 merkkiä).

API käyttää allekirjoitettua `X-SFL-Auth-Token`-tunnistetta. Salasanatiiviste ja allekirjoitusavain säilyvät palvelimen `settings.json`-tiedostossa eikä niitä palauteta selaimelle. Tunniste ei vanhene automaattisesti; salasanan vaihto ei mitätöi olemassa olevia istuntoja. Istunnot voi mitätöidä poistamalla palvelimen `settings.json`-tiedostosta `authSecret`-kentän, jolloin uusi avain luodaan automaattisesti.

Julkisessa käytössä tarvitaan HTTPS ja asianmukaisesti suojattu palvelinympäristö. Node-palvelin kuuntelee oletuksena vain loopback-osoitetta. Muualta tulevat kirjoituspyynnöt edellyttävät asetettua `SFL_API_WRITE_TOKEN`-arvoa ja luotetun proxyn välittämiä otsakkeita `X-SFL-Proxy-Authenticated: true` sekä `X-SFL-Write-Token`. Selain ei saa käsitellä proxyn salaisuutta.

## ⚙️ Vakioasetukset ja määrittelyt

### Palvelimen ympäristömuuttujat

Paikallinen Node-kehitys toimii oletuksilla. Projektissa ei ole `.env`-lataajaa: muuttujat asetetaan prosessin ympäristöön.

| Muuttuja | Toteutus | Oletus / tarkoitus |
| --- | --- | --- |
| `PORT` | Node.js | `3000` |
| `HOST` | Node.js | `127.0.0.1` |
| `PUBLIC_DIR` | Node.js | Repositorion juuri; julkaistun buildin tarjoamiseen esimerkiksi `dist`. Suhteelliset polut ratkaistaan projektin juuresta. |
| `JSONDB_DIR` | Node.js | `jsondb`; pysyvien tietojen hakemisto. Suhteellinen polku ratkaistaan projektin juuresta. |
| `SFL_API_WRITE_TOKEN` | Node.js | Ei asetettu oletuksena; proxyn kautta tulevien kirjoituspyyntöjen tarkistus. |
| `SFL_JSONDB_PATH` | PHP | Oletuksena sovelluksen juuren `jsondb`; tuotannossa aseta absoluuttinen polku web-juuren ulkopuolelle. |
| `SFL_ALLOW_PUBLIC_JSONDB` | PHP | Ei sallittu oletuksena. Arvo `true` ohittaa määritetyn tallennuspolun web-juuritarkistuksen; älä käytä ohitusta julkisessa ympäristössä. |

Julkaisuworkflow käyttää olemassa olevia GitHub Actions -salaisuuksia `SSH_USER`, `SSH_HOST`, `DEPLOY_PATH` ja `SSH_KEY`. Niiden arvoja ei tallenneta repositorioon eikä niitä tarvitse muuttaa README-päivityksen vuoksi.

### Sovelluksen oletukset ja standardit

- Sarjat: **MPO** ja **FPO**. Uudessa tietovarastossa pelaajat, turnaukset, tuloskortit ja pistetaulukkojen arvot ovat tyhjiä.
- Oletuskertoimet: **Major 2×**, **National Tour 1,5×**, **C-Tier 1×**; ylläpito Kertoimet-näkymässä.
- PDGA-perusosoitteet: `https://www.pdga.com/player/` ja `https://www.pdga.com/tour/event/`; linkki muodostetaan perusosoitteesta ja tunnuksesta.
- Pisteiden näyttötarkkuus: **2 desimaalia**, valittavissa 0–4. Näyttöpyöristys ei muuta laskennan tarkkuutta.
- Datan skeemaversio on `js/storage.js`-moduulin `STORAGE_VERSION` (nykyisin **5**).
- HTML5, ES-moduulit, UTF-8, JSON ja HTTP-rajapinta. Käyttöliittymän kieli on suomi.

## 🚀 Kehitysohjeet

### 1. Käynnistä paikallisesti

Tarvitset **Node.js 20+** ja npm:n. PHP ei ole tarpeen Node-palvelinta käytettäessä.

Suorita repositorion juuressa:

```bash
npm ci
npm start
```

Avaa **http://127.0.0.1:3000**. Palvelin luo tietovaraston tarvittaessa. Käytä ensikäynnistyksessä oletussalasanaa, jonka määrittely löytyy tiedostoista `server/site-auth.mjs` ja `api/index.php`, ja vaihda se heti.

Käyttöliittymän tiedostomuutokset näkyvät sivun päivityksellä; palvelinkoodin muutokset vaativat palvelimen uudelleenkäynnistyksen. Älä avaa `index.html`-tiedostoa suoraan `file://`-osoitteella, sillä sovellus tarvitsee API:n.

### 2. Testaa ja rakenna

```bash
npm test
npm run build
```

- Testit käyttävät Node.js:n sisäänrakennettua testiajuria; PHP-API-testit hyödyntävät PHP:tä, jos se on saatavilla.
- Kohdennettu testi: `node --test tests/scoring.test.js`.
- Erillistä lint-komentoa ei ole määritelty.
- Build luo `dist/`-hakemiston uudelleen ja kopioi HTML:n, CSS:n, JavaScriptin, resurssit sekä `server/`- ja `api/`-hakemistot. Sovellusdataa ei kopioida.
- `dist/`, `node_modules/` ja `jsondb/` on jätetty versionhallinnan ulkopuolelle.

### 3. Julkaise hyväksynnän jälkeen

> **Automaattinen julkaisu käynnistyy vain `main`-haaran pushista.** PR-haaran push ei julkaise sovellusta. Workflow sallii lisäksi erillisen käsikäynnistyksen (`workflow_dispatch`).

Nykyinen `.github/workflows/deploy.yml` ajaa `npm ci`, `npm test` ja `npm run build`, luo `version.json`-metatiedot, tarkistaa buildin ja siirtää koko `dist/`-sisällön SSH/rsyncillä. `jsondb/` suojataan rsync-poistoilta. Lopuksi workflow päivittää version metatiedot atomisesti palvelimen UTC-ajalla.

Apache/PHP-ympäristössä tarvitaan PHP, `.htaccess`-reititystä tukeva Apache ja PHP-prosessille kirjoitettava tallennushakemisto. Julkaise `dist/` kokonaisuudessaan, myös piilotetut `.htaccess`-tiedostot, ja aseta `SFL_JSONDB_PATH` web-juuren ulkopuolelle. Tarkista `/api/health`: vastauksessa tulee olla `"status": "ok"`.

Palvelinympäristön vastuulla ovat HTTPS, tallennushakemiston oikeudet ja varmuuskopiot. **Tämä dokumentaatiomuutos ei muuta deploy-salaisuuksia, palvelinympäristöä tai SSH-asetuksia eikä käynnistä julkaisua.** README tulee `main`-haaraan vasta PR:n hyväksynnän ja yhdistämisen jälkeen.

## 📂 Hakemistorakenne

```text
.
├── index.html               # Sovelluksen HTML-sivupohja
├── css/                     # Tyylit ja design tokenit
├── js/                      # Käyttöliittymä, toimialalogiikka ja API-asiakas
├── assets/                  # Staattiset kuvat ja muut resurssit
├── server/                  # Node.js-palvelin, tunnistautuminen ja JSON-tallennus
├── api/                     # Vaihtoehtoinen PHP-API ja sen Apache-reititys
├── scripts/                 # Build-skripti
├── tests/                   # Laskennan, UI:n, tallennuksen ja API:n testit
├── docs/                    # MVP-vaatimusdokumentti
├── .github/workflows/       # GitHub Actions -julkaisuworkflow
├── .htaccess                # Juuren Apache-API-reititys
├── package.json             # Projektin tiedot ja npm-komennot
├── package-lock.json        # Lukittu npm-asennus
├── jsondb/                  # Ajossa syntyvä tietovarasto; ei versionhallinnassa
└── dist/                    # Buildin tulos; ei versionhallinnassa
```

**Aloita lukeminen:** `js/app.js` → `js/storage.js` → `js/scoring.js` → `js/ui.js`. Käyttöohjeiden sisältö ylläpidetään `js/helpData.js`-rakenteessa, ei tietovarastossa. [MVP-vaatimusdokumentti](docs/mvp-requirements.md) kuvaa alkuperäistä rajausta; nykyinen toteutus sisältää jo esimerkiksi palvelintallennuksen ja yhteisen salasanasuojauksen.

## 🗺️ Huomioitavaa ja jatkokehitys

### Riippuvuudet ja tunnetut rajoitteet

- `package.json` ei määrittele ulkoisia npm-riippuvuuksia; Node.js ja vaihtoehtoisesti PHP/Apache ovat ympäristövaatimuksia.
- Ei käyttäjäkohtaisia tunnuksia tai rooleja, automaattista istunnon vanhenemista eikä kattavaa audit trailia.
- Tiedot ovat yhteisiä, mutta monikäyttäjämuokkausten konfliktinratkaisua ei ole: koko tilan tallennus voi ylikirjoittaa toisen käyttäjän muutokset.
- Ei offline-tallennusta tai automaattista PDGA-synkronointia. Tuonti/vienti rajoittuu toteutettuihin CSV-toimintoihin.
- JSON-tiedostojen varmuuskopiointi ja palautus eivät kuulu sovelluksen toimintoihin.
- Käyttöliittymän SFL-henkinen ilme ei tarkoita, että värit olisivat vahvistettuja virallisia brändivärejä. Logo on tekstipaikkavaraus.

### Mahdolliset seuraavat vaiheet

Tietokantapohjainen tallennus, käyttäjäkohtainen tunnistautuminen ja oikeudet, muokkauskonfliktien hallinta, tarkempi audit trail sekä hyväksytty logoaineisto ja brändivahvistus. Nämä ovat jatkokehitysideoita, eivät nykyisen version ominaisuuksia.
