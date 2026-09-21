# Nova’s Keyboard: An Input Architecture for Symbols, Commands, Pointing, and Chaos

## A guided tour through QMK, Linux input events, XKB, Hyper, mouse control, and the Any Key

This is not merely a custom keyboard layout.

It is a layered input architecture built around one central idea:

> **A physical key’s identity should be stable, while its meaning should be assigned at the most appropriate software layer.**

The keyboard firmware does not need to know that a particular key is “Any,” “Hyper,” “Compose,” “Meta,” or “Whisper.” It can emit a neutral, observable identity. Linux carries that identity as an input event. XKB, GNOME, or a host-side daemon then decides what the event means on this machine, at this moment.

That separation makes the keyboard easier to rebuild, easier to experiment with, and much less likely to require a firmware change every time a key acquires a new job.

It also makes possible a remarkably high-effort way to achieve pure chaos: one dedicated key whose purpose is to type a random character.

## Where this document lives

The canonical, version-controlled copy of this guided tour lives in the
`x1_keyboard_layout` repository as
`docs/nova-keyboard-input-architecture.md`. The ChatGPT Library copy is a
convenient reading and sharing mirror, not a second source of truth.

The detailed sources divide the changing facts deliberately:

- `docs/keyboard-architecture.md` records exact technical behavior,
  implementation boundaries, and acceptance evidence.
- `files/us-nova` is the authoritative XKB source for the current direct
  symbol assignments. Those assignments may change without this tour changing.
- `docs/symbol-vocabulary.md` explains the doctrine and rationale behind
  symbol placement without making this tour another copy of the live keymap.

The guide you are reading explains how the whole machine fits together and why
it is designed this way. When an exact current mapping or implementation detail
matters, follow the appropriate source above rather than treating this tour as
a status ledger.

---

# 1. The journey of a keypress

A useful way to understand the system is to follow one physical key through every layer.

```text
Physical switch
    ↓
QMK firmware identity
    ↓
Linux input event
    ↓
XKB keysym, modifier, or desktop-visible name
    ↓
GNOME shortcut or host-side daemon
    ↓
Text, command, mouse action, or synthetic keypress
    ↓
Application
```

Each layer has a deliberately limited job.

| Layer | Responsibility |
| --- | --- |
| Physical keyboard | Provide a position, switch, and keycap. |
| QMK firmware | Emit a stable key identity and implement timing-sensitive physical behavior. |
| Linux input layer | Carry key events from the device into the operating system. |
| XKB | Convert key identities into text symbols, modifiers, and named keysyms. |
| GNOME | Handle desktop shortcuts and input options. |
| Host-side daemons | Perform commands that do not belong in firmware or XKB. |
| Applications | Receive final text or shortcut behavior. |

This is the difference between building a keyboard layout and building an input architecture.

A conventional layout asks, “What character does this key type?”

This system asks several separate questions:

1. What physical key was pressed?
2. What stable identity did the firmware emit?
3. Should the event select a text symbol, act as a modifier, trigger a command, or change a layer?
4. Which software component is responsible for that meaning?
5. Should anything reach the focused application?

---

# 2. Stable identities instead of hardcoded meanings

Normal typing keys do not need much indirection. The physical A key can produce an A-related key event, and XKB can turn it into `a`, `A`, `ä`, or `Ä` depending on the active shift level.

Extra programmable keys are different.

A relegendable key may launch OBS today, control a light tomorrow, and become a speech-to-text control later. Reflashing the keyboard every time its job changes would make ordinary experimentation into firmware maintenance.

For those keys, the firmware should emit an identity that is:

- distinct;
- visible to Linux tools;
- semantically neutral;
- unlikely to be captured by the desktop;
- and stable even when the keycap and host binding change.

QMK’s programmable-button namespace fits that purpose.

```text
QMK:          PB_26
Linux evdev:  KEY_MACRO26
XKB/GNOME:    XF86Macro26
```

These are three names for the same event at three different layers.

A QMK programmable button is **not** a QMK macro.

A firmware macro performs behavior inside the keyboard—perhaps sending a sequence of keys. A programmable button merely says:

> “Programmable button number 26 was pressed.”

The host remains free to decide what button 26 means.

