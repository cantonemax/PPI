# PPI 1.0 — Roadmap di implementazione

Ordine di lavoro per Cursor. Non aggiunge funzioni e non cambia schema né dominio.

Fonti: Domain Freeze, SaaS Architecture, Domain Architecture, Persistence Architecture, UI Blueprint, Prisma schema. Il Brand Book non è nel progetto: l’interfaccia segue il UI Blueprint finché non arriva.

Lo schema Prisma è già la persistenza. Le fasi lo usano. Non lo ridisegnano.

Regole che ogni fase deve rispettare:

- Company è il tenant. La sessione decide la Company. Row-level security sul ruolo applicativo.
- Un User, una Company. Almeno un Owner. Un ruolo si assegna, si revoca e si riassegna. La riga revocata resta.
- Ogni ordine nasce con un Estimate, nella stessa scrittura.
- All’avvio si fotografano tariffa macchina e costi unitari già presenti sull’ordine. Dopo, i prezzi correnti di Machine, Tool e Material non rileggono quegli ordini.
- Confronto, margini, Copilot e memoria si calcolano. Non si salvano.
- Cp e Cpk si calcolano da 5 misure valide: 5–9 bassa, 10–19 media, 20–29 buona, 30 o più alta.
- L’operatore non vede dati economici. Il Quality Manager non li gestisce. Li scrive l’Owner, o un Production Manager con `economicAuthority`.
- Il Quality Manager può aggiungere una certificazione anche a ordine completato. La certificazione non tocca stima, reale, margine o memoria.

---

## Development Order

1. Foundation
2. Core Orders
3. Production Execution
4. Quality
5. Economics
6. Certifications
7. Manufacturing Copilot

Quality può iniziare dopo Core Orders, in parallelo con Production Execution, perché piano e misure non dipendono da scarto e fermo. Economics dipende dai fatti di esecuzione e dagli snapshot scritti all’avvio. Il disegno sull’ordine attivo è un criterio di Production Execution: il caricamento del file è la prima fetta di Certifications, da fare prima di chiudere l’accettazione dell’operatore. Il resto dei documenti e le certificazioni restano nella fase 6.

---

## 1. Foundation

**Goal.** Un’azienda vuota entra, resta isolata dalle altre e assegna i quattro ruoli.

**Features.** Next.js e TypeScript. Login. Onboarding atomico: Company, primo User, ruolo Owner. Invito con hash del token, scadenza, uso singolo. Ruoli Owner, Production Manager, Quality Manager, Operator, con `economicAuthority` solo sul Production Manager. Revoca e riassegnazione. Prisma sullo schema esistente. `companyId` su ogni query. Indice univoco parziale: un solo ruolo aperto per utente e ruolo.

**Dependencies.** Nessuna fase precedente. PostgreSQL disponibile. `DATABASE_URL`.

**Acceptance.** Due Company non si vedono. Il solo Owner completa l’onboarding e apre un’azienda vuota. L’invito verso un’email già usata è rifiutato. L’ultimo Owner non si revoca. Un ruolo revocato si riassegna e la riga vecchia resta. L’audit registra creazione Company, invito, accettazione, ruoli e revoca.

**Risks.** Tenant preso dal client. Contesto tenant lasciato nel pool di connessioni. Ruolo database che aggira la row-level security.

---

## 2. Core Orders

**Goal.** Il titolare, o il Production Manager, crea una bozza, la stima e la porta attraverso il ciclo.

**Features.** Part obbligatoria e quantità obiettivo. Estimate creato insieme all’ordine. Tempo per pezzo obbligatorio solo per avviare. Macchina, scarto atteso, consumi, altri costi e valore concordato facoltativi in bozza. Fasi: Bozza, In produzione, Completato, Annullato. Annulla avvio solo senza pezzi e senza eventi. Completamento solo con pause e fermi già chiusi. Riapertura che non scongela la stima e toglie l’ordine dalla lettura di memoria. All’avvio: `hourlyRateSnapshot` e `unitCost` delle righe di stima diventano immutabili. Actual nasce all’avvio. Lista e dettaglio secondo il ruolo. Creazione ordine solo per Owner e Production Manager.

**Dependencies.** Foundation. Anagrafiche minime di Part e, se servono in stima, Machine, Tool e Material con tariffa e costo unitario correnti. La gestione completa delle anagrafiche sta in questa fase perché senza Part l’ordine non esiste.

