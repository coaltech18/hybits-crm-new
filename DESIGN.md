---
name: Hybits Billing
description: A numbered bill book for a dishware-rental business. Serial first, amount large, state stamped.
colors:
  primary: "#1B7F65"
  primary-deep: "#16654F"
  primary-pressed: "#12503F"
  logo-green: "#229A7A"
  rail: "#0F3D31"
  rail-hover: "#164C3E"
  rail-active: "#1D5C4B"
  rail-text: "#E3EFEA"
  rail-muted: "#A9CBBE"
  rail-mark: "#7FD3B4"
  ink: "#14231E"
  ink-muted: "#4A5E57"
  ink-faint: "#5F706A"
  paper: "#F4F7F5"
  sheet: "#FFFFFF"
  paper-sunk: "#EBF0ED"
  rule: "#D5DFDA"
  rule-strong: "#B9C7C0"
  scrim: "#0B2A22"
  selection: "#CDEBDD"
  draft: "#6B5200"
  draft-tint: "#FFF4C2"
  draft-rule: "#E8D27A"
  overdue: "#8A1C33"
  overdue-tint: "#FBE1E6"
  overdue-rule: "#EDB2BF"
  final: "#16654F"
  final-tint: "#E4F3EC"
  final-rule: "#A6D5C2"
  stamp: "#4636A8"
  stamp-tint: "#EEEBFA"
  stamp-rule: "#C4BCEB"
  partial: "#9A4A00"
  partial-tint: "#FFF6E5"
  partial-rule: "#F0C98A"
  void: "#5D6763"
  void-tint: "#EEF1F0"
  void-rule: "#C7CECB"
  info: "#1E5AA8"
  info-tint: "#EBF2FC"
  info-rule: "#B5CDEE"
  danger: "#B42318"
  danger-hover: "#931C13"
  danger-tint: "#FEF0EE"
  danger-rule: "#F4B8B1"
typography:
  display:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: "2.5rem"
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\", \"lnum\""
  headline:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: "2.25rem"
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.625rem"
  body:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: "1.375rem"
  label:
    fontFamily: "Source Sans 3, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: "1.125rem"
    letterSpacing: "0.025em"
  serial:
    fontFamily: "Source Code Pro, ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "0.92em"
    fontWeight: 500
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\", \"zero\""
  stamp:
    fontFamily: "Source Code Pro, ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.14em"
rounded:
  sm: "6px"
  focus: "4px"
  md: "8px"
  sheet: "10px"
  sheet-mobile: "16px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.sheet}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  button-primary-active:
    backgroundColor: "{colors.primary-pressed}"
  button-outline:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-outline-hover:
    backgroundColor: "{colors.paper-sunk}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-ghost-hover:
    backgroundColor: "{colors.paper-sunk}"
    textColor: "{colors.ink}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-danger-hover:
    backgroundColor: "{colors.danger-hover}"
  button-sm:
    padding: "0 12px"
    height: "32px"
  button-lg:
    padding: "0 20px"
    height: "44px"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  input-disabled:
    backgroundColor: "{colors.paper-sunk}"
    textColor: "{colors.ink-muted}"
  sheet:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.sheet}"
    padding: "24px"
  ledger-header:
    backgroundColor: "{colors.paper-sunk}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    padding: "10px 16px"
  ledger-cell:
    typography: "{typography.body}"
    padding: "12px 16px"
  badge-draft:
    backgroundColor: "{colors.draft-tint}"
    textColor: "{colors.draft}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-final:
    backgroundColor: "{colors.final-tint}"
    textColor: "{colors.final}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-partial:
    backgroundColor: "{colors.partial-tint}"
    textColor: "{colors.partial}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-paid:
    backgroundColor: "{colors.stamp-tint}"
    textColor: "{colors.stamp}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-overdue:
    backgroundColor: "{colors.overdue-tint}"
    textColor: "{colors.overdue}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-void:
    backgroundColor: "{colors.void-tint}"
    textColor: "{colors.void}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-info:
    backgroundColor: "{colors.info-tint}"
    textColor: "{colors.info}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  status-stamp-paid:
    textColor: "{colors.stamp}"
    typography: "{typography.stamp}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
  rail-nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.rail-text}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  rail-nav-item-hover:
    backgroundColor: "{colors.rail-hover}"
    textColor: "{colors.sheet}"
  rail-nav-item-active:
    backgroundColor: "{colors.rail-active}"
    textColor: "{colors.sheet}"
  rail:
    backgroundColor: "{colors.rail}"
    width: "256px"
  top-bar:
    backgroundColor: "{colors.sheet}"
    height: "56px"
  dialog:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.sheet}"
    padding: "20px 24px"
