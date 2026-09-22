# Nova’s Keyboard: An Input Architecture for Symbols, Commands, Pointing, and Chaos

## A guided tour through QMK, Linux input events, XKB, Hyper, mouse control, and the Any Key

This is not merely a custom keyboard layout.

It is a layered input architecture in which different parts of the system do
different jobs.

The firmware knows about the physical keyboard and the behaviors that belong
there. Linux carries key events to the host. XKB interprets text and modifiers.
GNOME and small host-side programs handle desktop and application behavior.

Some special keys travel through those layers using neutral programmable-button
events such as `PB_n`. Those are useful transport identities, but they are not a
promise that every key's purpose can change without reflashing the keyboard.

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

A change to an installer, test procedure, service implementation, or project
milestone does not require changing this tour. A change to what the keyboard
*means or does for Nova* does.

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
| QMK firmware | Emit key events and implement the physical behaviors handled in firmware. |
| Linux input layer | Carry key events from the device into the operating system. |
| XKB | Convert key identities into text symbols, modifiers, and named keysyms. |
| GNOME | Handle desktop shortcuts and input options. |
| Host-side daemons | Perform commands that do not belong in firmware or XKB. |
| Applications | Receive final text or shortcut behavior. |

This is the difference between building a keyboard layout and building an input architecture.

A conventional layout asks, “What character does this key type?”

This system asks several separate questions:

1. What physical key was pressed?
2. What event did the firmware emit?
3. Should the event select a text symbol, act as a modifier, trigger a command, or change a layer?
4. Which software component is responsible for that meaning?
5. Should anything reach the focused application?

---

# 2. Programmable-button identities

Normal typing keys already have familiar identities. The physical A key produces
an A-related event, and XKB can turn that into different text depending on the
selected level.

The keyboard's extra and special-purpose controls sometimes need something more
neutral. QMK's programmable-button namespace gives them clean events that Linux
can observe without pretending that the button is already a media key, browser
key, power key, or some other control with built-in desktop expectations.

For example:

```text
QMK:          PB_26
Linux evdev:  KEY_MACRO26
XKB/GNOME:    XF86Macro26
```

Those are three names for the same event as it moves through three layers.

A QMK programmable button is **not** a QMK macro. A firmware macro performs
behavior inside the keyboard. A programmable button merely reports that a
particular programmable button was pressed.

That neutral event is useful when the host owns the eventual behavior. It does
not mean that every physical key on the board has an immutable identity, or that
changing a relegendable key can always be done without changing and reflashing
the firmware.

---

# 3. Why not simply use F13 through F24?

Extended function keys are perfectly usable spare identities. They are widely recognized, easy to observe, and supported by many remapping tools.

But they are still function keys. They carry a historical and conceptual meaning as an extension of the F-key row.

`PB_n`, `KEY_MACROn`, and `XF86MacroN` say something more accurate:

> This is a programmable control with no predefined meaning.

F13 through F24 remain valuable fallback identities. They are simply not the first choice when QMK and Linux can carry a dedicated programmable-button event cleanly.

Other possible spare namespaces—media keys, browser keys, language keys, power keys, and obscure workstation keys—are less attractive because desktops may already assign behavior to them. The appeal of a neutral programmable-button event is precisely that it is boring by default.

---

# 4. The projects and why they are separate

The complete keyboard system spans several repositories because different kinds
of behavior belong at different layers.

| Project | Responsibility |
| --- | --- |
| `lemokey-x2-qmk` | Firmware, physical layout, programmable-button identities, deterministic tap/hold behavior, mouse layers, and the NumLock-position layer lamp. |
| `x1_keyboard_layout` | Host-side XKB symbols, text levels, modifier meanings, GNOME input options and extensions, and the canonical documentation hub. |
| `press-the-any-key` | Host-side Any Key behavior and deliberate synthetic input. |
| `hyperkeyd` | Host-side Hyper command dispatcher that maps Hyper-plus-key events to executable scripts. |
| `whisper-ptt` | Host-side push-to-talk dictation for the dedicated Whisper key. |

They are separate on purpose.

In this project, firmware handles the physical behaviors that belong closest to
the keyboard itself: emitted key events, the custom tap/hold decision, and
hardware layers. That keeps those particular behaviors independent of desktop
software.

XKB owns text interpretation: symbols, shift levels, and modifier meanings. It
is excellent at choosing what a key means as text, but it is not a general
command engine.

Desktop and host-side software handle behaviors that depend on applications or
the operating system: launching commands, dictation, shortcuts, and generated
input. When a change is confined to that host-side behavior, the keyboard
firmware does not need to change with it.

Keeping those boundaries means an ordinary host-side change does not become a
firmware change, while timing-sensitive physical behavior does not depend on a
desktop daemon.

The repositories therefore stay separate, while this document provides the
single human-readable tour of how they fit together. When exact implementation
detail matters, the project listed above is where to look.

---

# 5. The extra buttons and their changeable legends

Outside the ordinary main typing area, the X2 provides extra physical buttons
that do not correspond to standard typing keys. Those are the relegendable
controls. There was no obvious factory legend to put on them because there was
no predefined job for them to name.

