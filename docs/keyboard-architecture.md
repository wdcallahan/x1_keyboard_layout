# Linux Workstation Keyboard Architecture

## A why-did-you-do-that document

This document explains the design logic behind Nova's custom Linux workstation keyboard setup.
It covers the relationship between QMK-style firmware, Linux input events, XKB symbol selection, GNOME input options, and host-side command daemons.

It is not a flashing guide, a QMK tutorial, an XKB manual, or a distro-specific installation checklist.
Those should remain separate how-to documents.

The purpose of this document is to answer the question:

> Why was the keyboard designed this way, and what ideas need to be preserved when rebuilding it later?

The intended reader is future Nova, or someone comfortable enough with Linux keyboard plumbing to recreate this architecture on a new machine, a new keyboard, or a new software stack.

---

## 1. Core design principle

The core principle is:

> Separate physical key identity from final key meaning.

A physical key does not need to directly mean "Hyper," "Compose," "AltGr," "Any," "Whisper," or "mouse layer." The keyboard firmware can emit a stable, neutral identity. Linux receives that identity as a normal input event. A later software layer decides what that event means today.

This makes the system portable and reconfigurable.

| Layer | Job |
| --- | --- |
| Firmware | Emit a stable key identity or normal keycode. |
| Linux input layer | Receive that identity as an event. |
| XKB / desktop layer | Translate that event into a symbol, modifier, option, or command trigger. |
| Host-side daemon / app | Act on command triggers when appropriate. |
| Application | Receive final text or shortcut behavior only when something should reach it. |

This is the difference between building a keyboard layout and building an input architecture.

---

## 2. Stable identities are better than hardcoded meanings

For normal typing keys, identity and meaning are often the same. The A key emits a key event that ultimately produces `a`. That is fine.

For extra programmable keys, that is too limiting. A key with a custom legend might be a command launcher today, an Any key tomorrow, and a speech-to-text trigger later. Its firmware identity should not have to change every time its job changes.

A good identity key should be:

| Property | Reason |
| --- | --- |
| Distinct | It must not collide with another key. |
| Observable | Tools such as `wev`, `evtest`, or `xkbcli interactive-wayland` should see it. |
| Boring | It should not trigger desktop behavior by default. |
| Stable | It should survive firmware, Linux input, and remapping layers. |
| Semantically neutral | It should not already mean sleep, brightness, volume, browser back, or some other host action. |

This is why QMK programmable-button keycodes are preferred over media keys, browser keys, power keys, or stolen keys from the normal typing area.

---

## 3. QMK programmable buttons are the preferred identity namespace

Modern QMK provides programmable button keycodes, usually named `QK_PROGRAMMABLE_BUTTON_1` through `QK_PROGRAMMABLE_BUTTON_32`, with aliases such as `PB_1`, `PB_2`, and so on.

These are not QMK macros.

A QMK macro means firmware sends a sequence of events.

A programmable button means firmware emits a neutral button identity for host-side software to interpret.

That distinction is central to this layout.

On Linux, the useful expectation is:

| QMK identity | Linux event identity | XKB-visible keysym |
| --- | --- | --- |
| `PB_1` | `KEY_MACRO1` | `XF86Macro1` |
| `PB_2` | `KEY_MACRO2` | `XF86Macro2` |
| `PB_3` | `KEY_MACRO3` | `XF86Macro3` |
| ... | ... | ... |
| `PB_30` | `KEY_MACRO30` | `XF86Macro30` |

QMK exposes 32 programmable buttons, but the Linux `KEY_MACRO` range should be tested before trusting the highest values. In this design, `PB_1` through `PB_30` are the safe practical namespace.

The practical rule is:

> Use `PB_n` / `KEY_MACROn` / `XF86MacroN` for keys whose meaning should be assigned later in software.

---

## 4. Why not just use F13 through F24?

F13 through F24 are useful and should not be dismissed. They are real, visible, remappable identities. They are also widely understood by remapping tools.

However, they are still function keys. They have historical and conceptual meaning as an extension of the function-key row.

Programmable buttons are a better fit for arbitrary relegendable keys because they say what is actually meant:

