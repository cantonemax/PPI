# PPI 1.0 — Domain Freeze

Documento ufficiale di dominio. È la fonte unica per il disegno successivo di dati, multi-tenant, esperienza e roadmap.

PPI non è descritto qui come software, come base dati o come API.

Nome: PPI. Nome esteso: Predictive Process Intelligence. Payoff: The Intelligence Behind Manufacturing. Categoria: Manufacturing Intelligence Platform.

---

## 1. Product Definition

### Cosa è PPI

PPI è una Manufacturing Intelligence Platform. Trasforma i dati di produzione in intelligenza operativa.

Collega, intorno all’ordine di produzione:

- produzione
- qualità
- materiali
- attrezzature
- margini operativi
- certificazioni
- insight di fabbrica

Ogni ordine nasce con una stima, accumula il reale mentre si produce e lascia una memoria. L’ordine successivo della stessa parte deve poter essere stimato, controllato e ottimizzato con più precisione.

PPI serve ad aziende manifatturiere piccole. Deve essere comprensibile in minuti da chi produce e in secondi da chi possiede l’azienda.

### Cosa non è PPI

- Non è un ERP.
- Non è un MES tradizionale.
- Non è un software SPC tradizionale.
- Non è un software di contabilità.

In PPI 1.0 non esistono giacenze, acquisti, distinte, cicli di lavorazione, manutenzioni, listini, fatture, clienti, preventivi, né un registro certificazioni aziendale. Queste direzioni restano evoluzioni possibili. Non fanno parte del dominio congelato.

---

## 2. Core Principles

1. **Semplicità prima di tutto.** L’operatore capisce il lavoro in pochi minuti. Il titolare legge lo stato del business in pochi secondi.
2. **Il sistema si adatta all’azienda.** Flussi e ruoli seguono come lavora l’azienda.
3. **L’ordine di produzione è il centro.** Ogni fatto operativo gli appartiene.
4. **La struttura è configurabile.** PPI funziona con il solo titolare e funziona bene con due utenti. I ruoli nominati non sono un organigramma obbligatorio.
5. **Tutto è collegato all’ordine.** Documenti, controlli, misure, eventi, costi e marginalità vivono sull’ordine, oppure esistono solo per dare un nome stabile a ciò che l’ordine usa.
6. **Stimato contro reale.** Ogni ordine ha due dataset. Il confronto continuo è il vantaggio competitivo.
7. **Operator first.** L’operatore agisce sull’ordine attivo. Non analizza costi, margini o trend.
8. **Manufacturing Copilot.** È un motore di allarmi, raccomandazioni e trend. Non è una chat e non è un flusso di presa in carico.
9. **Ogni ordine chiuso può insegnare.** La storia rende più accurata la stima successiva. Preventivi intelligenti, previsione costi, previsione margini e production intelligence sono obiettivi successivi. Consumano questa memoria. Non sono oggetti di PPI 1.0.

Regola di decisione usata in questo freeze: in caso di ambiguità vince il modello più semplice che resta centrato sull’ordine, comprensibile per un’azienda piccola e capace di crescere senza diventare un ERP.

---

## 3. Core Entities

Ogni oggetto di business appartiene a una Company. Questa è la proprietà di dominio. Non è un disegno di tenancy.

| Entità | Scopo | Proprietà |
|---|---|---|
| Company | L’azienda a cui PPI si adatta | Contiene persone, ruoli, parti, macchine, utensili, materiali e ordini |
| User | La persona che usa PPI | Appartiene a una Company. Può esistere anche da sola, nel ruolo Owner |
| Role | Assegnazione configurabile di responsabilità | Appartiene alla relazione tra User e Company. I ruoli nominati sono Owner, Production Manager, Quality Manager, Operator |
| Production Order | Centro operativo e unità di memoria | Appartiene alla Company. Riguarda una Part |
| Estimate | Dataset deciso prima dell’avvio | Esiste solo dentro un Production Order |
| Actual | Dataset raccolto in produzione | Esiste solo dentro un Production Order |

