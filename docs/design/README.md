# AIdeas intake design specification

Accepted concept files:

- `aideas-intake-desktop-v1.png` — complete 1536×1024 desktop workspace;
- `aideas-intake-mobile-v1.png` — mobile interaction transformation.

The images are design references only. Product UI is implemented as semantic,
accessible React components; the screenshots are never shipped as interactive
UI.

## Information architecture lock

- product and project identity;
- provider connection truth;
- project/phase navigation;
- one prominent intake question at a time;
- progress, notes, media and known facts;
- workflow state and approval policy;
- save and send actions;
- explicit demo/non-persistence notice.

No marketing hero, fake chart, fake metric, decorative terminal or fabricated
agent success belongs in this product surface.

## Design tokens

| Role | Value |
|---|---|
| background | true white `#ffffff` |
| foreground | charcoal `#171923` |
| primary | cobalt `#164ee8` |
| primary text | white |
| light surface | cool gray `#f6f7f9` |
| border | `#d9dde5` |
| muted text | `#606572` |
| forge accent | copper `#a84f22`, informational use only |
| UI typography | humanist/system sans |
| display typography | restrained Georgia-like serif |
| radius | 8–10px; no giant rounded wrappers |
| shadow | near-zero; only transient overlay elevation |

## Component families

- app shell, header, persistent desktop sidebar and mobile bottom navigation;
- question surface with index, textarea, help/error text;
- progress indicator;
- notes/media/facts utility regions;
- mobile collapsible sections;
- workflow timeline and semantic status badges;
- approval switch and primary/secondary actions;
- provider and live status announcements.

## Responsive contract

- mobile: single column, collapsible secondary regions, action dock and bottom
  phase navigation, 44px targets;
- tablet: single main column with more whitespace; secondary content may expand;
- desktop: sidebar + main workspace; workflow rail appears at 1280px;
- ultra-wide: primary workspace is capped and centered; rails do not drift
  across the monitor.

## Interaction truth

Current v0.1 behavior:

- edit idea and notes in memory;
- select local files and show count without uploading bytes;
- toggle repository approval preference in memory;
- validate intake length;
- submit moves Research to a truthful blocked state because no provider exists;
- save explains that SQLite persistence is not implemented;
- unavailable sections explain their dependency instead of faking navigation.

## Accessibility gate

- one page `<h1>` and logical headings;
- skip link and semantic regions;
- visible labels and error association;
- keyboard-operable controls and visible focus;
- live status for mutations;
- color is not the only status signal;
- 44px touch targets on mobile;
- reduced-motion support;
- desktop/mobile contrast verified in the rendered browser, not only token table.

## Fidelity review checklist

Before design sign-off compare concept and browser render for:

1. exact visible copy and truthful state;
2. desktop shell proportions and primary question prominence;
3. typography hierarchy and control text size;
4. white/cool-gray/cobalt/copper palette;
5. border, radius and open-container model;
6. workflow rail anatomy and status labels;
7. mobile collapse/action/navigation behavior;
8. keyboard, focus, overflow and error states.
