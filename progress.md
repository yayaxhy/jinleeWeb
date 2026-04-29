Original prompt: 整体切像素风，重新做一套完整视觉语言

- 2026-03-25: Audit completed. `/farm` currently uses painterly background assets with non-pixel UI chrome.
- 2026-03-25: Pixel-art roadmap is tracked in `C:\Users\james\Documents\GitHub\Bot\docs\farm-game-roadmap.md`.
- 2026-03-25: First implementation pass started on scene shell and UI chrome:
  - `MetricChip`, `TopStripButton`, `ToolButton`, and `OverlayDrawer` shifted from rounded glossy cards to blockier pixel-game styling.
  - Main scene frame, left HUD card, top icon strip, visitor banner, return button, seed tray, and bottom dock were restyled toward a pixel UI system.
- 2026-03-25: Type issues from JS field-geometry imports were normalized with explicit `unknown as` casts in `FarmClient.tsx`.

TODOs for next pass:
- Replace current painterly `manor-base` with a true pixel-art scene asset.
- Rebuild the field presentation as pixel-art tiles/patches while keeping the current 4-corner geometry and 16-cell logic.
- Re-skin dialogs, log/exchange panels, and bottom dock actions to match the new pixel-art shell.
- Rework crop visuals last, after the field tile system is stable.
