# Runbook: Validate semantic Meta at the consumer boundary

- **Version:** 1.0.0
- **Date:** 2026-07-26
- **Status:** Prepared; consumer not yet selected
- **Transport decision:** ADR-0003
- **Authoritative branch:** `main`

This runbook begins after the keyboard and XKB transport have succeeded. It
separates three facts that must not be collapsed into one result:

1. the physical hold emits the intended Linux key;
2. XKB exposes semantic Meta on real Mod3;
3. the focused application chooses whether and how to consume that modifier.

Every shell command is intentionally one physical line.

## Current transport

The deployed route is:

```text
Any/Meta hold -> KC_APP -> <COMP> -> Meta_R -> virtual Meta -> real Mod3
```

PB27 and `<I690>` are historical and must not reappear. Alt remains Mod1 and
Super remains Mod4.

## Offline map proof

From `~/src/x1_keyboard_layout`:

```bash
proof_dir=$(mktemp -d /tmp/nova-meta-proof.XXXXXX) && mkdir -p "$proof_dir/symbols" "$proof_dir/rules" && cp files/us-nova "$proof_dir/symbols/us-nova" && cp files/evdev "$proof_dir/rules/evdev" && xkbcli compile-keymap --include "$proof_dir" --include-defaults --rules evdev --model pc104 --layout us-nova --options shift:both_capslock --test && xkbcli compile-keymap --include "$proof_dir" --include-defaults --rules evdev --model pc104 --layout us-nova --options shift:both_capslock --modmaps
```

Required state:

- `COMP` owns real Mod3 and virtual Meta;
- `LALT` and `RALT` remain Mod1 / Alt;
- `LWIN` and `RWIN` remain Mod4 / Super;
- `I692` remains Mod2 / LevelFive;
- no PB27 / `I690` bridge exists.

## Native Wayland proof

Run:

```bash
xkbcli interactive-wayland
```

Hold the physical Any/Meta key and press F. The observer must show the
`Meta_R` key, Mod3 depressed during the chord, and no stuck modifier after
release.

The same state can be observed at the Wayland event boundary:

```bash
wev -f wl_keyboard
```

A pass here proves the firmware-to-XKB route. It does not prove terminal byte
encoding.

## Consumer inventory

Collect versions without installing or changing anything:

```bash
printf 'Ptyxis: '; ptyxis --version 2>/dev/null || echo absent; printf 'kitty: '; kitty --version 2>/dev/null || echo absent; printf 'tmux: '; tmux -V 2>/dev/null || echo absent; printf 'Emacs: '; emacs --version 2>/dev/null | head -1 || echo absent; printf 'Neovim: '; nvim --version 2>/dev/null | head -1 || echo absent
```

Keep the output with the acceptance receipt. Versions matter because terminal
keyboard protocols and multiplexer support change independently.

## Terminal byte proof

In the terminal under test, run:

```bash
od -An -tx1
```

Press Meta+F physically, then exit with Control+C. Record the bytes exactly.

A plain `66` byte means the terminal sent ordinary `f`. That is a consumer
boundary result, not a failed Meta transport.

## Protocol-aware terminal proof

If kitty is already installed, run this inside kitty:

```bash
kitten show-key -m kitty
```

Press Meta+F and record whether the event reports the distinct semantic `meta`
modifier. Kitty's protocol defines separate bits for Alt, Super, Hyper, and
Meta, so this test is intentionally different from legacy Escape-prefix Meta.

Do not infer that tmux can bind the distinct bit merely because kitty can report
it. Current tmux documentation describes Control, historical Meta (normally
Alt), and Shift; its terminal boundary must be tested independently.

## Decision boundary

Choose the first real consumer before changing configuration:

| Consumer path | Meaning |
| --- | --- |
| Native GUI application | Bind semantic Meta directly if the toolkit exposes Mod3. |
| Protocol-aware terminal application | Use the application's native kitty-keyboard-protocol support. |
| Legacy terminal or tmux action | Translate only the selected Meta chords at a narrow terminal/application boundary. |
| Global input filter | Last resort; requires correct suppression and re-emission of ordinary keys. |

The architecture rejects a global XKB alias from Meta to Alt. That experiment
made the terminal boundary easier only by destroying the semantic distinction
the keyboard was built to preserve.

## Smallest useful acceptance

The first consumer should implement one reversible, unmistakable action. A good
candidate remains Meta+D for tmux detach, but it is accepted only when:

- the action occurs with one simultaneous chord;
- plain D does not leak into the terminal;
- Alt+D, Super+D, and plain D retain their existing meanings;
- the solution does not rename Meta as Alt globally;
- behavior outside the intended consumer is understood.

## References

- Kitty keyboard protocol: <https://sw.kovidgoyal.net/kitty/keyboard-protocol/>
- tmux modifier documentation: <https://github.com/tmux/tmux/wiki/Modifier-Keys>
- tmux manual extended keys: <https://man.openbsd.org/tmux.1>