Estimate e Actual hanno un nome proprio perché il confronto richiede due insiemi distinti. Non si consultano, non si archiviano e non si riusano fuori dal loro ordine.

### Ciclo dell’ordine

Fasi: **Bozza**, **In produzione**, **Completato**, **Annullato**.

| Passaggio | Esito | Chi | Condizione |
|---|---|---|---|
| Crea | Bozza | Owner o Production Manager | Part e quantità obiettivo |
| Avvia | In produzione | Owner o Production Manager | Tempo stimato per pezzo presente |
| Annulla | Annullato | Owner o Production Manager | Mai avviato |
| Annulla avvio | Bozza | Owner o Production Manager | Nessun pezzo e nessun evento. La stima torna modificabile. Il tempo avviato si scarta |
| Completa | Completato | Owner o Production Manager | Pause e fermi già chiusi |
| Riapri | In produzione | Owner o Production Manager | Gesto esplicito. L’ordine esce dalla memoria |
| Completa di nuovo | Completato | Owner o Production Manager | Il reale corretto rientra in memoria |

Regole del ciclo:

- L’operatore non crea, non avvia, non completa e non riapre. Se l’azienda ha il solo titolare, quella persona agisce come Owner.
- Raggiungere la quantità obiettivo non completa l’ordine.
- Pausa e fermo non cambiano fase.
- Il cambio dell’ordine attivo sposta la persona, non lo stato dell’ordine.
- All’avvio si congelano le tariffe unitarie della stima. La Part e il tempo per pezzo restano quelli dell’avvio.
- In produzione si può correggere la quantità obiettivo. I totali stimati si ricalcolano dalle tariffe congelate.
- Una stima rivelatasi sbagliata durante la produzione resta quella dell’avvio. Lo scostamento è il dato da conservare.
- La riapertura corregge i fatti reali. Non scongela la stima.
- Completare congela stima, reale ed eventi. Disegni, documenti tecnici, note e certificazioni si possono aggiungere anche a ordine completato, perché non riscrivono il confronto.
- Una bozza annullata e un avvio annullato non diventano memoria.
- Un ordine completato con zero pezzi buoni e zero scarti resta traccia e non insegna.
- Più ordini possono essere in produzione. Ogni operatore ne tiene uno attivo. L’ordine non ha un blocco esclusivo: i fatti li registra chi sta lavorando.

Un ordine di PPI 1.0 è una lavorazione di una Part. Può cambiare macchina durante la produzione. Non ha fasi, operazioni o cicli.

---

## 4. Supporting Entities

Esistono perché vivono più a lungo del singolo ordine e danno un nome stabile alla storia. Il loro ciclo è «esiste in azienda e si riusa». Non aprono un processo gestionale.

| Entità | Perché esiste | Cosa possiede | Cosa non possiede |
|---|---|---|---|
| Part | La stessa parte torna su molti ordini. Senza di lei la memoria non ha soggetto | Identità del manufatto | Giacenza, distinta, ciclo, listino |
| Machine | Ore, tariffa e fermi devono riferirsi alla stessa macchina | Identità e tariffa oraria | Manutenzione, ricambi, calendario |
| Tool | Cambi, consumo e sostituzioni attraversano gli ordini | Identità e unità di consumo | Giacenza, lotti, acquisti, vita a magazzino |
| Material | Consumo e costo attraversano gli ordini | Identità e unità di consumo | Giacenza, lotti, acquisti, valorizzazione |

Il costo d’uso di utensile e materiale sta sull’ordine, nello stimato e nel reale. La tariffa oraria sta sulla Machine perché il costo macchina dell’ordine si calcola da quella tariffa per il tempo.

---

## 5. Order-Owned Information

Queste informazioni non hanno vita fuori dall’ordine. Restano dentro perché esistono per eseguire, spiegare o documentare quella lavorazione.

| Informazione | Forma | Perché resta nell’ordine |
|---|---|---|
| Drawing | Allegato | L’operatore lo guarda sull’ordine attivo |
| Technical Document | Allegato | Stesso trattamento del disegno. Non esiste un’entità documento |
| Production Note | Testo | Vale per questa lavorazione |
| Control Plan | Elenco strutturato | Dice i controlli dovuti di questo ordine |
| Measurement | Valore registrato | È l’esito di un controllo di questo ordine |
| Certification | Output allegato | È la prova prodotta per questo ordine |

