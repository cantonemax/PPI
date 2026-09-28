# PPI 1.0 — Architettura di dominio PostgreSQL

Descrizione dell’architettura di persistenza. Non è uno schema, non è SQL e non è Prisma.

Fonti: Domain Freeze e SaaS Architecture. Un documento separato «Lifecycle Persistence» non è presente nel progetto. Il ciclo persistito qui è quello già scritto nel Domain Freeze. L’audit e la cancellazione logica sono quelli già scritti nella SaaS Architecture.

Non introduce concetti di business nuovi. Production Order è l’aggregate root primario.

Contesto: multi-tenant, PostgreSQL, Prisma, Next.js. Il confine di ogni aggregate è la Company della sessione, con row-level security sul ruolo applicativo.

---

## 1. Aggregate Map

| Aggregate root | Confine di coerenza | Cosa contiene |
|---|---|---|
| Company | Tenant, almeno un Owner, unità di tempo, chiusura | User, assegnazioni di ruolo, inviti |
| Part | Identità del manufatto dentro la Company | Solo la propria identità e il ritiro |
| Machine | Identità e tariffa oraria dentro la Company | Solo la propria identità, la tariffa e il ritiro |
| Tool | Identità e unità di consumo dentro la Company | Solo la propria identità, l’unità e il ritiro |
| Material | Identità e unità di consumo dentro la Company | Solo la propria identità, l’unità e il ritiro |
| Production Order | Ciclo, stima, reale, eventi, documenti, qualità | Estimate, Actual, Scrap, Pause, Downtime, Tool Change, consumo materiale, Control Plan, Measurement, Drawing, Technical Document, Production Note, Certification |

Part, Machine, Tool e Material sono root piccoli e riusabili. Non stanno dentro l’ordine. L’ordine li cita.

Estimate e Actual non sono root. Non si caricano, non si salvano e non si autorizzano senza il loro Production Order.

Gli eventi non sono root. Nascono e si correggono solo attraverso l’ordine in produzione, o in riapertura per il reale.

Confronto, margini calcolati, Cp, Cpk, segnali del Copilot e memoria non sono aggregate. Non hanno vita propria da persistere.

---

## 2. Ownership Map

| Oggetto | Proprietario | Effetto sulla persistenza |
|---|---|---|
| User, assegnazione di ruolo, invito | Company | Nessun accesso fuori dalla Company. Un User, una Company |
| Part, Machine, Tool, Material | Company | Riusabili da molti ordini della stessa Company |
| Production Order | Company | Cita una Part della stessa Company |
| Estimate, Actual | Production Order | Inclusi nel salvataggio dell’ordine |
| Drawing, Technical Document, Production Note, Certification | Production Order | Stesso confine dell’ordine. Aggiungibili anche a ordine completato |
| Control Plan, Measurement | Production Order | Il piano definisce i controlli. La misura cita un controllo di quello stesso ordine |
| Scrap, Pause, Downtime, Tool Change, consumo materiale | Production Order | Downtime cita una Machine della Company. Tool Change cita una Tool. Il consumo cita un Material |
| Audit | Company | Non è un oggetto manifatturiero. Resta nel tenant |
| Confronto, Copilot, memoria | Nessuno | Si calcolano. Non si possiedono come archivio |

Un riferimento a Part, Machine, Tool o Material di un’altra Company non si persiste.

---

## 3. Relationship Map

- Una Company ha molti User, molte Part, molte Machine, molti Tool, molti Material, molti Production Order.
- Un User ha una o più assegnazioni tra i quattro ruoli, solo nella propria Company.
- Un Production Order ha una Part obbligatoria, scelta in bozza e non più cambiata dopo l’avvio.
- Un Production Order ha un Estimate e, dall’avvio in poi, un Actual.
- La quantità obiettivo sta sull’ordine. In produzione può cambiare. I totali stimati si ricalcolano dalle tariffe già congelate.
- La Machine prevista in stima è facoltativa. Le ore reali e i Downtime citano la Machine davvero usata, anche se in corso d’opera ne subentra un’altra. La Machine stimata non si riscrive.
- Ogni Tool Change cita una Tool della Company e una quantità nell’unità di quella Tool.
- Ogni consumo materiale cita un Material della Company e una quantità nella sua unità.
- Ogni controllo del piano ha nome, valore nominale e due limiti. Ogni Measurement cita uno di quei controlli e registra il valore.
- Scrap conta pezzi della Part dell’ordine. Non cita un Material.
- Pause e Downtime hanno inizio e fine. Più intervalli possono succedersi sullo stesso ordine. Non si sovrappongono tra loro nello stesso tipo.
- Drawing, Technical Document, Production Note e Certification sono molti per ordine, anche zero.
- L’audit cita l’oggetto della Company su cui è avvenuto il fatto: ordine, utente, ruolo o risorsa. Non cita un altro tenant.