**Acceptance.** Non esiste un ordine senza Estimate. Dopo l’avvio, cambiare la tariffa della Machine o il costo unitario di Tool e Material non cambia gli snapshot dell’ordine. La quantità obiettivo in produzione ricalcola solo i totali, non le tariffe. Un ordine completato con pezzi o scarti non si nasconde. Bozza e annullato si possono nascondere. L’audit registra i passaggi di ciclo e il congelamento della stima.

**Risks.** Estimate scritto in una transazione separata e ordine lasciato senza stima. Snapshot letto dal prezzo corrente a ogni calcolo.

---

## 3. Production Execution

**Goal.** L’operatore lavora un solo ordine attivo, senza dati economici.

**Features.** Casa operatore: ordine attivo, disegno se presente, controllo richiesto ora se il piano esiste già, contatore, informazione materiale, scarto, cambio utensile, consumo materiale, pausa, fermo, cambio ordine. I fatti li registrano Operator e Owner. Il Production Manager no. Pausa e fermo hanno inizio e fine, non si sovrappongono nello stesso tipo e non cambiano fase. Il cambio macchina scrive `MachineTime` con la tariffa già fotografata se la macchina è quella stimata. Se la macchina è nuova, la tariffa si copia una volta sull’intervallo. Un utensile o un materiale non stimato copia il costo unitario una volta sull’evento. L’Owner può usare la stessa casa.

**Dependencies.** Core Orders. Caricamento del disegno, anche se il resto dei documenti è in Certifications.

**Acceptance.** L’operatore non riceve costi, margine, trend, Cp, Cpk né Copilot. Il contatore e gli scarti restano a zero finché non accade un fatto. Chiudere l’ordine con una pausa o un fermo aperti è rifiutato. Annullare l’avvio con un pezzo o un evento è rifiutato. Il cambio ordine sposta il User, non la fase.

**Risks.** Payload del dettaglio ordine riusato per l’operatore e che include i campi economici. Pausa lasciata aperta.

---

## 4. Quality

**Goal.** Il piano dell’ordine produce misure e, quando bastano, Cp e Cpk.

**Features.** Controllo con nome, nominale e due limiti. Misura collegata a un controllo dello stesso ordine. Quality View per Owner e Quality Manager. L’operatore registra solo la misura del controllo dovuto, senza indici. Cp e Cpk non si salvano. Sotto le 5 misure valide non compaiono. Confidenza: 5–9 bassa, 10–19 media, 20–29 buona, 30 o più alta.

**Dependencies.** Core Orders. Il controllo dovuto in Production Execution può arrivare vuoto finché questa fase non c’è. Meglio chiudere Quality prima dell’accettazione finale dell’operatore, se il controllo richiesto ora deve essere reale.

**Acceptance.** Una misura fuori limite è visibile al Quality Manager e all’Owner, non al Production Manager e non come analisi all’operatore. Gli indici non hanno colonna. Una misura cita solo un controllo di quell’ordine.

**Risks.** Calcolare gli indici sotto le 5 misure, o salvarli e renderli una fonte parallela.

---

## 5. Economics

**Goal.** Owner legge in pochi secondi costo, margine e scostamento. Gli altri no.

**Features.** Costo macchina da ore e tariffa fotografata. Costo utensile e materiale da quantità e costo unitario fotografato. Altri costi. Costo operativo calcolato. Margine calcolato solo se c’è il valore concordato. Confronto continuo in produzione. Colonne economiche solo per l’Owner. Il Production Manager vede tempo, pezzi, scarto e fermi, non costi né margine. Scrivere tariffa, costo unitario e valore operativo richiede Owner o Production Manager autorizzato.

**Dependencies.** Core Orders per gli snapshot. Production Execution per il reale di ore, cambi e consumi. Senza quei fatti il confronto economico è vuoto sul lato Actual.

**Acceptance.** Nessun campo margine o costo totale nel database. Un ordine senza valore concordato non mostra margine. Dopo la chiusura, modificare il prezzo corrente di una risorsa non cambia il confronto di quell’ordine. La riapertura corregge i fatti e l’audit `ACTUAL_CORRECTED`. La stima resta congelata.

**Risks.** Ricalcolare uno storico dal prezzo corrente. Mostrare il margine al Quality Manager perché apre lo stesso dettaglio.

---

## 6. Certifications

**Goal.** Disegno, documenti, note e certificazioni restano dell’ordine.

**Features.** Drawing e Technical Document come allegati, con chiave che include la Company. Production Note come testo. Certification come output dell’ordine, in produzione e anche a ordine completato, per Owner e Quality Manager. Il Production Manager e l’operatore non certificano. Il download ripete il controllo di tenant e di ruolo.