> This is a programmable button with no predefined meaning.

F13 through F24 remain useful as a fallback namespace, or as literal function keys if a keyboard has a physical top row that should behave like extended function keys.

---

## 5. Fallback identity namespaces

If programmable buttons are unavailable, unreliable, or insufficient, these namespaces can be used as fallbacks.

| Namespace | Usefulness | Caution |
| --- | --- | --- |
| F13-F24 | Good general-purpose fallback. | They are still function keys, not neutral macro keys. |
| International and Language keys | Good obscure keyboard-page identities. | IME/input-method configuration may already use some of them. |
| Sun/workstation keys | Historically elegant and Linux-visible. | Availability depends on firmware support and mapping path. |
| XF86 launch/application keys | Usable and often visible. | Some desktop environments may attach meanings to them. |
| Consumer/media keys | Useful when intentional. | Often grabbed globally by the desktop. |
| Sleep/power/brightness keys | Avoid for neutral use. | They may trigger system behavior before user software sees them. |

The fallback namespaces are interesting and historically valuable, but programmable buttons are the clean first choice.

---

## 6. Current repository split

The keyboard system currently spans more than one repository by design.

| Repository | Responsibility |
| --- | --- |
| `x1_keyboard_layout` | Host-side XKB symbols, GNOME input options, layout installation. |
| `qmk_keychron` / `lemokey-x2-qmk` branch | Keyboard firmware, physical matrix behavior, deterministic tap-hold logic, flashing. |
| `press-the-any-key` | GNOME/Wayland Any key shortcut and `ydotool` injection path. |
| `hyperkeyd` | Experimental Hyper command dispatcher daemon. Not production-critical yet. |
| Future Whisper/PTT project | Speech-to-text hold-to-record trigger, expected to bind to the Whisper key. |

Do not merge the QMK firmware repo with the XKB/layout repo merely because both are about the keyboard. Firmware identity and host meaning are intentionally separate.

The better integration point is documentation: each repo should point to this architecture document and to the other relevant repos.

---

## 7. Current programmable-button allocation

The numbering is spatially meaningful, not merely packed.

| Physical area or role | Programmable button range |
| --- | --- |
| Left relegendable bank | `PB_1` through `PB_10` |
| Caps position / Hyper trigger | `PB_11` |
| Compose / AltGr pair | `PB_12` and `PB_25` |
| Top relegendable row | `PB_13` through `PB_24` |
| Fixed bottom/modifier specials | `PB_25` through `PB_29` |
| Safe spare | `PB_30` |

The top row deliberately uses `PB_13` through `PB_24` because those numbers visually echo F13 through F24. The left bank uses `PB_1` through `PB_10` because it is a distinct ten-key block. The bottom-row and special-role keys use the remaining fixed-special range because their roles are more stable.

Current active special mapping:

| QMK identity | Linux / XKB-visible identity | Current host meaning |
| --- | --- | --- |
| `PB_11` | `XF86Macro11` / `<I674>` | Hyper trigger keysym (`Hyper_L`), not a real modifier bit. |
| `PB_12` | `XF86Macro12` / `<I675>` | Compose (`Multi_key`). |
| `PB_25` | `XF86Macro25` / `<I688>` | AltGr / Level3 (`ISO_Level3_Shift`). |
| `PB_26` | `XF86Macro26` / `<I689>` | Any key GNOME shortcut trigger. |
| `PB_27` | `XF86Macro27` / `<I690>` | Meta (`Meta_R`, Mod3). |
| `PB_28` | `XF86Macro28` / `<I691>` | Future Whisper/PTT trigger. |
| `PB_29` | `XF86Macro29` / `<I692>` | Level5 shift (`ISO_Level5_Shift`, Mod2). |

The `I###` names are XKB key names assigned to these extra keys. They are not physical matrix positions, Linux evdev codes, or QMK names. They are the names XKB uses inside the compiled keymap.

---

## 8. Current right-side bottom cluster

The current full-size prototype places the special right-side cluster like this, moving left to right after the spacebar:

