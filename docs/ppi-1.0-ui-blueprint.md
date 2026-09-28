# PPI 1.0 — UI Blueprint

Fondamenta visiva del prodotto. Non cambia dominio, ciclo o regole di business. Non è codice e non è interfaccia implementata.

I testi che la persona legge sono in italiano. I nomi delle schermate qui sotto sono i nomi di prodotto, in inglese, come nel resto dei documenti.

Fonti: Domain Freeze, SaaS Architecture, Domain Architecture, Persistence Architecture.

---

## 1. Screen Inventory

### Login

- **Scopo.** Far entrare una persona già invitata o già Owner.
- **Utente.** Chiunque abbia un accesso. Non mostra dati di produzione.
- **Informazioni.** Nome prodotto, payoff, campi di accesso, errore di accesso in italiano.
- **Azioni.** Entra. Passa alla creazione della prima Company se non esiste ancora un tenant per quella persona.
- **Visibilità.** Nessun ruolo. Nessun ordine, margine o misura.
- **Gerarchia.** Il gesto di ingresso è l’unico elemento. Il payoff resta secondario.

### Initial Onboarding

- **Scopo.** Creare in un solo passaggio la Company e il primo User Owner. È il caso «solo titolare».
- **Utente.** La persona che apre l’azienda.
- **Informazioni.** Nome dell’azienda e unità di tempo unica dell’azienda. Nessun dato di esempio e nessun elenco di altre Company.
- **Azioni.** Crea l’azienda. Non invita ancora. L’invito sta in User Management.
- **Visibilità.** Solo prima che esista la Company. Non si rivede a ogni accesso.
- **Gerarchia.** Il nome dell’azienda è il campo principale. L’unità di tempo è la scelta unica successiva.

### Owner Dashboard

- **Scopo.** Lo stato del business in pochi secondi: redditività, produzione, qualità, margini operativi.
- **Utente.** Owner. È la sua casa.
- **Informazioni.** Ordini in produzione. Scostamento di tempo, pezzi, scarto e costo dove il confronto esiste. Margine solo se il valore concordato c’è. Segnali del Copilot: produzione, qualità, utensili, margine, raccomandazioni, trend. Le chiusure recenti che insegnano, per Part.
- **Azioni.** Apre un ordine. Crea un ordine. Passa alle altre aree consentite all’Owner.
- **Visibilità.** Solo Owner. Production Manager non vede questa casa: i costi, il margine e i trend sono dell’Owner. Quality Manager e Operator non la aprono.
- **Gerarchia.** Prima il margine e lo scostamento economico degli ordini aperti. Poi produzione. Poi qualità. I trend stanno sotto, come lettura e non come cruscotto analitico.

### Operator Dashboard

- **Scopo.** Far lavorare l’ordine attivo in pochi minuti, senza analisi.
- **Utente.** Operator. L’Owner può aprirla quando fa lui il lavoro di reparto. Production Manager e Quality Manager no.
- **Informazioni.** Ordine attivo, disegno, controllo richiesto ora, contatore, informazione materiale. Nessun costo, margine, trend, Cp, Cpk o segnale del Copilot.
- **Azioni.** Registra pezzi buoni, scarto, controllo, cambio utensile, consumo materiale, pausa, fermo. Cambia l’ordine attivo tra quelli in produzione.
- **Visibilità.** È l’unica casa dell’Operator. Non porta alla lista gestionale, alle risorse, agli utenti o all’audit.
- **Gerarchia.** L’ordine attivo occupa lo schermo. Subito sotto, il controllo dovuto ora. Poi il contatore. Le altre azioni di reparto sono una fila secondaria. Il cambio ordine non compete con il pezzo in lavorazione.

### Production Order List

- **Scopo.** Trovare e aprire gli ordini, e leggere il confronto di produzione.
- **Utente.** Owner e Production Manager.
- **Informazioni.** Fase, Part, quantità obiettivo, pezzi buoni, scarto, tempo. Per l’Owner anche costo e margine, se esistono. Per il Production Manager quelle due colonne non ci sono.
- **Azioni.** Apre il dettaglio. Crea un ordine. Filtra per fase e per Part.
- **Visibilità.** Owner e Production Manager. Quality Manager entra dagli ordini in produzione attraverso Quality View, non da questa lista economica. Operator non la vede: cambia ordine dalla propria casa.
- **Gerarchia.** Fase e Part identificano la riga. I numeri di produzione vengono dopo. Costo e margine, solo per l’Owner, chiudono la riga.

### Production Order Detail

