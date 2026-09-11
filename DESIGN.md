---
name: "Church Care Hub"
description: "A calm, joined care register for discreet ministry handoffs."
colors:
  evergreen-deep: "#123d2c"
  evergreen-action: "#245b43"
  evergreen-soft: "#e8f0eb"
  sda-yellow: "#f4c430"
  yellow-deep: "#987316"
  yellow-wash: "#fff8d8"
  ink: "#24312c"
  muted: "#64716b"
  mineral-rule: "#d9e0dc"
  mineral-rule-strong: "#bac7c0"
  paper: "#f3f4ef"
  surface: "#ffffff"
  surface-subtle: "#f7f8f5"
  directory-wash: "#eef3f0"
typography:
  headline:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "29px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  metadata:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "0.04em"
rounded:
  none: "0"
  nav: "5px"
  control: "6px"
  surface: "8px"
  register: "10px"
  panel: "12px"
  pill: "999px"
spacing:
  micro: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  xxl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.evergreen-deep}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
  button-primary-hover:
    backgroundColor: "{colors.evergreen-action}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.evergreen-deep}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
  nav-active:
    backgroundColor: "rgba(255, 255, 255, 0.12)"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.nav}"
  role-pill:
    backgroundColor: "{colors.evergreen-soft}"
    textColor: "{colors.evergreen-action}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  directory-search:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
  directory-row-selected:
    backgroundColor: "{colors.yellow-wash}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "15px 17px 14px 20px"
  care-status:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "20px 24px"
  field-solid:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "13px 14px"
  care-dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.register}"
    padding: "24px"
---

# Design System: Church Care Hub

## Overview

**Creative North Star: "Welcome Desk Handoff"**

Church Care Hub feels like one composed handoff register at a church welcome desk: orderly, discreet, and ready for the next ministry worker. The visual system makes operational continuity tangible through joined compartments, literal labels, quiet typography, and a restrained paper-and-rule material language.

Deep evergreen establishes trust and owns navigation and committed actions. SDA yellow stays rare and legible as the church mark, current-record wash, selection marker, guidance state, and focus signal. Warm neutrals keep those roles separated, while compact density lets ushers move quickly without making a person feel like a metric.

**Key Characteristics:**

- One continuous care register instead of a pile of floating cards.
- Deep evergreen navigation and actions, with SDA yellow reserved for identity and state.
- Quiet Plus Jakarta Sans hierarchy with plain operational wording.
- Joined desktop panes and directory-first mobile stacking.
- Fine mineral rules, solid fields, restrained corners, and low ambient depth.
- Purposeful selection motion with an equivalent reduced-motion state.

## Colors

The palette is a disciplined evergreen-and-yellow identity carried by ivory paper, white work surfaces, dark ink, and mineral dividers.

### Primary

- **Deep Evergreen:** Owns the application rail, trust-bearing surfaces, and primary actions.
- **Action Evergreen:** Handles hover states, icons, and supporting green emphasis without competing with the rail.
- **Soft Evergreen:** Supports quiet role pills and low-emphasis positive context.

### Secondary

- **SDA Yellow:** Marks the church identity, the shared selection dot, and focus or guidance states.
- **Deep Yellow:** Carries restrained text actions where yellow must remain readable rather than fill a large area.
- **Yellow Wash:** Identifies the current directory record without turning the row into a promotional banner.

### Neutral

- **Ink:** Primary readable content and record values.
- **Muted Ink:** Supporting descriptions, metadata, and empty-state language.
- **Mineral Rule:** The default divider that constructs the register.
- **Strong Mineral Rule:** Field boundaries and stronger section endings.
- **Ivory Paper:** The page ground around the working register.
- **White Surface:** Active work areas, fields where specified, and contiguous record sections.
- **Subtle Surface:** Solid field fill, history ground, and quiet hover treatment.
- **Directory Wash:** A faint cool-green tint that distinguishes the compact directory from the white record pane.

### Named Rules