| Position | Firmware behavior | Host meaning |
| --- | --- | --- |
| First key after Space | `PB_28` | Future Whisper/PTT trigger. |
| Fn/Menu position | tap `KC_APP`, hold `KC_RCTL` | Menu / Right Control. |
| Menu-ish position | tap `PB_26`, hold `PB_27` | Any / Meta. |
| Right Control position | tap `PB_12`, hold `PB_25` | Compose / AltGr. |

The reason for this arrangement is ergonomic rather than aesthetic.

Whisper is expected to become high-frequency once working, so it receives a high-honor tactile position near the spacebar. Control, Meta, and Shift sometimes need to participate in a three-key command chord, so Control and Meta remain contiguous near the right Shift area. Compose and AltGr remain on an outside feelable edge, with AltGr still close enough to Shift for Level4 typing.

This layout was chosen after the previous placement made a real chord uncomfortable during normal use.

---

## 9. Relegendable keys

Relegendable keys are an important part of the design.

A relegendable key should have:

| Layer | Stable or changeable? |
| --- | --- |
| Physical position | Stable. |
| Firmware identity | Stable. |
| Printed legend | Changeable. |
| Software binding | Changeable. |

For example, a key might permanently emit `PB_17`. Today the cap might say `VOL+` and the OS binding raises volume. Later the cap might say `OBS` and the OS binding launches or controls OBS.

The physical key and firmware identity remain stable. The legend and behavior change.

This prevents the keyboard from becoming a firmware-maintenance project every time a macro or launcher changes.

---

## 10. Modifier philosophy

This layout separates two ideas that are often blurred together.

| Concept | Purpose |
| --- | --- |
| Shift levels | Select alternate text symbols. |
| Bucky bits / command modifiers | Invoke commands, shortcuts, or modes. |

Shift, AltGr, and Level5 belong primarily to the text-symbol selection system.

Control, Meta, Hyper, and Super belong primarily to command or desktop behavior.

This distinction matters.

A should produce `a`. Shift+A should produce `A`. AltGr+A might produce `ä`. Shift+AltGr+A might produce `Ä`. Level5+A might produce another defined symbol. These are text-selection levels, not command chords.

By contrast, Meta+D or Hyper+A are command-space gestures. They should not type D or A into the focused application unless deliberately configured to do so.

---

## 11. Intended real modifier-bit allocation

XKB has eight real modifier bits. The names come from X11 history, but the design should be understood in terms of intended roles.

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

This assumes real NumLock semantics are not used. The physical NumLock key is repurposed as a mouse-layer toggle, and keypad keys remain keypad keys at all times.

Because NumLock is not part of the intended design, it should not permanently occupy a modifier slot merely out of convention.

Hyper does not need a real modifier bit in this architecture if it is implemented as an event-listener trigger rather than as an XKB modifier.

---

## 12. CapsLock, Hyper, and both-Shift Caps

The CapsLock position is valuable because it is easy to reach and historically underused.

In this layout, the physical CapsLock position is used as the Hyper trigger. It emits `PB_11`, which the host XKB layout maps to `Hyper_L`.

Hyper is intentionally not mapped into a real XKB modifier slot. It is a daemon-level trigger keysym used by userland software.

CapsLock itself is still available, but not through a dedicated CapsLock key. Instead, CapsLock is toggled by pressing both Shift keys together using the GNOME/XKB option:

`shift:both_capslock`

Right Shift is a plain Shift key in firmware. It is no longer a tap-hold Caps/Shift key.

This arrangement keeps CapsLock available while removing the accidental tap problem that made the old Right Shift tap-hold behavior annoying.

---

## 13. Hyper daemon design boundary

The Hyper trigger is meant to arm a command-dispatch mode.

| Event | Intended meaning |
| --- | --- |
| Hyper trigger down | Arm Hyper mode. |
| Next key down | Run the associated command. |
| Next key event | Should be consumed, not typed. |
| Hyper trigger up | Disarm Hyper mode. |

For example, Hyper+A should run the configured Hyper+A action. It should not also type `a` into the focused application.

A passive listener can detect the action, but preventing the following key from leaking requires an input-filtering stage such as grabbing the device and re-emitting allowed events through a virtual input device.