Un controllo del piano ha un nome, un valore nominale e due limiti. Una misura registra il valore rilevato contro quel controllo. Questo basta agli allarmi qualità e a Cp/Cpk. Non è un sistema qualità: niente revisioni, approvazioni o piani riusabili in PPI 1.0.

Lo scarto conta pezzi della Part. Lo scostamento di materiale è consumo materiale, non scarto.

---

## 6. Production Events

Gli eventi accadono solo con l’ordine in produzione. Alimentano Actual. Il reporting è una rilettura degli eventi, non un oggetto separato.

### Scrap

Registra pezzi della Part scartati. Parte da zero ed esiste come fatto anche quando resta zero. Lo registra chi sta lavorando l’ordine. Aumenta il costo per pezzo buono e il tasso di scarto che la Part ricorderà. Non modifica la stima.

### Pause

Registra un intervallo in cui il lavoro è fermo e la macchina non è in guasto. Ha un inizio e una fine. Chi lavora l’ordine la apre e la chiude. Va chiusa prima del completamento. Spiega il tempo di calendario. Non entra nel costo macchina e non corregge il tempo standard per pezzo.

### Downtime

Registra un fermo della Machine usata sull’ordine. Ha un inizio e una fine. Va chiuso prima del completamento. Il reale segna la macchina su cui il fermo è avvenuto. Spiega il tempo e, se si ripete, la quota di fermo di quella Machine. Non entra nel costo macchina e non si stima in bozza.

### Tool Change

Registra la sostituzione di una Tool e la quantità consumata nell’unità di quella Tool. È il fatto da cui nasce il consumo utensile reale. Non è una giacenza e non è un movimento di magazzino.

---

## 7. Estimate Dataset

Si compila in bozza. Lo scrive Owner o Production Manager. All’avvio le tariffe unitarie si congelano.

| Voce | Obbligo | Come nasce | Redditività | Stime future |
|---|---|---|---|---|
| Tempo per pezzo | Obbligatoria | Inserita | Base del costo macchina | Riferimento che la memoria corregge |
| Pezzi buoni attesi | Obbligatoria | È la quantità obiettivo | Scala i totali | Scala il tempo totale atteso |
| Scarto atteso | Facoltativa | Inserita solo se l’azienda vuole prevederlo | Scala il costo per pezzo buono | Utile solo se viene stimato |
| Costo macchina | Facoltativo | Tariffa oraria della Machine per il tempo previsto | Sì | Tariffa riusabile sulla Machine |
| Consumo utensile | Facoltativo | Quantità prevista della Tool | Sì | Consumo per pezzo della Part |
| Consumo materiale | Facoltativo | Quantità prevista del Material | Sì | Consumo per pezzo della Part |
| Altri costi operativi | Facoltativo | Un importo unico, senza voci contabili | Sì | Resta un’eccezione dell’ordine |
| Valore operativo concordato | Facoltativo | Un importo unico dell’ordine | Ancora del margine | Permette di ricordare il margine |
| Costo operativo | Calcolato | Somma dei costi stimati | Totale economico stimato | Costo atteso per pezzo buono |
| Margine atteso | Calcolato | Valore concordato meno costo operativo stimato | Redditività attesa | Scostamento da ridurre |

Senza Machine non c’è costo macchina. Senza valore concordato non c’è margine: PPI confronta tempi e costi, e la riga di margine resta assente.

Non appartengono allo stimato: misure, Cp, Cpk, fermi, pause, certificazioni.

L’azienda usa un’unica unità di tempo in tutti gli ordini. Material e Tool portano la propria unità di consumo.

---

## 8. Actual Dataset

Si apre all’avvio produzione. I fatti li registra chi lavora l’ordine. Tempi, costi e margine li calcola PPI.

