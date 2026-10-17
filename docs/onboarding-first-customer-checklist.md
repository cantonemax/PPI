# Primo cliente pagante

Il cliente è creato dalla console piattaforma. Non c’è iscrizione autonoma.

## Prima di aprire l’azienda

- [ ] Il database di lavoro ha un dump recente, fuori dal repository.
- [ ] L’azienda reale non ha la nota `TEST DATA` né `QA_DATASET_2026`.
- [ ] L’inizializzazione dei dataset di prova non viene lanciata su un’azienda già esistente senza quel marchio.
- [ ] `MRC PROJECT SRL`, se è l’azienda reale, non viene riscritta dallo seed di prova.

## Anagrafica e contratto

- [ ] Piano assegnato.
- [ ] Listino mensile e sconto annuo salvati dall’anagrafica se devono aggiornare il valore prenotato.
- [ ] Il valore che comanda è il ricavo annuo salvato. Il netto in scheda contratto resta un preventivo finché quel salvataggio non avviene.
- [ ] MRR, ARR, classifiche, crescita e totale executive usano quel valore. Non sono cassa.
- [ ] La data di rinnovo è una data, non un importo.

## Dopo l’apertura

- [ ] Accesso del cliente sul tenant, distinto dal login piattaforma.
- [ ] I dati di prova restano visibili in elenco, ma non entrano nei KPI.
- [ ] La pulizia dei dataset di prova è riservata al super admin e non si usa sul cliente reale.
- [ ] Una chiusura usa la cancellazione logica. Nessuna cancellazione definitiva dell’azienda reale.
