# Regola ID prompt anti-doppio

Data: 2026-05-17  
Chat: RAGIONAMENTO  
Titolo breve: `ID prompt anti-doppio`

## Obiettivo

Evitare che lo stesso prompt operativo venga incollato due volte consecutive nella stessa chat e produca doppio lavoro, doppie modifiche, doppi mockup, doppie verifiche o doppie promozioni.

La regola vale per tutte le chat del progetto:

- RAGIONAMENTO;
- MOCK-UP;
- SVILUPPO TEST Admin;
- SVILUPPO TEST Assistente Partite;
- Promuovi PROD Admin;
- Promuovi PROD Assistente Partite.

## Regola fondamentale

Ogni prompt operativo copiabile deve contenere in testa un identificativo univoco.

Formato consigliato:

```text
ID PROMPT: [CHAT]-[AAAA-MM-GG]-[NNN]
```

Esempi:

```text
ID PROMPT: MOCKUP-2026-05-17-001
ID PROMPT: TEST-ADMIN-2026-05-17-001
ID PROMPT: PROD-ADMIN-2026-05-17-001
ID PROMPT: TEST-ASSISTENTE-2026-05-17-001
ID PROMPT: PROD-ASSISTENTE-2026-05-17-001
```

Subito sotto l'ID deve comparire la regola anti-doppio:

```text
REGOLA ANTI-DOPPIO:
Se questo ID PROMPT e' gia stato eseguito in questa chat, non rieseguire il prompt, non modificare file, non creare nuovi output e rispondi solo:
"Prompt gia ricevuto: nessuna azione eseguita."
```

## Quando usarla

L'ID PROMPT e la regola anti-doppio devono essere presenti in ogni prompt operativo destinato a:

- creare o aggiornare un mock-up;
- preparare un prompt per SVILUPPO TEST;
- integrare modifiche in TEST;
- preparare un handoff;
- leggere un handoff;
- fare preflight PROD;
- promuovere in PROD;
- eseguire rollback;
- aggiornare documenti condivisi;
- lavorare su Supabase, SQL, Edge Function, scheduler, Matchpoint, import/export o dati reali.

Non serve per risposte puramente discorsive o domande di ragionamento senza azione operativa.

## Regola per la chat che riceve il prompt

La chat destinataria deve verificare l'ID PROMPT prima di iniziare.

Se lo stesso ID e' gia presente nella conversazione e risulta gia lavorato, la chat deve fermarsi e rispondere:

```text
Prompt gia ricevuto: nessuna azione eseguita.
```

Non deve:

- modificare file;
- creare nuovi mock-up;
- fare deploy;
- leggere o riscrivere handoff;
- aggiornare documenti;
- rilanciare test;
- rieseguire preflight.

Se lo stesso ID e' presente ma la lavorazione precedente era stata interrotta o fallita, la chat deve dichiararlo e chiedere conferma prima di riprendere.

## Regola per la chat che prepara il prompt

La chat che prepara il prompt deve:

1. assegnare un ID nuovo;
2. non riusare ID vecchi;
3. inserire la regola anti-doppio in testa al prompt;
4. indicare la chat destinataria;
5. mantenere lo stesso ID anche se il prompt viene salvato in un file handoff locale;
6. se deve correggere un prompt prima dell'invio, generare un nuovo ID solo quando sostituisce formalmente il prompt precedente.

## Handoff locali

I file handoff locali devono contenere lo stesso ID PROMPT del passaggio operativo.

Esempio:

```text
ID PROMPT: TEST-ADMIN-2026-05-17-002
DESTINATARIO: SVILUPPO TEST Admin
REGOLA ANTI-DOPPIO:
Se questo ID PROMPT e' gia stato eseguito in questa chat, non rieseguire il prompt, non modificare file, non creare nuovi output e rispondi solo:
"Prompt gia ricevuto: nessuna azione eseguita."
```

Il nome fisso del file handoff resta invariato, per esempio `sviluppo-test-admin.md`, ma l'ID PROMPT interno deve cambiare a ogni nuova consegna.

## Regole per i comandi brevi

I comandi brevi restano validi:

- `APPROVO CATENA`;
- `LEGGI HANDOFF TEST`;
- `LEGGI HANDOFF PROD`;
- `PROMUOVI PROD`;
- `ROLLBACK PROD`.

Quando questi comandi leggono o attivano un prompt/handoff, la chat deve comunque applicare la regola anti-doppio sull'ID PROMPT contenuto nel testo operativo.

## Dove richiamarla

Questa regola deve essere richiamata nei prompt prodotti per:

- chat MOCK-UP;
- chat SVILUPPO TEST;
- chat Promuovi PROD;
- chat Assistente Partite TEST/PROD;
- file handoff locali.

Quando RAGIONAMENTO prepara un prompt copiabile, deve ricordare di includere ID PROMPT e REGOLA ANTI-DOPPIO.

Quando MOCK-UP prepara il prompt definitivo per SVILUPPO TEST, deve includere ID PROMPT e REGOLA ANTI-DOPPIO.

Quando SVILUPPO TEST prepara il passaggio a Promuovi PROD, deve includere ID PROMPT e REGOLA ANTI-DOPPIO.

## Documenti collegati

- `docs/stato-progetto-corrente.md`
- `docs/regola-prompt-mockup-definitivi.md`
- `docs/prompt-definitivi-sviluppo-test.md`
- `docs/procedura-catena-mockup-sviluppo-prod.md`
- `docs/pmo-policy-test-prod-routine-deploy.md`
- documento specifico della sezione coinvolta
