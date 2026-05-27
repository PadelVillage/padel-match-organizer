#!/usr/bin/env bash
set -euo pipefail

# ── FASE 2 Setup — Parser Intelligente v1.1 ──────────────────────────────────
# Verifica variabili d'ambiente, applica la migration Supabase e
# controlla che l'Edge Function parser-rules-update sia disponibile.

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
YELLOW="\033[33m"
RESET="\033[0m"

ok()   { echo -e "  ${GREEN}✓${RESET} $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
fail() { echo -e "  ${RED}✗${RESET} $*"; exit 1; }
header() { echo -e "\n${BOLD}$*${RESET}"; }

# ── 1. Controlla variabili richieste ─────────────────────────────────────────
header "1/4  Controllo variabili d'ambiente"

: "${SUPABASE_PROJECT_ID:?Esporta SUPABASE_PROJECT_ID prima di eseguire questo script}"
: "${SUPABASE_API_KEY:?Esporta SUPABASE_API_KEY (service-role key) prima di eseguire questo script}"
: "${GITHUB_PERSONAL_TOKEN:?Esporta GITHUB_PERSONAL_TOKEN prima di eseguire questo script}"

ok "SUPABASE_PROJECT_ID = $SUPABASE_PROJECT_ID"
ok "SUPABASE_API_KEY    = ${SUPABASE_API_KEY:0:8}..."
ok "GITHUB_PERSONAL_TOKEN = ${GITHUB_PERSONAL_TOKEN:0:8}..."

SUPABASE_URL="https://${SUPABASE_PROJECT_ID}.supabase.co"

# ── 2. Verifica connessione Supabase ─────────────────────────────────────────
header "2/4  Verifica connessione Supabase"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "apikey: ${SUPABASE_API_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_API_KEY}" \
  "${SUPABASE_URL}/rest/v1/")

if [[ "$HTTP_STATUS" == "200" ]]; then
  ok "Connessione a ${SUPABASE_URL} OK"
else
  fail "Connessione Supabase fallita (HTTP $HTTP_STATUS). Controlla SUPABASE_PROJECT_ID e SUPABASE_API_KEY."
fi

# ── 3. Applica migration FASE 2 ───────────────────────────────────────────────
header "3/4  Applica migration pmo_parser_tables"

MIGRATION_FILE="supabase/migrations/20260527160000_pmo_parser_tables.sql"

if [[ ! -f "$MIGRATION_FILE" ]]; then
  fail "Migration non trovata: $MIGRATION_FILE"
fi

# Controlla se le tabelle esistono già
ERRORS_EXISTS=$(curl -s \
  -H "apikey: ${SUPABASE_API_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_API_KEY}" \
  "${SUPABASE_URL}/rest/v1/pmo_parser_errors?limit=0" \
  -o /dev/null -w "%{http_code}")

CONFIG_EXISTS=$(curl -s \
  -H "apikey: ${SUPABASE_API_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_API_KEY}" \
  "${SUPABASE_URL}/rest/v1/pmo_parser_config?limit=0" \
  -o /dev/null -w "%{http_code}")

if [[ "$ERRORS_EXISTS" == "200" && "$CONFIG_EXISTS" == "200" ]]; then
  ok "Tabelle pmo_parser_errors e pmo_parser_config già presenti — migration saltata"
else
  warn "Tabelle non trovate. Applica manualmente la migration su Supabase Dashboard:"
  echo "      ${SUPABASE_URL}/project/${SUPABASE_PROJECT_ID}/editor"
  echo "      File: ${MIGRATION_FILE}"
  warn "Oppure usa: supabase db push --project-ref ${SUPABASE_PROJECT_ID}"
fi

# ── 4. Verifica Edge Function parser-rules-update ────────────────────────────
header "4/4  Verifica Edge Function parser-rules-update"

EF_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X OPTIONS \
  "${SUPABASE_URL}/functions/v1/parser-rules-update")

if [[ "$EF_STATUS" == "204" || "$EF_STATUS" == "200" ]]; then
  ok "Edge Function parser-rules-update raggiungibile (HTTP $EF_STATUS)"
else
  warn "Edge Function parser-rules-update non risponde (HTTP $EF_STATUS)."
  warn "Deploya con: supabase functions deploy parser-rules-update --project-ref ${SUPABASE_PROJECT_ID}"
  warn "Poi imposta il secret: supabase secrets set GITHUB_PERSONAL_TOKEN=... --project-ref ${SUPABASE_PROJECT_ID}"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}✓ FASE 2 Setup completato!${RESET}"
echo ""
echo "  Prossimi passi:"
echo "    • Verifica Admin Panel → Amministrazione → Dati Matchpoint → Parser Config"
echo "    • Branch attivo: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'N/A')"
echo "    • Ultimo commit: $(git log --oneline -1 2>/dev/null || echo 'N/A')"
echo ""
