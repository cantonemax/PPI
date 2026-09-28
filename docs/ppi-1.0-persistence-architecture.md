# PPI 1.0 — Architettura di persistenza

Inventario che precede lo schema Prisma. Non è SQL e non è schema.

Fonti congelate: Domain Freeze, SaaS Architecture, Domain Architecture. Non aggiunge concetti di business e non cambia il dominio.

Ogni oggetto persistente sta nel confine della Company della sessione.

---

## 1. Persistence Inventory

### Persistenti

Si conservano come fatti.

| Oggetto | Proprietario | Note di persistenza |
|---|---|---|
| Company | — | Tenant. Unità di tempo. Apertura e chiusura |
| User | Company | Una sola Company |
| Assegnazione di ruolo | Company, sul User | Solo i quattro ruoli nominati |
| Invito | Company | Prima dell’accettazione non è un User |
| Part | Company | Identità. Stato attivo o ritirato |
| Machine | Company | Identità, tariffa oraria, attivo o ritirato |
| Tool | Company | Identità, unità di consumo, attivo o ritirato |
| Material | Company | Identità, unità di consumo, attivo o ritirato |
| Production Order | Company | Fase, Part, quantità obiettivo, istanti di avvio e chiusura |
| Estimate | Production Order | Voci inserite. Dopo l’avvio le tariffe unitarie sono immutabili |
| Actual | Production Order | Assente in bozza. Presente dall’avvio |
| Contatore pezzi buoni | Actual | Fatto di reparto |
| Scrap | Production Order | Uno o più fatti. Zero è l’assenza di fatti, non un valore inventato |
| Pause | Production Order | Intervallo con inizio e fine |
| Downtime | Production Order | Intervallo. Cita una Machine della Company |
| Tool Change | Production Order | Cita una Tool e una quantità |
| Consumo materiale | Production Order | Cita un Material e una quantità |
| Control Plan | Production Order | Elenco di controlli: nome, nominale, due limiti |
| Measurement | Production Order | Cita un controllo dello stesso ordine |
| Drawing | Production Order | Allegato. Anche zero |
| Technical Document | Production Order | Allegato. Anche zero |
| Production Note | Production Order | Testo. Anche zero |
| Certification | Production Order | Output. Anche zero. Aggiungibile a ordine completato |
| Ordine attivo del User | User | Preferenza di lavoro. Non è una fase dell’ordine |
| Audit | Company | Fatti della Audit Rules |

Le ore macchina reali sono fatti dell’Actual: citano la Machine usata. Non sono un oggetto separato dalla Machine stimata.

### Calcolati

Non si inseriscono e non sono fonte. Si ricavano dai fatti a ogni lettura.

- Tempo produttivo: avvio e chiusura, meno pause e fermi chiusi.
- Tempo per pezzo reale: tempo produttivo diviso pezzi buoni. Assente a zero pezzi buoni.
- Totali stimati: tariffe unitarie congelate per la quantità obiettivo corrente.
- Costo macchina stimato e reale, quando la Machine c’è: tempo per tariffa oraria.
- Costo operativo stimato e reale: somma di macchina, utensile, materiale e altri costi.
- Margine atteso e margine reale: valore concordato meno costo operativo. Assenti senza valore concordato.
- Cp e Cpk: dalle Measurement valide, da 5 in su. Non si persistono. La confidenza è bassa, media, buona o alta.

### Derivati

Non hanno archivio. Sono una lettura.

- Confronto: Estimate affiancato ad Actual, riga per riga, solo dove almeno un lato ha un valore. Fermi e pause compaiono solo sul reale.
- Segnali del Copilot: qualità, utensili, produzione, margine, raccomandazione, trend. Si calcolano al momento. Non si persistono.
- Memoria: lettura degli ordini completati che insegnano. La chiave è la Part. Non esiste una copia da aggiornare.

---

## 2. Aggregate Inventory

| Aggregate root | Contiene | Non contiene |
|---|---|---|
| Company | User, assegnazioni di ruolo, inviti | Ordini e risorse |
| Part | Identità e ritiro | Storia degli ordini |
| Machine | Identità, tariffa oraria, ritiro | Fermi e ore, che stanno sull’ordine |
| Tool | Identità, unità, ritiro | Cambi, che stanno sull’ordine |
| Material | Identità, unità, ritiro | Consumi, che stanno sull’ordine |
| Production Order | Estimate, Actual, eventi, consumi, piano, misure, allegati, note, certificazioni | Part, Machine, Tool, Material come oggetti propri |

Production Order è il root primario. Estimate, Actual e gli eventi si salvano e si autorizzano solo con lui.

Confronto, Copilot, margini, Cp, Cpk e memoria non sono aggregate.

---

## 3. Relationship Inventory

| Da | A | Cardinalità | Vincolo |
|---|---|---|---|
| Company | User | 1 a 1..n | Almeno un Owner |
| User | Company | n a 1 | Un User, una Company |
| User | Ruolo | 1 a 1..n | Solo i quattro ruoli, nella stessa Company |
| Company | Invito | 1 a 0..n | Non è ancora un User |
| Company | Part, Machine, Tool, Material | 1 a 0..n | Riusabili |
| Company | Production Order | 1 a 0..n | |
| Production Order | Part | n a 1 | Obbligatoria. Immutabile dopo l’avvio |
| Production Order | Estimate | 1 a 1 | Nasce con l’ordine |
| Production Order | Actual | 1 a 0..1 | Nasce all’avvio. Una sola istanza |
| Estimate | Machine | n a 0..1 | Facoltativa. Non si riscrive dopo l’avvio |
| Actual, ore | Machine | n a 0..n | Le Machine davvero usate, stessa Company |
| Downtime | Machine | n a 1 | Stessa Company |
| Tool Change | Tool | n a 1 | Stessa Company |
| Consumo materiale | Material | n a 1 | Stessa Company |
| Production Order | Controllo del piano | 1 a 0..n | |
| Measurement | Controllo | n a 1 | Controllo dello stesso ordine |
| Production Order | Scrap, Pause, Downtime, Tool Change, consumo | 1 a 0..n | Solo in produzione o in riapertura |
| Production Order | Drawing, Technical Document, Production Note, Certification | 1 a 0..n | I documenti restano aggiungibili da completato |
| User | Ordine attivo | 1 a 0..1 | Un ordine in produzione della stessa Company |
| Audit | Oggetto citato | n a 1 | Oggetto della stessa Company |

