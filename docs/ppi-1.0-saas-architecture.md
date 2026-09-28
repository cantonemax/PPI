# PPI 1.0 — Architettura SaaS

Disegno tecnico intorno al Domain Freeze. Non modifica regole di business, non ridisegna il prodotto, non definisce tabelle e non contiene schema Prisma.

Contesto tecnico: Next.js, TypeScript, PostgreSQL, Prisma. SaaS, multi-tenant, cloud first.

Il tenant è la Company. La stessa architettura vale per un’azienda e per migliaia di aziende.

---

## 1. Multi-Tenant Architecture

### Modello

Un solo database PostgreSQL, un solo schema, molte Company. Ogni fatto di business porta il confine della propria Company. Non si crea un database per azienda e non si crea uno schema per azienda: a migliaia di tenant quelle due strade cambiano l’operatività. Questa no.

La Company del Domain Freeze è il tenant. Non esiste un secondo oggetto «organizzazione».

### Cosa scala senza cambiare architettura

- Da 1 a migliaia di Company nello stesso schema.
- Più utenti nella stessa Company, fino al caso congelato di un solo Owner.
- Copilot e memoria storica eseguiti dentro il confine della Company, sugli ordini completati di quella Company.

### Cosa non è condiviso

Parti, macchine, utensili, materiali, ordini, stime, reali, eventi, allegati, confronti, memoria e segnali del Copilot non sono cataloghi globali. Un nome uguale in due aziende è una coincidenza, non lo stesso oggetto.

### Risoluzione del tenant

Il tenant della richiesta nasce dalla sessione autenticata. Il server Next.js ricava la Company dall’utente che ha fatto login. Un identificativo di azienda inviato dal client non è una prova di appartenenza.

Ogni lettura e ogni scrittura di Prisma avviene dentro quel contesto. PostgreSQL, con Row Level Security sul ruolo usato dall’applicazione, rifiuta le righe di un’altra Company anche se la query applicativa dimentica il filtro. Il ruolo runtime non è un superuser e non può aggirare quella policy.

### File

Disegni, documenti tecnici e certificazioni stanno in object storage cloud. La chiave include la Company. Il file si scarica solo dopo lo stesso controllo di accesso dell’ordine a cui appartiene.

### Copilot e memoria

Il calcolo di confronto, segnali e proposte usa solo ordini, parti, macchine, utensili e materiali della Company corrente. Un segnale non si persiste come oggetto di business, come già congelato. Il calcolo non ha un canale verso un altro tenant.

---

## 2. Company Ownership Model

La proprietà segue il freeze.

| Oggetto | Proprietario | Regola di architettura |
|---|---|---|
| User, Role, Part, Machine, Tool, Material, Production Order | Company | Visibili e modificabili solo dentro quella Company |
| Estimate, Actual | Production Order | Mai letti o riusati fuori dal loro ordine |
| Drawing, Technical Document, Production Note, Control Plan, Measurement, Certification | Production Order | Stesso confine dell’ordine, quindi della Company |
| Scrap, Pause, Downtime, Tool Change | Production Order | Stesso confine. Un evento cita solo Machine o Tool di quella Company |
| Confronto, memoria, segnali | Company, per derivazione | Si calcolano sui dati di quella Company. I segnali non diventano archivio |

Vincolo di riferimento: un ordine può citare solo una Part della stessa Company. Un costo macchina usa solo una Machine della stessa Company. Un cambio utensile e un consumo materiale citano solo Tool e Material della stessa Company. Il riferimento verso un’altra Company è un errore, non un collegamento.

L’unità di tempo è unica per Company, come nel freeze. Non esiste un’unità globale imposta dal SaaS.

---

## 3. User Access Model

### Isolamento

Un User appartiene a una sola Company. È la regola del freeze, applicata all’accesso.

In PPI 1.0 lo stesso login non entra in due aziende. Un invito verso un’email già appartenente a un’altra Company viene rifiutato. Questo evita un utente ponte tra tenant. L’accesso multi-azienda, se servirà, sarà un cambiamento di dominio, non una scorciatoia di questa architettura.

L’identità di login e il User di dominio non vanno confusi. Il login prova chi è la persona. Il User prova in quale Company agisce e con quali ruoli. Senza User dentro una Company, il login non vede dati di produzione.

### Sessione

La sessione porta l’identità e la Company. Si invalida quando il User perde l’accesso, quando la Company viene chiusa, e quando cambiano i ruoli: la richiesta successiva usa i ruoli nuovi, non una copia stantia dei permessi.

### Autorizzazione

