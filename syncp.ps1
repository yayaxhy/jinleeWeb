$SOURCE = "A:\Personal Project\jinlee-club\prisma"
$TARGET = "A:\Personal Project\3y\prisma"
$SCHEMA = Join-Path $TARGET "schema.prisma"

New-Item -ItemType Directory -Path $TARGET -Force | Out-Null
robocopy $SOURCE $TARGET /E /R:1 /W:1 /Z /FFT /XJ /XD .git

if (Test-Path $SCHEMA) {
  Push-Location (Split-Path $SCHEMA -Parent)
  try {
    Write-Output "Running prisma generate using schema: $SCHEMA"
    npx prisma generate --schema="$SCHEMA"
  } finally {
    Pop-Location
  }
} else {
  Write-Warning "Schema not found at $SCHEMA; skipped prisma generate."
}
