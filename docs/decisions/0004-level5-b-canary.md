# ADR-0004: Populate B as the first eight-level Level5 canary

- **Version:** 1.0.0
- **Date:** 2026-07-26
- **Status:** Accepted for deployment
- **Behavior label:** `nova-level5-b-canary-2026-07-26`
- **Depends on:** ADR-0003 / `nova-single-group-keypad-2026-07-26`
- **Validation runbook:** `docs/runbooks/validate-level5-b-canary.md`
- **Repository owner:** `wdcallahan/x1_keyboard_layout`

## Context

The physical Level5 hold is already complete:

```text
N_INS hold -> PB29 -> KEY_MACRO29 -> <I692> -> ISO_Level5_Shift -> Mod2 / LevelFive
```

The single-group Nova map compiled with that transport, and live modifier inspection
showed `I692` owning real Mod2 and virtual LevelFive. Ordinary keys still had at
most four symbols, however, so the selector had no fifth-level vocabulary to
select.

Nova had already approved one eight-symbol B-key vocabulary and its one-line
source style:

```text
b B β α 🐇 🐰 🥬 🥕
```

The symbol-vocabulary doctrine rejects filling unused levels merely for
completeness. The first Level5 deployment therefore needs to be a narrow canary,
not a bulk expansion.

## Decision

Make only `<AB05>` explicit eight-level input:

```xkb
key <AB05> { type[Group1] = "EIGHT_LEVEL_SEMIALPHABETIC", symbols[Group1] = [ b, B, U03B2, U03B1, U1F407, U1F430, U1F96C, U1F955 ] }; // β, α, 🐇, 🐰, 🥬, 🥕
```

The standard `EIGHT_LEVEL_SEMIALPHABETIC` type is the closest extension of the
key's existing inferred behavior. It keeps ordinary B alphabetic, keeps the
existing Level3/Level4 Greek behavior, and activates Level5 as the second
four-level selector.

With Caps Lock off, the resolved vocabulary is:

| Chord | Result |
| --- | --- |
| B | `b` |
| Shift+B | `B` |
| Level3+B | `β` |
| Shift+Level3+B | `α` |
| Level5+B | `🐇` |
| Shift+Level5+B | `🐰` |
| Level3+Level5+B | `🥬` |
| Shift+Level3+Level5+B | `🥕` |

The standard type's Caps Lock behavior is also deliberate and documented rather
than left implicit:

| Chord while Caps Lock is on | Result |
| --- | --- |
| B | `B` |
| Shift+B | `b` |
| Level3+B | `Β` |
| Shift+Level3+B | `Α` |
| Level5+B | `🐰` |
| Shift+Level5+B | `🐇` |
| Level3+Level5+B | `🥬` |
| Shift+Level3+Level5+B | `🥕` |

The Greek Caps behavior already existed on the four-symbol B key. The rabbit
pair swaps under Caps because that is how the standard semialphabetic type maps
Levels 5 and 6. If that proves undesirable in daily use, a later decision may
introduce a Nova-specific type; the first canary does not invent one preemptively.

## Scope boundary

This decision:

- changes no QMK firmware;
- changes no transport or real-modifier assignment;
- adds no second XKB group;
- leaves every key except B at its existing number of levels;
- does not treat Level5 as a command modifier;
- does not authorize filling other empty symbol slots.

## Offline proof

The exact candidate was compiled on 2026-07-26 with libxkbcommon 1.6.0 against
the standard `complete` types, compatibility, and evdev keycodes. Programmatic
state resolution produced all eight approved symbols in order and verified every
Caps Lock case listed above.

MACE still needs the repository runbook's independent `xkbcli` proof with its
installed libxkbcommon 1.13.1, followed by deployment and a physical-key
acceptance test.

## Consequences

Level5 changes from an architecturally available selector into a working text
dimension with one deliberately small acceptance surface. The B key becomes the
canary for the full combination of Shift, Level3, Level5, Lock, Unicode
keysyms, and the single-group rules assembly.

A successful live test proves the Level5 pipeline without committing the rest
of the keyboard to an eight-level vocabulary.

## Rollback

Rollback is a new commit that restores the four-symbol B line while retaining
the durable `Nova custom single-group` display name, followed by the normal
Ansible deployment and one deliberate GNOME keymap reload. Published history is
not rewritten.