L’autorizzazione è sul server, a ogni lettura e a ogni scrittura. Il ruolo decide quali azioni del freeze sono permesse e quali campi possono uscire dalla risposta.

| Capacità congelata | Owner | Production Manager | Quality Manager | Operator |
|---|---|---|---|---|
| Ciclo dell’ordine: crea, avvia, completa, riapre, annulla | Sì | Sì | No | No |
| Scrivere la stima in bozza | Sì | Sì | No | No |
| Leggere scostamenti di produzione | Sì | Sì | No | No |
| Leggere confronto qualità | Sì | No | Sì | No |
| Leggere costi, margine, allarme margine, trend | Sì | No | No | No |
| Registrare pezzi, scarti, controlli, utensili, materiale, pause, fermi | Sì | No | Solo misure e certificazioni, in produzione | Sì, misure incluse |
| Certificazioni | Sì | No | Sì | No |
| Superficie operatore | Può usarla | No | No | Sì, ed è la sua unica superficie |

L’Owner registra i fatti di produzione perché il freeze glielo consente, anche se in azienda non esiste un Operator. Non serve assegnargli anche quel ruolo.

Quality Manager non riceve costi, margine né ciclo. Operator non riceve margini, costi, trend né segnali del Copilot. Il controllo richiesto ora arriva dal piano dell’ordine, non da un payload del Copilot.

Un utente con più ruoli riceve l’unione delle capacità. Nessuna unione attraversa due Company.

---

## 4. Role Assignment Model

I ruoli assegnabili in PPI 1.0 sono solo i quattro nominati nel freeze: Owner, Production Manager, Quality Manager, Operator. La configurabilità è scegliere quali usare e a chi darli. Non si inventano ruoli nuovi e non esiste un costruttore di permessi.

Regole di assegnazione:

- Ogni assegnazione lega un User della Company a un ruolo, dentro quella Company.
- Un User può avere più ruoli nella stessa Company. Un’azienda piccola può così unire qualità e reparto senza un quinto ruolo.
- La Company nasce con un solo User, e quel User è Owner.
- Deve restare sempre almeno un Owner. L’ultimo Owner non si rimuove, non si degrada e non si disattiva.
- Togliere un ruolo ha effetto sulla richiesta successiva. Non modifica gli ordini già chiusi né la memoria.
- Production Manager e Quality Manager possono non esistere. L’assenza di quei ruoli non blocca nessuna funzione.

Chi assegna i ruoli: l’Owner. Gli altri ruoli non amministrano gli accessi. Il freeze non gli dà questa responsabilità, e allargarla mescolerebbe governo dell’azienda e governo del reparto.

---

## 5. SaaS Onboarding Model

### Creazione della Company

1. Una persona crea l’account di login.
2. Nel stesso passaggio nasce la Company e il primo User, con ruolo Owner.
3. Il passaggio è atomico: non resta una Company senza Owner e non resta un Owner senza Company.
4. La Company nasce vuota. Nessuna Part, Machine, Tool, Material o ordine di esempio viene copiato da un altro tenant.
5. Da subito è valido il caso congelato «solo titolare»: l’Owner crea l’ordine, scrive la stima, avvia, registra i fatti e completa.

Finché questo passaggio non è concluso, non esiste un tenant da interrogare.

### Invito di un User

1. L’Owner indica email e uno o più ruoli tra i quattro.
2. L’invito appartiene a quella Company, scade, si usa una sola volta e non concede accesso prima dell’accettazione.
3. All’accettazione nasce il User dentro quella Company, con i ruoli indicati.
4. Se l’email è già un User di questa Company, l’invito si rifiuta.
5. Se l’email appartiene già a un’altra Company, l’invito si rifiuta.
6. Un invito non accettato non compare nelle schermate di produzione e non entra nell’audit operativo degli ordini. Entra solo nell’audit degli accessi.
7. Revocare un invito aperto o un User già attivo è un gesto dell’Owner. Revocare un User chiude la sua sessione. Non cancella i fatti che ha registrato sugli ordini.

L’invito di un Operator è il caso previsto per l’azienda con due persone. Non è obbligatorio.

### Chiusura della Company

L’Owner può chiudere la Company. La chiusura revoca tutte le sessioni e rende i dati illeggibili agli altri tenant e agli utenti di quella Company. I dati restano isolati. Non vengono fusi, esportati verso un altro tenant o riusati come memoria altrui.

---

## 6. Security Model

### Isolamento dei dati

Tre livelli, tutti necessari:

1. Il server accetta solo la Company della sessione.
2. L’accesso Prisma del prodotto filtra per quella Company e rifiuta i riferimenti verso oggetti di un’altra Company.
3. PostgreSQL RLS applica lo stesso confine sul ruolo dell’applicazione.

