# Architettura PadelVillage — Principi guida

> Documento di riferimento stabile. Definisce i principi architetturali del progetto e la
> relazione con Matchpoint durante il periodo di transizione. Ogni decisione tecnica futura
> dovrebbe essere coerente con questi principi.

_Ultimo aggiornamento: 2026-06-02._

---

## 1. Visione: Matchpoint è transitorio

Matchpoint è il sistema gestionale attualmente in uso (prenotazioni, anagrafica soci, livelli).
**Verrà dismesso.** Esiste un **periodo di interregno** in cui Matchpoint convive con la web app
PadelVillage; al termine, Matchpoint sparirà e la web app resterà l'unico sistema.

Di conseguenza l'integrazione con Matchpoint **non** è un'integrazione paritaria e permanente tra
due sistemi: è un **ponte temporaneo** verso un sistema in uscita. Le scelte tecniche devono
puntare a coprire bene l'interregno, non a una sincronizzazione bidirezionale perfetta e duratura.

## 2. Fonte di verità: la web app PadelVillage (PROD)

La **fonte di verità ufficiale dei dati è la web app PadelVillage in produzione**, non Matchpoint —
nemmeno durante l'interregno. In caso di divergenza tra app e Matchpoint, **vince il dato dell'app**.

## 3. Direzione di propagazione utile: app → Matchpoint

Finché Matchpoint è operativo, ciò che nasce o cambia nell'app deve poter arrivare a Matchpoint:

- **Creazione socio** (app → Matchpoint): implementata. Alla creazione di un nuovo socio nell'app,
  un browser worker crea il cliente in Matchpoint, gli assegna il livello, e l'app **adotta** il
  Codice Matchpoint restituito.
- **Modifica / cancellazione socio** (app → Matchpoint): da valutare per coprire l'interregno
  (oggi NON implementata: le modifiche fatte nell'app restano nell'app).

## 4. Direzione Matchpoint → app: in esaurimento

L'import da Matchpoint verso l'app serve solo per l'**anagrafica storica e i codici**. È una
direzione **in esaurimento**, destinata a sparire con Matchpoint.

La regola di merge al reimport è **"l'app vince"** (in `mergeProtectedMember`, pattern
`existing || imported`): un dato già presente nell'app **non** viene sovrascritto da Matchpoint.
Questo comportamento è **voluto e coerente** con la visione (punto 2) e va mantenuto.

## 5. Il Codice Matchpoint è un identificatore-ponte, non l'identità primaria

Il Codice Matchpoint (campo `memberId`, formato numerico es. `001016`) serve a dialogare con
Matchpoint finché esiste. **Non è l'identità primaria del socio.** L'identità primaria è l'`id`
interno dell'app (i soci creati nell'app ricevono un id provvisorio `PMO-XXXXXX` prima di ottenere
il Codice Matchpoint).

Implicazione: il Codice Matchpoint deve restare un **attributo** del socio, mai la chiave primaria.
Quando Matchpoint sparirà, il Codice resterà solo come dato storico e l'app continuerà a funzionare
sull'identità interna.

## 6. Regola operativa per l'interregno

Per evitare divergenze tra le due fonti durante la convivenza:

- **Si opera nell'app**, non direttamente in Matchpoint.
- Si **evita** di modificare manualmente i dati in Matchpoint (le modifiche manuali in Matchpoint
  non risalgono all'app e creano disallineamento).
- L'app spinge verso Matchpoint nelle direzioni supportate; Matchpoint è trattato come backend
  operativo temporaneo, non come pannello di gestione.

---

## Conseguenze pratiche per lo sviluppo

- Non investire in una sincronizzazione complessa **Matchpoint → app**: basta l'import storico
  (one-shot o periodico) finché serve a riconciliare i dati esistenti.
- Concentrare lo sforzo sulla direzione **app → Matchpoint** (creazione fatta; modifica/cancellazione
  da valutare) per la durata dell'interregno.
- Alla dismissione di Matchpoint: si stacca il browser worker e si interrompe l'import; l'app resta
  in piedi autonomamente, con i Codici Matchpoint conservati come dato storico.