- **Scopo.** È il centro visivo del prodotto. Contiene il ciclo, i due dataset e i fatti dell’ordine.
- **Utente.** Tutti i ruoli, con sezioni diverse.
- **Informazioni.** Identità, Part, fase, quantità. Sezioni: stima, reale, confronto, eventi, piano e misure, allegati e note, certificazioni.
- **Azioni.** Dipendono da fase e ruolo. Owner e Production Manager: compilano la stima in bozza, avviano, annullano, annullano l’avvio, completano, riaprono, correggono la quantità in produzione. Owner, in produzione, registra anche i fatti di reparto. Operator registra solo i fatti di reparto e solo in produzione. Quality Manager registra misure e certificazioni solo in produzione. Documenti, note e certificazioni si aggiungono anche a ordine completato, da chi già può scriverli.
- **Visibilità.** Il confronto di produzione è di Owner e Production Manager. Costi, margine e allarme margine solo Owner. Piano, misure, Cp e Cpk solo Owner e Quality Manager; l’Operator vede soltanto il controllo richiesto ora, nella propria casa, e registra la misura senza vedere gli indici. Certificazioni: Owner e Quality Manager.
- **Gerarchia.** Fase, Part e quantità stanno in testa. Per l’Owner il confronto viene subito dopo. Per l’Operator questa schermata non è la casa: se la raggiunge, vede solo il blocco operativo, con il controllo dovuto prima degli altri fatti.

### Production Order Creation

- **Scopo.** Aprire una bozza.
- **Utente.** Owner e Production Manager.
- **Informazioni.** Part e quantità obiettivo, obbligatori. Poi, se già noti: tempo per pezzo, scarto atteso, macchina, consumi, altri costi, valore concordato. Il tempo per pezzo non blocca la creazione: blocca l’avvio, che resta un gesto del dettaglio.
- **Azioni.** Crea la bozza. Non avvia la produzione su questa schermata.
- **Visibilità.** Owner e Production Manager. Gli altri ruoli non la aprono.
- **Gerarchia.** Part e quantità sono i campi forti. La stima è il passo successivo, chiaramente facoltativo tranne il tempo per pezzo quando si vorrà avviare.

### Part Management

- **Scopo.** Tenere i nomi dei manufatti usati dagli ordini.
- **Utente.** Owner e Production Manager.
- **Informazioni.** Nome della Part e se è attiva o ritirata. Nessuna giacenza, distinta o listino.
- **Azioni.** Crea. Ritira se un ordine l’ha già citata. Nasconde se nessun ordine l’ha citata.
- **Visibilità.** Owner e Production Manager. Operator e Quality Manager vedono il nome solo dentro l’ordine o la vista qualità.
- **Gerarchia.** Il nome è la riga. Lo stato attivo o ritirato è secondario.

### Machine Management

- **Scopo.** Tenere le macchine e la tariffa oraria.
- **Utente.** Owner e Production Manager.
- **Informazioni.** Nome, tariffa oraria, attiva o ritirata.
- **Azioni.** Crea, aggiorna la tariffa finché non è congelata dentro una stima già avviata, ritira o nasconde con la stessa regola della Part.
- **Visibilità.** Come Part Management. La tariffa è visibile a chi stima. L’Operator non vede la tariffa.
- **Gerarchia.** Nome, poi tariffa.

### Tool Management

- **Scopo.** Tenere gli utensili e l’unità di consumo.
- **Utente.** Owner e Production Manager.
- **Informazioni.** Nome, unità, attivo o ritirato. Nessuna giacenza.
- **Azioni.** Crea, ritira o nasconde.
- **Visibilità.** Come Part Management. In reparto l’Operator sceglie l’utensile nel cambio, senza questa schermata.
- **Gerarchia.** Nome, poi unità.

### Material Management

- **Scopo.** Tenere i materiali e l’unità di consumo.
- **Utente.** Owner e Production Manager.
- **Informazioni.** Nome, unità, attivo o ritirato. Nessuna giacenza.
- **Azioni.** Crea, ritira o nasconde.
- **Visibilità.** Come Tool Management.
- **Gerarchia.** Nome, poi unità.

### Quality View

- **Scopo.** Leggere misure, Cp e Cpk degli ordini.
- **Utente.** Quality Manager, come casa. Anche l’Owner.
- **Informazioni.** Ordini in produzione e completati, Part, esito delle misure rispetto ai limiti, Cp e Cpk solo quando il calcolo è possibile. Nessun costo, margine o trend economico.
- **Azioni.** Apre la sezione qualità del dettaglio. Il Quality Manager registra misure solo se l’ordine è in produzione.
- **Visibilità.** Owner e Quality Manager. Production Manager e Operator non la aprono.
- **Gerarchia.** Le misure fuori limite stanno sopra. Cp e Cpk, quando comparono, stanno sotto la misura che li ha generati. Gli ordini senza scostamento qualità restano in fondo.

### Certification View

- **Scopo.** Vedere le certificazioni prodotte dagli ordini.
- **Utente.** Quality Manager e Owner.
- **Informazioni.** Certificazione, ordine, Part, fase dell’ordine. Non è un registro aziendale indipendente: ogni riga appartiene a un ordine.
- **Azioni.** Apre l’ordine. Aggiunge una certificazione se il ruolo può farlo: in produzione, e anche a ordine completato.
- **Visibilità.** Owner e Quality Manager.
- **Gerarchia.** L’ordine e la Part identificano la riga. Il documento è il contenuto, non un cruscotto.

### User Management

