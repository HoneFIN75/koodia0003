/**
 * Ohjeet-osion sisältö ylläpidetään keskitetysti tässä moduulissa.
 * Uuden ohjeen lisääminen, muokkaaminen tai poistaminen ei vaadi käyttöliittymämuutoksia:
 * riittää, että muokkaat alla olevaa rakennetta.
 *
 * Rakenne:
 * {
 *   id: 'players',
 *   title: 'Pelaajat',
 *   topics: [{ title: 'CSV-tuonti', content: 'Ohjeteksti...' }],
 * }
 */
export const HELP_SECTIONS = [
  {
    id: 'summary',
    title: 'Yhteenveto',
    topics: [
      {
        title: 'Yhteenvetonäkymä',
        content: `Yhteenveto on sovelluksen aloitusnäkymä ja se kokoaa tilanteen yhdelle sivulle.

Näkymä sisältää:
- Pelaajat-tunnusluvun, joka kertoo tallennettujen pelaajien määrän
- Turnaukset-tunnusluvun, joka kertoo tallennettujen turnausten määrän
- World Ranking MPO- ja World Ranking FPO -taulukot PDGA World Ranking -sijoituksen mukaan
- TOP 10 MPO- ja TOP 10 FPO -taulukot sovelluksen kokonaispisteiden mukaan

Kaikissa neljässä taulukossa on samat sarakkeet: #, Nimi, Rating ja Kokonaispisteet. TOP 10 -taulukoissa # on pelaajan sijoitus sovelluksen rankingissa, ja taulukon voi lajitella samalla tavalla sarakkeiden #, Rating ja Kokonaispisteet mukaan. Lajittelu muuttaa vain näyttöjärjestystä, ei TOP 10 -listan pelaajia.

Yhteenveto on vain lukunäkymä: tietoja muokataan aina niiden omilla sivuilla.`,
      },
      {
        title: 'World Ranking MPO',
        content: `World Ranking MPO -taulukko näyttää MPO-sarjan pelaajat PDGA World Ranking -sijoituksen mukaan. Taulukko on TOP 10 MPO -taulukon yläpuolella, jotta virallista PDGA-sijoitusta voi verrata suoraan sovelluksen omiin rankingpisteisiin.

Sarakkeet:
- # = pelaajan World Ranking -sijoitus
- Nimi = pelaajan nimi
- Rating = pelaajan nykyinen PDGA-rating
- Kokonaispisteet = sovelluksen rankingin kokonaispisteet, jotka lasketaan aina tuloskorttien sijoituksista

Lajittelu: oletuksena taulukko on lajiteltu World Rankingin mukaan nousevasti, eli paras sijoitus on ensimmäisenä. Sarakkeiden #, Rating ja Kokonaispisteet otsikot ovat painikkeita: valinta lajittelee sarakkeen mukaan ja uusi valinta vaihtaa nousevan (▲) ja laskevan (▼) järjestyksen. Jokaisella Yhteenvedon taulukolla on oma lajittelunsa, joten World Ranking MPO -taulukon lajittelu ei muuta muiden taulukoiden järjestystä.

Puuttuva ranking: pelaajat, joilla ei ole World Ranking -sijoitusta (kenttä on tyhjä), eivät näy taulukossa. Taulukossa näytetään vain positiiviset kokonaislukusijoitukset. Sijoituksen voi lisätä pelaajan tietoihin Pelaajat-sivulla tai Rating ja Ranking -päivitysimportilla.

Tuloskortti: pelaajan nimi on painike, joka avaa pelaajan tuloskortin lukutilaan samalla tavalla kuin Ranking-sivulla. Yhteenvetoon palataan Takaisin yhteenvetoon -painikkeella tai päänavigaation Yhteenveto-kohdasta.`,
      },
      {
        title: 'World Ranking FPO',
        content: `World Ranking FPO -taulukko näyttää FPO-sarjan pelaajat PDGA World Ranking -sijoituksen mukaan. Taulukko on TOP 10 FPO -taulukon yläpuolella, jotta virallista PDGA-sijoitusta voi verrata suoraan sovelluksen omiin rankingpisteisiin.

Sarakkeet:
- # = pelaajan World Ranking -sijoitus
- Nimi = pelaajan nimi
- Rating = pelaajan nykyinen PDGA-rating
- Kokonaispisteet = sovelluksen rankingin kokonaispisteet, jotka lasketaan aina tuloskorttien sijoituksista

Lajittelu: oletuksena taulukko on lajiteltu World Rankingin mukaan nousevasti, eli paras sijoitus on ensimmäisenä. Sarakkeiden #, Rating ja Kokonaispisteet otsikot ovat painikkeita: valinta lajittelee sarakkeen mukaan ja uusi valinta vaihtaa nousevan (▲) ja laskevan (▼) järjestyksen. Jokaisella Yhteenvedon taulukolla on oma lajittelunsa, joten World Ranking FPO -taulukon lajittelu ei muuta muiden taulukoiden järjestystä.

Puuttuva ranking: pelaajat, joilla ei ole World Ranking -sijoitusta (kenttä on tyhjä), eivät näy taulukossa. Taulukossa näytetään vain positiiviset kokonaislukusijoitukset. Sijoituksen voi lisätä pelaajan tietoihin Pelaajat-sivulla tai Rating ja Ranking -päivitysimportilla.

Tuloskortti: pelaajan nimi on painike, joka avaa pelaajan tuloskortin lukutilaan samalla tavalla kuin Ranking-sivulla. Yhteenvetoon palataan Takaisin yhteenvetoon -painikkeella tai päänavigaation Yhteenveto-kohdasta.`,
      },
    ],
  },
  {
    id: 'compare',
    title: 'Vertaile',
    topics: [
      {
        title: 'Pelaajahaku',
        content: `Vertaile-sivulla pelaajat haetaan hakukentällä, ei pitkästä valikosta.

Kirjoita hakukenttään vähintään 3 merkkiä pelaajan nimestä tai PDGA ID:stä. Hakukenttä ehdottaa osumia, esimerkiksi hakusana "Tuo" löytää pelaajan Tuomo Rikman ja hakusana "123" löytää pelaajan, jonka PDGA ID alkaa numeroilla 123.`,
      },
      {
        title: 'Pelaajien lisääminen ja poistaminen',
        content: `Lisää pelaaja vertailuun valitsemalla hänet hakuehdotuksista. Valitut pelaajat näkyvät vertailutaulukon yläpuolella omina kortteinaan, joissa kerrotaan PDGA-rating, maailmanranking, kokonaispisteet ja turnausten määrä.

Poista pelaaja vertailusta kortin − -painikkeella. Poistaminen koskee vain tätä vertailua: pelaajan tietoja tai tuloksia ei poisteta.`,
      },
      {
        title: 'Tyhjien turnausten piilotus',
        content: `Valinta "Piilota turnaukset joissa kukaan vertailtavista pelaajista ei ole pelannut" rajaa taulukosta pois ne turnaukset, joissa yhdelläkään valitulla pelaajalla ei ole sijoitusta.

Poista valinta, kun haluat nähdä kaikki turnaukset.`,
      },
      {
        title: 'Sijoitusten vertailu',
        content: `Taulukossa on yksi rivi jokaista turnausta kohti. Turnaukset ovat samassa järjestyksessä kuin Turnaukset-sivulla: ensin järjestysnumeron ja sitten alkamispäivän mukaan.

Kiinteät sarakkeet ovat Turnauksen nimi, Tila ja Kerroin. Niiden jälkeen on yksi sarake jokaiselle valitulle pelaajalle.

Sijoitus näytetään täsmälleen siinä muodossa kuin se on tallennettu, myös tasatulokset (esimerkiksi 3T4). Jos pelaaja ei ole pelannut turnauksessa, sarakkeessa näkyy viiva.`,
      },
      {
        title: 'Parhaan sijoituksen korostus',
        content: `Jokaisella turnausrivillä korostetaan valittujen pelaajien paras sijoitus vaalealla taustalla ja lihavoinnilla. Ruudunlukija kertoo korostuksen tekstillä "paras sijoitus", joten korostus ei perustu pelkkään väriin.

Jos useampi pelaaja on jakanut saman parhaan sijoituksen, kaikki heidän sijoituksensa korostetaan.

Vertaile-sivu on lukunäkymä: sijoituksia, pisteitä tai pelaajatietoja ei voi muokata täällä.`,
      },
    ],
  },
  {
    id: 'ranking',
    title: 'Ranking',
    topics: [
      {
        title: 'Rankingin laskenta',
        content: `Pelaajan kokonaispisteet ovat kaikkien hänen turnaustulostensa pisteiden summa.

Yksittäisen turnaustuloksen pisteet lasketaan kaavalla:
turnauspisteet = 1x-peruspisteet × turnauksen kerroin

1x-peruspisteet haetaan sarjan pistetaulukosta pelaajan sijoituksen perusteella. Jos pistetaulukosta puuttuu sijoitusta vastaava rivi, tulokselle ei lasketa pisteitä.`,
      },
      {
        title: 'Rankingin tietolähteet',
        content: `Ranking muodostuu seuraavista tiedoista:
- Pelaajat-sivun pelaajat ja heidän sarjansa
- Pelaajien tuloskorteille tallennetut sijoitukset
- Pistetaulukot-sivun 1x-peruspisteet
- Kertoimet-sivun kertoimet, jotka on liitetty turnaukseen

Ranking ja Yhteenvedon TOP-listat päivittyvät automaattisesti, kun sijoitus, pistetaulukko tai kerroin muuttuu.`,
      },
      {
        title: 'Pisteiden pyöristys',
        content: `Asetukset-sivun Pyöristys-valinta määrittää, montako desimaalia kokonaispisteissä näytetään (0–4, oletus 2). Pisteet näytetään suomalaisessa muodossa desimaalipilkulla, esimerkiksi 123,46.

Pyöristys vaikuttaa vain näytettäviin arvoihin Yhteenveto-sivun taulukoissa ja Ranking-sivun kokonaispisteissä. Laskenta, tallennetut arvot, pistetaulukot, kertoimet ja tulokset säilyttävät aina täyden tarkkuuden.`,
      },
      {
        title: 'Pelaajan Tuloskortin avaaminen',
        content: `Ranking-taulukossa pelaajan nimi on painike: sitä napsauttamalla (tai valitsemalla näppäimistöllä Enterillä tai välilyönnillä) avautuu kyseisen pelaajan Tuloskortti sovelluksen sisällä. Tuloskortti ei avaudu uuteen välilehteen eikä ulkoiselle sivustolle.

Tuloskortti avautuu aina lukutilaan, joten sijoituksia tai pisteitä ei voi muuttaa vahingossa:
- Muokkaa-painike siirtää muokkaustilaan, jossa sijoituskenttiä voi muuttaa
- Tallenna ja poistu tallentaa muutokset ja palauttaa lukutilaan
- Poistu sulkee muokkaustilan tallentamatta ja varmistaa tallentamattomat muutokset

Rankingiin palataan Takaisin Rankingiin -painikkeella tai päänavigaation Ranking-kohdasta.

PDGA ID -sarakkeen numero toimii edelleen linkkinä pelaajan PDGA-profiiliin uudessa välilehdessä.`,
      },
      {
        title: 'Rankingin suodatus ja lajittelu',
        content: `Ranking-listaa voi suodattaa sarjan mukaan taulukon yläpuolella olevilla painikkeilla (Kaikki, MPO, FPO). Valittu suodatin on korostettu ja merkitty ✓-merkillä.

Taulukon sarakeotsikkoa napsauttamalla lista lajitellaan nousevaan järjestykseen (▲) ja uudelleen napsauttamalla laskevaan järjestykseen (▼). Lajitella voi esimerkiksi sijan, nimen, PDGA-ratingin, maailmanrankingin, turnausmäärän tai kokonaispisteiden mukaan.`,
      },
    ],
  },
  {
    id: 'results',
    title: 'Tulokset',
    topics: [
      {
        title: 'Tulokset-sivun turnausyhteenveto',
        content: `Tulokset-sivu näyttää kaikki turnaukset samassa järjestyksessä kuin Turnaukset-sivulla (järjestysnumero nousevasti).

Jokaisesta turnauksesta näytetään:
- Turnauksen nimi
- Tila ja kerroin Kertoimet-sivulta
- Alku- ja loppupäivä
- Paras MPO ja Paras FPO muodossa sijoitus ja pelaajan nimi, esimerkiksi 1 Niklas Anttila
- Tulokset-painike, joka avaa turnauksen tuloskortin (katso Turnauksen tulokset)

Jos turnaukseen ei ole vielä syötetty kyseisen sarjan tuloksia, sarakkeessa näytetään viiva (-). Yhteenveto on lukunäkymä: sijoitukset syötetään pelaajien tuloskorteille.`,
      },
      {
        title: 'Turnauksen tulokset',
        content: `Tulokset-painike: jokaisen turnausrivin lopussa on Tulokset-painike, joka avaa turnauksen tuloskortin sovelluksen sisällä. Tulokset-sivulle palataan Takaisin tuloksiin -painikkeella tai päänavigaation Tulokset-kohdasta.

Turnauksen tuloskortti: kortti näyttää turnauksen viralliset tulokset yhdellä silmäyksellä ilman, että pelaajien tuloskortteja tarvitsee avata. Kortti on lukunäkymä: siinä ei voi muokata sijoituksia tai pisteitä eikä tehdä hallintatoimintoja. Sijoituksia muokataan vain pelaajan tuloskortilla.

Turnauksen tiedot: kortin yläosassa näkyy turnauksen nimi ja sen alla päivämäärä, paikkakunta, tila (esimerkiksi MAJ) ja PDGA Event ID. Jos turnauksen alkamis- ja päättymispäivä ovat eri päiviä, näytetään väli, esimerkiksi 17.07.2026 - 20.07.2026. Yksipäiväisestä turnauksesta näytetään vain yksi päivämäärä, esimerkiksi 17.07.2026.

MPO-tulokset ja FPO-tulokset: kummallakin sarjalla on oma taulukkonsa sarakkeilla Sijoitus ja Kilpailija.

Lajittelu: tulokset näytetään kilpailujärjestyksessä syötetyn sijoituksen mukaan, esimerkiksi 1, 2, 3T4, 3T4, 7. Saman tasatuloksen pelaajat näytetään nimen mukaan aakkosjärjestyksessä.

Tyhjät sarjat: sarjaa ei näytetä, jos sille ei ole syötetty tuloksia. Jos turnauksessa on vain MPO-tuloksia, näytetään vain MPO. Jos tuloksia ei ole lainkaan, kortilla kerrotaan, ettei tuloksia ole vielä syötetty.

Mitalikorostukset: palkintosijat korostetaan molemmissa sarjoissa mitalikuvakkeella, hillityllä taustasävyllä ja lihavoinnilla:
- 🥇 sijoitus 1 (kultamitali)
- 🥈 sijoitus 2 (hopeamitali)
- 🥉 sijoitus 3 (pronssimitali)
Tasatuloksissa mitali määräytyy näytetyn sijoituksen ensimmäisestä numerosta: esimerkiksi molemmat 1T2-rivit saavat kultamitalin ja kaikki neljä 3T4-riviä pronssimitalin.

PDGA Event ID -linkit: PDGA Event ID avaa turnauksen PDGA-sivun uuteen välilehteen. Osoite muodostetaan Asetukset-sivun PDGA-kilpailuosoitteen perus-URL -asetuksesta ja tunnuksesta, esimerkiksi https://www.pdga.com/tour/event/97339. Tunnus 000000 tarkoittaa, ettei PDGA Event ID:tä ole vielä määritetty: se näytetään varoitustyylisenä tekstinä ⚠-varoitusmerkin kanssa vaaleanpunaisella taustalla eikä se ole linkki.`,
      },
      {
        title: 'Pelaajan tuloskortti',
        content: `Tuloskortti on pelaajakohtainen, ja se on turnaussijoitusten ja ranking-pisteiden ainoa lähde.

Tuloskortti avataan Pelaajat-sivulta pelaajan rivin Tuloskortti-painikkeella. Kortilla näytetään kaikki turnaukset järjestysnumeron mukaan nousevasti, ja jokaisella rivillä on:
- Turnauksen nimi, tila ja kerroin
- PDGA Event ID, joka avaa turnauksen PDGA-sivun uuteen välilehteen
- Sijoitus-kenttä
- Lasketut pisteet
- Tyhjennä-painike

Tyhjennä poistaa rivin sijoituksen ja samalla lasketut pisteet. Toiminto on käytettävissä vain muokkaustilassa, se kysyy aina vahvistuksen ja tallentuu vasta Tallenna ja poistu -painikkeella.`,
      },
      {
        title: 'Nopea syöttö ja tallennus',
        content: `Sijoitukset syötetään muokkaustilassa suoraan Sijoitus-kenttään. Tab-näppäin (tai Enter) siirtää kohdistuksen seuraavan turnauksen Sijoitus-kenttään kuten taulukkolaskennassa. Siirtyminen ei muuta eikä ylikirjoita kentissä jo olevia arvoja, ja kohdistus näkyy aina selvästi.

Tallennus:
- Muutokset jäävät voimaan vasta, kun ne tallennetaan Tallenna ja poistu -painikkeella.
- Pisteet lasketaan uudelleen heti jokaisen sijoitusmuutoksen jälkeen.

Jos sijoitus on virheellinen tai sille ei voida laskea pisteitä, rivillä näytetään virhe eikä sijoitusta tallenneta.

Tarkemmat ohjeet lukutilasta ja muokkaustilasta ovat Ohjeet-osion kohdassa Pelaajat.`,
      },
      {
        title: 'Sijoituksen muoto',
        content: `Sijoitus syötetään joko yksittäisenä sijoituksena tai tasatuloksena.

Sallitut muodot:
- 1, 2, 10 tai 100 (yksittäinen sijoitus)
- 3T4, 5T2, 10T3 tai 100T10 (tasatulos muodossa sijoitusTpelaajamäärä)

Sijoituksen pitää olla positiivinen kokonaisluku. Tasatuloksessa pelaajamäärän pitää olla vähintään 2.

Arvo 0 tarkoittaa, ettei pelaaja osallistunut turnaukseen. Siitä ei anneta pisteitä eikä sitä lasketa osallistumiseksi.`,
      },
      {
        title: 'Tasatulokset',
        content: `Tasatulos merkitään muodossa sijoitusTpelaajamäärä.

Esimerkki:
- 3T4 tarkoittaa, että neljä pelaajaa jakaa sijat 3–6.
- Kaikille tasatuloksen pelaajille merkitään omille tuloskorteilleen sama sijoitus 3T4.

Huomioi:
- Saman turnauksen ja sarjan sijoitusalueet eivät saa mennä päällekkäin eri sijoitusten kesken.
- Tasatulosmerkintää voi käyttää enintään niin monella pelaajalla kuin merkintä ilmoittaa.
- Tasatuloksen pelaajat saavat jaettujen sijojen 1x-peruspisteiden keskiarvon kerrottuna turnauksen kertoimella.`,
      },
      {
        title: 'Pisteiden laskenta',
        content: `Lasketut pisteet muodostuvat kaavalla:
turnauspisteet = 1x-peruspisteet × turnauksen kerroin

1x-peruspisteet haetaan pelaajan sarjan (MPO tai FPO) pistetaulukosta sijoituksen perusteella. Tuloskortille tallennetaan vain sijoitus: pisteitä ei tallenneta, vaan ne lasketaan aina nykyisestä pistetaulukosta ja turnauksen nykyisestä kertoimesta. Jos pistetaulukkoa tai kerrointa muutetaan, pisteet päivittyvät automaattisesti Tuloskortilla, Rankingissa ja Yhteenvedossa.

Jos pistetaulukosta puuttuu sijoitusta vastaava arvo tai turnaukselta puuttuu kerroin, sijoitusta ei tallenneta.`,
      },
    ],
  },
  {
    id: 'players',
    title: 'Pelaajat',
    topics: [
      {
        title: 'CSV-tuonti',
        content: `Voit tuoda pelaajia CSV-tiedostosta sivun yläreunan toimintopalkin Tuo pelaajat -painikkeella. Painike avaa tuontiikkunan, jossa valitaan divisioona ja CSV-tiedosto.

Vaatimukset:
- Sarake-erotin on puolipiste (;)
- PDGA ID on pakollinen
- Muut kentät voivat olla tyhjiä
- Divisioona valitaan importin yhteydessä
- UTF-8-koodaus on suositeltu (å, ä, ö)

Esimerkki:
Etunimi;Sukunimi;PDGA ID;PDGA-rating;Maailmanranking
Matti;Meikäläinen;12345;950;1250
Maija;Mallikas;54321;890;2450

Tuonnin jälkeen näytetään yhteenveto tuoduista ja epäonnistuneista riveistä perusteluineen.`,
      },
      {
        title: 'Rating ja Ranking -päivitysimportti',
        content: `Pelaajat-sivun Päivitä Rating ja Ranking -painike avaa ikkunan, johon voit liittää puolipisteillä eroteltua CSV-dataa.

Ensimmäisen rivin pitää olla PDGA ID;Rating;Ranking. Esimerkki:
PDGA ID;Rating;Ranking
12345;998;120
56789;1021;34

Rating ja Ranking ovat annettuina positiivisia kokonaislukuja. Puuttuva Rating on sallittu ja tallennetaan tyhjänä. Puuttuva World Ranking on sallittu ja tallennetaan tyhjänä. Tyhjä arvo korvaa myös aiemmin tallennetun arvon. Pelaajalistassa tyhjät Rating-arvot korostetaan hillityllä varoitusvärillä ja merkitään myös tekstillä ruudunlukijalle.

Importti täsmää olemassa olevat pelaajat PDGA ID:n perusteella ja muuttaa vain heidän Rating- ja World Ranking -kenttiään. Nimi, sarja, tulokset ja pisteet säilyvät ennallaan. Uusia pelaajia ei lisätä.

CSV-tiedoston sisäiset saman PDGA ID:n rivit ovat virheitä eikä niitä päivitetä. Järjestelmästä puuttuvat pelaajat näytetään huomioina. Lopuksi näet onnistuneesti päivitettyjen, virheiden ja huomioiden lukumäärät sekä rivikohtaiset syyt.`,
      },
      {
        title: 'Pelaajan lisääminen',
        content: `Lisää pelaaja -painike avaa lomakkeen, jossa pakolliset kentät on merkitty tähdellä.

Pakolliset tiedot:
- Nimi
- Sarja (MPO tai FPO)

Vapaaehtoiset tiedot: PDGA ID, PDGA-rating, maailmanranking ja muistiinpanot.`,
      },
      {
        title: 'Pelaajan tiedot, tuloskortti ja poistaminen',
        content: `Pelaajalistan Tiedot-painike avaa pelaajan tietojen muokkauslomakkeen olemassa olevilla tiedoilla. Tuloskortti-painike avaa pelaajan tuloskortin, jolla syötetään pelaajan turnaussijoitukset.

Pelaajan poistaminen vaatii aina erillisen vahvistuksen. Poistettua pelaajaa ei voi palauttaa, ja samalla poistetaan pelaajan tuloskortti ja sijoitukset.

Toimintopalkin ⚠ Poista kaikki pelaajat -toiminto poistaa kaikki pelaajat kerralla. Myös se vaatii erillisen vahvistuksen.`,
      },
      {
        title: 'Poista kaikki tulokset',
        content: `Toimintopalkin ⚠ Poista kaikki tulokset -toiminnolla voit nollata kaikkien pelaajien turnaussijoitukset esimerkiksi uuden kauden alussa.

Toiminto tyhjentää kaikkien pelaajien tuloskortit ja poistaa sijoitusten perusteella lasketut pisteet. Pelaajien tiedot, turnaukset, kertoimet, pistetaulukot, Rating ja World Ranking säilyvät ennallaan. Toiminto vaatii vahvistuksen, eikä sitä voi perua.

Tyypillisiä käyttötarkoituksia ovat uuden kauden aloittaminen, tulosten rakentaminen uudelleen tuonneista ja laajamittaiset korjaukset.`,
      },
      {
        title: 'Tuloskortti: lukutila ja muokkaustila',
        content: `Tuloskortti avautuu aina lukutilaan, jotta sijoituksia ja pisteitä ei muuteta vahingossa. Voimassa oleva tila näkyy kortin otsikon vieressä tekstinä ja symbolina: Lukutila (🔒) tai Muokkaustila (✎).

Lukutila:
- Sijoituskenttiä ei voi muokata eikä Tyhjennä-painike ole käytettävissä.
- Tiedot näkyvät normaalisti ja PDGA Event ID -linkit toimivat.

Muokkaa-painike:
- Siirtää kortin muokkaustilaan, jolloin kaikkien turnausten sijoituskentät ovat muokattavissa.
- Lasketut pisteet pysyvät aina järjestelmän laskemina: niitä ei voi syöttää käsin.

Sijoitusten muuttaminen:
- Sijoitus syötetään muodossa 1 tai tasatuloksena 3T4. Samat validoinnit ovat voimassa kuin ennen.
- Tab siirtää seuraavan turnauksen sijoituskenttään.

Pisteiden automaattinen laskenta:
- Pisteet lasketaan heti uudelleen sijoituksen, sarjan pistetaulukon ja turnauksen kertoimen perusteella.

Tallenna ja poistu:
- Tallentaa kaikki kortin sijoitukset, päivittää pisteet ja palaa lukutilaan samalle kortille.
- Onnistuneesta tallennuksesta näytetään ilmoitus ✓ Tuloskortti tallennettu onnistuneesti.

Poistu:
- Palaa lukutilaan tallentamatta muutoksia.
- Jos muutoksia ei ole tehty, kortti palaa lukutilaan heti.
- Jos tallentamattomia muutoksia on, näytetään vahvistus, jossa voi valita Poistu ilman tallennusta tai Peruuta.
- Sama vahvistus näytetään, jos siirryt muokkaustilasta toiselle sivulle navigaatiosta.

Ilmoitukset näkyvät sivun yläreunassa ja ne piilotetaan automaattisesti viiden sekunnin kuluttua.`,
      },
      {
        title: 'Tuloskorttien Import ja Export',
        content: `Pelaajat-sivun toimintopalkin Export Tuloskortit- ja Import Tuloskortit -painikkeilla ylläpidetään kaikkien pelaajien tuloskorttien sijoituksia kerralla esimerkiksi Excelissä. Yksittäisen pelaajan tuloskortti toimii edelleen kuten ennenkin.

Export-työnkulku:
- Export Tuloskortit lataa CSV-tiedoston (tuloskortit-VVVV-KK-PP.csv), jossa on kaikki pelaajat ja kaikki turnaukset.
- Tiedostossa on järjestelmän nykyiset sijoitukset täsmälleen tallennetussa muodossa, ei tyhjää pohjaa.

Excel-työnkulku:
1. Avaa viety tiedosto Excelissä.
2. Muokkaa sijoituksia turnaussarakkeisiin. Älä muuta otsikkoriviä tai PDGA ID -saraketta.
3. Tallenna tiedosto muodossa "CSV UTF-8 (puolipisteellä erotettu)" (Tallenna nimellä → tiedostomuoto).
4. Tuo tiedosto Import Tuloskortit -painikkeella.

CSV-muoto:
- Merkistö on UTF-8 (ä, ö ja å säilyvät oikein). Export lisää tiedoston alkuun UTF-8-tunnisteen, jotta Excel avaa sen oikein.
- Sarake-erotin on puolipiste (;).
- Otsikkorivi on pakollinen ja alkaa sarakkeilla PDGA ID;Nimi. Jos otsikkorivi puuttuu tai on virheellinen, koko import epäonnistuu.

Esimerkki:
PDGA ID;Nimi;T1;T2;T3
12345;Tuomo Rikman;3;1;5
67890;Leo Piironen;10;;2

T1/T2/T3-merkintä:
- Turnaussarakkeet nimetään turnauksen järjestysnumeron mukaan: T1 = järjestysnumero 1, T2 = järjestysnumero 2 jne.
- Turnauksia ei tunnisteta nimen perusteella. Jos sarakkeelle ei löydy turnausta, sarakkeen arvot ohitetaan ja asiasta raportoidaan virhe.

PDGA ID -tunnistus:
- Pelaaja tunnistetaan aina ja vain PDGA ID:n perusteella. Nimi-sarake on vain tiedoksi.
- Jos nimi poikkeaa tallennetusta nimestä, päivitys tehdään silti PDGA ID:n perusteella ja asiasta näytetään huomio.
- Tuntematon PDGA ID on virhe. Importti ei luo eikä poista pelaajia tai turnauksia, vaan päivittää vain tiedostossa olevien pelaajien sijoitukset.

Sijoitusten muodot:
- Positiivinen kokonaisluku, esim. 1, 2 tai 10.
- Tasatulos muodossa sijoitusTpelaajamäärä, esim. 3T4, 10T2 tai 100T10.
- Tyhjä arvo = sijoitusta ei ole vielä syötetty. Tyhjä solu poistaa aiemmin tallennetun sijoituksen.
- 0 = pelaaja ei osallistunut turnaukseen. Arvo on sallittu, siitä ei anneta pisteitä eikä sitä lasketa osallistumiseksi.
- Virheelliset arvot (esim. ABC, 1TT2 tai 3-T-4) ohitetaan ja raportoidaan virheinä. Muut rivit käsitellään normaalisti.
- Samat säännöt kuin yksittäisellä tuloskortilla ovat voimassa: päällekkäistä sijoitusta tai sijoitusta, jolle pistetaulukossa ei ole arvoa, ei tallenneta, vaan aiempi sijoitus säilyy.

Pisteet:
- Importti tallentaa vain sijoitukset. Pisteet lasketaan automaattisesti uudelleen: sijoitus → pistetaulukko → sarja → kerroin → lasketut pisteet.

Importin yhteenveto:
- Import valmis -yhteenveto näyttää päivitettyjen pelaajien, virheiden ja huomioiden määrät.
- Taulukossa luetellaan virheet ja huomiot rivinumeron mukaan (rivi 1 on otsikkorivi) sekä PDGA ID, sarake ja kuvaus.
- Virhe tarkoittaa, että rivin tai solun arvoa ei tallennettu (esim. tuntematon PDGA ID, tuntematon T-sarake tai virheellinen sijoitus).
- Huomio on tiedoksi annettava havainto, esim. sama PDGA ID useammalla rivillä (vain ensimmäinen käsitellään), nimi poikkeaa tallennetusta, tunnistamaton ylimääräinen sarake tai rivi ilman muutoksia.
- Ilmoitus ✓ Tuloskortit päivitetty onnistuneesti näytetään, kun virheitä ei ollut. ⚠ Osa riveistä ohitettiin kertoo, että osa arvoista ohitettiin virheiden vuoksi. ✕ Import epäonnistui tarkoittaa, ettei mitään päivitetty (esim. otsikkorivi puuttuu).
- Virheet kirjataan myös palvelimen virhelokiin.`,
      },
      {
        title: 'PDGA ID',
        content: `PDGA ID on pelaajan yksilöivä PDGA-numero.

Huomioi:
- PDGA ID on yksilöllinen: samaa tunnusta ei voi tallentaa kahdelle pelaajalle.
- Kenttään syötetään vain numero, ei koko osoitetta.
- CSV-tuonnissa PDGA ID on pakollinen tieto.`,
      },
      {
        title: 'PDGA-profiililinkit',
        content: `Kun pelaajalle on tallennettu PDGA ID, PDGA ID näytetään linkkinä PDGA-profiiliin pelaajalistassa, rankingissa ja pelaajan tietosivulla. Pelaajan nimi on pelkkää tekstiä eikä toimi linkkinä.

Linkki avautuu aina uuteen välilehteen ja sen osoite muodostetaan keskitetysti Asetukset-sivun perusosoitteesta, joten yksittäisiä linkkejä ei tarvitse ylläpitää käsin.`,
      },
      {
        title: 'Haku ja lajittelu',
        content: `Hakukenttä ja sarjasuodattimet (Kaikki, MPO, FPO) ovat suoraan pelaajalistan yläpuolella. Pelaajalistaa voi hakea nimellä tai PDGA ID:llä.

Lista lajitellaan sarakeotsikkoa napsauttamalla: ensimmäinen napsautus lajittelee nousevaan järjestykseen (▲) ja toinen laskevaan (▼). Lajitella voi nimen, PDGA ID:n, sarjan, PDGA-ratingin tai maailmanrankingin perusteella.`,
      },
    ],
  },
  {
    id: 'tournaments',
    title: 'Turnaukset',
    topics: [
      {
        title: 'Turnausten CSV-tuonti',
        content: `Tuo turnaukset -toiminto luo vain uusia turnauksia eikä koskaan ylikirjoita olemassa olevia.

Tuettu muoto:
Järjestysnumero;PDGA Event ID;Turnauksen nimi

Esimerkki:
1;123456;European Open 2027
2;123457;Finnish Nationals 2027
3;123458;Tyyni 2027

Vaatimukset:
- Erotin on puolipiste (;)
- Otsikkorivi on sallittu
- UTF-8-koodaus on suositeltu (å, ä, ö)
- Pakolliset kentät: Järjestysnumero, PDGA Event ID ja Turnauksen nimi

PDGA Event ID toimii turnauksen yksilöivänä avaimena: jos sama tunnus löytyy jo sovelluksesta, rivi ohitetaan duplikaattina.`,
      },
      {
        title: 'Turnauksen lisääminen ja muokkaaminen',
        content: `Pakolliset tiedot:
- Turnauksen nimi
- Alkamispäivä
- Kerroin

Päättymispäivä ei voi olla ennen alkamispäivää.

Kerroin valitaan Kertoimet-sivulla ylläpidetyistä arvoista, joten lisää vähintään yksi kerroin ennen turnauksen tallennusta. PDGA Event ID -kenttään syötetään vain tunnus; linkki muodostetaan keskitetysti Asetukset-sivun perusosoitteesta.`,
      },
      {
        title: 'Turnausten poistaminen',
        content: `Turnauksen poistaminen poistaa myös kaikki turnaukselle tallennetut tulokset, eikä toimintoa voi peruuttaa.

Toimintopalkin ⚠ Poista kaikki turnaukset -toiminto poistaa kaikki turnaukset ja niihin liittyvät turnaustulokset pysyvästi. Molemmat toiminnot vaativat erillisen vahvistuksen.`,
      },
      {
        title: 'Turnauslistan suodatus',
        content: `Hakukenttä ja tilasuodattimet ovat suoraan turnauslistan yläpuolella. Turnauslistaa voi hakea nimen, paikkakunnan ja radan perusteella sekä suodattaa tilan mukaan painikkeilla.

Lista lajitellaan sarakeotsikkoa napsauttamalla (▲ nouseva, ▼ laskeva) esimerkiksi järjestysnumeron, nimen, tilan, PDGA Event ID:n, päivämäärien, paikkakunnan tai radan mukaan.`,
      },
    ],
  },
  {
    id: 'points',
    title: 'Pistetaulukot',
    topics: [
      {
        title: 'Pistetaulukon CSV-tuonti',
        content: `Pistetaulukko tuodaan sarjakohtaisesti toimintopalkin Tuo pistetaulukko -painikkeella. Tuonti sallitaan vain tyhjään pistetaulukkoon.

Muoto:
Sijoitus;Pisteet

Esimerkit:
1;100
2;85
3;75
4;10,5

Vaatimukset:
- Erotin on puolipiste (;)
- Otsikkorivi on sallittu
- UTF-8-koodaus on suositeltu
- Sijoitusten tulee alkaa 1:stä ja edetä peräkkäin ilman aukkoja`,
      },
      {
        title: 'Sijoitukset ja pisteet',
        content: `Pistetaulukossa jokaiselle sijoitukselle tallennetaan 1x-peruspisteet sarjakohtaisesti.

Säännöt:
- Sijoitus on positiivinen kokonaisluku.
- 1x-peruspisteet voivat olla desimaaliluku (esim. 10,5).
- Pistetaulukot on alustettu tyhjiksi: pisteitä ei oleteta eikä kovakoodata käyttöliittymään.

Rivejä voi lisätä toimintopalkin Lisää rivi -painikkeella sekä muokata ja poistaa yksitellen rivin omilla painikkeilla. Koko sarjan pistetaulukon voi poistaa kerralla toimintopalkin ⚠ Poista kaikki -painikkeilla. Kaikki poistot vaativat erillisen vahvistuksen.`,
      },
      {
        title: 'Tasatulokset pistetaulukossa',
        content: `Pistetaulukkoon tallennetaan vain yksittäiset sijoitukset, ei tasatuloksia.

Kun tuloskortilla käytetään tasatulosmerkintää (esim. 3T4), tasatuloksen pelaajat saavat jaettujen sijojen (esim. 3–6) 1x-peruspisteiden keskiarvon. Siksi pistetaulukossa pitää olla arvo jokaiselle tasatuloksen kattamalle sijoitukselle.`,
      },
      {
        title: 'Miksi keskitetty pistetaulukko?',
        content: `Keskitetty pistetaulukko pitää laskennan yhtenäisenä:
- Käyttöliittymäkomponentit eivät sisällä kovakoodattuja pistearvoja.
- Pisteet lasketaan aina pelaajien tuloskorttien sijoituksista nykyisellä pistetaulukolla, joten Ranking ja Yhteenveto päivittyvät automaattisesti.
- Pistetaulukon voi myöhemmin korvata API- tai tietokantaratkaisulla.`,
      },
    ],
  },
  {
    id: 'multipliers',
    title: 'Kertoimet',
    topics: [
      {
        title: 'Mikä kerroin on?',
        content: `Kerroin kuvaa turnauksen painoarvoa rankingissa.

Turnauksen pisteet lasketaan kaavalla:
turnauspisteet = 1x-peruspisteet × kerroin

Esimerkki: jos sijoituksen 1x-peruspisteet ovat 100 ja turnauksen kerroin on 1,5, pelaaja saa 150 pistettä.

Kertoimen pitää olla nollaa suurempi.`,
      },
      {
        title: 'Kertoimien hallinta',
        content: `Kertoimet ylläpidetään keskitetysti Kertoimet-sivulla. Jokaisella kertoimella on:
- Järjestysnumero, joka määrittää listan järjestyksen
- Nimi, esimerkiksi turnauksen tila
- Lyhenne, joka näytetään turnaus- ja tuloskorttilistoissa
- Kerroin eli pistekerroin

Turnaukselle valitaan kerroin tästä listasta, joten lisää vähintään yksi kerroin ennen turnausten tallentamista.`,
      },
      {
        title: 'Kertoimen muuttaminen jälkikäteen',
        content: `Kertoimen muuttaminen vaikuttaa heti kaikkiin kyseistä kerrointa käyttävien turnausten pisteisiin.

Tuloskorteille ei tallenneta kerrointa tai pisteitä, vaan Tulokset, Ranking ja Yhteenveto lasketaan aina turnauksen nykyisellä kertoimella.`,
      },
    ],
  },
  {
    id: 'settings',
    title: 'Asetukset',
    topics: [
      {
        title: 'PDGA-linkkien perusosoitteet',
        content: `Pelaajille ja turnauksille tallennetaan vain PDGA-tunnus. Linkki muodostetaan automaattisesti perusosoitteesta ja tunnuksesta ja avautuu uuteen välilehteen. Pelaajan profiili avataan PDGA ID -kentästä, ei pelaajan nimestä. Vanhoista täydellisistä PDGA-osoitteista poimitaan tunnus latauksen yhteydessä.

Pelaajaosoitteen oletus: https://www.pdga.com/player/
Kilpailuosoitteen oletus: https://www.pdga.com/tour/event/
Perusosoitteen muutos vaikuttaa kaikkiin nykyisiin ja tuleviin linkkeihin.`,
      },
      {
        title: 'Pisteiden näyttö ja pyöristys',
        content: `Pyöristys määrittää Ranking- ja Yhteenveto-sivuilla näytettävien pisteiden desimaalien määrän (0–4, oletus 2). Se vaikuttaa vain näyttöön, ei laskentaan tai tallennettuihin arvoihin.`,
      },
      {
        title: 'Asetusten tallennus',
        content: `Tallenna asetukset tallentaa lomakkeen arvot. Palauta tallennetut arvot peruu lomakkeeseen tehdyt tallentamattomat muutokset.`,
      },
      {
        title: 'Salasanasuojaus',
        content: `Sovellukseen kirjaudutaan yhteisellä sivuston salasanalla. Uuden salasanan pitää olla vähintään 8 merkkiä. Nykyistä salasanaa ei näytetä, eikä salasanaa tallenneta selaimeen.

Uusi salasana otetaan käyttöön seuraavissa kirjautumisissa; jo kirjautuneet käyttäjät pysyvät kirjautuneina. Kirjaudu ulos poistaa kirjautumisen tästä selaimesta.`,
      },
    ],
  },
];

export function listHelpSections() {
  return HELP_SECTIONS;
}

export function findHelpSection(sectionId) {
  return HELP_SECTIONS.find((section) => section.id === sectionId) || null;
}
