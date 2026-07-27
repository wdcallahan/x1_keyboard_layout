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

Two companion documents divide the details deliberately:

- `docs/keyboard-architecture.md` records the exact current implementation,
  acceptance evidence, and operational boundaries.
- `docs/symbol-vocabulary.md` records the direct symbol inventory and the
  doctrine behind individual placements.

The guide you are reading explains how the whole machine fits together. When
an exact mapping or live status matters, the version-controlled implementation
and those companion documents win.

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
| `hyperkeyd` | An experimental host-side Hyper command dispatcher that maps Hyper-plus-key events to executable scripts. It is not production-critical yet. |
| `whisper-ptt` | Accepted local push-to-talk speech input: direct key listener, exact microphone, CPU Whisper, notifications, focus audit, and reviewed insertion. |

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

## Relevant QMK representation

The firmware represents actions as either ordinary QMK keycodes or programmable-button events:

```c
typedef enum {
    NOVA_NORMAL,
    NOVA_PB,
} nova_action_type_t;

typedef struct {
    nova_action_type_t type;
    uint16_t code;
} nova_action_t;

typedef struct {
    uint16_t keycode;
    nova_action_t tap;
    nova_action_t hold;
    bool active;
    bool interrupted;
    bool hold_registered;
} nova_dual_t;

#define NORMAL_ACTION(kc) { NOVA_NORMAL, (kc) }
#define PB_ACTION(index)  { NOVA_PB,     (index) }

static nova_dual_t nova_duals[] = {
    { N_RCTL, PB_ACTION(12),          PB_ACTION(25),          false, false, false },
    { N_FN,   NORMAL_ACTION(KC_MENU), NORMAL_ACTION(KC_RCTL), false, false, false },
    { N_MENU, PB_ACTION(26),          NORMAL_ACTION(KC_APP),  false, false, false },
    { N_INS,  NORMAL_ACTION(KC_INS),  PB_ACTION(29),          false, false, false },
};
```

When another key interrupts a pending dual-role key, the hold action is registered immediately. When the dual-role key is released without interruption, its tap action is emitted.

This puts physical timing and chord recognition in firmware, where that behavior belongs, while leaving the semantic meaning of `PB_12`, `PB_25`, and the other programmable identities to the host.

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

# 10. The four-level base and eight-level canary

Most keys use a four-level layout built on top of ordinary US typing. The B
key is the first deliberate eight-level canary and proves that Level5 can
extend the same single XKB group without replacing the four-level vocabulary.

| Level | Gesture | Role |
| --- | --- | --- |
| Level 1 | key | Normal US character |
| Level 2 | Shift + key | Shifted US character |
| Level 3 | AltGr + key | First custom symbol |
| Level 4 | Shift + AltGr + key | Paired or related custom symbol |
| Level 5 | Level5 + key | Additional direct symbol where explicitly defined |
| Level 6 | Shift + Level5 + key | Shifted Level5 symbol where explicitly defined |
| Level 7 | AltGr + Level5 + key | Combined-selector symbol where explicitly defined |
| Level 8 | Shift + AltGr + Level5 + key | Shifted combined-selector symbol where explicitly defined |

The first two levels remain familiar. The custom vocabulary occupies levels three and four.

The custom symbols are not intended as a random Unicode showcase. Placement follows several overlapping principles:

- mnemonic association;
- paired uppercase/lowercase or checked/unchecked forms;
- mathematical families;
- visual similarity;
- historical or linguistic interest;
- symbols used in technical writing;
- and personal delight.

A symbol table is part utility and part autobiography.

---

# 11. The symbol vocabulary

## Number row

| Key | Level 1 | Level 2 | Level 3 | Level 4 |
| --- | --- | --- | --- | --- |
| `` ` `` | `` ` `` | `~` | `⎓` direct current | `⏦` alternating current |
| `1` | `1` | `!` | `‼` double exclamation | `⚠` warning |
| `2` | `2` | `@` | `₿` Bitcoin sign | `☡` caution |
| `3` | `3` | `#` | `π` pi | `τ` tau |
| `4` | `4` | `$` | `₹` rupee | `φ` phi |
| `5` | `5` | `%` | `€` euro | `⅌` per sign |
| `6` | `6` | `^` | `∑` summation | `θ` theta |
| `7` | `7` | `&` | `⅋` turned ampersand / par | `⊕` circled plus |
| `8` | `8` | `*` | `⁂` asterism | `⊗` circled times |
| `9` | `9` | `(` | `△` triangle | `Δ` delta |
| `0` | `0` | `)` | `○` circle | `☐` empty ballot box |
| `-` | `-` | `_` | `∅` empty set | `🅭` Creative Commons mark |
| `=` | `=` | `+` | `≈` approximately equal | `≡` identical/equivalent |