That distinction is the foundation of the relegendable and special-purpose keys.

---

# 3. Why not simply use F13 through F24?

Extended function keys are perfectly usable spare identities. They are widely recognized, easy to observe, and supported by many remapping tools.

But they are still function keys. They carry a historical and conceptual meaning as an extension of the F-key row.

`PB_n`, `KEY_MACROn`, and `XF86MacroN` say something more accurate:

> This is a programmable control with no predefined meaning.

F13 through F24 remain valuable fallback identities. They are simply not the first choice when QMK and Linux can carry a dedicated programmable-button event cleanly.

Other possible spare namespaces—media keys, browser keys, language keys, power keys, and obscure workstation keys—are less attractive because desktops may already assign behavior to them. A neutral key should be boring by default.

---

# 4. The projects and their boundaries

The complete keyboard system spans several repositories because the layers have different responsibilities.

| Project | Responsibility |
| --- | --- |
| `lemokey-x2-qmk` | Firmware, physical layout, programmable-button identities, deterministic tap/hold behavior, mouse layers, and the NumLock-position layer lamp. |
| `x1_keyboard_layout` | Host-side XKB symbols, text levels, modifier meanings, GNOME input options and extensions, and the canonical documentation hub. |
| `press-the-any-key` | GNOME shortcut registration, the Any Key script, `ydotoold`, and synthetic input through `/dev/uinput`. |
| `hyperkeyd` | Host-side Hyper command dispatcher that maps Hyper-plus-key events to executable scripts. |
| `whisper-ptt` | Host-side push-to-talk dictation for the dedicated Whisper key. |

These repositories should not be merged merely because they all concern one keyboard.

Firmware identity and host meaning are intentionally separate. The useful integration point is documentation: a single tour can show how the pieces cooperate without erasing their design boundaries.

---

# 5. The physical philosophy: stable positions, changeable legends

The keyboard includes relegendable keys whose printed labels can be changed.

A relegendable key has four layers of identity:

| Property | Stable or changeable? |
| --- | --- |
| Physical position | Stable |
| Firmware identity | Stable |
| Printed legend | Changeable |
| Host-side binding | Changeable |

For example, a key may permanently emit `PB_17`.

Today, its keycap and GNOME binding might identify it as a volume control. Later it might launch OBS. The firmware identity does not need to change.

This prevents a keyboard from becoming frozen around the first set of ideas that happened to be useful when the firmware was written.

The architecture preserves room for future curiosity.

---

# 6. Programmable-button allocation

The numbering is spatially meaningful rather than merely packed into the lowest available values.

| Physical area or role | Identity range |
| --- | --- |
| Left relegendable bank | `PB_1` through `PB_10` |
| Caps position / Hyper trigger | `PB_11` |
| Compose | `PB_12` |
| Top relegendable row | `PB_13` through `PB_24` |
| AltGr | `PB_25` |
| Any | `PB_26` |
| Meta transport | `KC_APP` |
| Menu transport | `KC_MENU` |
| Whisper | `PB_28` |
| Level5 | `PB_29` |
| Safe spare | `PB_30` |

The top row uses `PB_13` through `PB_24` partly because those numbers visually echo F13 through F24.

The left bank receives `PB_1` through `PB_10` as a distinct ten-key region.

The special bottom-row controls use the remaining identities because their conceptual roles are more stable.

## Current active special mappings

| Firmware identity | Linux/XKB identity | Current host meaning |
| --- | --- | --- |
| `PB_11` | `KEY_MACRO11` / `XF86Macro11` | Hyper trigger, exposed as `Hyper_L` |
| `PB_12` | `KEY_MACRO12` / `XF86Macro12` | Compose, exposed as `Multi_key` |
| `PB_25` | `KEY_MACRO25` / `XF86Macro25` | AltGr, exposed as `ISO_Level3_Shift` |
| `PB_26` | `KEY_MACRO26` / `XF86Macro26` | Any Key GNOME shortcut trigger |
| `KC_APP` | `<COMP>` | Meta, exposed as `Meta_R` with virtual Meta on real Mod3 |
| `KC_MENU` | `<PROP>` | Menu / application context menu |
| `PB_28` | `KEY_MACRO28` / `XF86Macro28` | Active Whisper / push-to-talk trigger |
| `PB_29` | `KEY_MACRO29` / `XF86Macro29` | Level5 shift |

