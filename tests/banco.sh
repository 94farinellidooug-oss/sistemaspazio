#!/usr/bin/env bash
# Testa supabase/*.sql num Postgres local descartável (imitando o Supabase com tests/sql/supabase-simulado.sql).
# Uso: PGHOST=/tmp PGPORT=5499 PGUSER=postgres bash tests/banco.sh   (precisa de um Postgres rodando)
set -euo pipefail
cd "$(dirname "$0")/.."
BANCO="musubi_teste_$$"
createdb "$BANCO"
trap 'dropdb --if-exists "$BANCO"' EXIT
export PGOPTIONS="-c client_min_messages=warning"
P="psql -X -q -t -v ON_ERROR_STOP=1 -d $BANCO"
$P -f tests/sql/supabase-simulado.sql
for f in supabase/*.sql; do $P -f "$f"; $P -f "$f"; done   # duas vezes: rodar de novo não pode quebrar
PGOPTIONS='-c client_min_messages=notice' $P -f tests/sql/regras.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //;s/^NOTICE:  //' | grep -v '^\s*$'