| Voce | Come nasce | Redditività | Stime future |
|---|---|---|---|
| Tempo produttivo | Dall’avvio alla chiusura, esclusi pause e fermi | Base del costo macchina reale | Tempo reale per pezzo buono |
| Pezzi buoni | Contatore | Denominatore del costo per pezzo | Sì |
| Scarto | Evento Scrap. Zero finché non accade | Alza il costo per pezzo buono | Tasso di scarto della Part |
| Costo macchina | Ore di macchina per la tariffa della Machine | Sì | Costo per pezzo, per macchina e per parte |
| Consumo utensile | Somma dei Tool Change | Sì | Consumo per pezzo |
| Consumo materiale | Registrazione durante la produzione | Sì | Consumo per pezzo |
| Altri costi operativi | Importo unico, se nasce un costo non previsto | Sì | Eccezione, non una tariffa |
| Costo operativo | Somma dei costi reali | Sì | Costo reale per pezzo buono |
| Margine reale | Valore concordato meno costo operativo reale | È la redditività dell’ordine | Errore di margine |
| Misure | Valore contro un controllo del piano | No | Memoria qualità |
| Fermi | Evento Downtime | Spiegano il tempo. Fuori dal costo macchina | Quota di fermo della Machine |
| Pause | Evento Pause | Spiegano il tempo. Fuori dal costo macchina | Separano il fermo umano dal ciclo |

Il tempo per pezzo reale è il tempo produttivo diviso i pezzi buoni. Se i pezzi buoni sono zero, quel rapporto non esiste: l’ordine può comunque insegnare scarto e tempo complessivo.

Un cambio macchina durante la produzione attribuisce le ore alla macchina usata. La stima iniziale della macchina non si riscrive.

Cp e Cpk non si inseriscono. PPI li calcola dalle misure valide del controllo, quando ce ne sono almeno 5. Una misura è valida se il controllo ha i due limiti. Confidenza: 5–9 bassa, 10–19 media, 20–29 buona, 30 o più alta.

---

## 9. Comparison Model

Il valore di PPI nasce dal confronto continuo tra Estimate e Actual, per tutta la vita produttiva dell’ordine.

Una riga di confronto esiste quando almeno un lato ha un valore.

| Confronto | Da dove viene il valore |
|---|---|
| Tempo per pezzo | Tariffa congelata contro tempo produttivo / pezzi buoni |
| Pezzi buoni | Quantità obiettivo contro contatore |
| Scarto | Atteso, se indicato, contro pezzi scartati |
| Costo macchina | Stimato contro ore per tariffa |
| Consumo utensile | Stimato, se indicato, contro i cambi |
| Consumo materiale | Stimato, se indicato, contro il consumo registrato |
| Costo operativo | Totale stimato contro totale reale |
| Margine | Atteso calcolato contro reale calcolato |
| Fermi e pause | Solo reale. Spiegano perché il calendario diverge dal ciclo |
| Cp e Cpk | Solo reale calcolato. Visibili da 5 misure valide, con la confidenza della regola di capability |

Il confronto alimenta tre risultati:

- la redditività operativa dell’ordine, quando il valore concordato esiste
- i segnali del Copilot
- la materia prima della memoria, alla chiusura

Il titolare deve poter leggere questo scostamento in pochi secondi. L’operatore non lo usa per decidere il gesto successivo.

---

## 10. Historical Learning Model

La memoria è l’insieme degli ordini completati che possono insegnare.

Entra in memoria un ordine completato con almeno un pezzo buono o uno scarto. Durante una riapertura ne esce. Alla chiusura successiva rientra con il reale corretto e sostituisce la versione precedente. Non convive con la versione superata.

Non insegnano: bozze, annullati, ordini ancora in produzione, chiusure a zero pezzi e zero scarti, certificazioni, pause isolate, segnali del Copilot.

La chiave di lettura è la Part. Machine, Tool e Material sono il contesto.

| Memoria | Correzione che prepara |
|---|---|
| Tempo reale per pezzo buono | Il tempo per pezzo del prossimo ordine |
| Tasso di scarto | I pezzi da considerare e il costo per pezzo buono |
| Materiale per pezzo buono | Il consumo materiale |
| Utensile per pezzo buono | Il consumo utensile |
| Costo macchina per pezzo buono | Il costo macchina |
| Quota di fermo della Machine | Il rischio tempo, senza modificare il ciclo standard |
| Scostamento di margine | L’errore economico della stima |
| Cpk, se calcolabile | La fiducia qualità sulla Part. Non il costo |