---

## 4. Persistence Map

| Oggetto | Classe | Cosa si conserva |
|---|---|---|
| Company, User, ruoli, invito | Persistente | Identità, appartenenza, stato di accesso, unità di tempo |
| Part, Machine, Tool, Material | Persistente | Identità, tariffa oraria della Machine, unità di Tool e Material, ritiro |
| Production Order | Persistente | Fase corrente, Part, quantità obiettivo, istanti di avvio e chiusura |
| Voci inserite di Estimate | Persistente | Tempo per pezzo, scarto atteso, costo macchina stimato, consumi stimati, altri costi, valore concordato |
| Tariffe unitarie dopo l’avvio | Storiche | Restano quelle dell’avvio. Non si ricalcolano |
| Fatti di Actual | Persistente | Contatore pezzi buoni, eventi, consumi, misure, istanti di pausa e fermo |
| Drawing, Technical Document, Production Note, Certification, Control Plan | Persistente | Contenuto dell’ordine |
| Tempo produttivo | Calcolato | Istante di avvio e chiusura meno pause e fermi chiusi |
| Tempo per pezzo reale | Calcolato | Tempo produttivo diviso pezzi buoni. Assente se i pezzi buoni sono zero |
| Costo operativo, margine atteso, margine reale | Calcolati | Somme e differenza dal valore concordato. Il margine è assente senza quel valore |
| Confronto | Derivato | Lettura simultanea di Estimate e Actual. Non è un terzo archivio |
| Cp, Cpk | Calcolati | Dalle Measurement valide, da 5 in su. Mai inseriti. Confidenza bassa, media, buona o alta |
| Segnali del Copilot | Derivati | Calcolo al momento della lettura. Non si persistono |
| Memoria | Storica, calcolata | Lettura degli ordini completati che insegnano. Non è una copia separata |
| Audit | Persistente | Fatti di piattaforma elencati nella Audit Map |

«Storico» qui significa immutabile dopo il fatto, non un secondo database. La versione che insegna è sempre l’ordine completato corrente. Dopo una riapertura e una nuova chiusura, la lettura vede il reale corretto e non conserva la versione superata come memoria parallela.

---

## 5. Audit Map

L’audit persiste solo i fatti già richiesti dalla SaaS Architecture. È nel confine della Company. Lo legge l’Owner.

| Confine | Si persiste | Non si persiste |
|---|---|---|
| Company | Creazione, chiusura | Contenuto degli ordini |
| Accessi | Invito, accettazione, cambio ruoli, revoca | Password, segreti di sessione, token in chiaro |
| Ciclo ordine | Crea, avvia, annulla, annulla avvio, completa, riapri, completa di nuovo | Ogni lettura del Copilot |
| Stima | Congelamento all’avvio | Bozze intermedie di compilazione |
| Reale | Correzioni durante la riapertura | Ricalcolo continuo di costi e margine |
| Risorse | Ritiro di Part, Machine, Tool, Material | Uso ordinario su un ordine |
| Piattaforma | Break-glass, con scadenza e motivo, fuori dai ruoli azienda | Segnali del Copilot |

Ogni voce dice chi, quando e quale oggetto della Company. Non è un’entità manifatturiera e non entra in Estimate, Actual o memoria.

---

## 6. Lifecycle Persistence Model

La fase corrente è persistente sull’ordine. Il passaggio è persistente nell’audit. Una scrittura rifiuta un passaggio non previsto.

| Fase persistita | Estimate | Actual | Eventi | Documenti |
|---|---|---|---|---|
| Bozza | Modificabile | Assente | Assenti | Aggiungibili |
| In produzione | Tariffe unitarie immutabili. I totali seguono la quantità | Aperto | Apribili e chiudibili | Aggiungibili |
| Completato | Immutabile | Immutabile | Immutabili | Ancora aggiungibili |
| Annullato | Non entra in memoria | Assente | Assenti | Restano traccia dell’ordine nascosto, se l’ordine si nasconde |

Transizioni persistite:

- Crea porta in Bozza. Richiede Part della Company e quantità obiettivo. Attore: Owner o Production Manager.
- Avvia porta In produzione. Richiede il tempo per pezzo. Persiste l’istante di avvio e il congelamento della stima. Apre Actual.
- Annulla, solo da Bozza, porta in Annullato. Non crea memoria.
- Annulla avvio, solo da In produzione senza pezzi e senza eventi, torna in Bozza. Cancella l’istante di avvio e rende di nuovo modificabile la stima.
- Completa porta in Completato. Rifiuta se esiste una Pause o un Downtime senza fine. Persiste l’istante di chiusura.
- Riapri, solo da Completato, torna In produzione. L’ordine esce dalla lettura di memoria. La stima resta congelata. Actual ridiventa correggibile.
- Completa di nuovo porta in Completato. La memoria legge questa chiusura e non la precedente.

