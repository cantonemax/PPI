# Go-live tecnico

Controlli già chiusi nello Sprint 0, da ripetere sull’ambiente di destinazione.

## Database

- [ ] Le migration applicate coincidono con i file nel repository, inclusa la migration del ruolo applicativo.
- [ ] In quella migration non c’è una password.
- [ ] `DIRECT_URL` è il ruolo proprietario, usato solo per le migration.
- [ ] `DATABASE_URL` è `ppi_app`: login, senza superuser e senza bypass delle policy.
- [ ] All’avvio il processo rifiuta un ruolo con superuser o bypass.
- [ ] Nessun `migrate reset` sul database del cliente.

## Accesso

- [ ] Il cookie piattaforma senza ruolo non entra. Non esiste un super admin implicito.
- [ ] La pulizia di `TEST DATA` e di `QA_DATASET_2026` richiede il super admin.
- [ ] `.env` non è nel repository. L’esempio contiene solo segnaposto.

## Verifica

- [ ] `npm test` verde. Riferimento dello Sprint 0: 179 test.
- [ ] `npm run build` verde.
- [ ] Dump custom verificato e restore provato su un database copia, non su `ppi`.
- [ ] Il test di isolamento copre anche FeatureSpc, macchine, materiali e tempi macchina.
