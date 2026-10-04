# Component sheet

The component sheet is deliverable 5 of the UX brief: every component, with every state. The design
has no renders of it (there is no `design/frames/5*.html`), so the data below is copied from the
Components table of `docs/ux/tendril-ux-doc.md` and from the Task 7 brief. The catalog pages
(`apps/mobile/src/catalog/componentSheet.tsx`) are built from it and are a visual self-check, not a
comparison against a design render.

Each page is a 393 x 852 catalog frame in the light scheme, at `/catalog/<id>`. It shows the
component name in Inter 600 20, its rule in Inter 400 15, and every state under a caption. A page
that cannot fit all its states in one frame continues on `<id>-2` (and `<id>-3`), headed
"(continued)".

| Id  | Component          | Used on                                           | States on the page                                                                                                                                      | Rule                                                                                                   |
| --- | ------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 5a  | Confidence label   | Result, Plant detail, Diagnosis                   | Very likely 94%, likely 71%, not sure 41%                                                                                                               | Word first, then the percentage; never a bare number.                                                  |
| 5b  | Pet check card     | Result, Plant detail, Species card, Label adoption | A very likely match (5b); a likely match, Easter lily with cats severe, with the match note (5b-2)                                                      | One row per household pet. Verdict chip, one plain line and the source on every row.                   |
| 5c  | Pet verdict chip   | Pet check card, plant cards                       | Unknown, No known toxicity, Mild, Moderate, Severe                                                                                                      | Icon, word and colour together, read as "Cats: Mild".                                                  |
| 5d  | Rarity badge       | New species, Plantdex, Species card               | Common, Uncommon, Rare, Legendary                                                                                                                       | Leaf count plus word; sensitive species never appear on public rarity boards.                          |
| 5e  | Plant card         | My Plants, Today                                  | Check due, overdue, all good, paused by a diagnosis ("1 of 2 dry checks"), dead, given away                                                             | Photo, nickname, species in italics, next check.                                                       |
| 5f  | Task row           | Today                                             | Due (with the Check in action), overdue, done                                                                                                           | Tap opens the check-in sheet; finishing a watering task gets no celebration.                           |
| 5g  | Check-in sheet     | Today, Plant detail                               | Unanswered (5g); answered No and answered Yes (5g-2); saved offline (5g-3)                                                                              | One question, two large answers, optional photo and leaf chips.                                        |
| 5h  | Quota meter        | Camera, Today, Limit reached                      | Free 7 of 10; Premium 52 of 60; one left (1 of 10); used up (0 of 10, resets 1 November); also the Today card and the camera pill                       | Reads "7 of 10 left this month"; the reset date shows on tap.                                          |
| 5i  | Streak counter     | Today, Streaks                                    | Active, last day to keep it, freeze used, winter mode (3 weeks), broken                                                                                 | Flame icon plus number in the streak colour; a broken streak turns grey, never red.                    |
| 5j  | League row         | League, Friends                                   | You, others, points pending                                                                                                                             | Your row in primary-tint; rank, handle, points.                                                        |
| 5k  | Plantdex tile      | Plantdex, Sets                                    | Found, missing, sensitive                                                                                                                               | Found shows photo, name and rarity; missing shows a silhouette and a question mark.                    |
| 5l  | Find marker        | Finds map                                         | Exact pin, shared area, hidden                                                                                                                          | Only the owner sees exact pins; anything shared shows an area at most.                                 |
| 5m  | Plan card          | Paywall                                           | Yearly selected, monthly unselected                                                                                                                     | The billed amount is the largest text; any tag such as "Best value" is smaller than the price.         |
| 5n  | Permission primer  | Before camera, location and notification prompts  | Camera (5n); location and notifications (5n-2)                                                                                                          | Says why and what Tendril never does, then the system prompt; "Not now" always available.              |
| 5o  | Button             | Everywhere                                        | Primary, secondary, text, danger, pressed, disabled, loading                                                                                            | At least 44 by 44 pt on iOS and 48 by 48 dp on Android.                                                |
| 5p  | Sheet              | Check-in, Log a find, Limit reached               | Half height (5p); full height (5p-2). Both are `SheetPanel`s drawn in the flow, not Modals                                                              | Grab handle, title and a close button.                                                                 |
| 5q  | Empty state        | My Plants, Plantdex, League, Friends              | My Plants, Friends                                                                                                                                      | Tendril line drawing, one sentence, one action.                                                        |
| 5r  | Snackbar           | Everywhere                                        | "Check-in saved." with Undo; "You're offline. We'll sync when you're back."; the points-pending line (`copy.pointsHeld`)                                | One plain sentence, with Undo where it can apply.                                                      |

## Where the pixel values come from

- `2a`, `2c`, `4ab`, `4al`: confidence label, verdict chip, rarity badge and pet check card.
- `2e`: task row (52 pt photo slot, 48 pt "Check in" button, hairline dividers), streak and quota tiles.
- `2f`: Plantdex tile (120 pt photo, text block, missing tile).
- `2g`: plan card (radio, tag, price).
- `3i`: find marker (the area fill is `primary` at 16%, the dot has a white ring).
- `4c`, `4d`, `4e`: check-in sheet (panel padding, Fraunces 28 title, answer tiles 64 pt, dark Note).
- `4aq`: league row (28 pt rank column, You row on `primaryTint`).
- `4i`: plant card (the frame is a plain row list; the card follows the Task 7 brief: 44 pt lead,
  nickname Inter 600 17, species italic).
- `3k`: permission primer.

## Differences from the Task 7 brief, taken from the frames

- **Task row photo is 52 pt** (`2e`), not 44.
- **Missing Plantdex tile** (`2f`) is a solid 1.5 pt `border` ring with a 40 pt question-mark circle
  glyph on a full-width `primaryTint` block, not a dashed ring and a 44 pt circle.
- **Plan card tag** is Inter 500 13 (`2g`, the `caption` variant), not Inter 600.
- **Check-in sheet height** (`4c`): the frame's content is about 16 pt taller than its 522 pt panel
  (the frame squeezes the grab handle to nothing and lets the answers run into the bottom padding),
  so the sheet is 522 pt at least and grows to fit, rather than clipping the answers.

## States the frames do not draw

- Winter mode on the streak counter has no visible line (the Streaks screen owns that copy); the
  page labels it and the counter reads it aloud.
- "Answered Yes" on the check-in sheet has no frame; its copy is from the Task 7 brief.