XKB may internally identify these extra keys using names such as `<I674>` or `<I689>`. Those names belong to the compiled XKB keymap. They are not QMK matrix positions and not Linux evdev names.

---

# 7. The right-side special cluster

Moving rightward after the spacebar, the current full-size prototype places the special controls approximately like this:

```text
Space | Whisper | Menu/Right Control | Any/Meta | Compose/AltGr
```

The arrangement is ergonomic rather than decorative.

- **Whisper** became a high-frequency control immediately after deployment, validating its high-honor position near the spacebar.
- **Control and Meta** must remain easy to chord with other command keys.
- **Compose and AltGr** occupy a tactile outside edge, while AltGr remains close enough to Shift for fourth-level symbols.
- **Any** receives a real physical position because a dedicated chaos key deserves commitment.

Several of these positions are dual-role keys: tapping and holding produce different identities.

---

# 8. Deterministic tap/hold behavior

Many keyboard systems decide whether a key was tapped or held by measuring a timeout.

This design instead uses deterministic, interruption-based behavior.

The conceptual rule is:

- press and release a dual-role key by itself: perform its tap action;
- press another key while the dual-role key is still down: promote it immediately to its hold action;
- ignore ordinary timer guessing.

That means the user does not need to race a tapping term. A key becomes a hold because it participated in a chord, not because a clock expired.

## Current dual-role controls

| Physical control | Tap | Hold |
| --- | --- | --- |
| Compose/AltGr position | `PB_12` → Compose | `PB_25` → AltGr |
| Menu/Control position | `KC_MENU` → Menu / Application key | Right Control |
| Any/Meta position | `PB_26` → Any | `KC_APP` → Meta |
| Insert/Level5 position | Insert | `PB_29` → Level5 |

An earlier version also used tap Right Shift for CapsLock and hold for Shift. That was removed. Right Shift is now an ordinary Shift key, and CapsLock is toggled by pressing both Shift keys together.

The exact firmware implementation belongs to `lemokey-x2-qmk`. For this tour,
the important behavior is the rule itself: a lone press is a tap, an interrupted
press becomes a hold, and no timing threshold decides between them.

---

# 9. Typing space and command space are different systems

The keyboard distinguishes two ideas that are often blurred together.

| System | Purpose |
| --- | --- |
| Text shift levels | Select characters and symbols |
| Command modifiers | Invoke shortcuts, commands, and modes |

Shift, AltGr, and Level5 primarily belong to text selection.

Control, Alt, Super, Meta, and Hyper primarily belong to command behavior.

For example:

```text
A                   → a
Shift + A           → A
AltGr + A           → ä
Shift + AltGr + A   → Ä
```

Those are four text levels.

By contrast:

```text
Meta + D
Hyper + A
Control + Shift + T
```

are command gestures. They should not normally type `d`, `a`, or `t` into the focused application.

Keeping these systems conceptually distinct makes a heavily customized keyboard easier to reason about.

---

# 10. Text levels: three clutches for one keyboard

A car has a clutch pedal. Big trucks can have more elaborate clutch systems.

Well, guess what‼

This keyboard has three shift-like selectors.

Ordinary Shift is the familiar one. AltGr is another selector, opening Levels 3
and 4. Level5 is the next bit of the same idea, opening another set of levels.
Used together, those selectors let one physical key reach as many as eight
outputs without changing groups or modes.

| Level | Gesture | Role |
| --- | --- | --- |
| Level 1 | key | Normal US character |
| Level 2 | Shift + key | Shifted US character |
| Level 3 | AltGr + key | First additional symbol |
| Level 4 | Shift + AltGr + key | Shifted or paired additional symbol |
| Level 5 | Level5 + key | Next additional symbol where defined |
| Level 6 | Shift + Level5 + key | Shifted Level5 symbol |
| Level 7 | AltGr + Level5 + key | Combined-selector symbol |
| Level 8 | Shift + AltGr + Level5 + key | Shifted combined-selector symbol |

