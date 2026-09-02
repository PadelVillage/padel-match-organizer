-- VOCE 84 ⓑ — «IN MANO ALLA SEGRETERIA» SU SCHEDE CHE IN MANO A NESSUNO SONO MAI STATE.
--
-- 📏 MISURATO su PROD il 02/09/2026, facendo girare `assessment-apply-level` in **simulazione**
-- (nessuna scrittura) e leggendo i motivi che dà lei, invece di ricostruirli:
--
--     esaminate 63 · applicate 0 · saltate 19
--
-- e la causa più numerosa è **una sola**: `in mano alla segreteria (review)`, **9 soci**, fermi
-- da 5 a **125 giorni** — Lidia Comes, Fabiola Limuti e Laura Aprea dal 27 agosto; Alessandra
-- Macchitella, Alberto Chiesurin e Adriano Dalle Crode dal 25 maggio.
--
-- 🎯 E IL DIFETTO NON È CHE NON SI APPLICANO. Per un quiz non superato **non applicare è
-- giusto**, ed è la protezione che il progetto ha voluto: *senza conoscenza dimostrata la
-- scheda non si applica da sola*. Il difetto è che quelle schede stanno in uno stato che si
-- chiama «in mano alla segreteria» **e in mano a nessuno ci sono mai state**.
--
-- ⚖️ `review` SIGNIFICA DUE COSE, ed è la malattia che questo progetto conosce a memoria — la
-- voce 71, la 83, la 68:
--   · *una PERSONA ha deciso di guardarla* — `pending`, `pending_attention`, e il `review` che
--     scrive l'app quando la segreteria segna «da controllare»;
--   · *la MACCHINA non se la prende* — quiz non superato, sesso mancante, le due bandiere,
--     coerenza bassa, dati tecnici insufficienti.
--
-- 🔨 LA CURA È QUELLA DI SEMPRE IN QUESTA CASA: **non si rinomina `review`**, si fa uscire il
-- **perché accanto al dato**. La decisione resta identica riga per riga; cambia solo che
-- adesso si sa quale delle due è.
--
-- 🚨 E RINOMINARLO SAREBBE STATO IL DIFETTO, misurato prima di scegliere: **sei** punti fra
-- `index.html`, le edge e una funzione SQL confrontano quel valore **per uguaglianza** —
-- `staff === 'review'`, `statoStaff !== 'review'`, `in ('da_controllare','review','attention')`.
-- Un valore nuovo li avrebbe attraversati tutti **in silenzio**, fra cui il ramo del **gradino**,
-- che `review` lo apre apposta e che avrebbe smesso di far scendere chi lo chiede.
-- 📌 *Una parola che significa due cose non si spacca: le si mette accanto quale delle due.*
--
-- ⚠️ LE RIGHE DI PRIMA RESTANO A NULL, e va letto per quello che è: **non misurato**, non «l'ha
-- messa lì una persona». Riempirle a posteriori vorrebbe dire inventare un fatto che nessuno ha
-- osservato — è la stessa scelta della voce 68 con `esito`, e per la stessa ragione. Le nove
-- schede ferme si spiegano leggendo il loro `raw_response`, che il motivo ce l'ha dentro.
--
-- 🚨 SI APPLICA A PROD **E** A TEST, e non è una gentilezza: `assessment-quiz` compone la riga
-- come **intersezione dei due schemi** (lo dice un commento suo, nato dalla colonna `email` che
-- c'è di qua e non di là). Una colonna che esiste su un progetto solo farebbe fallire la
-- scrittura sull'altro — cioè perderebbe la scheda di un socio, non un dato di contorno.
--
-- ⛔ Nessun indice: la colonna si legge guardando una scheda o contando le nove, non in un giro
-- caldo.
--
-- Idempotente: si può rieseguire.

ALTER TABLE public.self_assessments
  ADD COLUMN IF NOT EXISTS review_reason text;

COMMENT ON COLUMN public.self_assessments.review_reason IS
  'Perché la MACCHINA ha mandato questa scheda in «review»: genere_mancante | quiz_non_superato | '
  'poca_esperienza | poca_frequenza | coerenza_bassa | dati_insufficienti. '
  'NULL = non misurato — o la scheda è precedente al 02/09/2026, o in «review» ce l''ha messa una '
  'PERSONA dalla segreteria. Le due cose non si distinguono a posteriori, e non si indovinano. '
  'L''invariante è provato dal banco (motivo-review.test.ts): c''è un motivo se e solo se '
  'staff_status vale «review». La frase da mostrare sta in motivo-review.ts, non in chi la mostra.';
