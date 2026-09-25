# Copilot-ohjeet: SFL Pisteytystyökalu

## Sovelluksen tarkoitus

SFL Pisteytystyökalu on Suomen frisbeegolfliiton selainpohjainen MVP, jolla hallitaan MPO- ja FPO-pelaajia, turnauksia, pistetaulukoita, turnaustuloksia ja rankingia.

## Teknologia

- semanttinen HTML5
- erillinen CSS design tokeneilla
- modulaarinen vanilla JavaScript
- localStorage versionoidulla avaimella
- Node.js testit ja build-skripti

## Käyttöliittymä

- kaikki näkyvät käyttöliittymätekstit ovat suomeksi
- käyttöliittymä noudattaa hillittyä SFL-henkistä ilmettä, mutta värejä ei pidä väittää virallisiksi ennen brändivahvistusta
- saavutettavuus, responsiivisuus ja näkyvä focus ovat pakollisia
- käyttö ei saa perustua pelkkään väriin

## Tietomallin periaatteet

- pelaajat, turnaukset, pistetaulukot ja turnaustulokset tallennetaan keskitetysti
- pistetaulukko on erotettu käyttöliittymäkomponenteista
- snapshot-pisteet tallennetaan jokaiselle turnaustulokselle
- localStorage voidaan myöhemmin korvata API:lla tai tietokannalla

## Pistelaskenta

- pisteiden laskenta keskitetään yhteen moduuliin tai funktioon (`js/scoring.js`)
- `turnauspisteet = 1x-peruspisteet × multiplier`
- `kokonaispisteet = pelaajan kaikkien turnaustulosten summa`
- MPO- ja FPO-pistetaulukoita ei kovakoodata UI-komponentteihin
- jos pistetaulukon arvo puuttuu, tulosta ei tallenneta

## Validoinnit

- pelaajalla nimi ja sarja ovat pakollisia
- PDGA-numero on yksilöllinen, jos se annetaan
- turnauksella nimi, alkamispäivä ja multiplier ovat pakollisia
- sijoitus on positiivinen kokonaisluku
- multiplierin pitää olla sallittu arvo ja nollaa suurempi
- päättymispäivä ei voi olla ennen alkamispäivää
- sama pelaaja voi esiintyä samassa turnauksessa vain kerran

## Testausvaatimukset

- merkittäville laskentasäännöille tehdään testit
- `npm test` ja `npm run build` pidetään toimivina
- olemassa olevaa toimivaa rakennetta ei muuteta ilman perusteltua syytä

## MVP-rajaukset

- ei ulkoisia palveluita tai API-kutsuja
- ei kirjautumista, rooleja tai käyttöoikeuksia
- ei importia tai exportia
- ei monikäyttäjäsynkronointia
- ei automaattista tasatulospisteiden jakamista

## Turvallinen julkaisu

- mitään muutoksia ei julkaista automaattisesti Copilotin toimesta
- julkaisuworkflow saa käynnistyä automaattisesti vain `main`-haaran pushista
- deploy-salaisuuksia, palvelinympäristöä tai SSH-asetuksia ei muuteta
- build julkaisee koko staattisen `dist`-hakemiston nykyisellä SSH/rsync-mallilla