The `hyperkeyd` project currently demonstrates the command-dispatch idea, but it still needs work before it should become part of the critical daily keyboard path. HyperKeyD details belong in the HyperKeyD repo. This document only records why the keyboard exposes a clean Hyper trigger identity.

---

## 14. Meta is for command space

Meta should be treated as a real, intentional command modifier.

This is useful for terminal programs and keyboard-heavy tools such as Emacs, tmux, editors, and shells.

Meta+D is cleaner than multi-key prefix sequences such as Control+B then D. Meta creates a command namespace without overloading Control for everything.

Super remains available for desktop/window-manager behavior. Meta remains available for application and terminal command behavior.

This keeps desktop control and application command space separate.

---

## 15. Super is not Meta

Modern systems often blur Super, Meta, GUI, Windows, and Command. This layout does not.

Super is the desktop/window-manager key. It belongs where the Windows-logo key usually appears, but the legend should say Super, not Win.

Meta is a separate command modifier. It should not merely be treated as another name for Super.

This distinction is especially important on Linux systems that inherit both PC and Unix workstation traditions.

---

## 16. Compose and AltGr on one physical key

Compose and AltGr make sense as a deterministic tap-hold pair.

| Gesture | Intended meaning |
| --- | --- |
| Tap | Compose / `Multi_key` |
| Hold | AltGr / `ISO_Level3_Shift` |

Compose is a tap-style prefix mechanism. AltGr is a hold-style level selector. They naturally fit on one physical key.

The firmware does not need to know what Compose or AltGr are. It emits `PB_12` for tap and `PB_25` for hold. The Linux/XKB layer maps those identities to `Multi_key` and `ISO_Level3_Shift`.

This avoids burning ordinary firmware keycodes for meanings that belong to XKB.

Compose is central to this workstation. It is not an obscure convenience. Losing Compose makes normal text production worse, because symbols such as `æ` are part of the user's working vocabulary.

---

## 17. Level3 and Level4

In a typical AltGr setup:

| Key state | Example result |
| --- | --- |
| A | `a` |
| Shift+A | `A` |
| AltGr+A | `ä` |
| Shift+AltGr+A | `Ä` |

AltGr selects another level; Shift can combine with it to select the paired shifted level.

The exact symbols are defined by the user's XKB layout. There is nothing magical about the preexisting contents of Level3 or Level4.

In this layout, Level3 and Level4 are curated symbol vocabulary, not random Unicode decoration. Priority order is:

1. Symbols used often that cannot be composed conveniently.
2. Symbols that can be composed but are common enough to deserve a direct slot.
3. Symbols that would be used more often if they were convenient.

Example acceptance test:

`1!‼⚠1!`

This demonstrates levels 1 through 6 on the `1` key. Levels 5 and 6 currently fall back to levels 1 and 2 when no fifth/sixth-level symbols are defined.

---

## 18. Level5 as future expansion

Level5 is reserved as a future text-symbol dimension.

It is not expected to do much unless the keymap defines symbols and types that use it.

| Key state | Example role |
| --- | --- |
| A | base symbol |
| Shift+A | shifted base symbol |
| AltGr+A | third-level symbol |
| Shift+AltGr+A | fourth-level symbol |
| Level5+A | fifth-level symbol |
| Shift+Level5+A | sixth-level symbol |

Level5 is mapped to `ISO_Level5_Shift` on `PB_29`, which is seen by XKB as `<I692>` and assigned to Mod2.

Level5 is not a command modifier. It is another text-symbol selector.

One current use case is the narrow no-break space on Space Level3. It is used for units and attached expressions such as `50 kg`, `6 o'clock`, and `Shift 6`, where the parts should not wrap apart but a full non-breaking space is visually too wide. Fourth-level Space provides a discretionary soft hyphen for controlling line breaks when needed.

---

## 19. NumLock is not NumLock anymore

The physical NumLock key is repurposed.

It does not toggle host NumLock state.

It toggles the keyboard's mouse layer.

The keypad should always remain numeric. This preserves muscle memory and avoids the classic NumLock problem where the keypad unpredictably changes between numbers and navigation.