Un identificativo noto di un ordine, di un allegato o di una Part non è un’autorizzazione. La prova è sessione più ruolo più appartenenza alla stessa Company.

### Cancellazione logica

Il freeze non definisce una cancellazione distruttiva. L’architettura non ne introduce una che rompa la memoria.

| Oggetto | Comportamento |
|---|---|
| Production Order in bozza o annullato | Si può nascondere. Non è mai entrato in memoria |
| Production Order in produzione | Segue il ciclo. Non si nasconde per aggirare chiusura o riapertura |
| Production Order che insegna o che è traccia di una chiusura a zero | Si conserva. Nasconderlo altererebbe la memoria o la storia dell’azienda |
| Part, Machine, Tool, Material già citati da un ordine | Si ritirano: non si scelgono più per ordini nuovi e restano leggibili sugli ordini vecchi |
| Part, Machine, Tool, Material mai citati | Si possono nascondere |
| User rimosso | Perde l’accesso. Il nome resta sui fatti che ha registrato |
| Company chiusa | Isolata e inaccessibile, non cancellata fisicamente nel gesto di chiusura |

Nessuna cancellazione logica rende visibili dati di un altro tenant. Gli oggetti nascosti restano dentro la Company e fuori dalle letture normali, dal Copilot e dai nuovi ordini.

### Audit

L’audit è un requisito di piattaforma. Non è un’entità del dominio manifatturiero e non è il Copilot.

Si registra, dentro la Company:

- creazione della Company e chiusura
- invito, accettazione, cambio ruoli, revoca
- passaggi di ciclo dell’ordine: crea, avvia, annulla, annulla avvio, completa, riapri, completa di nuovo
- congelamento della stima all’avvio
- correzioni del reale durante la riapertura
- ritiro di Part, Machine, Tool, Material

Ogni voce dice chi, quando, su quale oggetto della Company. L’Owner la può consultare. Operator, Production Manager e Quality Manager no.

I segnali del Copilot non si auditano come pratiche: in 1.0 non sono oggetti conservati.

Un accesso di piattaforma, se esisterà per il supporto, è fuori dai ruoli azienda, è limitato nel tempo, è motivato e lascia audit. Non è un Owner implicito di ogni Company.

---

## 7. Risks

| Rischio | Perché conta | Contro misura |
|---|---|---|
| Query senza confine di Company | Una dimenticanza mostra un altro tenant | RLS sul ruolo runtime, oltre al filtro applicativo |
| Company scelta dal client | L’header o il body diventano un passepartout | Tenant solo dalla sessione |
| Identificativo come autorizzazione | Un ordine o un file di un’altra azienda si apre conoscendo l’id | Controllo Company su ogni oggetto e su ogni file |
| Ruolo database troppo potente | RLS non si applica ai superuser e alle query raw privilegiate | Ruolo applicativo senza bypass. Nessuna query di prodotto con privilegi di migrazione |
| Pool di connessioni | Il contesto tenant della transazione precedente resta appeso | Contesto tenant impostato e rimosso dentro la stessa transazione |
| Risposta troppo ricca | L’Operator riceve margine o trend in un payload condiviso | Campi e segnali filtrati sul server in base al ruolo |
| Utente su due Company | Un bug di invito crea un ponte tra tenant | Un User, una Company. Invito cross-company rifiutato |
| Ultimo Owner rimosso | L’azienda resta senza governo | Invariante: almeno un Owner |
| Cancellazione di un ordine che insegna | La memoria della Part cambia senza una riapertura | Gli ordini di memoria si conservano. Il ciclo di riapertura resta l’unico modo per correggere il reale |
| Ritiro di una Part ancora necessaria allo storico | L’ordine chiuso perde il soggetto della memoria | Il ritiro blocca i nuovi usi e mantiene il riferimento storico |
| Copilot cross-tenant | Una proposta usa il tempo per pezzo di un’altra azienda | Il calcolo eredita il contesto tenant della richiesta |
| Allegati in bucket condiviso | Il link al disegno aggira l’applicazione | Chiave per Company e autorizzazione prima del download |
| Permessi stantii in sessione | Un Operator appena promosso, o degradato, agisce col ruolo vecchio | I ruoli si rileggono sul server a ogni richiesta |
| Supporto piattaforma | Un accesso interno legge tutte le Company | Break-glass separato dai ruoli azienda, con audit e scadenza |

Cp e Cpk si calcolano solo sulle misure della Company, da 5 misure valide. La confidenza non attraversa un altro tenant.