- **Scopo.** Invitare le persone e assegnare i quattro ruoli.
- **Utente.** Owner.
- **Informazioni.** Persone della Company, ruoli, inviti aperti. Si vede che deve restare almeno un Owner.
- **Azioni.** Invita, assegna o toglie ruoli, revoca un invito, revoca un User. Non può togliere o degradare l’ultimo Owner.
- **Visibilità.** Solo Owner.
- **Gerarchia.** Le persone attive stanno sopra. Gli inviti aperti sotto. Il vincolo dell’ultimo Owner è visibile prima del gesto pericoloso.

### Audit View

- **Scopo.** Leggere i fatti di piattaforma già previsti: accessi, ciclo, congelamento della stima, correzioni in riapertura, ritiro risorse.
- **Utente.** Owner.
- **Informazioni.** Chi, quando, quale oggetto. Nessun segnale del Copilot, nessun margine ricalcolato, nessun token.
- **Azioni.** Consulta e filtra. Non modifica l’audit e non modifica gli ordini da qui.
- **Visibilità.** Solo Owner.
- **Gerarchia.** I passaggi di ciclo e le correzioni del reale stanno sopra i cambi di ruolo.

---

## 2. Navigation Model

Dopo l’accesso la casa dipende dal ruolo.

| Ruolo | Casa | Può raggiungere |
|---|---|---|
| Owner | Owner Dashboard | Lista ordini, dettaglio, creazione, quattro risorse, qualità, certificazioni, utenti, audit, e la casa operatore quando lavora in reparto |
| Production Manager | Production Order List | Dettaglio, creazione, quattro risorse |
| Quality Manager | Quality View | Certification View e la sezione qualità o certificazioni del dettaglio |
| Operator | Operator Dashboard | Solo il cambio dell’ordine attivo, tra ordini in produzione |

Login e Initial Onboarding stanno fuori dalla navigazione di lavoro. L’onboarding non resta in menu.

Il Production Manager non ha una casa propria oltre la lista: il blueprint non aggiunge schermate. Quality Manager e Operator non vedono le voci che il loro ruolo non può aprire.

---

## 3. Screen Hierarchy

1. Login e, una sola volta, Initial Onboarding.
2. Casa del ruolo: Owner Dashboard, Production Order List, Quality View o Operator Dashboard.
3. Production Order Detail, centro del lavoro.
4. Production Order Creation, solo come ingresso alla bozza.
5. Part, Machine, Tool e Material Management, sullo stesso piano, dietro la casa di chi stima.
6. Certification View, accanto a Quality View.
7. User Management e Audit View, in fondo, solo per l’Owner.

---

## 4. Dashboard Hierarchy

**Owner Dashboard**, dall’alto: margine degli ordini in produzione; scostamento di costo e di tempo; produzione (pezzi, scarto, fermi); qualità (misure fuori limite); segnali e trend. Un numero deve bastare a capire se l’ordine sta rendendo.

**Operator Dashboard**, dall’alto: ordine attivo e disegno; controllo richiesto ora; contatore; azioni di scarto, utensile, materiale, pausa e fermo; cambio ordine, ultimo.

Non esiste una dashboard per Production Manager o Quality Manager. La lista ordini e la vista qualità sono le loro case, con la stessa disciplina: prima l’eccezione, poi il resto.

---

## 5. Information Architecture

Il menu di chi guida l’azienda è: lavoro, risorse, qualità, amministrazione.

- **Lavoro:** casa, ordini, creazione, dettaglio. Dentro il dettaglio: identità, stima, reale, confronto, eventi, qualità, documenti.
- **Risorse:** Part, Machine, Tool, Material. Solo anagrafiche sottili.
- **Qualità:** Quality View e Certification View. Le misure nascono dal piano dell’ordine.
- **Amministrazione:** User Management e Audit View.

L’Operator non vede questo menu. Vede un solo ordine e le azioni di reparto.

I nomi di fase che la persona legge sono Bozza, In produzione, Completato, Annullato. Non compaiono i nomi tecnici degli oggetti.

---

## 6. Visibility Rules

| Informazione o gesto | Owner | Production Manager | Quality Manager | Operator |
|---|---|---|---|---|
| Margine, costi, trend, allarme margine | Sì | No | No | No |
| Confronto di tempo, pezzi, scarto, fermi | Sì | Sì | No | No |
| Stima, avvio, chiusura, riapertura, annullo | Sì | Sì | No | No |
| Misure, Cp, Cpk, certificazioni | Sì | No | Sì | No. L’Operator registra solo la misura del controllo dovuto, senza indici e senza certificazioni |
| Fatti di reparto | Sì | No | No | Sì |
| Risorse | Sì | Sì | No | No |
| Utenti e audit | Sì | No | No | No |
| Casa operatore | Sì | No | No | Sì |

Cp e Cpk compaiono da 5 misure valide. Sotto quella soglia la vista qualità mostra solo le misure. La confidenza mostrata è bassa da 5 a 9, media da 10 a 19, buona da 20 a 29, alta da 30.

Il confronto economico non viene inviato in una risposta destinata all’Operator o al Quality Manager, anche se la schermata è la stessa.

---

## 7. Open Questions

Nessuna. Cp e Cpk seguono la regola di capability del Domain Freeze.