**The Separated Signal Rule.** Evergreen and yellow never merge into a large blended surface; neutral paper and rules keep their semantic roles distinct.

**The Yellow Means Here Rule.** Use yellow only for identity, current selection, guidance, and focus; its rarity is what makes it useful.

## Typography

**Display Font:** Plus Jakarta Sans (with system sans fallbacks)
**Body Font:** Plus Jakarta Sans (with system sans fallbacks)

**Character:** A quiet workhorse sans throughout. Weight, scale, and compact metadata create hierarchy; decorative display faces, novelty lettering, and ornamental kickers are absent.

### Hierarchy

- **Headline** (700, 29px, 1.15): Selected-person names and the strongest in-register heading; tight tracking keeps the work surface compact.
- **Title** (700, 26px, 1.15): Directory and section ownership headings.
- **Body** (400, 16px, 1.55): Instructions, entered content, and primary reading copy.
- **Label** (700, 13px, 1.3): Buttons, form labels, status names, and operational actions.
- **Metadata** (650, 11px, 0.04em): Uppercase fact labels and compact record metadata; values remain sentence case.

### Named Rules

**The Workhorse Rule.** Let one sans family carry every role and make hierarchy through disciplined size and weight, never through decorative type.

## Layout

The workspace sits inside a maximum content width of 1600px. On desktop, the People surface is a joined two-column register with no gap: a compact directory between 300px and 340px wide meets a flexible record pane at one top edge. Their shared border is the seam; the directory removes its right border and the record removes its left-side corner rounding so the pair reads as one object.

The directory header and record header share a 116px minimum height. Directory rows are a consistent 76px, the list scrolls within a 540px ceiling, and the record continues through status, facts, entry forms, and history as ruled compartments rather than detached cards. Facts use three columns at full width and two below 1100px.

At 900px and below, the directory stacks first, followed by the selected record, actions, and history. An 8px evergreen boundary marks the handoff between directory and record while preserving the outer 10px register silhouette. At 620px and below, status, facts, form, and history sections become single columns; content padding contracts to 12px, editable fields use 16px text, and primary controls remain reachable without horizontal overflow. The Cyventura credit closes the page in a 40px-tall strip aligned bottom-right, using a 46px mark on desktop and 44px on mobile.

**The Joined-at-the-Top Rule.** Directory and record begin on the same edge and share one seam on desktop; responsive stacking preserves their order and visual handoff.

## Elevation & Depth

The system is flat by default. Paper tone, white surfaces, and one-pixel mineral rules establish most depth; a low ambient shadow belongs to the joined record pane, while stronger lift is reserved for the modal dialog over its dark evergreen veil.

### Shadow Vocabulary

- **Quiet Surface** (`0 1px 2px rgba(18, 61, 44, .06)`): Minimal ambient separation for ordinary panels outside the joined register.
- **Joined Record** (`0 12px 34px rgba(18, 61, 44, .07)`): A single low shadow under the record pane, never repeated on its inner sections.
- **Dialog Lift** (`0 24px 70px rgba(18, 61, 44, .18)`): Reserved for the person form above the modal backdrop.

### Named Rules

**The Flat-by-Default Rule.** Use rules and tonal adjacency first; shadows never turn status, facts, forms, or history into a floating-card pile.

## Shapes

Corners are restrained and functional: navigation uses 5px, controls use 6px, ordinary surfaces use 8px, and the joined register and dialog use 10px. The joined desktop register rounds only its outside corners, leaving the center seam square. Directory rows, status cells, fact cells, form halves, and history sections stay square inside the parent silhouette. Full pills are limited to compact role and count states; the yellow selection marker is a 6px circle.

**The Outer-Edge Rule.** Round the enclosing register, not every compartment inside it.

## Components

### Buttons

- **Shape:** Compact, gently squared controls with a 6px radius and a 44px minimum target.
- **Primary:** Solid deep evergreen with white text and no shadow; People-directory actions may compress vertically to 40px while retaining a 44px mobile tap target.
- **Hover / Focus:** Hover shifts to action evergreen without lift. Press moves down 1px. Keyboard focus uses a visible 3px translucent yellow outline with a 3px offset.
- **Secondary / Text:** Secondary actions use a white fill, strong mineral border, and deep evergreen text. Text actions use deep yellow and underline on hover.