The number row contains dense mathematical, monetary, warning, and editorial vocabulary. Many pairs are intentionally related: `π/τ`, `△/Δ`, `≈/≡`, and `⊕/⊗`.

## Q row

| Key | Level 1 | Level 2 | Level 3 | Level 4 |
| --- | --- | --- | --- | --- |
| Q | `q` | `Q` | `☠` skull and crossbones | `☣` biohazard |
| W | `w` | `W` | `ŭ` u with breve | `Ŭ` uppercase |
| E | `e` | `E` | `ë` e with diaeresis | `Ë` uppercase |
| R | `r` | `R` | `ƿ` wynn | `Ƿ` uppercase wynn |
| T | `t` | `T` | `þ` thorn | `Þ` uppercase thorn |
| Y | `y` | `Y` | `✓` check mark | `☑` checked box |
| U | `u` | `U` | `ü` u with diaeresis | `Ü` uppercase |
| I | `i` | `I` | `ï` i with diaeresis | `Ï` uppercase |
| O | `o` | `O` | `ö` o with diaeresis | `Ö` uppercase |
| P | `p` | `P` | `Φ` uppercase phi | `℗` sound-recording copyright |
| `[` | `[` | `{` | `⧘` left wiggly fence | `∵` because |
| `]` | `]` | `}` | `⧙` right wiggly fence | `∴` therefore |
| `\` | `\` | `|` | `❣` heavy heart exclamation | `❢` heavy exclamation ornament |

The alphabetic rows carry useful European letters, historical English letters, logical and mathematical signs, and expressive punctuation.

## A row

| Key | Level 1 | Level 2 | Level 3 | Level 4 |
| --- | --- | --- | --- | --- |
| A | `a` | `A` | `ä` | `Ä` |
| S | `s` | `S` | `ŝ` | `Ŝ` |
| D | `d` | `D` | `ð` eth | `Ð` |
| F | `f` | `F` | `℉` Fahrenheit | `℃` Celsius |
| G | `g` | `G` | `ĝ` | `Ĝ` |
| H | `h` | `H` | `ĥ` | `Ĥ` |
| J | `j` | `J` | `ĵ` | `Ĵ` |
| K | `k` | `K` | `ȝ` yogh | `Ȝ` |
| L | `l` | `L` | `λ` lambda | — |
| `;` | `;` | `:` | `∶` ratio | `∷` proportion |
| `'` | `'` | `"` | `′` prime | `″` double prime |

The A row includes a particularly tidy set of paired letters and scientific notation. Fahrenheit and Celsius share F. Ratio and proportion share the semicolon key. Prime and double-prime naturally occupy the quote key.

## Z row

| Key | Level 1 | Level 2 | Level 3 | Level 4 |
| --- | --- | --- | --- | --- |
| Z | `z` | `Z` | `Ω` omega | — |
| X | `x` | `X` | `ƒ` florin/function | `ſ` long s |
| C | `c` | `C` | `ĉ` | `Ĉ` |
| V | `v` | `V` | `⚛` atom | `☢` radiation |
| B | `b` | `B` | `β` beta | `α` alpha |
| N | `n` | `N` | `✗` cross mark | `☒` crossed box |
| M | `m` | `M` | `℞` prescription | `⚕` staff of Aesculapius |
| `,` | `,` | `<` | `≤` less than or equal | `≲` less than or approximately equal |
| `.` | `.` | `>` | `≥` greater than or equal | `≳` greater than or approximately equal |
| `/` | `/` | `?` | `⁇` double question mark | `⸮` irony mark |

The Z row contains paired hazards, comparison operators, editorial marks, Greek letters, and medical symbols. The irony mark on the question-mark key may be one of the clearest examples of the layout’s personality.

## Level5 B canary

Only B currently has a deliberate eight-level type. It retains its familiar
first four levels and adds a small, memorable family:

| Gesture | Output |
| --- | --- |
| B | `b` |
| Shift + B | `B` |
| AltGr + B | `β` |
| Shift + AltGr + B | `α` |
| Level5 + B | `🐇` |
| Shift + Level5 + B | `🐰` |
| AltGr + Level5 + B | `🥬` |
| Shift + AltGr + Level5 + B | `🥕` |

The canary proved that all eight levels can coexist in one group. Keys without
an explicit eight-level type remain on their existing vocabulary.

## Arrow keys