---

# Design System: Hybits Billing

## Overview

**Creative North Star: "The Bill Book"**

Every record reads like a page torn from a numbered duplicate bill book. The serial number leads, set in mono. The amount is the largest thing on the page. The state is stamped onto the record in rubber-stamp ink rather than described in a sentence. The workspace is a cool paper ground (paper) holding white sheets, framed by a deep Hybits-green rail. Carbon-copy tints carry state: yellow for a draft or office copy, pink for overdue, green-ruled white for finalized, violet ink for PAID, struck grey for cancelled or void.

Density is that of an accountant's ledger. Tables are ruled with hairlines, figures line up in tabular numerals, and rows sit at a 12px vertical rhythm. Pages open with exposure (money strip), then the ledger, then the next action. Colour is spent on state and on the one primary action per view. The rest of the surface is ink on paper. Motion only reports a state change, and the reduced-motion setting collapses all of it to 1ms.

The direction named logo green (logo-green) as the primary. The build moved primary fills to a deeper green (primary, 4.92:1 with white text) and kept logo-green for focus rings, rules and large marks, where 3:1 suffices. The build is authoritative here.

**Key Characteristics:**
- Cool paper ground, white sheets, deep-green rail; light mode only.
- Serials in Source Code Pro; everything else in Source Sans 3 with tabular figures.
- Eight carbon-copy state families, each with ink, tint and rule colours, every pair at or above 5.15:1.
- A rotated, double-ruled rubber stamp on record headers is the signature move.
- Hairline-ruled ledgers, a ruled money strip, and day-length aging bars.
- One primary action per view, placed top right in the page header.

## Colors

The palette is restrained: green ink on cool paper, with saturated colour reserved for record state.

### Primary
- **Ledger Green** (primary): fills the single primary button per view, link text, the caret and checkbox accent, and the spinner. Pressed state darkens to primary-pressed.
- **Deep Ledger Green** (primary-deep): primary hover, and the ink of the *finalized* state.
- **Hybits Logo Green** (logo-green): the brand's own green. It draws the 2px focus ring everywhere, the input focus border and its 20% halo, and large marks. Never use it as a fill behind body text (3.52:1 on white).

### Secondary
- **Rubber-Stamp Violet** (stamp): the PAID state only, in the badge, the header stamp, and nowhere else. It stays rare so the colour itself reads as "settled".

### Neutral
- **Rail Green** (rail): the navigation rail, the sign-in brand panel, and the browser theme colour. Rail-hover and rail-active step it lighter; rail-text (10.28:1) and rail-muted (6.91:1) are the type on it; rail-mark is the 3px active-item bar and icon tint.
- **Ledger Ink** (ink): all primary text, 16.29:1 on white.
- **Ink Muted** (ink-muted): descriptions, ledger headers, figure captions, secondary cells. It measures 6.93:1 on white and 6.01:1 on paper-sunk.
- **Ink Faint** (ink-faint): placeholders, nil values ("—", zero counts) and decorative arrows. It measures 5.23:1 on white, 4.85:1 on paper and 4.54:1 on sunk, so it passes AA for text.
- **Cool Paper** (paper): the work ground behind sheets, and quiet wells inside them.
- **Sheet White** (sheet): every content surface.
- **Sunk Paper** (paper-sunk): ledger header band, ghost and outline hover, disabled fields, skeleton base.
- **Hairline** (rule) / **Strong Rule** (rule-strong): rule is the default border on every element (set globally) and the divider between ledger rows at 70%. Rule-strong is the input and outline-button stroke.
- **Scrim** (scrim): the dialog, palette and drawer backdrop at 45 to 50% opacity with a 2px blur.