AltGr and Level5 are not separate subsystems. They are additional level
selectors in the same XKB model. Ordinary Shift selects Level 2. AltGr—the
traditional abbreviation for "Alternate Graphic"—is the familiar extra shift
key used to reach Level 3, with Shift+AltGr reaching Level 4. Level5 is simply
the next selector in that same progression. It is uncommon enough that it never
acquired a similarly familiar everyday key name, so the technical name stuck.

In that sense, the keyboard has three "shift" controls available for choosing
text: Shift, AltGr, and Level5.

The B key was the first eight-level canary, used to prove that all of those
levels could coexist cleanly in one group. That proof does not mean every key
needs eight assigned outputs. Empty higher levels are useful spare capacity.

The exact current characters assigned to any level belong in `files/us-nova`.
Placement favors mnemonic association, useful families, technical and
linguistic symbols, text-control characters, and personal delight. A symbol
earns a direct slot because Nova has a reason to reach for it, not because an
empty level needs to be filled.

---

# 11. The symbol vocabulary

The exact current direct-symbol map is intentionally **not duplicated here**.

The authoritative source is:

`x1_keyboard_layout/files/us-nova`

That is the file to inspect when the question is “What does this key produce
today?” It can change as the vocabulary evolves without requiring an editorial
revision of this guided tour.

`docs/symbol-vocabulary.md` has the complementary job: it records why symbols
earn direct slots, how mnemonic families and neighborhoods influence placement,
and which principles should survive future rearrangement.

For this tour, the important facts are simpler:

- Levels 1 and 2 preserve ordinary US typing.
- AltGr selects Levels 3 and 4.
- Level5 can extend selected keys through Levels 5–8.
- Higher levels may also give non-letter keys useful textual roles, including
  direction and invisible line-breaking control.
- Compose supplies characters that are useful but do not deserve permanent
  direct real estate.

A future reader or assistant should consult `files/us-nova`, not an old prose
example, before asserting a current symbol assignment.

---

# 12. Compose: vocabulary without permanent real estate

A four-level layout can provide many useful symbols, but not every character deserves a permanent position.

Compose fills that gap.

The Compose key is exposed as `Multi_key`. It allows mnemonic sequences to generate characters that are useful but too infrequent to occupy one of the fixed Level 3 or Level 4 slots.

This creates a hierarchy:

1. common US typing remains on Levels 1 and 2;
2. personally important symbols receive Levels 3 and 4;
3. less frequent characters remain available through Compose sequences;
4. truly unusual characters can still be entered through Unicode input or character tools.

Compose therefore complements the symbol table rather than competing with it.

---

# 13. Modifier allocation

XKB has eight real modifier bits whose names reflect X11 history. This design
assigns them by purpose:

| Real modifier slot | Intended role |
| --- | --- |
| Shift | Shift |
| Lock | CapsLock |
| Control | Control |
| Mod1 | Alt |
| Mod2 | Level5 |
| Mod3 | Meta |
| Mod4 | Super |
| Mod5 | AltGr / Level3 |

## Super is not Meta

Super belongs primarily to desktop and window-manager behavior. Meta is a
separate application and terminal command space.

Holding the Any/Meta key produces semantic Meta on real Mod3. Some application
stacks preserve that distinction better than others. Where an application loses
real Mod3, a narrow compositor-side adapter may be used for a specific gesture
rather than collapsing Meta back into Alt or Super. The current consumer details
and acceptance evidence belong in `docs/keyboard-architecture.md`.

## Hyper is not assigned a real modifier bit

Hyper is exposed as `Hyper_L`, but its command dispatcher observes the physical
event below XKB. It therefore does not need to consume one of the limited real
modifier bits.

## NumLock does not own Mod2

The physical NumLock position toggles the mouse layer; the keypad is intended to
remain numeric. Genuine NumLock semantics are therefore not part of this design,
leaving Mod2 available for Level5. The exact host-state protections belong in
the technical architecture document.

---

# 14. CapsLock without a CapsLock key

The physical CapsLock position is too valuable to dedicate to a rarely used lock.

It emits `PB_11`, which XKB turns into `Hyper_L`.

CapsLock remains available through the GNOME/XKB option:

```text
shift:both_capslock
```

Pressing both Shift keys toggles CapsLock.

