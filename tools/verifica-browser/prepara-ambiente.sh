#!/bin/bash
# Prepara un container nuovo alla console remota. Da incollare nel campo
# "Script di configurazione" dell'ambiente cloud: gira a ogni sessione, prima
# che Claude parta, e senza di lui il browser non raggiunge nessun sito.
#
# Il container è effimero: quello che si installa a mano dura una sessione sola.
#
# Chromium su Linux non guarda i certificati di sistema, guarda il proprio
# magazzino NSS, che nasce vuoto. Il proxy di uscita si mette in mezzo alle
# connessioni con una CA propria, quindi senza questo passaggio ogni pagina
# muore con ERR_CERT_AUTHORITY_INVALID.
#
# Non fallisce mai di proposito (|| true): se qualcosa qui si rompe, la sessione
# deve partire lo stesso e dirlo dopo, non restare bloccata all'avvio.

set -u

CA=/root/.ccr/agent-proxy-ca.crt
DB="sql:${HOME}/.pki/nssdb"

if [ ! -f "$CA" ]; then
  echo "[prepara-ambiente] nessuna CA del proxy in $CA: salto (ambiente senza proxy?)"
  exit 0
fi

command -v certutil >/dev/null 2>&1 || {
  apt-get update -qq >/dev/null 2>&1 || true
  apt-get install -y -qq libnss3-tools >/dev/null 2>&1 || true
}

command -v certutil >/dev/null 2>&1 || {
  echo "[prepara-ambiente] certutil non installabile: il browser non si fiderà del proxy"
  exit 0
}

mkdir -p "${HOME}/.pki/nssdb"
certutil -d "$DB" -L 2>/dev/null | grep -q ccr-agent-proxy-ca \
  && echo "[prepara-ambiente] CA del proxy già presente" \
  || { certutil -d "$DB" -A -t "C,," -n ccr-agent-proxy-ca -i "$CA" 2>/dev/null \
       && echo "[prepara-ambiente] CA del proxy importata nel magazzino del browser" \
       || echo "[prepara-ambiente] importazione CA non riuscita"; }

exit 0