| Physical key | Intended behavior |
| --- | --- |
| NumLock position | Toggle mouse layer on/off. |
| Keypad numbers | Always send keypad numbers. |
| NumLock LED | Indicate mouse-layer state, if firmware can control it. |

This treats the NumLock position as a useful mode toggle while rejecting the old behavior that turns a numeric keypad into a duplicate navigation cluster.

---

## 20. Mouse layer design

The mouse layer is a firmware-level mode for pointer control.

| Layer | Purpose |
| --- | --- |
| Base | Normal keyboard. |
| Mouse | Mouse movement and buttons. |
| Scroll | Scroll wheel movement. |
| Extra | Reserved / future layer. |

The physical NumLock position toggles the mouse layer.

On the mouse layer:

| Key area | Behavior |
| --- | --- |
| Arrow keys | Move pointer. |
| Delete / End / Page Down cluster | Mouse buttons. |
| Either Shift held | Temporarily access scroll layer. |

On the scroll layer:

| Key area | Behavior |
| --- | --- |
| Arrow keys | Scroll wheel movement. |

This keeps mouse movement and scroll movement spatially related while avoiding a permanent pointing-device dependency for simple navigation.

---

## 21. NumLock LED as mouse-layer indicator

If the keyboard firmware can control the NumLock LED directly, the LED should indicate mouse-layer state instead of host NumLock state.

| State | NumLock LED |
| --- | --- |
| Normal layer | Off. |
| Mouse layer | Solid on. |
| Scroll layer | Blinking, if practical. |

This depends on keyboard hardware and firmware support. Some keyboards expose lock LEDs as directly controllable outputs. Some expose them through an LED driver or I/O expander. Some may only follow host lock state unless firmware is modified.

---

## 22. Tap-hold keys

Tap-hold keys are used where the tapped behavior and held behavior are conceptually different but physically related.

The tap-hold implementation should remain deterministic. It should not depend on timing guesses such as "tap within N milliseconds." The decision is based on key event structure: a key tapped alone emits its tap action; a key held while another key is pressed promotes to its hold action.

Current tap-hold pairings:

| Physical key | Tap | Hold |
| --- | --- | --- |
| Compose/AltGr key | `PB_12` → Compose / `Multi_key` | `PB_25` → AltGr / `ISO_Level3_Shift` |
| Fn/Menu key | Menu / Application | Right Control |
| Insert key | Insert | `PB_29` → Level5 shift |
| Any/Meta key | `PB_26` → Any trigger | `PB_27` → Meta |

Right Shift is no longer tap-hold. It is plain Right Shift. CapsLock is handled by both Shifts together through XKB/GNOME options.

The tap behavior should generally be a discrete action or prefix. The hold behavior should generally be a modifier or mode.

---

## 23. Any and Whisper triggers

Some special functions are not ordinary modifiers or text input. They are host-side triggers.

| Trigger | Current identity | Intended role |
| --- | --- | --- |
| Any | `PB_26` / `XF86Macro26` / `<I689>` | GNOME shortcut launches the Any key program. |
| Whisper/PTT | `PB_28` / `XF86Macro28` / `<I691>` | Future hold-to-record speech-to-text trigger. |
| Hyper | `PB_11` / `XF86Macro11` / `<I674>` | Command launcher mode trigger. |

These should use programmable-button identities rather than function keys or media keys.

That way host-side listeners can bind to clean events such as `KEY_MACRO28` instead of stealing F22, F23, or another key that may be useful elsewhere.

The current Any key implementation lives in the `press-the-any-key` project. It binds GNOME to `XF86Macro26` and injects random alphanumeric characters through the Wayland-safe `ydotool` path.

The Whisper/PTT trigger is planned but separate. It should not be conflated with the old STT binding.

---

## 24. Why the F-keys were freed

Earlier versions used high function keys such as F18 through F24 as special trigger identities.

Programmable buttons make that unnecessary.

After moving Hyper, Any, STT/Whisper, Compose, AltGr, Meta, and Level5 behaviors to `PB_n` / `KEY_MACROn`, F13 through F24 can be restored to their natural role or left available for other purposes.