| Physical key | Normal behavior | AltGr | Shift + AltGr |
| --- | --- | --- | --- |
| Up | move upward | `↑` | `👆` |
| Left | move left | `←` | `👈` |
| Down | move downward | `↓` | `👇` |
| Right | move right | `→` | `👉` |

The physical arrow keys remain navigation controls at levels one and two, but can type arrow glyphs and pointing hands at levels three and four.

## Space

| Gesture | Output |
| --- | --- |
| Space | ordinary space |
| Shift + Space | ordinary space |
| AltGr + Space | narrow non-breaking space |
| Shift + AltGr + Space | soft hyphen |

Invisible characters deserve deliberate placement because they are difficult to enter correctly by accident and difficult to diagnose after the fact.

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

XKB has eight real modifier bits whose names reflect long X11 history. The design assigns them according to current purpose.

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

Several choices are deliberate.

## Super is not Meta

Modern desktop conventions often blur Windows, Command, GUI, Super, and Meta.

This keyboard keeps Super and Meta conceptually separate.

- **Super** belongs primarily to desktop and window-manager behavior.
- **Meta** provides an application and terminal command namespace.

The physical and XKB transport is complete: the Any/Meta hold emits `KC_APP`,
Linux/XKB names it `<COMP>`, and Nova maps it to `Meta_R` with virtual Meta on
real Mod3. `wev` sees the modifier correctly.

Consumers are a separate problem. Traditional terminal input does not carry a
general “Meta” bit; it usually represents Meta as an Escape prefix. Current
MACE behavior is therefore intentionally recorded rather than generalized:

| Consumer | Meta+D | Alt+D |
| --- | --- | --- |
| xterm 406 + Bash Readline | sends `ESC d`; native Readline Meta+D works | plain `d` in the tested configuration |
| Ptyxis/VTE without the adapter | plain `d`; Mod3 is discarded at the application boundary | sends `ESC d` |
| Ptyxis + Nova semantic-Meta adapter + tmux | exact Meta+D is intercepted and translated to tmux detach | remains the ordinary Alt path |

The accepted GNOME Shell adapter is deliberately narrow. Mutter owns the
exact `<Mod3>d` binding before Ptyxis loses Mod3, confirms that Ptyxis is
focused, and injects tmux's existing `Ctrl+B`, `D` command through `ydotool`.
It makes one tested gesture work; it is not general Bash Meta support and does
not claim that Meta works natively in all terminals or applications.

Future consumers must either bind real Mod3 before the lossy boundary or use a
protocol and application stack that preserves semantic Meta end to end.

## Hyper is not assigned a real modifier bit

Hyper is exposed as `Hyper_L`, but in this architecture it is primarily a trigger observed by a daemon.

It does not need to consume one of the limited XKB modifier bits unless a future implementation requires that.

## NumLock does not own Mod2

Traditional XKB mappings often attach NumLock to Mod2.

This design does not use genuine NumLock semantics. The keypad is intended to remain numeric, while the physical NumLock key toggles a mouse layer.

Mod2 is therefore available for Level5.

GNOME is configured with both `remember-numlock-state` and `numlock-state`
false so it does not restore stale NumLock state into raw Mod2. A managed
GNOME Shell sentinel alerts if Mod2 is ever latched or locked unexpectedly;
it does not rewrite legitimate depressed Mod2 while the Level5 key is active.

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

The Hyper key is intended to arm a personal command-dispatch mode.

```text
Hyper down      → dispatcher armed
Hyper + a       → run ~/.hyper/a.sh
Hyper + 1       → run ~/.hyper/1.sh
Hyper up        → dispatcher idle
```

There are no command prefixes, no sequence buffers, and no timing grammar.

Every alphanumeric key pressed while Hyper is held represents one complete command event.

The daemon’s design boundary is intentionally narrow:

```text
key event → executable script
```

The daemon should not become a macro language, application controller, command palette, shell, keyboard remapper, or desktop environment.

Action-specific behavior belongs in the scripts.

That keeps the dispatcher stable while allowing the command vocabulary to grow independently.

## Why evdev?

Wayland intentionally restricts arbitrary global keyboard interception.

`hyperkeyd` reads Linux evdev devices directly, below the compositor. That makes it independent of X11-style global-hotkey APIs, but it requires permission to read the selected `/dev/input/event*` device.

## Current limitation: listening is not suppression

The current daemon is a passive listener. It does not grab the keyboard and does not prevent a command key from also reaching the desktop.

A complete filtering implementation would need to:

1. grab the physical keyboard;
2. consume Hyper command events;
3. create a virtual keyboard through `uinput`;
4. re-emit all allowed non-command events;
5. remain exceptionally reliable, because failure would affect the primary input path.

