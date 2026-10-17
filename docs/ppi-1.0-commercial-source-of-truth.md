# Fonte commerciale

Questo documento fissa quale cifra comanda. Non cambia le formule del cruscotto.

## Valore prenotato

Il valore prenotato di un'azienda è `annualRevenue` salvato.

Si aggiorna solo quando un salvataggio anagrafica cambia il listino mensile o lo sconto annuo. In quel caso diventa il netto calcolato: lordo annuo meno lo sconto. Se listino e sconto non cambiano, il valore salvato resta quello già letto dal cruscotto.

Il netto mostrato in scheda contratto è un preventivo finché quel salvataggio non avviene.

## Chi usa quale cifra

| Uso | Cifra |
|---|---|
| Classifiche | Ricavo annuo salvato |
| Crescita e ricavo per piano | Ricavo annuo salvato |
| Totale executive | Ricavo annuo salvato |
| MRR di un contratto mensile | Listino mensile, se è maggiore di zero |
| MRR di un contratto annuale | Ricavo annuo salvato diviso 12, se è maggiore di zero |
| ARR | Dodici volte il MRR così ottenuto |
| Rinnovo | Data di rinnovo, non l'importo |

## Non è cassa

Queste cifre sono il valore contrattuale dichiarato. Non sono incassi registrati.

L'azione di salvataggio contratto può ancora scrivere il ricavo annuo, ma la pagina piattaforma non la chiama.
