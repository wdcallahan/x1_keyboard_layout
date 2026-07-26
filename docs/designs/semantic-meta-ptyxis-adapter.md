# Design: semantic Meta adapter for Ptyxis and tmux

- **Version:** 0.2.0
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

The adapter is a GNOME Shell extension because Shell sees real Mod3 before the
terminal boundary. It acts only when:

- the focused window identifies as `org.gnome.Ptyxis` through its Shell
  application ID, GTK application ID, WM class, or WM class instance;
- the event is D or d;
- the explicit `Meta_R` key-down event has been observed and its matching
  release has not yet arrived.

Plain D, Alt+D, Super+D, Level3+D, Level5+D, and Meta+D outside Ptyxis continue
through the normal input path.

## Event state machine

| State | Event | Action | Next state |
| --- | --- | --- | --- |
| Idle | Exact Meta+D press in Ptyxis | Consume D; queue detach | Swallowing D |
| Swallowing D | D repeat | Consume repeat | Swallowing D |
| Swallowing D | D release | Consume release | Waiting for Meta release |
| Waiting | Meta still depressed | Do nothing | Waiting |
| Waiting | Meta released | Inject `Ctrl+B`, then `D` with `ydotool` | Idle |
| Any | Dependency or subprocess failure | Notify once; preserve fault in journal | Faulted |

The adapter must wait for physical Meta release before injection. Injecting D
while Mod3 remained depressed would make the extension recognize its own
synthetic D as another Meta+D chord and could recurse indefinitely.

Tracking the concrete `Meta_R` press and release is intentional. The firmware
and Wayland proofs already establish that identity, while the project exists
precisely because later consumers inconsistently preserve the corresponding
modifier bit.

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

## Acceptance contract

After a fresh GNOME session:

1. Extension version 2 reports `Enabled: Yes` and `State: ACTIVE`.
2. In tmux under Ptyxis, Meta+D detaches the focused client.
3. No literal D appears before detachment.
4. D auto-repeat does not trigger repeated detach attempts.
5. Plain D, Alt+D, Super+D, Level3+D, and Level5+D keep their prior meanings.
6. Meta+D in a non-Ptyxis application is not consumed.
7. Disabling the extension restores the prior behavior immediately.

The prototype remains unaccepted until MACE passes those checks.