That is a much more consequential design than passive listening.

The existing project therefore demonstrates the command-dispatch model without prematurely turning itself into a critical input filter.

---

# 16. The Any Key: industrial-grade chaos

The Any Key began as a joke:

> Put an “Any Key” label on a physical key, and make it type a random character.

The implementation is deliberately real.

On this keyboard, tapping the Any/Meta dual-role key emits:

```text
PB_26
    ↓
KEY_MACRO26
    ↓
XF86Macro26
```

GNOME listens for `XF86Macro26` as a custom shortcut and launches:

```text
~/bin/any.sh
```

The script selects one random character from:

```text
a-z
A-Z
0-9
```

It then asks `ydotool` to type that character.

## Runtime path

```text
Physical Any key
    ↓
PB_26 / KEY_MACRO26 / XF86Macro26
    ↓
GNOME custom shortcut
    ↓
~/bin/any.sh
    ↓
ydotool type "<random character>"
    ↓
$XDG_RUNTIME_DIR/.ydotool_socket
    ↓
ydotoold
    ↓
/dev/uinput
    ↓
Focused application receives the character
```

## Runtime implementation boundary

The exact script belongs to `press-the-any-key`, not to this tour. Its current
implementation checks the `ydotool.service` state, starts or resets it when
necessary, chooses one random alphanumeric character, and retries the
`ydotool type` request during the brief daemon-startup window. Keeping the
executable source in one repository prevents a copied code listing here from
quietly becoming obsolete.

GNOME listens for the physical shortcut. `ydotoold` listens for synthetic-input requests. Ansible installs and reconciles the pieces but does not participate in each keypress.

The visible result is one random character.

The machinery includes QMK, evdev naming, XKB/GNOME shortcuts, systemd, a Unix socket, `ydotool`, and `/dev/uinput`.

This is an intentionally disproportionate engineering effort in service of a joke, which is part of why it is worth having.

---

# 17. The mouse layer

The physical NumLock key does not toggle keypad meaning.

It toggles a dedicated QMK mouse layer:

```c
TG(MOUSE)
```

The keypad remains numeric because XKB gives every keypad key one explicit
`ONE_LEVEL` numeric symbol. The physical NumLock position emits no NumLock
event at all.

When the mouse layer is active:

- the physical arrow cluster becomes pointer movement;
- selected navigation keys become mouse buttons;
- either Shift key can momentarily activate a scroll sublayer;
- the same directional controls then become wheel movement.

## Mouse layer concept

```text
NumLock position → toggle mouse layer

On mouse layer:
    arrows       → pointer movement
    Insert/Home/PageUp-style positions → mouse buttons
    hold Shift   → scroll sublayer
    arrows       → wheel movement
```

The relevant QMK layer uses:

```c
KC_MS_U
KC_MS_D
KC_MS_L
KC_MS_R

KC_BTN1
KC_BTN2
KC_BTN3
```

The scroll sublayer uses:

```c
KC_WH_U
KC_WH_D
KC_WH_L
KC_WH_R
```

Both Shift positions expose `MO(SCROLL)` while the mouse layer is active, making scrolling momentary and symmetrical.

## Why preserve the numeric keypad?

The keypad should be a keypad.

Traditional NumLock behavior turns the same physical keys into two competing layouts. This design instead preserves numbers continuously and obtains pointer control through an explicit layer.

That makes the mode change intentional and keeps numeric entry predictable.

## Host-state isolation and the layer lamp

The earlier firmware reassertion watchdog has been removed. It produced
repeated synthetic NumLock events and could interfere with key repeat and
scrolling. The accepted design removes every intentional producer instead of
fighting host state continuously:

- QMK sends no `KC_NUM_LOCK` event.
- XKB maps `<NMLK>` to `VoidSymbol` and removes `Num_Lock` from modifier maps.
- The keypad uses one group and one numeric level, so no lock can turn it into
  a navigation cluster.
- GNOME does not remember or restore NumLock state.
- A GNOME Shell sentinel alerts on unexpected latched or locked Mod2 without
  trying to “heal” a legitimate depressed Level5 hold.

The physical NumLock lamp now reports firmware pointer-layer state:

| Firmware state | NumLock lamp |
| --- | --- |
| Base | off |
| Mouse | solid |
| Scroll | blinking every 250 ms |

The lamp does not mirror host NumLock. This gives the repurposed control a
useful, glanceable status indicator while leaving Level5's Mod2 bit alone.

---

# 18. Level5 and the first eight-level canary

AltGr supplies Levels 3 and 4.

A separate Level5 modifier is active through `PB_29`, `<I692>`,
`ISO_Level5_Shift`, and real Mod2.

