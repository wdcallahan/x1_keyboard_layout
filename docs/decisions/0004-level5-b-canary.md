# ADR-0004: Populate B as the first eight-level Level5 canary

- **Version:** 1.2.0
- **Date:** 2026-07-26
- **Status:** Live canary rejected; GNOME Mod2 correction pending
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

### MACE offline proof receipt

On 2026-07-26, MACE fast-forwarded from `df878c0` to `2448dfe` and ran the
repository proof with its installed xkbcli/libxkbcommon 1.13.1. The compiled
keymap established all of the following:

- `<AB05>` uses `EIGHT_LEVEL_SEMIALPHABETIC`;
- its symbols are exactly `b B β α 🐇 🐰 🥬 🥕`;
- `<COMP>`, `<I688>`, and `<I692>` retain Meta/Mod3, LevelThree/Mod5, and
  LevelFive/Mod2 respectively;
- the map contains no Group2-or-higher symbols.

The command concluded `PASS: Level5 B candidate compiled in one group` and
cleared the candidate for its first managed deployment.

## First live deployment and canary rejection

MACE pulled repository commit `21f09d9`, installed the symbols file, passed both
byte comparisons, and proved Ansible idempotence: the first run changed one file
and the second changed zero. MACE then rebooted to establish a fresh GNOME
Wayland keymap.

The first live B test produced only the upper four symbols:

```text
🐇 🐰 🥬 🥕 🐇 🐰 🥬 🥕
```

Ordinary B therefore produced `🐇`; the physical Level5 hold did not change the
result. The Unicode vocabulary, eight-level type, and physical modifier
combinations were working, but LevelFive was already active before any key was
pressed.

MACE's GNOME state then reported:

```text
remember-numlock-state = true
numlock-state          = true
```

GNOME's settings schema remembers NumLock between sessions. Mutter's native
seat implementation restores that state by explicitly locking the real
modifier named `Mod2`; it does not resolve the current keymap's virtual NumLock
assignment. Nova deliberately uses real Mod2 for LevelFive, so the restored
NumLock state pre-locked LevelFive despite `<NMLK>` being void and absent from
modifier maps.

Authoritative implementation references:

- [GNOME keyboard settings schema](https://github.com/GNOME/gsettings-desktop-schemas/blob/7b18982df798313a7adbcca9c9f5a8c3d819cf4c/schemas/org.gnome.desktop.peripherals.gschema.xml.in)
- [Mutter native Mod2 restoration](https://github.com/GNOME/mutter/blob/52924b84de06c4ce01551449c2dc2d8d74ea754c/src/backends/native/meta-seat-impl.c)

The corrective decision is to manage both GNOME settings as `false` before the
next session reload:

```text
remember-numlock-state = false
numlock-state          = false
```

Repository commit `4264de0` adds that policy to `install_layout.yml`. A fresh
session and the original physical acceptance suite remain required.

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