In PPI 1.0 la memoria non riscrive da sola la stima. Il prossimo Estimate lo scrive ancora una persona. Il Copilot può proporre il valore imparato. La persona lo accetta, lo modifica o lo ignora.

La quota di fermo non va sommata al tempo standard per pezzo: un fermo eccezionale non deve diventare il nuovo ciclo.

---

## 11. Role Model

I ruoli sono configurabili. I quattro nomi sotto sono quelli riconosciuti. Un’azienda può usarne uno solo o una parte. Nessuna funzione di PPI 1.0 richiede che tutti e quattro esistano.

| Ruolo | Responsabilità di dominio | Fuori dalla sua responsabilità |
|---|---|---|
| Owner | Crea, stima, avvia, completa, riapre, annulla. Legge in pochi secondi ordini, scostamenti e margini. Può registrare gli stessi fatti dell’operatore | Nessun gesto gli è precluso nell’azienda |
| Production Manager | Se il ruolo esiste: prepara, stima, avvia, completa, riapre e segue il confronto di produzione | Non è richiesto per far funzionare PPI |
| Quality Manager | Se il ruolo esiste: registra misure e certificazioni sugli ordini in produzione e legge il confronto qualità | Non cambia stima, costi, margine o ciclo dell’ordine |
| Operator | Sull’ordine attivo registra pezzi buoni, scarti, controlli, cambi utensile, consumo materiale, pause e fermi. Passa a un altro ordine attivo | Non crea, non avvia, non completa, non riapre, non legge margini né trend |

Superficie operatore, e solo quella: ordine attivo, disegno, controllo richiesto ora, contatore, registrazione scarto, cambio utensile, informazione materiale, pausa, fermo macchina, cambio ordine.

---

## 12. Manufacturing Copilot

### Scopo

Il Copilot è il motore di intelligenza operativa di PPI. Osserva il confronto, gli eventi e la memoria degli ordini chiusi. Restituisce segnali a chi guida l’azienda. Non conversa, non assegna compiti e non conserva pratiche.

In PPI 1.0 i segnali sono generati quando servono. Diventano oggetti conservati solo in una evoluzione in cui qualcuno debba prenderli in carico e lasciarne traccia.

### Segnali

- allarme qualità
- allarme utensili
- allarme produzione
- allarme margine
- raccomandazione
- trend

### Trigger

| Segnale | Nasce quando |
|---|---|
| Allarme qualità | Una misura esce dai limiti, lo scarto si allontana dalla storia della Part, oppure il Cpk calcolabile peggiora |
| Allarme utensili | Il consumo reale supera lo stimato, oppure i cambi si ripetono oltre il comportamento noto di quella Tool |
| Allarme produzione | Il tempo per pezzo reale supera lo stimato, oppure i fermi crescono sulla Machine |
| Allarme margine | Il margine reale scende sotto il margine atteso, oppure il costo operativo reale supera lo stimato. Resta assente se il valore concordato non c’è |
| Raccomandazione | La memoria della Part propone un tempo, uno scarto o un consumo per la stima ancora apribile, oppure segnala la voce che sta generando lo scostamento sull’ordine in corso |
| Trend | Più ordini completati della stessa Part, Machine, Tool o Material mostrano una direzione |

### Output

Per il titolare: scostamento, margine e segnali leggibili in pochi secondi.

Per Production Manager e Quality Manager, se presenti: rispettivamente i segnali di produzione e quelli di qualità.

Per l’operatore: nessun cruscotto del Copilot. L’unico segnale sul suo lavoro è il controllo richiesto ora, che arriva dal piano dell’ordine, non da una conversazione.

---

## 13. Open Questions

Nessuna. La soglia di Cp e Cpk è decisa: visibili da 5 misure valide, con confidenza bassa, media, buona o alta.