This avoids wasting function-key namespace on daemon triggers.

---

## 25. What should be printed on custom legends

Printed legends should reflect the durable role of a key, not a temporary software binding.

For fixed special keys, legends should match the stable intended behavior:

| Legend | Meaning |
| --- | --- |
| Hyper | Hyper trigger / command mode. |
| Super | Desktop/window-manager Super key. |
| Compose / AltGr | Tap Compose, hold AltGr. |
| Any / Meta | Tap Any trigger, hold Meta. |
| Menu / Control | Tap Menu/Application, hold Right Control. |
| Whisper | Future speech-to-text push-to-talk trigger. |
| Mouse | Mouse layer toggle on NumLock position. |

For relegendable keys, the printed legend may change with software bindings, but the firmware identity should remain stable.

---

## 26. Installation and reload boundaries

The XKB/layout repo installs the `us-nova` symbols file under the user's XKB configuration directory and sets GNOME input sources/options.

Important GNOME/XKB state:

| Setting | Current intent |
| --- | --- |
| Input source | `us-nova` custom XKB layout. |
| XKB option | `shift:both_capslock`. |
| Stale option removed | `compose:ralt`, because there is no longer a physical Right Alt key used for Compose. |

After changing the installed symbols file, GNOME may not reload the keymap immediately. A logout/login may be needed. The file being installed correctly does not guarantee the current Wayland session has rebuilt its active keymap.

Useful verification command:

`xkbcli interactive-wayland`

Acceptance checks:

| Test | Expected result |
| --- | --- |
| Compose, a, e | `æ` |
| Level3+1 | `‼` |
| Shift+Level3+1 | `⚠` |
| Any key repeated | Random alphanumeric output from Any program. |
| Meta hold + key | `Meta_R` / Mod3 visible in `xkbcli`. |
| Level5 hold + key | `ISO_Level5_Shift` / LevelFive visible in `xkbcli`. |
| Both Shifts | Toggle CapsLock. |
| Right Shift alone | Plain Shift. |

The phrase `Dæmon‼` is a good compact acceptance test because it exercises Compose and Level3 in ordinary writing.

---

## 27. Firmware flashing notes

The QMK firmware repo owns physical positions and deterministic tap-hold behavior.

The current X2 helper script is intentionally simple:

`qmk flash -kb keychron/x2/ansi/red -km default`

QMK's flash process can wait for the bootloader device. The normal ritual is:

1. Start the flash command while the keyboard is still usable.
2. When QMK waits for the device, unplug the keyboard.
3. Hold Escape.
4. Plug the keyboard back in.
5. Let QMK flash and reboot the keyboard.

This does not need to be fully automated before it is useful.

Firmware readback/idempotence is a later research project. The practical idempotence boundary is local workflow state, not proven device state: the script can remember the checksum of the last firmware it successfully flashed, but that does not prove what the keyboard currently contains.

---

## 28. Pruning QMK

Do not immediately prune the full QMK tree just because most keyboards are irrelevant.

Reasons to wait:

- The full tree is boring and known-good.
- Upstream keyboard definitions may have hidden build dependencies or conventions.
- The current priority is a repeatable working keyboard, not repo elegance.

A later cleanup may be worthwhile, but the safer long-term pattern may be a personal overlay/branch with documentation rather than deleting hundreds of upstream keyboard directories.

---

## 29. What must be preserved

If rebuilding this setup later, preserve these ideas first:

1. Firmware emits stable identities.
2. XKB assigns text/modifier meaning.
3. GNOME or host-side services bind triggers.
4. Compose and AltGr remain available as first-class daily tools.
5. The keypad remains numeric; NumLock does not get to turn it into navigation.
6. Meta remains separate from Super.
7. Hyper is a trigger, not necessarily a real modifier.
8. CapsLock exists only as an intentional both-Shift action.
9. Level3/Level4 are curated vocabulary, not random symbols.
10. Level5 exists for future expansion.
11. Physical placement is decided by real hand use, especially uncomfortable chords, not by abstract symmetry alone.

The keyboard should disappear during teaching and writing. If the layout makes a common chord noticeable in a bad way, the layout is wrong.
