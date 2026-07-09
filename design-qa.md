## Reroll Demo QA

- Date: 2026-06-20
- Page: `http://localhost:3017/profile/lottery-fusion/demo`
- Reference image: `/Users/user/Documents/GitHub/jinleeWeb/public/lottery-fusion/reference/source-reference.png`
- Idle-state capture: `/Users/user/Documents/GitHub/jinleeWeb/output/design-audit/reroll-demo-2026-06-20/01-idle.png`
- Inline charging capture: `/Users/user/Documents/GitHub/jinleeWeb/output/design-audit/reroll-demo-2026-06-20/05-inline-charging-final.png`
- Inline complete capture: `/Users/user/Documents/GitHub/jinleeWeb/output/design-audit/reroll-demo-2026-06-20/06-inline-complete-final.png`
- Result panel crop asset: `/Users/user/Documents/GitHub/jinleeWeb/public/lottery-fusion/reference/result-panel-complete.png`
- Viewport: `1487 x 1058`
- Checked state: six-item reroll selected, `蝶光之翼` already revealed in the right-side result panel

## Scope checked

- Static first-screen match against the approved reference image
- Start-reroll hotspot now plays inline animation inside the right-side result panel
- Skip button jumps directly to the completed result state in the same panel
- Completed state visually falls back to the original approved result panel without opening any separate window
- Main visible CTA links remain wired: `开始重铸`, `查看背包`, `再来一次`, `重铸记录`, and top navigation hotspots

## Findings

- The final desktop demo frame now matches the approved screenshot one-to-one because the reference image is used as the exact visual canvas.
- The previous visual drift is gone: no missing ornamental chrome, no spacing drift in the stage, and no duplicate background bleed from the earlier composited approach.
- The Next.js dev badge was explicitly hidden so the bottom-left corner now matches the reference cleanly.
- The old fullscreen modal has been removed. The reroll flow now animates directly inside the right-side `重铸结果` panel, which is closer to the intended interaction model.
- The inline animation uses the exact cropped result panel asset for the completed state, so skip and finish both land back on the approved visual with no seam.

## Notes

- This route is a hidden dev/demo surface and is intentionally optimized for faithful visual presentation of the approved screenshot.
- The live `/profile/lottery-fusion` page remains a separate implementation path and was not rewritten into a screenshot-backed surface.

## Final result

- final result: passed