### Chips

- **Style:** Role and count pills use soft evergreen, action-evergreen text, and a full radius.
- **State:** Pills summarize context only; selection belongs to the row wash and traveling dot, not to a chip.

### Cards / Containers

- **Corner Style:** The care workspace is a single 10px outer register; internal cells are square.
- **Background:** The directory uses a cool washed surface, the record uses white and subtle neutral sections, and the page rests on ivory paper.
- **Shadow Strategy:** Only the record pane receives low ambient separation; internal sections rely on rules.
- **Border:** One-pixel mineral rules join every section and define the desktop seam.
- **Internal Padding:** Dense rows use roughly 15px to 20px; major work sections use 20px to 28px.

### Inputs / Fields

- **Style:** Solid subtle-neutral fields with a strong mineral border, 6px radius, and a 46px minimum height; text areas open to at least 104px.
- **Focus:** Yellow border plus a restrained translucent yellow ring. The directory search applies the ring to its whole joined search shell.
- **Error / Disabled:** Errors remain literal and announced; disabled committed actions preserve their shape and label while clearly losing availability.

### Navigation

The desktop rail is deep evergreen through the content height. Navigation is left aligned, 5px-rounded, and white at full strength only for the active item; hover and active states use translucent white fills rather than yellow blocks. Mobile uses the compact menu affordance while the page title and task context remain visible.

### Selected Directory Record

Each directory row is a ruled 76px register line with name and contact on the left and compact context on the right. Selection changes the wash immediately and moves one shared 6px yellow dot to the selected row over `190ms cubic-bezier(.22, .75, .28, 1)`. `aria-pressed` communicates the same state to assistive technology, and reduced-motion preferences remove the travel transition.

**The One Marker Rule.** One shared dot travels between records; never create a decorative marker per row or add selection spectacle.

### Care Record Sections

Status summaries, person facts, visit entry, support entry, and history are contiguous cells. Status uses green icons, literal state labels, compact metadata, and large tabular counts; form actions align to the start so the next care action remains obvious.

### Person Dialog

The person form is a white 10px dialog over a dark evergreen backdrop. It uses `role="dialog"`, `aria-modal="true"`, and a labelled title; initial focus enters the first enabled control, Tab and Shift+Tab stay trapped, Escape or a direct backdrop click closes it, and focus returns to the prior element. These interaction rules are part of the component, not optional polish.

### Site Credit

The Cyventura mark is a compact, transparent footer element at the bottom-right. It never becomes a promotional banner, floats over content, or competes with the care workflow.

## Do's and Don'ts

### Do:

- **Do** keep evergreen responsible for navigation, trust, and committed actions.
- **Do** use yellow sparingly for the church mark, current record, guidance, and visible focus.
- **Do** preserve the joined-at-top register seam and compact directory boundary.
- **Do** stack directory, selected record, actions, and history in that order on mobile.
- **Do** keep editable fields solid, readable at 16px on small screens, and primary actions at least 44px.
- **Do** preserve the shared selection marker, reduced-motion override, dialog focus trap, Escape close, and focus restoration.
- **Do** keep the Cyventura footer compact and aligned to the bottom-right.

### Don't:

- **Don't** split the People workspace into a pile of floating cards or add gradients, glass, bevels, or decorative lift.
- **Don't** blend evergreen and yellow across large surfaces or use yellow as routine decoration.
- **Don't** replace literal operational labels with promotional copy, decorative kickers, or dashboard jargon.
- **Don't** hide primary actions, introduce horizontal overflow, or reduce editable text below 16px on mobile.
- **Don't** fabricate or expose visitor data in previews, screenshots, or design-system examples.
- **Don't** enlarge, center, or otherwise promote the footer credit beyond its quiet closing role.
