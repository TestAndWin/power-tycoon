#!/usr/bin/env bash
# Builds Wattmogul from src/ into game/ (single self-contained HTML file).
# Do not edit game/index.html directly; change the sources in src/ and run this script.
set -e
cd "$(dirname "$0")"
SRC=src
OUT=game
HEAD='<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Wattmogul</title><meta name="description" content="Wattmogul: Browser-Strategiespiel über die Energiewende 2026 bis 2035."><meta name="robots" content="noindex"><style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'
mkdir -p "$OUT"
{
  echo "$HEAD"
  cat "$SRC/fonts.css" "$SRC/head.html"   # raw, in this order
  echo '<script>'
  cat "$SRC/core.js" "$SRC/scene.js" "$SRC/sound.js" "$SRC/mini.js" "$SRC/ui.js"
  echo '</script>'
  echo '</body></html>'
} > "$OUT/index.html"
chmod 644 "$OUT/index.html"
echo "built: power-tycoon/$OUT/index.html"