The B key is the first accepted eight-level canary:

```text
b  B  β  α  🐇  🐰  🥬  🥕
```

It proves that Level5, Shift, and AltGr can select Levels 5 through 8 in the
same XKB group. The canary was compiled offline, installed reproducibly,
survived reboot, and passed live typing acceptance.

This does not require every key to be expanded immediately. An intentional
spare is still more valuable than a symbol chosen merely because a slot
exists. `docs/symbol-vocabulary.md` owns the placement doctrine and the exact
current inventory.

---

# 19. Whisper: the prepared interface fulfilled

`PB_28` is reserved for Whisper or push-to-talk speech input.

The physical position is already chosen and the firmware identity is already
stable. The host-side implementation now lives in
[`wdcallahan/whisper-ptt`](https://github.com/wdcallahan/whisper-ptt).

This demonstrates the architecture’s central principle especially well.

The keyboard exposed a durable identity before the software behavior existed.
The later service consumed that identity without a firmware remap, a borrowed
function key, or an XKB modifier.

The accepted service listens directly for `KEY_MACRO28` press and release.
Press begins an exact-source RØDE PipeWire recording. Release finalizes the
audio, transcribes locally with the verified English `base.en` model on the
CPU, checks that GNOME focus still matches, and injects the result through
`ydotool` without pressing Enter. Desktop notifications expose recording,
transcription, completion, no-speech, and attention states.

The original `docs/designs/whisper-ptt-boundary.md` is therefore no longer a
promise about future work. It is the record of a prepared interface whose
implementation validated the separation between physical identity and host
meaning.

---

# 20. One keyboard, several kinds of meaning

The design can now be summarized by category.

## Ordinary text

Handled primarily by QMK key identity plus XKB Levels 1 and 2.

```text
key → letter, digit, punctuation
```

## Extended text

Handled by AltGr, Shift+AltGr, Compose, and the explicitly populated parts of
Level5.

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

Handled by `ydotoold` and `/dev/uinput`.

```text
host command → virtual keyboard event
```

The system does not insist that one mechanism solve every problem.

It assigns each problem to the layer best suited to it.

---

# 21. Why the architecture is intentionally distributed

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

# 22. What is authoritative, and what is explanatory?

This document is a guided tour. It is intended to be readable by humans and models.

The canonical copy of this tour lives in `x1_keyboard_layout`. The
repositories remain authoritative for exact implementation details, while the
ChatGPT Library copies are synchronized reading and sharing mirrors.

## `lemokey-x2-qmk`

Authoritative for:

- current physical keymap;
- programmable-button emission;
- deterministic tap/hold implementation;
- mouse and scroll layers;
- NumLock-position layer toggling and lamp behavior;
- firmware build and flashing.

## `x1_keyboard_layout`

Authoritative for:

- XKB keysyms and symbol levels;
- modifier mappings;
- GNOME input options;
- the Level5 and semantic-Meta GNOME Shell extensions;
- the complete architecture rationale;
- installation of the host-side layout.

## `press-the-any-key`

Authoritative for:

- the Any Key script;
- `ydotoold` user service;
- GNOME shortcut reconciliation;
- Ansible deployment.

## `hyperkeyd`

Authoritative for:

- evdev device handling;
- Hyper arming and command dispatch;
- CLI behavior;
- script execution;
- permissions and service examples;
- current passive-listener limitations.

## Whisper/PTT

`wdcallahan/whisper-ptt` is authoritative for capture, transcription,
notification, focus-safety, injection, deployment, and runtime diagnostics.
`x1_keyboard_layout/docs/designs/whisper-ptt-boundary.md` preserves the
cross-project keyboard boundary and summarizes the accepted MACE result.

This tour intentionally omits build systems, generated files, complete installers, full command-line parsers, packaging details, and most service boilerplate. Those details matter when maintaining a repository, but they are not necessary for understanding the keyboard as a designed system.

---

# 23. Design principles worth preserving

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

# 24. Closing: the keyboard as a personal language

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
| Whisper | `PB_28` | `KEY_MACRO28` | Active local release-to-finalize dictation service |
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
record exact RØDE PipeWire source
    ↓
release and transcribe with local base.en
    ↓
verify GNOME focus
    ↓
ydotool types reviewed text without Enter
```

## Eight-level B canary

```text
B                              → b
Shift + B                      → B
AltGr + B                      → β
Shift + AltGr + B              → α
Level5 + B                     → 🐇
Shift + Level5 + B             → 🐰
AltGr + Level5 + B             → 🥬
Shift + AltGr + Level5 + B     → 🥕
```

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
