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
- TOP 10 MPO- ja TOP 10 FPO -listat kokonaispisteiden mukaan

Yhteenveto on vain lukunäkymä: tietoja muokataan aina niiden omilla sivuilla.`,
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
- Tulokset-sivun tuloskortit ja niille tallennetut sijoitukset
- Pistetaulukot-sivun 1x-peruspisteet
- Kertoimet-sivun kertoimet, jotka on liitetty turnaukseen

Ranking päivittyy automaattisesti, kun tuloskortti tallennetaan.`,
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
        title: 'Tuloskortin käyttö',
        content: `Tuloskortit ovat turnaussijoitusten ja ranking-pisteiden virallinen lähde.

Tuloskortin luonti:
1. Valitse turnaus.
2. Valitse pelaajat, jotka osallistuivat turnaukseen.

Tämän jälkeen voit syöttää jokaiselle pelaajalle sijoituksen ja tallentaa kortin. Lisää pelaajia -toiminnolla voit täydentää korttia myöhemmin.

Sama pelaaja voi esiintyä samalla tuloskortilla vain kerran.

Sivun yläreunan toimintopalkin ⚠ Poista kaikki tuloskortit -toiminto poistaa kaikki tuloskortit ja niiden tulosrivit pysyvästi. Toiminto vaatii aina erillisen vahvistuksen.`,
      },
      {
        title: 'Sijoituksen muoto',
        content: `Sijoitus syötetään joko yksittäisenä sijoituksena tai tasatuloksena.

Sallitut muodot:
- 1 (yksittäinen sijoitus)
- 3T4 (tasatulos: neljä pelaajaa sijoilla 3–6)

Sijoituksen pitää olla positiivinen kokonaisluku. Tasatuloksessa pelaajamäärän pitää olla vähintään 2 ja enintään 99.`,
      },
      {
        title: 'Tasatulokset',
        content: `Tasatulos merkitään muodossa sijoitusTpelaajamäärä.

Esimerkki:
- 3T4 tarkoittaa, että neljä pelaajaa jakaa sijat 3–6.
- Kaikille tasatuloksen pelaajille merkitään sama sijoitus 3T4.

Huomioi:
- Sijoitusalueet eivät saa mennä päällekkäin eri sijoitusten kesken.
- Tasatuloksen merkintää pitää käyttää yhtä monella pelaajalla kuin merkintä ilmoittaa.
- Pisteitä ei jaeta automaattisesti tasatuloksen kesken, vaan jokainen tasatuloksen pelaaja saa sijoituksensa mukaiset pisteet.`,
      },
      {
        title: 'Pisteiden laskenta',
        content: `Lasketut pisteet muodostuvat kaavalla:
turnauspisteet = 1x-peruspisteet × turnauksen kerroin

1x-peruspisteet haetaan pelaajan sarjan pistetaulukosta sijoituksen perusteella. Käytetyt arvot tallennetaan tuloskortille, jotta historiallinen laskenta säilyy, vaikka pistetaulukkoa tai kerrointa muutettaisiin myöhemmin.

Jos pistetaulukosta puuttuu sijoitusta vastaava arvo, tulosta ei tallenneta.`,
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
        title: 'Pelaajan lisääminen',
        content: `Lisää pelaaja -painike avaa lomakkeen, jossa pakolliset kentät on merkitty tähdellä.

Pakolliset tiedot:
- Nimi
- Sarja (MPO tai FPO)

Vapaaehtoiset tiedot: PDGA ID, PDGA-rating, maailmanranking ja muistiinpanot.`,
      },
      {
        title: 'Pelaajan muokkaaminen ja poistaminen',
        content: `Pelaajalistan Muokkaa-painike avaa saman lomakkeen olemassa olevilla tiedoilla.

Pelaajan poistaminen vaatii aina erillisen vahvistuksen. Poistettua pelaajaa ei voi palauttaa, ja jos pelaaja on tallennettu tuloskortille, hänet näytetään tuloskortilla tekstillä Poistettu pelaaja.

Toimintopalkin ⚠ Poista kaikki pelaajat -toiminto poistaa kaikki pelaajat kerralla. Myös se vaatii erillisen vahvistuksen.`,
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
        content: `Kun pelaajalle on tallennettu PDGA ID, pelaajan nimi näytetään linkkinä PDGA-profiiliin yhteenvedossa, rankingissa ja pelaajalistassa.

Linkin osoite muodostetaan keskitetysti Asetukset-sivun perusosoitteesta, joten yksittäisiä linkkejä ei tarvitse ylläpitää käsin.`,
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

Kun tuloskortilla käytetään tasatulosmerkintää (esim. 3T4), jokainen tasatuloksen pelaaja saa oman sijoituksensa mukaiset 1x-peruspisteet. Pisteitä ei jaeta automaattisesti tasatuloksen pelaajien kesken tässä MVP-versiossa.`,
      },
      {
        title: 'Miksi keskitetty pistetaulukko?',
        content: `Keskitetty pistetaulukko pitää laskennan yhtenäisenä:
- Käyttöliittymäkomponentit eivät sisällä kovakoodattuja pistearvoja.
- Tulokselle tallennetaan käytetyt snapshotit, jotta historiallinen laskenta säilyy.
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
        content: `Kertoimen muuttaminen vaikuttaa vain uusiin laskentoihin.

Jo tallennetuille tuloskorteille on tallennettu käytetty kerroin snapshotina, joten aiemmat pisteet eivät muutu takautuvasti.`,
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
