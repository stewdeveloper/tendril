# Plant app: UX design brief

Oct 3, 2026 · @Louis

## Name

Recommended: **Tendril**. One word, a plant part anyone can picture, and a hint of growing and reaching out, which suits collecting and leagues. Store title: "Tendril: Plant ID & Care".

| Name | Verdict | Why |
| --- | --- | --- |
| Tendril | SELECTED | No plant app found; the nearest is Tendrils, a vegan dating app ([App Pricing Lab](https://apppricinglab.com/app/apple/1454550179)) |

## The product on one page

Tendril identifies a plant from a photo, says how sure it is, checks it against your pets, coaches you to keep it alive, and turns every find into a collection you can compete with friends on. It ships on iOS and Android, in English, for Ireland, the EU and the US.

### Who we design for

- **The plant keeper:** 5 to 30 houseplants, has lost a few, wants to stop guessing when to water.
- **The pet household:** a cat or dog at home; wants to know a plant is safe before buying it, and fast answers after a nibble.
- **The collector:** walks, parks and hikes; enjoys ticking things off, keeping a streak and beating friends.

### What v1 does

Scan and identify, pet check, My Plants with care check-ins and diagnosis, the collection (Plantdex, sets, rarity, finds map), streaks and weekly leagues, Premium, and adopting a plant from a grower's label QR.

### Design principles

1. **Show how sure we are.** Every identification shows a confidence level and alternatives; low confidence asks for a better photo instead of guessing.
2. **Never trick anyone into paying.** The price is the loudest thing on the paywall, and the 7-day preview starts no store subscription and ends on its own.
3. **Safety reads in words, not just colour.** Every toxicity verdict has a label, an icon and the identification's confidence; unknown is never shown as safe.
4. **Check before you water.** Care screens ask about the soil before suggesting water, and nothing celebrates watering itself.
5. **Collect without pressure.** Streaks forgive (freezes, winter mode), and points never need picking, trespassing or a shared location.
6. **Private by default.** Other people see a find's location only as an area, never a pin, and nothing near home is ever public.

### Numbers the UI must reflect

| Item | Free | Premium |
| --- | --- | --- |
| Identifications | 10 a month | 60 a month |
| Diagnoses | 1 a month | 10 a month |
| Price | Free | $24.99 a year or $4.99 a month, no weekly plan |
| Preview | 7 days of Premium, no store subscription | Already included |

## Brand and visual direction

Tendril should feel like a calm friend who knows plants: deep green on warm off-white, plenty of space, and colour saved for meaning. Play lives in the collection and leagues; pet safety and payment screens stay plain.

| Tendril is | Tendril is not |
| --- | --- |
| Calm and plain-spoken | Clinical or full of jargon |
| Honest about doubt | Falsely certain |
| Playful about collecting | Playful about pet safety or money |
| Encouraging | Guilt-tripping or pushy |

### Colour

Every text pair below passes WCAG AA (4.5:1) in both themes, and meaningful outlines pass 3:1; ratios were computed with the WCAG contrast formula. Colour never carries meaning alone: each pet verdict has a word and an icon, each rarity tier a word and a mark.

| Token | Light | Dark | Used for | Lowest contrast, light / dark |
| --- | --- | --- | --- | --- |
| background | #FBFAF6 | #121714 | App background | Base colour |
| surface | #FFFFFF | #1B221E | Cards and sheets | Base colour |
| text-primary | #1D2420 | #E8EEEA | Names and body text | 15.2 / 13.8 |
| text-secondary | #56605A | #A9B5AE | Scientific names, captions | 6.3 / 7.7 |
| border | #7F8983 | #69756E | Outlines that carry meaning: inputs, unselected chips | 3.5 / 3.4 |
| primary | #2E6B4E | #7BC79C | Buttons, links, selected tab | 6.0 / 8.1 |
| on-primary | #FFFFFF | #0E1A13 | Text on primary buttons | 6.3 / 8.9 on primary |
| primary-tint | #E6F0EA | #1E3328 | Selected rows, soft highlights | 5.4 / 6.7 with primary text on it |
| streak | #A36100 | #F2B35C | Streak flame and count | 4.7 / 8.8 |

Lowest contrast is measured against both background and surface unless the row says otherwise. Pet verdict chips and rarity badges use white text in light mode and #0E1A13 in dark mode.

| Pet verdict | Light chip | Dark chip | Icon | Chip text contrast, light / dark |
| --- | --- | --- | --- | --- |
| Unknown | #5F6B66 | #B9C3BE | Question mark in a circle | 5.6 / 9.9 |
| No known toxicity | #2B6A45 | #86CFA1 | Tick in a circle | 6.5 / 9.7 |
| Mild | #8A5A00 | #E6B85C | Exclamation mark in a triangle | 5.9 / 9.7 |
| Moderate | #B3401F | #F0A07F | Exclamation mark in a diamond | 5.7 / 8.5 |
| Severe | #9B1C1C | #F2A3A3 | Exclamation mark in an octagon | 8.2 / 9.0 |

Severe's colours double as the danger colour for destructive buttons such as Delete account.

| Rarity tier | Light badge | Dark badge | Mark | Badge text contrast, light / dark |
| --- | --- | --- | --- | --- |
| Common | #5E6E66 | #B4C0B9 | One leaf | 5.4 / 9.5 |
| Uncommon | #2F7D6D | #7FCDB9 | Two leaves | 4.9 / 9.6 |
| Rare | #3F5BA9 | #A9B8F0 | Three leaves | 6.4 / 9.2 |
| Legendary | #8C6A12 | #E3C26A | A flower | 5.0 / 10.4 |

### Type

Fraunces, a soft serif, carries plant names and big moments; Inter, drawn for screens, carries everything else. Both use the SIL Open Font License. Sizes follow Apple's default Dynamic Type sizes so text scales with the user's setting; Android uses the same values in sp.

| Role | Face | Size, pt | iOS style it matches |
| --- | --- | --- | --- |
| Moments: new species, week results | Fraunces 600 | 34 | Large Title |
| Plant name on results and plant pages | Fraunces 600 | 28 | Title 1 |
| Section headings | Inter 600 | 20 | Title 3 |
| Body text, and buttons at 600 | Inter 400 | 17 | Body, Headline |
| Scientific names, secondary lines | Inter 400 italic | 15 | Subhead |
| Captions, chip and badge labels | Inter 500 | 13 | Footnote |

Nothing goes below 11 pt, Apple's minimum. Scientific names are always italic, the usual botanical style.

### Shape, icons and motion

- 4 pt spacing grid, 16 pt screen margins, 16 pt card corners, fully rounded chips.
- Lucide outline icons (ISC licence) at 24 pt with a 2 pt stroke; tab labels always show under the icons.
- User photos lead every plant screen. Text never sits on a photo without a dark scrim.
- Motion is quick: fades and short slides of 200 to 300 ms. The new-species moment lasts under 1.5 seconds, and a tap skips it.
- With Reduce Motion on, movement becomes fades, as Apple's guidelines advise.
- Empty states use a simple line drawing of a curling tendril in primary at low opacity.

## App map

&#91;embedded content: app map · 5 tabs and the screens under each\]

Ways in from outside the app: a care reminder opens Check-in, a label QR link opens Label adoption, and first run ends on the camera.

## Key journeys

Eight journeys carry v1. Each runs straight through below; the branches after a scan are drawn in Scan result states.

### First run

1. **Welcome.** One line of value and two buttons: "Get started" and "Scan your plant label" for people arriving from a label QR.
2. **Age.** Ask for month and year of birth on a neutral screen that never mentions the age limit, as the FTC's COPPA guidance suggests. Under 13 ends politely, the answer sticks so going back cannot change it, and only "13 or over" is stored.
3. **Sign in.** Sign in with Apple, Google or an email link.
4. **Pets.** "Who lives with you?" Cat, dog, other or none; several allowed, each with an optional name.
5. **Home area.** The user marks home on a map or types a town, with no location prompt. Finds inside the area are never public, and the stored centre is randomised so it cannot reveal the house. Skip is allowed; the app asks again before the first public find.
6. **First scan.** A short primer, the system camera prompt, then the camera.

Permissions are asked in context: camera at the first scan, location at the first logged find, notifications after the first plant is added.

### Scan to result

1. **Camera.** Chips for Leaf, Flower and Whole plant; up to 5 photos; a gallery button noting that gallery photos earn no points; a "Check its health" toggle that uses a diagnosis. The quota meter shows what is left, for example "7 of 10 left this month".
2. **Send.** If the month's identifications are used up, Limit reached opens instead and no paid call is made.
3. **Identifying.** The first photo with a progress indicator; no made-up percentages.
4. **Result.** The layout follows confidence: very likely, likely or not sure.
5. **Confirm.** "Add to My Plants" asks three setup questions: light in the room, pot size and material, drainage. "Log a find" asks where it was: shop, garden or park, or wild.
6. **After confirming.** Pet check for every household pet, the care basics and any points; a species new to the user's Plantdex gets the new-species moment.

### Care check-in

1. A local reminder or a Today task: "Time to check Monty's soil."
2. The check-in sheet asks one question, "Is the top of the soil dry?", with an optional photo and leaf-state chips.
3. Yes adds a watering task for today; No sets the next check and says when.
4. Any check-in extends the daily care streak. Watering itself earns nothing.
5. Free follows the species' basic schedule. Premium adapts to answers, pot, light, season and outdoor weather, and a diagnosis can change the plan: an overwatering result pauses watering until two dry checks in a row.

### Pet safety

1. Every result, plant page and species card shows a pet check for each household pet: verdict chip, one plain line, the source and how sure the identification is.
2. Unknown always reads as not reviewed, never as safe.
3. On a likely match, the check adds: "This depends on the match. Confirm the plant to be sure."
4. "My pet ate this" sits on every pet check and opens Pet emergency: the verdict and symptoms from the source, the household's vet first, then the poison line for the user's country.
5. In the US that line is the ASPCA Animal Poison Control Center, (888) 426-4435, open 24 hours. Ireland and the EU need a line confirmed before launch; until then the screen shows the vet only.

### Paywall and preview

1. Triggers: the 11th identification of the month, the 2nd diagnosis, a Premium feature (adaptive schedule, weather, household sharing, holiday hand-over) or Settings.
2. The first trigger offers the preview: "Try Premium free for 7 days. No payment details, nothing to cancel." It starts no store subscription and ends on its own, with a reminder the day before.
3. The paywall lists what Premium adds, then two plans: $24.99 a year and $4.99 a month. The billed amount is the biggest price text; any per-month figure for the yearly plan is smaller.
4. Every paywall shows plan name, length and price, links to the Terms of Use and Privacy Policy, Restore purchases, and a close button from the start.
5. Review risk: Apple requires in-app purchase to unlock features and asks non-subscription apps to run trials as a $0 purchase (guideline 3.1.1). Confirm the server-granted preview with App Review; if refused, switch to a store introductory offer and rewrite the preview copy.

### Label QR adoption

1. The phone's camera scans the label and opens a fast web page with care basics and pet toxicity; no install needed.
2. If Tendril is installed, the link opens Label adoption in the app instead.
3. Without the app, the page links to the store; after install, first run offers "Scan your plant label" to finish.
4. Label adoption shows the plant, the grower, care basics and the pet check. "Add to my plants" runs the three setup questions, and no identification is used.

### Streaks and leagues

1. Two streaks: a daily care streak (any check-in) and a weekly discovery streak (a species new to the user's Plantdex).
2. A held freeze is spent automatically on a missed day. Free users earn freezes through referrals; Premium holds 2 at all times.
3. Winter mode protects the discovery streak when little grows; its exact rules are still open.
4. Weekly leagues group at least 20 people from neighbouring areas and reset every week; a friends board sits beside them.
5. Points come only from finds the server accepts. Held points show as "pending review", never as an accusation.

### Account deletion

1. Settings, then Account, then Delete account: easy to find, as Apple asks.
2. The screen lists what goes: plants, finds, photos, locations and points.
3. With an active subscription, it says billing continues through the store and links to manage subscriptions before going on, as Apple asks.
4. One confirmation with a danger-coloured button, then back to Welcome.

## Scan result states

&#91;embedded content: scan result states · 3 confidence bands, 3 scoring outcomes\]

Limit reached and Not a plant end a scan early. A sensitive species follows the same paths, but its location is never public.

## Screen specs

v1 has 33 screens and sheets. Each needs its main layout plus every state in the last column; those states are where trust is won or lost.

| Area | Screen | Shows | Main action | States to design |
| --- | --- | --- | --- | --- |
| First run | Welcome | Value line over a plant photo | Get started; Scan your plant label | None |
| First run | Age | Month and year of birth | Continue | Under 13: polite stop that persists |
| First run | Sign in | Apple, Google, email link | Continue with Apple | Link sent; link expired |
| First run | Pets | Cat, dog, other, none, with names | Continue | No pets |
| First run | Home area | Map with an adjustable area, town search | Save area | Skipped; town not found |
| Today | Today | Tasks due, both streaks, league rank, identifications left | Check in on the first task | No plants yet; all done today |
| Today | Check-in sheet | "Is the top of the soil dry?", photo, leaf chips | Yes or No | Offline: saved, synced later |
| Today | Streaks | Check-in calendar, discovery weeks, freezes, winter mode | Invite a friend to earn a freeze | Freeze used; streak broken, without blame |
| My Plants | My Plants | Plants by room with the next check; household switcher | Add a plant | Empty: scan or scan a label |
| My Plants | Plant detail | Photo, nickname, species, care plan, history, pet check, status | Check in | Dead or given away, kept in history |
| My Plants | Add plant setup | Light, pot size and material, drainage, nickname, room | Save | "Not sure" answers |
| My Plants | Label adoption | Plant, grower, care basics, pet check | Add to my plants | Unknown or retired code |
| My Plants | Diagnosis | Photos, likely problem, confidence, change to the plan | Apply to care plan | Diagnoses used up; not sure |
| Scan | Camera | Viewfinder, organ chips, 1 to 5 photo tray, gallery, health toggle, quota meter | Shutter, then Identify | Camera denied; gallery only |
| Scan | Result | Photos, name, confidence, alternatives, pet check, care basics | Add to My Plants or Log a find | Very likely; likely; not sure; not a plant; offline; error |
| Scan | Log a find | Where: shop, garden or park, wild | Save find | Location off: saved to the Plantdex without points |
| Scan | New species | Name, rarity badge, points, Plantdex count, set progress | Continue | Reduce Motion; points pending review; no points (gallery or integrity) |
| Scan | Limit reached | What ran out, reset date, Premium or preview | Try Premium | Premium at its cap: reset date only, no upsell |
| Collection | Plantdex | Found species grid, houseplant and wild filters, counts | Open a species | Empty: first-scan prompt |
| Collection | Species card | Your finds, rarity, care basics, pet check, sets | See finds on the map | Sensitive species: no map, privacy note |
| Collection | Sets | Sets with progress; missing species as silhouettes | Open a set | Set completed |
| Collection | Finds map | Your finds as exact pins only you see; list toggle | Open a find | Location never granted: list only |
| Collection | Badges | Earned and locked badges with what earns them | Share a badge | None earned yet |
| Leagues | League | This week's board, your rank and points, days left | Open a profile | Before your first points |
| Leagues | Friends | This week's friends board | Add friends | No friends yet |
| Leagues | Add friends | Handle search, invite link | Send invite | Handle not found |
| Leagues | Week results | Final rank, points, best find | Continue | No points this week |
| Profile | Profile | Handle, badges, Plantdex count, streaks | Edit profile | Your view and the public view |
| Profile | Settings | Household and pets, home area, notifications, Premium, account, terms, privacy | Open a setting | Preview active |
| Profile | Household and pets | Members, pets, vet name and phone, holiday hand-over | Invite a member | Free: sharing locked with the preview offer |
| Profile | Paywall | What Premium adds, two plans, terms, privacy, restore, close | Subscribe | Preview days left; purchase pending; purchase failed |
| Profile | Pet emergency | Verdict, symptoms, source, vet, poison line | Call your vet | No vet saved; country without a line |
| Profile | Delete account | What gets deleted, subscription notice, manage link | Delete account | Active subscription |

## Components

Eighteen components cover v1. The first three carry the honesty and pet-safety promises, so they get the most review.

| Component | Used on | Variants and states | Rules |
| --- | --- | --- | --- |
| Confidence label | Result, Plant detail, Diagnosis | Very likely (80% and over), Likely (50 to 79%), Not sure (under 50%) | Word first, then the percentage; never a bare number. The 50% line comes from the architecture; all three are starting values to tune |
| Pet check card | Result, Plant detail, Species card, Label adoption | One row per household pet; likely-match note; "My pet ate this" | Verdict chip, one plain line and the source on every row |
| Pet verdict chip | Pet check card, plant cards | Unknown, No known toxicity, Mild, Moderate, Severe | Icon, word and colour together, read as "Cats: Mild" |
| Rarity badge | New species, Plantdex, Species card | Common, Uncommon, Rare, Legendary | Leaf count plus word; sensitive species never appear on public rarity boards |
| Plant card | My Plants, Today | Check due, overdue, all good, paused by a diagnosis, dead, given away | Photo, nickname, species in italics, next check |
| Task row | Today | Due, done, overdue | Tap opens the check-in sheet; finishing a watering task gets no celebration |
| Check-in sheet | Today, Plant detail | Unanswered, answered, saved offline | One question, two large answers, optional photo and leaf chips |
| Quota meter | Camera, Today, Limit reached | Free, Premium, one left, used up | Reads "7 of 10 left this month"; the reset date shows on tap |
| Streak counter | Today, Streaks | Active, last day to keep it, freeze used, winter mode, broken | Flame icon plus number in the streak colour; a broken streak turns grey, never red |
| League row | League, Friends | You, others, points pending | Your row in primary-tint; rank, handle, points |
| Plantdex tile | Plantdex, Sets | Found, missing, sensitive | Found shows photo, name and rarity; missing shows a silhouette and a question mark |
| Find marker | Finds map | Exact pin, shared area, hidden | Only the owner sees exact pins; anything shared shows an area at most |
| Plan card | Paywall | Yearly, monthly; selected, unselected | The billed amount is the largest text; any tag such as "Best value" is smaller than the price |
| Permission primer | Before camera, location and notification prompts | One per permission | Says why and what Tendril never does, then the system prompt; "Not now" always available |
| Button | Everywhere | Primary, secondary, text, danger; pressed, disabled, loading | At least 44 by 44 pt on iOS and 48 by 48 dp on Android |
| Sheet | Check-in, Log a find, Limit reached | Half height, full height | Grab handle, title and a close button |
| Empty state | My Plants, Plantdex, League, Friends | One per screen | Tendril line drawing, one sentence, one action |
| Snackbar | Everywhere | Saved, offline, points pending | One plain sentence, with Undo where it can apply |

## Copy

Every line says what we know, how sure we are and what to do next, in plain words. Use sentence case, digits for numbers, the common name before the scientific one, and dates in the device's regional format.

- Lead with the confidence word, then the number: "Very likely, 94%".
- Never write "safe". Write "No known toxicity" and name the source.
- No guilt, no countdown timers, no fake urgency, no "Are you sure you want to miss out?"
- Points and streaks can be light; pet safety and money stay plain and calm.
- State the points rules up front, so nobody finds out after a scan that it did not count.

| Moment | Line |
| --- | --- |
| Very likely | Very likely a peace lily, 94% match. |
| Likely | Likely a peace lily, 71%. Compare these two before you add it. |
| Not sure | Not sure yet. Try a close photo of one leaf or flower. |
| Not a plant | We couldn't find a plant in this photo. Try again with the plant filling the frame. |
| Pet check, moderate | Moderate for cats. Peace lily can irritate the mouth and cause drooling and vomiting. Source: ASPCA. |
| Pet check, severe | Severe for cats. Easter lily can cause kidney failure. Call your vet now. |
| Pet check, no known toxicity | No known toxicity to cats (ASPCA). Eating any plant can still cause vomiting or an upset stomach. |
| Pet check, unknown | Not reviewed yet. Keep it away from Miso until we know more. |
| Likely-match note | This depends on the match. Confirm the plant to be sure. |
| Limit reached | You've used your 10 free identifications this month. More arrive on 1 November, or get 60 a month with Premium. |
| Preview offer | Try Premium free for 7 days. No payment details, nothing to cancel. |
| Preview ending | Your Premium preview ends tomorrow. You'll go back to Free, and nothing is charged. |
| Check-in | Is the top of Monty's soil dry? |
| Check-in answered No | Good. We'll check again on Friday. |
| Streak, last day | Your 12-day streak needs one check-in today. |
| Freeze used | A freeze kept your 12-day streak going. |
| Gallery note | Gallery photos get identified but don't earn points. |
| Points held | Points pending review. We check unusual finds before they count. |
| Sensitive species | We keep this species' location private to protect it. |
| Home area | Finds near home never appear publicly, not even as an area. |
| Delete account | This deletes your plants, finds, photos and points for good. It doesn't cancel your subscription, so do that first. |

## Accessibility

Tendril targets WCAG 2.2 AA plus Apple's and Google's touch-target sizes, and the palette above already meets the contrast rules.

| Rule | Requirement | How Tendril meets it |
| --- | --- | --- |
| Text contrast | [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): 4.5:1 for normal text, 3:1 for large text (18 pt or 14 pt bold, about 24 px or 18.5 px) | Every text pair passes 4.5:1, so no screen relies on the large-text exception |
| Non-text contrast | [WCAG 1.4.11](https://www.w3.org/TR/WCAG22/): 3:1 against adjacent colours for UI components and graphics needed to understand content | Meaningful outlines use the border token, above 3:1 in both themes; chips and badges pass against both backgrounds |
| Colour alone | [WCAG 1.4.1](https://www.w3.org/TR/WCAG22/): colour is never the only visual means of conveying information | Verdicts carry words and icons, rarity carries words and leaf counts, and your league row says "You" |
| Touch targets | [Apple](https://developer.apple.com/design/human-interface-guidelines/accessibility): 44 by 44 pt default, 28 by 28 pt minimum; [Google](https://support.google.com/accessibility/android/answer/7101858?hl=en): 48 by 48 dp; [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): 24 by 24 CSS px at AA | Design every control at 44 pt on iOS and 48 dp on Android, chips and the shutter included |
| Text size | [Apple Dynamic Type](https://developer.apple.com/design/human-interface-guidelines/typography): 17 pt default, 11 pt minimum | All text scales; layouts stack at large sizes; verdict words wrap and never truncate |
| Motion | [Apple](https://developer.apple.com/design/human-interface-guidelines/accessibility): with Reduce Motion on, reduce automatic and repetitive animation and prefer fades | The new-species moment becomes a static card; no parallax or zoom anywhere |
| Screen readers | VoiceOver and TalkBack | Chips read in full ("Cats: moderate toxicity"), confidence reads "Very likely, 94 percent", silhouettes read "Not found yet", and the map has a list view |

Pet emergency has no timeouts, and its call buttons sit in the bottom half of the screen for one-handed use. Haptics confirm actions but never carry meaning alone.

## Brief for Claude Design

Start with the scan result and its pet check, because they carry the product's promise. Design iPhone screens at 393 by 852 pt (iPhone 16, with safe areas of 59 pt at the top and 34 pt at the bottom), light mode first.

### Deliverables, in order

1. **Style tile:** colour tokens in both themes, the type scale, pet verdict chips, rarity badges and buttons.
2. **Hero screens in light mode:** Camera, Result (very likely, with the pet check), Result (not sure), Plant detail, Today, Plantdex and Paywall.
3. **Onboarding:** Welcome, Age, Sign in, Pets and Home area.
4. **Every other screen** in Screen specs, each listed state as its own frame.
5. **Component sheet:** every component and state in Components.
6. **Dark mode** for the hero screens.
7. **App icon:** three concepts built on a curling tendril, deep green on off-white, readable at small sizes; avoid a generic leaf.

### Layout rules

- Bottom tab bar, left to right: Today, My Plants, Scan, Collection, Leagues. Scan is a raised primary button in the centre, and every tab shows its label.
- The avatar sits top right on every tab and opens Profile.
- Use only the colour tokens and type scale above: no new colours and no gradients behind text.
- Real content only, never placeholder Latin; use the sample data below and the lines in Copy.
- On the paywall the billed price is the largest price text, and the close button shows from the start.

### Sample data

The plants and the ASPCA lines are real. Pet verdict levels, rarity tiers and points are placeholders until the vet review and the scoring rules are set.

| Item | Sample |
| --- | --- |
| User | @aoifegrows, with Miso (cat) and Bran (dog) |
| My Plants | Monty, Swiss cheese plant (*Monstera deliciosa*), living room; Spidey, spider plant (*Chlorophytum comosum*), kitchen; Lily, peace lily (*Spathiphyllum*), bedroom |
| Pet checks | Spider plant: non-toxic to cats and dogs. Peace lily: toxic to cats and dogs, with mouth irritation, drooling, vomiting and trouble swallowing. Easter lily (*Lilium longiflorum*): can cause kidney failure in cats, non-toxic to dogs. Source for all three: ASPCA. Show Monty as Unknown to demonstrate that state |
| Result | Peace lily (*Spathiphyllum*), very likely, 94%; alternative: flamingo flower (*Anthurium andraeanum*), 3% |
| Wild finds | Foxglove (*Digitalis purpurea*), gorse (*Ulex europaeus*), primrose (*Primula vulgaris*), hawthorn (*Crataegus monogyna*), bluebell (*Hyacinthoides non-scripta*) |
| Quota | 7 of 10 identifications left, resets 1 November |
| Streaks | 12-day care streak, 3-week discovery streak, 1 freeze held |
| League | 4th of 20, 340 points, 3 days left |
| Collection | 37 species; sets "Irish hedgerow" 4 of 8 and "Easy-care houseplants" 3 of 6 |

### Starter prompt

Paste this with the brief:

```text
Design the iPhone app "Tendril: Plant ID & Care" from the UX brief I'm sharing. Start with a style tile, then the scan result screen (very likely match, with the pet check) in light mode at 393 x 852 pt. Use only the brief's colour tokens, type scale, sample data and copy lines. Then work through the deliverables list in order: hero screens, onboarding, the remaining screens and states, the component sheet, dark mode and three app icon concepts.
```

## Sources

- **Product rules** (quotas, prices, thresholds, flows): Plant app: system architecture
- **Name check:** [Tendrils](https://apppricinglab.com/app/apple/1454550179), the nearest existing app name
- **Accessibility:** [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [Understanding 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [Understanding 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Android touch target size](https://support.google.com/accessibility/android/answer/7101858?hl=en)
- **Store and legal rules:** [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app), [Complying with COPPA: FAQ (FTC)](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
- **Pet safety:** [ASPCA toxic and non-toxic plants](https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants), [Spider plant](https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants/spider-plant), [Peace lily](https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants/peace-lily), [Easter lily](https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants/easter-lily), [ASPCA Animal Poison Control Center](https://www.aspca.org/node/30171)
- **Type, icons and devices:** [Fraunces](https://github.com/undercasetype/Fraunces), [Inter](https://github.com/rsms/inter), [Lucide licence](https://lucide.dev/license), [iPhone 16 screen sizes (Use Your Loaf)](https://useyourloaf.com/blog/iphone-16-screen-sizes/)
- **Identification:** [Kindwise API client overview](https://deepwiki.com/flowerchecker/kindwise-api-client) (the result's is\_plant field)
