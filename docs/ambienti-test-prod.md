# Ambienti TEST e PROD

## URL

- PROD: https://padelvillage.github.io/padel-match-organizer/
- TEST: https://padelvillage.github.io/padel-match-organizer/?env=test

## Supabase

- PROD usa `config.js`.
- TEST usa `config-test.js`.
- TEST deve puntare a un progetto Supabase separato, senza dati sensibili reali.

## Procedura consigliata

1. Sviluppare e provare in locale.
2. Pubblicare o aprire la versione TEST con `?env=test`.
3. Verificare login, routine, permessi, sync e form pubblici.
4. Solo dopo pubblicare o usare la versione PROD.

## Configurazione Auth Supabase TEST

Nel progetto Supabase TEST:

- Site URL: `https://padelvillage.github.io/padel-match-organizer/?env=test`
- Redirect URLs: `https://padelvillage.github.io/padel-match-organizer/*`

## Nota dati

La web app separa localStorage, sessioni staff, snapshot e backup tra TEST e PROD.
Un backup creato in TEST viene marcato come `environment: "test"`.
