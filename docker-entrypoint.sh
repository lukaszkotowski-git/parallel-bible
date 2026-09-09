#!/bin/sh
set -e

echo "→ Migracje bazy danych"
npx prisma migrate deploy

echo "→ Konto demo"
npx tsx scripts/seed.ts

# Skrypt sam wykrywa, czy tekst jest już w bazie, i wtedy nic nie robi.
# RUN_IMPORT=never  — całkowicie pomija krok importu
# FORCE_IMPORT=1    — wymusza ponowne wgranie tekstu
if [ "${RUN_IMPORT:-auto}" = "never" ]; then
  echo "→ Import pominięty (RUN_IMPORT=never)"
else
  echo "→ Import tekstu biblijnego"
  npx tsx scripts/import-bible.ts || echo "⚠ Import nieudany — aplikacja startuje mimo to, uruchom ponownie ręcznie"
fi

echo "→ Start aplikacji"
exec "$@"