Right Shift itself is now a plain Shift key. An earlier tap/hold arrangement made a quick Right Shift tap behave as CapsLock, but that produced accidental activations. Both-Shift Caps preserves the function without making ordinary typing fragile.

---

# 15. Hyper: a command namespace

The Hyper key arms a personal command namespace.

```text
Hyper down      → dispatcher armed
Hyper + key     → run the matching user command
Hyper up        → dispatcher idle
```

There are no prefixes, sequence buffers, or timing grammar. Each alphanumeric
key pressed while Hyper is held is one complete command event.

The daemon stays deliberately narrow:

```text
key event → executable script
```

The scripts own the actions. The exact current Hyper command vocabulary is not
listed here because it can change independently of the keyboard architecture.

## Current limitation: listening is not suppression

HyperKeyD currently listens to evdev without grabbing and replacing the keyboard
stream. A Hyper command can therefore execute **and** allow its ordinary command
letter to reach the focused application.

That leakage is predictable enough to work around in daily use, but removing it
would be a much larger architectural commitment. True suppression would require
a component in the critical input path to grab the physical keyboard, consume
Hyper command events, and faithfully re-emit every allowed ordinary event
through a virtual keyboard.

Until that tradeoff is worth making, Hyper remains a command plane with a known
leakage edge. Exact HyperKeyD implementation and deployment details belong in
the `hyperkeyd` repository.

---

# 16. The Any Key: industrial-grade chaos

There was once an unused key.

That is difficult to imagine now, but when Nova still had one, an old family
joke suggested what to put on it. His sister loved the familiar computer prompt
joke: “It says to press the Any key. Where is the Any key?”

So Nova labeled one **Any**.

That immediately raised a better question: if an Any key really existed, what
should it actually do?

The answer he settled on was literal: pressing **Any** should press any of the
ordinary character keys for him. So each press chooses one at random and the
computer receives that character.

It was not solving an important productivity problem. Nova built it because it
was funny, because he wanted it, and because figuring out how to make a physical
key cause software on the host to generate input was a useful way to learn how
the whole input stack fit together.

That experiment opened up ideas that became useful elsewhere. Once the path
from a stable physical key identity to host software and then back into synthetic
input made sense, more practical features became easier to imagine and build.
Whisper's ability to place locally transcribed speech into the active
application is one descendant of that understanding.

The Any key is therefore deliberately nonessential. Someone could reproduce the
rest of Nova's keyboard and leave it out without losing the architecture. Nova
keeps it because he learned from it, enjoys having it, and it still occasionally
comes in handy.

The exact implementation belongs in `wdcallahan/press-the-any-key`.

---

# 17. The mouse layer

The physical NumLock key does not toggle keypad meaning. The keypad remains a
numeric keypad.

Instead, that physical position toggles a firmware mouse layer:

```text
NumLock position → toggle mouse layer

On mouse layer:
    arrows       → pointer movement
    navigation positions → mouse buttons
    hold either Shift    → scroll sublayer
    arrows       → wheel movement
```

This is deliberate: the keypad should be a keypad, while pointer control should
be an explicit alternate mode rather than the traditional NumLock competition
between numbers and navigation.

The physical NumLock lamp reports the firmware layer rather than host NumLock:

| Firmware state | NumLock lamp |
| --- | --- |
| Base | off |
| Mouse | solid |
| Scroll | blinking |

The exact QMK keycodes, host-state isolation, and implementation history belong
in the firmware and technical architecture documentation.

---


# 18. Whisper: local voice typing on a real key

A lot of people already voice-type on their phones. Tap the microphone button
on the keyboard, talk instead of typing, and clean up the occasional mistake
afterward. That is often much faster than typing the whole thought by hand.

Desktop computers do not usually make that experience nearly as convenient,
and common speech-input services often send the audio or transcription work to
a remote service.

The Whisper key gives Nova a local version of that familiar interaction.

Hold the key and talk. Release it when the utterance is finished. The workstation
records and transcribes the speech locally, checks that the intended application
context is still appropriate, and inserts the resulting text without pressing
Enter.

The transcription does not have to be perfect to be useful. Correcting a few
words afterward is often easier than typing the entire passage from scratch.

