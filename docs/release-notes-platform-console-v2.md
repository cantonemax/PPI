# Platform Console V2

Sprint 0. Primo cliente pagante amministrato da MRC. Nessuna iscrizione autonoma.

## Console

- Moduli e flussi della console piattaforma.
- Profilo cliente, catalogo piani e gestione contratto.
- Cruscotto incassi, classifiche, crescita e totale executive.

## Database e sicurezza

- Schema e storico migration allineati.
- Credenziali rimosse dalle migration.
- Il processo rifiuta un ruolo database privilegiato.
- Rimosso il super admin implicito quando il ruolo di sessione manca.
- La pulizia dei dataset di prova è solo del super admin.

## Governance

- Il ricavo annuo salvato è la cifra commerciale. Non è cassa.
- `TEST DATA` e `QA_DATASET_2026` non entrano nei KPI.
- Un salvataggio anagrafica non cancella quei marchi.
- Lo seed aggiorna solo un’azienda che ha già lo stesso marchio. Un omonimo reale, incluso MRC PROJECT SRL, resta intatto.

## Validazione

- Build verde.
- Backup e restore verificati su una copia.
- Isolamento tenant esteso a FeatureSpc, macchine, materiali e tempi macchina.
- 179 test verdi.
