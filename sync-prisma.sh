#!/usr/bin/env bash
# Sync the prisma folder from 3y (canonical) into the sibling jinlee-club/prisma.
# Flags:
#   --mirror    : delete files on target that are not in source.
#   --dry-run   : show what would change.
#   --source <dir> --target <dir> : override defaults.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="${SOURCE:-"$SCRIPT_DIR/prisma"}"
TARGET="${TARGET:-"$SCRIPT_DIR/jinlee-club/prisma"}"
MIRROR=false
DRYRUN=false

usage() {
  echo "Usage: $0 [--mirror] [--dry-run] [--source DIR] [--target DIR]" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mirror) MIRROR=true; shift ;;
    --dry-run|--dryrun) DRYRUN=true; shift ;;
    --source) SOURCE="$2"; shift 2 ;;
    --target) TARGET="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown arg: $1" >&2; usage ;;
  esac
done

if [[ ! -d "$SOURCE" ]]; then
  echo "Source prisma folder not found: $SOURCE" >&2
  exit 1
fi

mkdir -p "$TARGET"

echo "Syncing prisma from '$SOURCE' to '$TARGET' (mirror=$MIRROR, dry-run=$DRYRUN)..."

if command -v rsync >/dev/null 2>&1; then
  RSYNC_OPTS=(-avh --exclude '.git')
  $MIRROR && RSYNC_OPTS+=(--delete)
  $DRYRUN && RSYNC_OPTS+=(-n --itemize-changes)
  rsync "${RSYNC_OPTS[@]}" "$SOURCE"/ "$TARGET"/
else
  # Fallback to robocopy (available on Windows). robocopy considers codes 0-7 as success.
  ROBO_ARGS=(
    "$SOURCE" "$TARGET"
    /E
    /R:1 /W:1
    /Z
    /FFT
    /XJ
    /XD .git
  )
  $MIRROR && ROBO_ARGS+=(/MIR)
  $DRYRUN && ROBO_ARGS+=(/L)
  robocopy "${ROBO_ARGS[@]}" | cat
  CODE=$?
  if [[ $CODE -ge 8 ]]; then
    echo "robocopy failed with exit code $CODE" >&2
    exit $CODE
  fi
fi

echo "Done."