**Dependencies.** Core Orders. Il disegno è prerequisito di accettazione della casa operatore.

**Acceptance.** Una certificazione aggiunta a ordine completato non cambia Estimate, Actual, margine né l’insieme degli ordini che insegnano. Un file di un’altra Company non si scarica conoscendo la chiave.

**Risks.** Link diretto all’object storage che aggira l’applicazione.

---

## 7. Manufacturing Copilot

**Goal.** Il motore segnala. Non conversa e non salva pratiche.

**Features.** Allarmi di qualità, utensili, produzione e margine. Raccomandazione sul dato che scosta, o sul valore che la memoria della Part può proporre in una bozza ancora aperta. Trend sugli ordini completati che insegnano. Visibili all’Owner. Produzione al Production Manager. Qualità al Quality Manager. Nessun cruscotto per l’operatore. L’allarme margine manca se manca il valore concordato. Accettare una proposta scrive la bozza, non una memoria separata.

**Dependencies.** Economics per il confronto. Quality per misure e indici. Ordini completati con almeno un pezzo buono o uno scarto. Core Orders per la riapertura, che toglie l’ordine dalla lettura finché non si chiude di nuovo.

**Acceptance.** Nessuna tabella di segnali. Due Company non mescolano la storia. Una chiusura a zero pezzi e zero scarti non corregge la stima successiva. La quota di fermo non diventa il nuovo tempo per pezzo.

**Risks.** Persistere l’allarme per poterlo «gestire». Usare ordini di un altro tenant perché la query dimentica `companyId`.

---

## Sprint Breakdown

Ogni sprint termina con i criteri di accettazione della fase, osservabili in interfaccia e nel database. Non si apre la fase successiva se il criterio fallisce.

| Sprint | Fase | Esito osservabile |
|---|---|---|
| 1 | Foundation | Onboarding, login, isolamento di due Company, invito, ruoli |
| 2 | Foundation | Revoca, riassegnazione, ultimo Owner, audit accessi, row-level security verificata |
| 3 | Core Orders | Part e risorse sottili, bozza con Estimate, lista e dettaglio |
| 4 | Core Orders | Avvio con snapshot, Actual, chiusura, riapertura, annullo |
| 5 | Production Execution | Casa operatore, contatore, scarto, pausa, fermo, cambio ordine |
| 6 | Production Execution | Cambio utensile, consumo materiale, ore macchina, disegno visibile |
| 7 | Quality | Piano, misure, Quality View, soglia Cp e Cpk |
| 8 | Economics | Confronto, costi e margine solo per l’Owner, prezzi correnti che non riscrivono lo storico |
| 9 | Certifications | Allegati, note, certificazione su ordine chiuso, download autorizzato |
| 10 | Manufacturing Copilot | Segnali calcolati, proposta in bozza, memoria per Part |

---

## MVP Roadmap

L’MVP utilizzabile da un’azienda con il solo titolare è la fine dello sprint 8: entra, crea l’ordine, lo avvia, registra i fatti, chiude, legge margine e scostamento, e lo storico non si muove se cambiano i prezzi.

Quality, nello sprint 7, entra nell’MVP perché il controllo richiesto ora è sulla casa operatore. Certifications e Copilot sono il completamento di PPI 1.0, non il primo utilizzo.

---

## Dependencies

```text
Foundation
  -> Core Orders
       -> Production Execution -> Economics -> Copilot
       -> Quality -------------^
       -> Certifications
```

Economics legge gli snapshot di Core Orders e i fatti di Production Execution. Copilot legge Economics, Quality e gli ordini completati. Certifications non blocca Economics. Blocca solo la prova del disegno in mano all’operatore.

---

## Risks

| Rischio | Quando si vede | Controllo |
|---|---|---|
| Filtro di tenant dimenticato | Foundation e ogni query nuova | Row-level security e prova con due Company |
| Snapshot non scritto all’avvio | Core Orders | Cambiare il prezzo corrente e rileggere l’ordine avviato |
| Campi economici nella risposta operatore | Production Execution e Economics | Stessa schermata di dettaglio, ruoli diversi, payload diverso |
| Cp e Cpk salvati o mostrati troppo presto | Quality | Nessuna colonna. Nessun indice sotto le 5 misure |
| File raggiungibile senza sessione | Certifications | Download solo dopo controllo Company e ruolo |
| Copilot persistito o cross-tenant | Copilot | Nessuna scrittura di segnale. Lettura solo degli ordini della Company |
