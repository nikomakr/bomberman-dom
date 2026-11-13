#!/usr/bin/env bash
# scripts/check.sh
# Scans every .js file in web/src/ for forbidden patterns.
# Uses only bash, find and grep, and works with the bash 3.2 that macOS ships.
# Exits 1 if anything is found, 0 otherwise.

# Run from the project root, wherever the script is called from.
self="${BASH_SOURCE[0]}"
script_dir="${self%/*}"
[[ "$script_dir" == "$self" ]] && script_dir="."
cd "$script_dir/.." || exit 1

SRC_DIR="web/src"

# Each entry is "label|extended regex".
PATTERNS=(
  'addEventListener|addEventListener'
  'innerHTML|innerHTML'
  '<canvas|<canvas'
  'getContext(|getContext\('
  '.style.left|\.style\.left'
  '.style.top|\.style\.top'
  # import ... from 'package-or-url'  (also covers the closing line of a multi-line import)
  "import from package/URL|\bfrom[[:space:]]*['\"][^./'\"]"
  # import 'package-or-url'  (side-effect import)
  "import from package/URL|^[[:space:]]*import[[:space:]]*['\"][^./'\"]"
  # import('package-or-url')  (dynamic import)
  "import from package/URL|\bimport[[:space:]]*\([[:space:]]*['\"][^./'\"]"
)

found=0

if [[ -d "$SRC_DIR" ]]; then
  # find walks every folder under web/src, so no file is skipped, however deep.
  while IFS= read -r file; do
    for entry in "${PATTERNS[@]}"; do
      label="${entry%%|*}"
      regex="${entry#*|}"
      while IFS=: read -r line _; do
        [[ -n "$line" ]] || continue
        echo "$file:$line: $label"
        found=1
      done < <(grep -n -E -e "$regex" -- "$file")
    done
  done < <(find "$SRC_DIR" -type f -name '*.js' | sort)
fi

if [[ "$found" -eq 1 ]]; then
  exit 1
fi

echo "check passed"
exit 0