That made relegendable keycaps a natural fit.

Once Nova decides what one of those buttons should do, its legend can say so. If
that decision changes later, the project can be changed, the keyboard reflashed,
and the legend changed with it.

The important flexibility is physical and practical: an extra button does not
have to spend the rest of its life wearing the first label anybody happened to
give it.

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

Moving rightward after the spacebar, the current layout places the special controls approximately like this:

```text
Space | Whisper | Menu/Right Control | Any/Meta | Compose/AltGr
```

The arrangement is ergonomic rather than decorative.

- **Whisper** is a high-frequency control, so it earns a high-honor position near the spacebar.
- **Control and Meta** are placed where they remain easy to chord with other command keys.
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

are command gestures rather than text-selection gestures. Hyper currently has a known leakage edge, described later, in which the command letter can also reach the focused application.

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
selectors in the same XKB model.

The easiest way to understand the numbering is as successive selector bits.
With no selector held, a key produces Level 1. Ordinary Shift adds the first
choice and gives Level 2.

AltGr is the familiar Level-3 shifter. Adding it does not merely add one more
output; it doubles the available combinations. AltGr alone selects Level 3, and
Shift+AltGr selects Level 4.

Level5 is the next selector in exactly the same progression. Adding it doubles
the space again: Level5 and its combinations with Shift and AltGr provide
Levels 5 through 8.

Conceptually, another selector of the same kind would begin at Level 9 and could
double the space again to sixteen combinations. Nova's layout does not need that;
the point is that the numbering follows the combination structure.

Level5 is uncommon enough that it never picked up a similarly familiar everyday
name, so it is usually just called Level5.

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

That is difficult to imagine on the ordinary main layout now, but when Nova
still had an unused ordinary key position, an old family joke suggested what to
put on it. The keyboard still has plenty of *capacity* elsewhere—relegendable
controls and unfilled higher text levels—but that is different from having an
ordinary key sitting around with no job. His sister loved the familiar computer prompt
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



# 20. Why these choices were made

The keyboard did not start from a list of universal design rules. Its shape came
from practical decisions about what worked well in daily use.

## Deterministic dual-role keys instead of timing thresholds

Nova tried the usual timing-based tap/hold approach first. In actual use it was
frustrating: the result depended on timing, created repeated little failures,
and demanded that he adapt his typing to the keyboard's threshold.

The custom behavior removes the timing guess entirely. Press and release the
dual-role key by itself and it is a tap. Press another key while holding it and
it becomes the hold action immediately.

That rule proved intuitive from the start. There is no tapping term to learn and
no need to think about how long a key has been held. The same physical gesture
produces the same interpretation each time.

The implementation lives in firmware because that is where this keyboard makes
the tap/hold decision. The reason for building it was not a doctrine that all
tap/hold logic belongs in firmware; it was to replace a timing-based behavior
that worked badly for Nova with one that simply worked.

## Different jobs live in different places

Some behaviors depend on the physical keyboard, some on XKB text interpretation,
and some on applications or host software. The projects are separated along
those boundaries so that each feature can be implemented where the information
and tools it needs are available.

That division is practical rather than ideological. Section 4 names the projects
and their responsibilities; the individual projects contain the exact
implementation.

---

# 21. Closing: the keyboard as a personal language

Most keyboards arrive with their vocabulary already decided for them.

This one has grown a vocabulary of its own.

Ordinary typing is still ordinary typing, but around it are extra ways to say
things: additional symbol levels, Compose sequences, command keys, mouse control,
local dictation, and even one key whose job is to choose another key at random.

None of this was built merely to prove that it could be done. Nova uses this
keyboard. These features solve real problems, support real habits, and make the
machine fit the person using it instead of asking the person to fit the machine.

That is worth being proud of.

The design is technical because it crosses several layers of the system, but the
reason for all of that engineering is personal. Some features grew from a need
for speed or convenience. Some came from wanting more control or keeping work
local. Some put useful symbols within easy reach. Some exist because the ordinary
way of doing something was irritating enough to deserve a better one.

And one began as a family joke.

The Any Key may be the best summary of the whole project. It was not necessary.
It was funny enough to build anyway, useful enough to teach something important,
and just useful enough afterward to earn its place.

That is a great deal of engineering to type the wrong character on purpose.

This document exists because the keyboard is worth explaining. Nova could tell
the story himself—and in a sense, that is what this tour is meant to preserve:
not just what each part does, but why somebody cared enough to build it this way.

It is a keyboard that unmistakably belongs to its owner.

---

# Appendix A: Runtime diagrams

## Any Key

```text
press physical Any key
    ↓
programmable-button event
    ↓
host-side Any action
    ↓
one randomly chosen ordinary character
```

## Hyper command

```text
hold physical Hyper key
    ↓
Hyper key event
    ↓
HyperKeyD arms
    ↓
press a command key
    ↓
matching host command executes
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
toggle mouse mode
    ↓
arrow cluster becomes pointer movement
    ↓
hold either Shift
    ↓
temporary scroll mode
    ↓
arrow cluster becomes wheel movement
```