Pause dello stesso ordine non si sovrappongono. Downtime dello stesso ordine non si sovrappongono. Lo scarto non cita un Material.

---

## 4. Delete Rules

Il prodotto non cancella fisicamente i fatti di business. La cancellazione del SaaS è un nascondimento o un ritiro, già definiti.

| Oggetto | Regola |
|---|---|
| Company | Non si cancella nel gesto di chiusura. Si chiude, le sessioni cadono, i dati restano isolati e illeggibili |
| User | Si revoca l’accesso. I fatti che ha registrato restano attribuiti a lui |
| Assegnazione di ruolo | Si revoca, tranne l’ultimo Owner |
| Invito aperto | Si revoca. Non lascia un User |
| Production Order in bozza o annullato | Si può nascondere. Esce dalle letture normali. Non è memoria |
| Production Order in produzione | Non si nasconde. Vale solo il ciclo |
| Production Order che insegna | Non si nasconde e non si cancella. Il reale si corregge solo con riapertura e nuova chiusura |
| Chiusura a zero pezzi e zero scarti | Si conserva come traccia. Non si nasconde e non insegna |
| Part, Machine, Tool, Material mai citati | Si possono nascondere |
| Part, Machine, Tool, Material già citati | Si ritirano. Restano risolvibili dagli ordini che li citano. Non si scelgono per ordini nuovi |
| Estimate, Actual, eventi, misure | Si rimuovono solo come effetto di «annulla avvio», e solo se non ci sono pezzi né eventi. Altrimenti seguono la fase dell’ordine |
| Allegati, note, certificazioni | Non si usano per aggirare il ciclo. Un ordine completato può riceverne ancora |
| Confronto, Copilot, memoria, margini, Cp, Cpk | Non si cancellano: non sono persistiti |
| Audit | Non si cancella nel percorso del prodotto |

Nascondere o ritirare non rende visibile un altro tenant. L’oggetto resta nella Company.

---

## 5. Archive Rules

Non esiste un archivio separato. Spostare gli ordini chiusi altrove li toglierebbe alla memoria, che è una lettura dei fatti completati.

| Situazione | Dove resta |
|---|---|
| Ordine completato che insegna | Nel tenant, fase Completato. La memoria lo legge |
| Ordine riaperto | Stesso ordine, fase In produzione. La memoria non lo legge finché non si chiude di nuovo |
| Chiusura successiva | Lo stesso ordine, con il reale corretto. La versione precedente non resta in archivio |
| Chiusura a zero | Nel tenant, fuori dalla memoria |
| Company chiusa | Nel tenant, inaccessibile agli utenti e agli altri tenant. Non si fonde e non si riusa |
| Risorsa ritirata | Nel tenant, leggibile solo attraverso gli ordini che la citano |
| Audit | Nel tenant, consultabile dall’Owner finché la Company non è chiusa |

Una proiezione di memoria, se servirà alle prestazioni, si ricostruisce dagli ordini. Non è l’archivio e non è la fonte.

---

## 6. Audit Rules

Si persiste un fatto, nella Company, con chi, quando e quale oggetto.

Si persiste:

- creazione e chiusura della Company
- invito, accettazione, cambio ruoli, revoca di invito o di User
- crea, avvia, annulla, annulla avvio, completa, riapri, completa di nuovo
- congelamento delle tariffe all’avvio
- correzioni del reale durante la riapertura
- ritiro di Part, Machine, Tool, Material
- break-glass di piattaforma, con motivo e scadenza, fuori dai ruoli azienda

Non si persiste:

- segnali del Copilot
- confronto, margini e Cp/Cpk ricalcolati
- bozze intermedie della stima, prima del congelamento
- cambio dell’ordine attivo
- uso ordinario di una risorsa su un ordine
- password, segreti di sessione, token di invito in chiaro

Lo legge l’Owner. Production Manager, Quality Manager e Operator no. L’audit non entra in Estimate, Actual o memoria.

---

## Lifecycle persistence

La fase corrente sta sul Production Order. Il passaggio sta nell’audit.

| Fase | Estimate | Actual | Eventi | Documenti |
|---|---|---|---|---|
| Bozza | Modificabile. Actual assente | Assente | Assenti | Aggiungibili |
| In produzione | Tariffe immutabili. Totali ricalcolati dalla quantità | Aperto | Aperti | Aggiungibili |
| Completato | Immutabile | Immutabile | Immutabili | Ancora aggiungibili |
| Annullato | Fuori dalla memoria | Assente | Assenti | Traccia, se l’ordine non è nascosto |

L’avvio persiste l’istante e apre Actual. La chiusura persiste l’istante ed esige pause e fermi già chiusi. La riapertura non scongela la stima e toglie l’ordine dalla memoria. Aver raggiunto la quantità non cambia la fase.