### State tints (carbon copies)
Each state is a family of ink (text), tint (fill) and rule (border). The ratios below are ink on tint.

| State | Used for | Ink on tint |
|---|---|---|
| draft | draft invoice/audit, paused subscription, counting | 6.70:1 |
| final | finalized, active, completed, approved, recorded | 6.09:1 |
| partial | part paid; aging under 30 days; warnings | 5.83:1 |
| stamp | paid | 7.61:1 |
| overdue | overdue, unpaid, rejected; aging 30+ days | 7.42:1 |
| void | cancelled, voided | 5.15:1 |
| info | planned, submitted | 6.05:1 |
| danger | errors and destructive actions (not a record state) | 5.92:1 |

**The Carbon Copy Rule.** A record's state is shown only through its state family (StatusBadge in tables, StatusStamp on headers), mapped in one place. Never hand-pick a tint for a status on a page.

**The One Green Fill Rule.** Primary green fills at most one button per view. Every other action is outline or ghost.

## Typography

**Display Font:** Source Sans 3 (with system-ui, Segoe UI)
**Body Font:** Source Sans 3
**Label/Mono Font:** Source Code Pro (with ui-monospace, Consolas), for serials, codes, keycaps and the stamp

**Character:** A plain workhorse sans with tabular lining figures, paired with a mono used as data rather than costume. Serials such as invoice numbers, GSTIN, HSN and outlet codes are set in mono with a slashed zero, so 0 and O never get confused.

### Hierarchy
- **Display** (700, 2.25rem/2.5rem at sm and up, 1.75rem below): the loudest balance figure in a money strip ("Outstanding"). Other strip figures use 1.75rem (1.5rem on mobile).
- **Headline** (700, 1.75rem/2.25rem at sm and up, 1.5rem/2rem below): the page title in PageHeader, which is the serial itself on record pages.
- **Title** (600, 1.125rem/1.625rem): sheet section headings, dialog titles, empty-state headings.
- **Body** (400, 0.9375rem/1.375rem): the base size for the whole app, ledger cells and form fields. Descriptions are capped at about 48rem.
- **Label** (600, 0.8125rem/1.125rem, uppercase, 0.025em tracking): ledger column headers, figure captions, `dt` terms, sidebar group names (0.12em tracking). Nothing in the app is set below 13px.

**The Tabular Rule.** Every table, total and amount uses tabular lining numerals (`table`, `.tabular`, `.amount`), and amounts never wrap. Right-align money columns.

**The Serial Rule.** Mono appears only on identifiers (`.serial`) and on the stamp. Never set prose, names or headings in mono.

## Layout

The shell is a fixed 256px rail on the left, visible from 1024px up. To its right is a 56px top bar in translucent white (85%, backdrop blur) holding the Ctrl+K jump field (max 28rem), the outlet scope from 768px, and a menu button below 1024px. The main column scrolls on its own, centred at a max width of 1400px. Gutters are 16px, then 24px from 640px, then 32px from 1024px. Vertical padding is 24px, rising to 32px.

Below 1024px the rail becomes a 256px drawer over a scrim, with a close button floating outside its edge. A skip link leads to `#main`, and every page scrolls to the top on navigation.

Page grammar: PageHeader (24px below it, 32px on large screens), then a ruled money strip, then content. The dashboard splits into a ledger and a 380px right column from 1280px. Blocks are separated by 24px. Sheet section headers are padded 16px vertical and 20px horizontal, with a hairline beneath. Forms run as one sheet, ending in a sticky bottom action bar.

**The Ruled Strip Rule.** Key figures sit in one sheet as a 2-column grid (4 columns from 1024px), divided by hairlines. They are never separate floating tiles.

## Elevation & Depth

