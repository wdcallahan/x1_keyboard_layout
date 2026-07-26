# Design: semantic Meta adapter for Ptyxis and tmux

- **Version:** 1.0.0
- **Date:** 2026-07-26
- **Status:** Accepted on MACE
- **Transport decision:** ADR-0003

## Purpose

Nova exposes a real semantic Meta modifier:

```text
Any/Meta hold -> KC_APP -> <COMP> -> Meta_R -> virtual Meta -> real Mod3
```

Firmware, XKB, and the Wayland protocol preserve that state. Live MACE
comparisons isolate the next consumer boundary:

| Consumer | Meta+D | Alt+D | Interpretation |
| --- | --- | --- | --- |
| XTerm 406 | `ESC d` | plain `d` | Xterm recognizes semantic Meta on Mod3 and serializes it through the legacy terminal Meta channel. |
| Ptyxis 50.1 / VTE 0.84.0 before the adapter | plain `d` | `ESC d` | VTE assigns the legacy terminal Meta channel to Alt and discards Mod3 for ordinary text input. |
| kitty 0.47.1 extended-key trace | Meta key event, then unmodified F | not part of this receipt | The wire protocol can represent Meta, but the following ordinary-key event did not retain it. |

This proves that the modifier is not lost in firmware, XKB, Wayland, or every
terminal. Xterm is a native semantic-Meta consumer. VTE is the daily-terminal
consumer gap. Mapping Meta to `ESC` inside Ptyxis would collide with Alt, so
the adapter must remain command-specific rather than pretending to be a
general Meta transport.

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

## Implementation iteration receipt

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

## Live MACE acceptance receipt

MACE passed the contract on 2026-07-26 after a fresh GNOME session:

- extension version 3 reported `Enabled: Yes` and `State: ACTIVE`;
- Meta+D detached the active tmux client without inserting D;
- reattaching returned to the same tmux session with an unsubmitted command
  still intact;
- holding the chord caused one detach, not an auto-repeat burst;
- outside Ptyxis, `wev` still reported `Meta_R`, depressed Mod3, and the
  ordinary D event, proving that the scoped grab did not consume the chord;
- `showkey -a` in Ptyxis reported Alt+D as bytes `27 100` (`ESC d`) and
  adapted Meta+D as bytes `2 100` (Control+B, D);
- `showkey -a` in XTerm 406 reported native Meta+D as `27 100` and Alt+D
  as plain `100`;
- Bash Readline in xterm consumed Meta+D as its native `M-d` word deletion;
- the managed extension survived reboot, and the installation playbook had
  already reached a zero-change run.

The adapter is accepted for the exact Ptyxis/tmux detach consumer. It is not a
general terminal Meta encoder, and the documented behavior outside tmux
remains part of its scope.

## Implementation references

- Xterm Meta-key handling:
  <https://invisible-island.net/xterm/xterm-meta-key.html>
- Xterm keyboard control sequences:
  <https://invisible-island.net/xterm/ctlseqs/ctlseqs.html>
- Mutter 50.3 event routing:
  <https://github.com/GNOME/mutter/blob/50.3/src/core/events.c>
- Mutter 50.3 external accelerator handling:
  <https://github.com/GNOME/mutter/blob/50.3/src/core/keybindings.c>
- GNOME Shell 50.3 keybinding-mode filter:
  <https://github.com/GNOME/gnome-shell/blob/50.3/js/ui/windowManager.js>