Whisper also demonstrates the architecture's central rule especially well. The
physical key has a stable programmable-button identity; the speech system behind
it can evolve independently without requiring the keyboard firmware to know
anything about microphones or transcription.

The exact microphone, model, audio pipeline, focus checks, deployment, and
runtime diagnostics belong in `wdcallahan/whisper-ptt`.

---

# 19. One keyboard, several kinds of meaning

The design can now be summarized by category.

## Ordinary text

Handled primarily by QMK key identity plus XKB Levels 1 and 2.

```text
key → letter, digit, punctuation
```

## Extended text

Handled by the text selectors—Shift, AltGr, and Level5—plus Compose.

```text
key + text selector → Unicode symbol
```

## Desktop shortcuts

Handled by GNOME using named identities such as `XF86Macro26`.

```text
programmable identity → desktop action
```

## Command dispatch

Handled by `hyperkeyd` reading evdev.

```text
Hyper + alphanumeric key → executable script
```

## Pointer control

Handled in QMK because the behavior is a physical alternate layer.

```text
mouse layer + physical key → mouse movement, click, or wheel event
```

## Synthetic input

Host-side tools can also generate keyboard input and feed it back into the
active application.

```text
host action → generated keyboard input
```

The exact mechanism belongs with the software that implements it.

The system does not insist that one mechanism solve every problem.

It assigns each problem to the layer best suited to it.

---

# 20. Why the architecture is intentionally distributed

A monolithic keyboard system might appear simpler because all behavior lives in one place.

In practice, that would create poor boundaries.

Putting everything in firmware would mean:

- reflashing for ordinary command changes;
- embedding desktop-specific behavior into the keyboard;
- losing access to rich host software;
- and making one keyboard less portable between machines.

Putting everything in a host remapper would mean:

- giving up deterministic physical tap/hold behavior;
- relying on a critical daemon for basic keyboard operation;
- and blurring text, command, and pointer semantics.

Putting everything in XKB would be impossible because XKB is excellent at symbol and modifier selection but is not a general command runtime.

The distributed design is more complex in the small but cleaner in the large.

Each component is narrow enough to explain:

- QMK handles physical behavior.
- XKB handles symbols and modifiers.
- GNOME handles desktop shortcuts.
- HyperKeyD dispatches scripts.
- Any Key uses `ydotool` for deliberate synthetic input.

---

# 21. What is authoritative, and what is explanatory?

This document is the readable whole-system tour. It explains what Nova's
keyboard does, how the pieces fit together, and why the design has this shape.

It is deliberately **not** the live status ledger for every implementation
project.

Use these sources when exact current detail matters:

- `files/us-nova` — current XKB symbol and modifier assignments.
- `docs/symbol-vocabulary.md` — symbol-placement doctrine and rationale.
- `docs/keyboard-architecture.md` — exact technical behavior, boundaries, and
  acceptance evidence.
- `wdcallahan/lemokey-x2-qmk` — firmware, physical mapping, tap/hold, and
  pointer layers.
- `wdcallahan/press-the-any-key` — Any Key implementation.
- `wdcallahan/hyperkeyd` — Hyper command dispatcher implementation.
- `wdcallahan/whisper-ptt` — speech-input implementation.

The canonical copy of this tour lives in `x1_keyboard_layout`. ChatGPT Library
copies are reading and sharing mirrors, not independent authorities.

A change to an installer, test procedure, service implementation, or project
milestone does not require changing this tour. A change to what the keyboard
*means or does for Nova* does.

---

# 22. Design principles worth preserving

The exact hardware and software will change. The principles are more durable.

## Separate identity from meaning

A key should not require new firmware merely because its host-side job changes.

## Put timing-sensitive physical behavior in firmware

Tap/hold and layer behavior should remain deterministic even when desktop software is busy or absent.

## Keep text selection distinct from command dispatch

AltGr and Level5 select symbols. Hyper and Meta select commands.

## Preserve ordinary typing

The base layout remains recognizable US typing. Custom power lives on additional levels and dedicated keys.

## Use neutral identities for relegendable controls

A programmable key should not masquerade as sleep, brightness, browser back, or another event with inherited behavior.

## Keep daemons narrow

HyperKeyD dispatches scripts. It does not need to know what those scripts do.

## Make configuration reproducible