The system is mostly flat, with hairline borders. The only resting shadow is the faint, rail-tinted sheet shadow, which reads as paper lying on a desk. Lift is reserved for floating things (skip link, toasts, the drawer close button). The deeper dialog shadow is for modals, the palette and the drawer. All shadows are tinted with rail green and never pure black.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 1px 2px rgba(15,61,49,0.06), 0 1px 1px rgba(15,61,49,0.04)`): cards, sheets, primary and outline buttons at rest.
- **Lift** (`box-shadow: 0 8px 24px -6px rgba(15,61,49,0.18), 0 2px 6px rgba(15,61,49,0.08)`): toasts, the focused skip link, floating controls.
- **Dialog** (`box-shadow: 0 24px 48px -12px rgba(15,61,49,0.28), 0 4px 12px rgba(15,61,49,0.10)`): Modal, ConfirmDialog, the Ctrl+K palette, the mobile drawer.
- **Field inset** (`box-shadow: inset 0 1px 1px rgba(15,61,49,0.04)`): text inputs only.

**The Paper On A Desk Rule.** Sheets do not nest, and a sheet never carries more than the sheet shadow. Depth beyond that means the element is floating above the page.

## Shapes

Corners are gently curved: 6px on badges, stamps and small controls; 8px on buttons, inputs, alerts and wells; 10px on sheets and dialogs. On mobile, modals become bottom sheets with 16px top corners. Pills (full) are used only for avatars, the aging-bar track and the confirm-dialog icon disc. Borders are 1px hairlines in rule. The stamp alone uses a 2.5px border plus a 1px outline offset by 2px, which gives it a double impression, and it is rotated -4 degrees. Empty states use a dashed circle. The sign-in rail panel ends in a perforated edge (a column of paper-coloured punch holes), the bill book's tear line.

## Components

### Buttons
Quiet and sure of themselves. One green fill per view; everything else steps back.
- **Shape:** gently curved (8px). Heights are 32/40/44px (sm/md/lg), with a 6 to 8px icon gap. Weight is 600.
- **Primary:** primary fill with white text and the sheet shadow. Hover goes to primary-deep, active to primary-pressed.
- **Outline (also `secondary`/`default`):** white with a rule-strong stroke and ink text. Hover goes to paper-sunk with an ink-faint stroke.
- **Ghost:** transparent with ink-muted text. Hover goes to paper-sunk with ink text. Used for refresh, cancel-record and other low-stakes actions.
- **Danger (also `destructive`):** danger fill with white text (6.57:1). Hover goes to danger-hover.
- **Focus / Disabled / Loading:** a 2px logo-green outline offset by 2px. Disabled is 50% opacity with no shadow. Loading shows an inline spinner and sets `aria-busy`. `LinkButton` gives router links the same styling; a Button is never nested inside a Link.

### Status badges (chips)
- **Style:** 6px corners, a 1px state-rule border, a state-tint fill, state-ink text in 13px semibold, padded 2px by 8px.
- **API:** `StatusBadge kind={invoice|subscription|event|audit|payment} status=…` resolves label and family from one map. For example, invoice `partially_paid` shows "Part paid" in partial, and `paid` shows "Paid" in stamp.

### Status Stamp (signature)
A rubber-stamp impression beside the record title in PageHeader. It is set in Source Code Pro 600, uppercase, 0.14em tracking, in state ink with matching border and outline, on 60% white, rotated -4 degrees. An optional second line carries the detail (a date or amount). It has `role="status"` and a spoken label. When the state changes (finalize, paid, approve), `animate` presses it in over 180ms: it scales from 1.35 with a 2px blur to 0.97, then to 1, on `cubic-bezier(0.16,1,0.3,1)`. With reduced motion it simply appears.

### Cards / Containers (Sheet)
- **Corner Style:** 10px.
- **Background:** sheet white on the paper ground.
- **Shadow Strategy:** sheet shadow only (see Elevation & Depth).
- **Border:** 1px rule.
- **Internal Padding:** `none` / 16px / 20px, rising to 24px from 640px (default) / 24px, rising to 32px. Ledger sheets use `none` with `overflow-hidden`.

### Ledger tables
Opt in with `className="ledger"`; every table in the app does. The header is a sticky paper-sunk band of label-style column names, padded 10px by 16px with a rule beneath. Cells are padded 12px by 16px, divided by rule at 70%, with no rule under the last row. Row hover tints final-tint at 40%. Serials link in mono, ink, turning primary on hover. Amounts are right-aligned and semibold. Grouped rows use a `colgroup` header row in the label style on paper. Loading shows a `TableSkeleton` of shimmer bars instead of a blank page.
- **Carbon-copy rows:** the record carries its state, not only the badge. `tr.row-draft` takes a draft-tint (60%) wash, `tr.row-overdue` an overdue-tint (50%) wash for balances unpaid more than 30 days, and `tr.row-void` turns the row void-grey with its `.amount` and `.serial` struck through (cancelled invoices, voided payments, inactive records).
- **Numeric headers** right-align over right-aligned figures automatically (`useLedgerLabels` copies `text-right` from the first body row onto the header).
- **Phones (<640px):** every ledger row becomes a labelled card. `useLedgerLabels` (mounted once in `MainLayout`) copies each header's text onto its cells as `data-label`; the first cell leads as the card heading. `td.cell-emph` sets the key figure large, `td.cell-hide-sm` drops secondary cells, `th[data-nolabel]` keeps action columns unlabelled, and `table.ledger-keep` opts an editable grid out of card mode.

### Money strip and Figure
One sheet holding 2 to 4 cells. Each cell has a label caption, the figure (display or headline size, bold, `-0.025em`, tabular), and a muted one-line hint. Values that failed to load show "—" and are never zero. Figure colour follows meaning: overdue for money over 30 days, final when nothing is outstanding.

### Aging Bar
A fixed-scale bar where length is exact days outstanding (1 day = 1.2px by default, capped at 90 days with a "90+" label). The track is an 8px pill in paper-sunk. The fill is partial up to 30 days and overdue from day 31 (the aging report's buckets), followed by a tabular "Nd" count in 13px semibold. Because the scale is fixed, bars compare across rows and across pages.

### Inputs / Fields
- **Style:** 40px high, white fill, 1px rule-strong stroke (ink-faint on hover), 8px corners, a faint inset shadow, 15px ink text with ink-faint placeholders. The label sits above in 15px semibold ink, with a danger asterisk when required. Helper text sits below in muted 15px. Select uses the same field with a muted chevron. Textarea starts at 88px and resizes vertically.
- **Focus:** the border changes to logo-green, with a 3px logo-green halo at 20%.
- **Error / Disabled:** a danger border and halo, the message in danger, `aria-invalid` set, and the message wired via `aria-describedby`. Disabled fields use paper-sunk fill and muted text.

- **Dates:** `DateInput` replaces every native date field. Entry and display are always DD/MM/YYYY whatever the browser's language (a native date input shows mm/dd/yyyy on an English (US) browser). It reads and writes ISO `YYYY-MM-DD`; a calendar button opens the native picker; impossible or out-of-range dates show an inline error.

### Forms with sticky action bar
Long forms are one sheet ending in a bar pinned to the viewport bottom. The bar is white at 95% with a backdrop blur, a top hairline, and the sheet's bottom corners. Actions are right-aligned: Cancel (outline), then the primary save. On mobile they stack, with the primary on top.

### Dialogs (Modal, ConfirmDialog)
Rendered through a portal over the scrim, with a focus trap, Escape to close, scroll lock, and focus returned to the opener. `dismissable={false}` locks the dialog while saving. Modal has a header band (title plus optional description, hairline below, close button) and a scrolling body padded 20px by 24px. Widths run from sm to 4xl, and below 640px the modal becomes a bottom sheet. ConfirmDialog is an `alertdialog` with a 40px tinted icon disc (danger, partial or info). Initial focus lands on Cancel, so Enter never confirms by accident.

### Navigation (rail, top bar, Ctrl+K jump)
- **Rail:** the logo sits on a white plate at the top. Nav is grouped (Overview, Sales, Dishware, Accounts, Admin) under label-style group names in rail-muted, and filtered by role. Items are 15px medium in rail-text, padded 8px by 12px with 8px corners. Hover uses rail-hover with white text. Active uses rail-active with white text, a 3px rail-mark bar on the left edge, a rail-mark icon, and `aria-current="page"`. The longest matching path wins. Focus rings on the rail are white. The user block sits at the foot with a sign-out button.
- **Ctrl+K jump:** Ctrl/Cmd+K toggles it from anywhere, and so does the top-bar field with its mono "Ctrl K" keycap. It is a 36rem dialog at 12vh with a 56px search combobox. Results group invoices (shown in serial mono), clients and dishware items above "Go to" pages. Arrow keys move, Enter opens, and the active row tints final-tint. A footer shows keycap hints.

### Alerts, toasts, empty and loading states
Alerts use the state families (success = final, warning = partial, error = danger, info), with 8px corners and an 18px icon; errors use `role="alert"`. Toasts stack bottom-right with 10px corners and the lift shadow, sliding in over 220ms. EmptyState has a dashed 56px circle with an icon, a title-size heading, muted copy and one primary action. Spinners are primary green; skeletons shimmer between paper-sunk and paper.

## Do's and Don'ts

### Do:
- **Do** lead every record with its serial in mono (`.serial`), and make the PageHeader title the serial itself on record pages.
- **Do** show state with `StatusBadge` in lists and `StatusStamp` on record headers. Press the stamp (`animate`) only right after the user changed the state.
- **Do** put key figures in one ruled money strip sheet, with outstanding the loudest figure, and show "—" for anything that did not load.
- **Do** use `className="ledger"` for every table, with right-aligned amounts in tabular figures.
- **Do** show age as an AgingBar on its fixed scale, partial under 30 days and overdue from 30.
- **Do** end long forms with the sticky action bar: Cancel (outline) then the primary save.
- **Do** build dialogs on `Modal`/`useDialog` or `ConfirmDialog`, so focus trap, Escape and focus return come for free.
- **Do** keep text at 13px or larger and every text pair at 4.5:1 or better; `ink-muted` is the faintest colour safe for readable text.
- **Do** make every new page reachable from `navigation.ts`, so it appears in both the rail and Ctrl+K.

### Don't:
- **Don't** fill more than one button per view with primary green.
- **Don't** use logo-green behind or as body text (3.52:1). It is for focus, rules and large marks.
- **Don't** pick tints for status by hand on a page. Add the status to the StatusStamp map instead.
- **Don't** spend stamp violet on anything except PAID.
- **Don't** lay KPI figures out as separate floating tiles above a pale table. That is the grey SaaS dashboard this system rejects.
- **Don't** nest sheets or add shadows deeper than the sheet shadow to resting content.
- **Don't** set names, prose or headings in mono.
- **Don't** add `dark:` styles. The app is light only, for office laptops in daylight.
- **Don't** animate anything that is not a state change, and don't bypass the reduced-motion override.

<!-- Drift observed in the shipped build (2026-10-29), recorded rather than repaired:
1. ~~ink-faint below AA~~ — resolved 2026-10-29: token darkened to #5F706A (≥4.5:1 on white, paper and sunk).
2. The money-strip Figure cell is re-implemented locally in 9 files (Dashboard, EventDetail, InventoryAllocation, InventoryAuditDetail, StockParts, InvoiceDetail, Payments, SubscriptionDetail, plus ReportKit's export); the strip grid classes are copy-pasted on Dashboard, EventDetail and Payments. No kit component owns it.
3. ~~Raw hex outside tokens~~ — resolved 2026-10-29: `scrim`, `rail.mark`, `brand.primaryActive` and `danger.hover` are now tokens in tailwind.config.js and every usage references them.
4. ~~Wrong contrast comment~~ — resolved 2026-10-29: comment now states 5.15:1 (void) to 7.61:1 (paid).
5. The FORM raise "row actions revealed on focus" did not land: no focus-within/opacity reveal exists in any ledger. Not recorded as a rule.
6. InventoryAuditDetailPage's sticky bar bleeds to page gutters with negative margins instead of closing the sheet like the other forms.
7. FactWell (components/inventory/ModalParts.tsx) names its uppercase caption prop `eyebrow`; it captions record data ("Item", "Sending to event") like a dt, and is not a licence for kicker lines above headings.
-->
