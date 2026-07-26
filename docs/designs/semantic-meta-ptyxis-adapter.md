# Design: semantic Meta adapter for Ptyxis and tmux

- **Version:** 0.3.0
- **Date:** 2026-07-26
- **Status:** Prototype awaiting live MACE acceptance
- **Transport decision:** ADR-0003

## Purpose

Nova exposes a real semantic Meta modifier:

```text
Any/Meta hold -> KC_APP -> <COMP> -> Meta_R -> virtual Meta -> real Mod3
```

Firmware, XKB, and the Wayland protocol preserve that state. Ptyxis/VTE and
kitty both demonstrated a consumer gap: the terminal recognized the modifier
key itself but encoded the following key as unmodified input. Installing or
implementing a richer terminal wire protocol cannot recover a modifier that
the terminal frontend has already discarded.

The first useful consumer is therefore deliberately narrow:

```text
physical Meta+D in focused Ptyxis -> tmux Control+B, D -> detach client
```

This is not a global alias from Meta to Alt, Super, or Control. It is one
consumer-specific translation for one approved command.

## Why VTE matters

VTE is the terminal-emulation widget and engine used by Ptyxis. It is not a
terminal standard. Ptyxis supplies the GNOME application, windows, tabs, and
preferences; VTE supplies the terminal grid, escape-sequence handling, PTY
connection, and keyboard-to-byte translation.

kitty uses its own terminal stack and its own extended keyboard protocol. Its
live trace encoded Right Meta with modifier field 33, but encoded the following
F with no modifier field. That proved the protocol can represent Meta and that
the modifier had already been lost before the ordinary-key event reached the
protocol encoder.

## Boundary

The adapter is a GNOME Shell extension because Mutter sees real Mod3 before
the terminal boundary. It owns one compositor accelerator:

```text
<Mod3>d
```

The accelerator is allowed only while the focused window identifies as
`org.gnome.Ptyxis` through its Shell application ID, GTK application ID, WM
class, or WM class instance. Mutter consumes the exact chord before Wayland
delivery. Outside Ptyxis, Shell marks the accelerator disallowed, so Mutter
treats it as unhandled and preserves the normal application input path.

Plain D, Alt+D, Super+D, Level3+D, Level5+D, and Meta+D outside Ptyxis continue
through the normal input path.

## Event state machine

| State | Event | Action | Next state |
| --- | --- | --- | --- |
| Ptyxis unfocused | Focus enters Ptyxis | Allow compositor accelerator | Armed |
| Armed | Exact Meta+D press | Mutter consumes chord; queue detach | Waiting |
| Waiting | D repeat | Mutter consumes and ignores repeat | Waiting |
| Waiting | D or Meta still depressed | Do nothing | Waiting |
| Waiting | D and Meta released | Inject `Ctrl+B`, then `D` with `ydotool` | Armed |
| Waiting | Release wait reaches 15 seconds | Cancel without injection; notify once | Faulted |
| Any | Focus leaves Ptyxis | Disallow accelerator; cancel pending action | Ptyxis unfocused |
| Any | Dependency or subprocess failure | Notify once; preserve fault in journal | Faulted |

The adapter must wait for physical Meta release before injection. Injecting D
while Mod3 remained depressed would make the extension recognize its own
synthetic D as another Meta+D chord and could recurse indefinitely.

Mutter emits separate activation and deactivation signals for the grabbed D
key. The extension combines that lifecycle with the compositor's current
Mod3 mask from `global.get_pointer()`, the same modifier-state mechanism GNOME
Shell uses for its own switcher release handling. Injection begins only after
both are clear.

## Injection

The established Any Key project already owns the user `ydotoold` service and
Wayland-safe virtual keyboard path. The adapter reuses it with Linux input
event codes:

| Code | Key |
| --- | --- |
| 29 | Left Control |
| 48 | B |
| 32 | D |

The emitted sequence is:

```text
29:1 48:1 48:0 29:0 32:1 32:0
```

tmux therefore receives its existing prefix and detach command. No tmux
configuration is changed.

## Known scope

The adapter knows that Ptyxis is focused, but it cannot determine whether the
focused Ptyxis tab currently contains tmux. Inside tmux the sequence detaches
the client. Outside tmux it has the ordinary terminal meanings of Control+B
followed by D. This limitation must be included in live acceptance; expanding
the consumer requires a separate design decision.

## Prototype iteration receipt

Version 1 loaded successfully after reboot but Meta+D printed a literal `d`.
Window Calls then reported the focused Ptyxis window as:

```json
{"wm_class":"org.gnome.Ptyxis","wm_class_instance":"org.gnome.Ptyxis"}
```

The original filter required only `org.gnome.Ptyxis.desktop` from
`Shell.App.get_id()`, so an otherwise valid Ptyxis window could fail before the
modifier test. Version 2 accepts all four relevant window/application identity
surfaces and records the chosen identity in the journal when it claims the
chord. It also follows the explicit `Meta_R` key lifecycle rather than making
the action depend solely on a toolkit modifier mask.

Version 2 also loaded as `ACTIVE`, but Meta+D still printed `d`. Inspection of
Mutter 50.3 established the actual boundary error: normal key events for a
focused Wayland client are handled by Mutter's keybinding layer and then
routed to the client; they do not traverse GNOME Shell's Clutter stage.
Consequently, a `global.stage` `captured-event` listener cannot implement this
consumer while Ptyxis owns keyboard focus.

Version 3 replaces the passive stage listener with Mutter's external
accelerator API. It grabs exact `<Mod3>d`, uses Shell's keybinding filter to
allow that grab only while Ptyxis is focused, ignores auto-repeat, receives a
release callback, and polls the real Mod3 mask before injection.

## Acceptance contract

After a fresh GNOME session:

1. Extension version 3 reports `Enabled: Yes` and `State: ACTIVE`.
2. In tmux under Ptyxis, Meta+D detaches the focused client.
3. No literal D appears before detachment.
4. D auto-repeat does not trigger repeated detach attempts.
5. Plain D, Alt+D, Super+D, Level3+D, and Level5+D keep their prior meanings.
6. Meta+D in a non-Ptyxis application is not consumed.
7. Disabling the extension restores the prior behavior immediately.

The prototype remains unaccepted until MACE passes those checks.

## Implementation references

- Mutter 50.3 event routing:
  <https://github.com/GNOME/mutter/blob/50.3/src/core/events.c>
- Mutter 50.3 external accelerator handling:
  <https://github.com/GNOME/mutter/blob/50.3/src/core/keybindings.c>
- GNOME Shell 50.3 keybinding-mode filter:
  <https://github.com/GNOME/gnome-shell/blob/50.3/js/ui/windowManager.js>