Ansible and documented host configuration turn a clever workstation trick into something that can be rebuilt.

## Leave useful space unfilled

A spare programmable button and unpopulated Level5 slots beyond the B canary
are invitations rather than omissions. Whisper demonstrates that such prepared
space can later become a daily-use feature without destabilizing the layers
around it.

## Permit delight

A system used every day is allowed to contain jokes, strange historical letters, pointing hands, an irony mark, and one meticulously engineered chaos key.

---

# 23. Closing: the keyboard as a personal language

Most keyboards present themselves as fixed objects.

This one behaves more like a small language.

Its physical positions form the grammar. QMK supplies stable nouns. XKB adds inflection and symbol vocabulary. Meta and Hyper create command spaces. Layers change the interpretation of whole regions. Compose allows productive phrases. Host daemons turn selected events into actions.

The design is technical, but its purpose is personal.

It reflects a preference for:

- stable interfaces;
- free software;
- explicit control;
- recoverable configuration;
- meaningful distinctions;
- symbols worth remembering;
- and experiments that remain funny after they become infrastructure.

The Any Key is not an exception to the architecture.

It is the purest expression of it.

A neutral physical identity travels cleanly through every layer, reaches the one component responsible for its meaning, and produces exactly one carefully unconstrained result.

That is a great deal of engineering to type the wrong character on purpose.

It is also a keyboard that unmistakably belongs to its owner.

---

# Appendix A: Compact identity cross-reference

| Role | QMK | Linux | Host meaning |
| --- | --- | --- | --- |
| Hyper | `PB_11` | `KEY_MACRO11` | `Hyper_L`, HyperKeyD trigger |
| Compose | `PB_12` | `KEY_MACRO12` | `Multi_key` |
| AltGr | `PB_25` | `KEY_MACRO25` | `ISO_Level3_Shift`, Mod5 |
| Any | `PB_26` | `KEY_MACRO26` | `XF86Macro26`, GNOME shortcut |
| Meta | `KC_APP` | `<COMP>` | `Meta_R`, virtual Meta, real Mod3 |
| Menu | `KC_MENU` | `<PROP>` | `Menu` |
| Whisper | `PB_28` | `KEY_MACRO28` | Local release-to-finalize dictation service |
| Level5 | `PB_29` | `KEY_MACRO29` | `ISO_Level5_Shift`, Mod2 |

# Appendix B: Runtime diagrams

## Any Key

```text
tap physical Any/Meta key
    ↓
PB_26
    ↓
KEY_MACRO26
    ↓
XF86Macro26
    ↓
GNOME shortcut
    ↓
any.sh
    ↓
ydotool
    ↓
ydotoold
    ↓
/dev/uinput
    ↓
random alphanumeric character
```

## Hyper command

```text
hold physical Hyper key
    ↓
PB_11 / KEY_MACRO11
    ↓
HyperKeyD arms
    ↓
press A
    ↓
~/.hyper/a.sh executes
```

## Whisper push-to-talk

```text
hold physical Whisper key
    ↓
PB_28 / KEY_MACRO28
    ↓
record speech locally
    ↓
release and transcribe
    ↓
verify application context
    ↓
insert text without Enter
```

## Eight-level text selection

```text
key                              → Level 1
Shift + key                      → Level 2
AltGr + key                      → Level 3
Shift + AltGr + key              → Level 4
Level5 + key                     → Level 5
Shift + Level5 + key             → Level 6
AltGr + Level5 + key             → Level 7
Shift + AltGr + Level5 + key     → Level 8
```

For the current character assigned at any of those levels, read `files/us-nova`.

## Mouse layer

```text
press physical NumLock position
    ↓
toggle MOUSE layer
    ↓
arrow cluster becomes pointer movement
    ↓
hold either Shift
    ↓
SCROLL layer becomes active
    ↓
arrow cluster becomes wheel movement
```

# Appendix C: Source projects

- `wdcallahan/lemokey-x2-qmk`
- `wdcallahan/x1_keyboard_layout`
- `wdcallahan/press-the-any-key`
- `wdcallahan/hyperkeyd`
- `wdcallahan/whisper-ptt`

All are free-software projects, with the individual repositories carrying their authoritative licensing and implementation details.