Raggiungere la quantità obiettivo non scrive un cambio di fase.

Pausa e fermo non cambiano la fase. Cambiano gli intervalli persistiti, che il tempo produttivo esclude.

Il cambio dell’ordine attivo è lo stato di lavoro del User, non una fase dell’ordine. Si persiste come preferenza di sessione di quel User, dentro la Company. Non entra nell’audit di ciclo e non entra nella memoria.

Nascondere un ordine, secondo la SaaS Architecture, è ammesso per Bozza e Annullato. Un ordine In produzione non si nasconde. Un ordine che insegna, o una chiusura a zero pezzi e zero scarti, si conserva.

---

## 7. Historical Learning Model

La memoria non ha un aggregate e non ha una scrittura propria.

Una lettura di memoria include un Production Order se la fase è Completato e l’ordine ha almeno un pezzo buono o uno scarto. La Part è la chiave. Machine, Tool e Material citati dal reale sono il contesto.

La lettura calcola, dai fatti persistiti: tempo reale per pezzo buono, tasso di scarto, materiale per pezzo buono, utensile per pezzo buono, costo macchina per pezzo buono, quota di fermo della Machine, scostamento di margine, Cpk se calcolabile.

Esclude bozze, annullati, ordini in produzione, chiusure a zero pezzi e zero scarti, certificazioni, pause come correttivo del tempo standard, e ogni segnale del Copilot.

La quota di fermo resta un contesto della Machine. Non si somma al tempo per pezzo persistito nella stima successiva.

In PPI 1.0 nessuno scrive la memoria dentro il prossimo Estimate. Una persona scrive la stima. Il Copilot può proporre i valori calcolati. Accettarli significa una normale modifica della bozza, finché l’ordine non è avviato.

Dopo la riapertura la lettura non vede più quell’ordine. Alla chiusura successiva vede solo il reale corretto. Non resta una memoria parallela da aggiornare.

Una proiezione materiale, se un giorno servirà alle prestazioni, deve potersi ricostruire da questa lettura. Non diventa la fonte.

---

## 8. Validation Rules

Le regole seguenti rifiutano la scrittura. Non aggiungono comportamenti al freeze.

1. Ogni oggetto scritto appartiene alla Company della sessione.
2. Un ordine cita solo Part, Machine, Tool e Material di quella Company.
3. La Company ha sempre almeno un Owner. L’ultimo non si revoca e non si degrada.
4. I ruoli assegnabili sono solo Owner, Production Manager, Quality Manager, Operator.
5. L’attore del ciclo e della stima è Owner o Production Manager. Quality Manager e Operator non scrivono fase né Estimate.
6. Quality Manager scrive Measurement e Certification solo a ordine In produzione, e non scrive costi, margine, stima o fase.
7. Operator scrive pezzi buoni, Scrap, Measurement, Tool Change, consumo materiale, Pause e Downtime solo sull’ordine In produzione. Non scrive Certification, stima, costi o fase.
8. Owner può scrivere gli stessi fatti di reparto dell’Operator.
9. In Bozza la Part è obbligatoria e la quantità obiettivo è presente. Per avviare, il tempo per pezzo è presente.
10. Dopo l’avvio, Part e tariffe unitarie di Estimate non cambiano. La quantità obiettivo sì, e solo lei ricalcola i totali stimati.
11. Actual e gli eventi esistono solo da In produzione. Una Measurement cita un controllo del piano di quello stesso ordine.
12. Scrap è un numero di pezzi. Il consumo materiale non si salva come Scrap.
13. Pause e Downtime si completano con una fine. La chiusura dell’ordine li vuole tutti chiusi.
14. Annulla avvio è rifiutato se esiste un pezzo buono, uno scarto o un altro evento.
15. Da Completato si corregge Actual solo dopo Riapri. Documenti, note e certificazioni si aggiungono anche senza riaprire.
16. Senza valore operativo concordato non si persiste un margine. Il margine, quando esiste, è calcolato, non inserito.
17. Cp e Cpk non si inseriscono.
18. Un ordine Completato con almeno un pezzo buono o uno scarto non si nasconde.
19. Una risorsa già citata da un ordine si ritira e non si scollega dagli ordini esistenti.
20. L’invito verso un’email già presente in questa Company, o in un’altra, non crea un secondo User.
