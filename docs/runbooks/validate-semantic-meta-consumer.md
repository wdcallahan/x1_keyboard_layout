# Runbook: Validate semantic Meta at the consumer boundary

- **Version:** 2.0.0
- **Date:** 2026-07-26
- **Status:** Ptyxis/tmux Meta+D consumer accepted on MACE
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
if command -v ptyxis >/dev/null 2>&1; then printf 'Ptyxis: '; ptyxis --version 2>/dev/null; else echo 'Ptyxis: absent'; fi; if command -v xterm >/dev/null 2>&1; then printf 'xterm: '; xterm -version 2>/dev/null; else echo 'xterm: absent'; fi; if command -v kitty >/dev/null 2>&1; then printf 'kitty: '; kitty --version 2>/dev/null; else echo 'kitty: absent'; fi; if command -v tmux >/dev/null 2>&1; then printf 'tmux: '; tmux -V 2>/dev/null; else echo 'tmux: absent'; fi; if command -v emacs >/dev/null 2>&1; then printf 'Emacs: '; emacs --version 2>/dev/null | head -1; else echo 'Emacs: absent'; fi; if command -v nvim >/dev/null 2>&1; then printf 'Neovim: '; nvim --version 2>/dev/null | head -1; else echo 'Neovim: absent'; fi
```

Keep the output with the acceptance receipt. Versions matter because terminal
keyboard protocols and multiplexer support change independently.

## Terminal byte proof

In the terminal under test, run:

```bash
showkey -a
```

Press each requested chord once, in the stated order, and finish with Control+D.
Record the decimal bytes exactly. `^[` is the terminal's visible notation for
Escape byte 27.

Do not use a short interactive `od -An -tx1` capture terminated by Control+C
as the acceptance receipt. GNU `od` may retain a partial block and then lose
it when the interrupt terminates the process. That happened during the live
MACE investigation; `showkey -a` produced the unambiguous byte receipt.

### Native xterm reference

In XTerm 406, press Meta+D, Alt+D, then Control+D. MACE produced:

```text
Meta+D -> 27 100
Alt+D  ->    100
```

Byte 27 followed by byte 100 is `ESC d`, the traditional terminal encoding
of Meta+D. At a Bash prompt, typing `echo one two` without Enter, pressing
Control+A, and then pressing Meta+D deleted `echo`. That is an end-to-end
native Readline `M-d` proof.

Xterm therefore recognizes the modifier containing `Meta_R` on real Mod3.
Its current configuration does not encode Alt+D; Alt+D reaches the PTY as
plain `d`.

### Ptyxis/VTE boundary

Before the adapter, MACE's Ptyxis 50.1 / VTE 0.84.0 delivered Meta+D as plain
`d`, while Alt retained VTE's legacy Escape-prefix behavior. After enabling
the accepted adapter, `showkey -a` in Ptyxis produced:

```text
Alt+D  -> 27 100
Meta+D ->  2 100
```

Byte 2 followed by byte 100 is Control+B, D: exactly the sequence injected by
the scoped adapter. The result proves all three relevant facts:

1. VTE assigns `ESC d` to Alt+D;
2. VTE does not natively serialize semantic Mod3 Meta;
3. the adapter preserves the distinction by emitting the selected tmux command
   rather than aliasing Meta to Alt.

A richer wire encoding cannot recover a modifier after a terminal frontend has
discarded it. Conversely, xterm's result proves that the firmware/XKB/Wayland
transport is sound and that a terminal frontend can consume the real Meta
modifier correctly.

## Protocol-aware terminal proof

If kitty is already installed, run this inside kitty:

```bash
kitten show-key -m kitty
```

Press Meta+F and record whether the event reports the distinct semantic `meta`
modifier. Kitty's protocol defines separate bits for Alt, Super, Hyper, and
Meta, so this test is intentionally different from legacy Escape-prefix Meta.

MACE's kitty 0.47.1 trace encoded Right Meta itself as:

```text
CSI 57452 ; 33 u
```

The protocol modifier field is one plus a bit mask, and bit 32 is semantic
Meta. The following F event nevertheless had an empty modifier field:

```text
CSI 102 ; ; ; 102 u
```

This is a precise rejection receipt. Kitty's wire protocol can represent Meta,
but kitty's input frontend did not carry the depressed Mod3/Meta state onto the
following F event. A richer terminal protocol cannot restore a modifier that
was discarded before encoding.

Do not infer that tmux can bind the distinct bit merely because a terminal can
report it. Current tmux documentation describes Control, historical Meta
(normally Alt), and Shift; its terminal boundary must be tested independently.

## Decision boundary

The first real consumer has now been selected and accepted:

| Consumer path | Meaning |
| --- | --- |
| Native GUI application | Bind semantic Meta directly if the toolkit exposes Mod3. |
| Protocol-aware terminal application | Use the application's native kitty-keyboard-protocol support. |
| Legacy terminal or tmux action | Translate only the selected Meta chords at a narrow terminal/application boundary. |
| Global input filter | Last resort; requires correct suppression and re-emission of ordinary keys. |

The architecture rejects a global XKB alias from Meta to Alt. That experiment
made the terminal boundary easier only by destroying the semantic distinction
the keyboard was built to preserve.

The accepted adapter is
`nova-semantic-meta@wdcallahan`, documented in
`docs/designs/semantic-meta-ptyxis-adapter.md`. Mutter sees real Mod3 before
Ptyxis discards the modifier. The extension therefore registers exact
`<Mod3>d` at the compositor keybinding layer, allows it only while Ptyxis is
focused, waits until both D and Meta are released, and injects tmux's already
accepted Control+B, D sequence through the established `ydotool` path.

Waiting for release is a safety requirement. Injecting D while physical Meta
remained depressed could make the extension recognize its own synthetic D and
recurse.

Version 1 loaded and reported `ACTIVE`, but Meta+D still printed `d`. The
installed Window Calls extension identified the focused window as
`org.gnome.Ptyxis`, exposing a brittle first-pass check that required only
`org.gnome.Ptyxis.desktop`. Version 2 recognizes Ptyxis through the Shell
application ID, GTK application ID, WM class, or WM class instance, but it
also remained unable to claim the chord.

The second failure exposed the real interception boundary. Ordinary key events
destined for a focused Wayland client do not traverse GNOME Shell's Clutter
stage, so a `captured-event` listener cannot see them. Version 3 uses Mutter's
external accelerator path, which runs before client delivery. Shell's
keybinding filter enables the grab only for focused Ptyxis; outside Ptyxis the
same chord remains unhandled and follows its normal path.

## Smallest useful acceptance

The first consumer implements one reversible, unmistakable action. Meta+D for
tmux detach is accepted only when:

- the action occurs with one simultaneous chord;
- plain D does not leak into the terminal;
- Alt+D, Super+D, and plain D retain their existing meanings;
- the solution does not rename Meta as Alt globally;
- behavior outside the intended consumer is understood.

## Install the adapter

From `~/src/x1_keyboard_layout`:

```bash
git status --short --branch && git pull --ff-only && git log -1 --oneline && ansible-playbook --syntax-check install_layout.yml && ansible-playbook install_layout.yml && cmp files/gnome-shell/extensions/nova-semantic-meta@wdcallahan/extension.js ~/.local/share/gnome-shell/extensions/nova-semantic-meta@wdcallahan/extension.js && cmp files/gnome-shell/extensions/nova-semantic-meta@wdcallahan/metadata.json ~/.local/share/gnome-shell/extensions/nova-semantic-meta@wdcallahan/metadata.json
```

GNOME Shell caches extension modules for the life of the session. Reboot or
log out and back in after installing a new extension version; disable/enable
alone is not proof that revised JavaScript was loaded.

## Live acceptance

After the fresh session:

```bash
gnome-extensions info nova-semantic-meta@wdcallahan
```

Required state is version 3, `Enabled: Yes`, and `State: ACTIVE`.

Open tmux in Ptyxis. Type a visible marker, then press physical Meta+D. The
client must detach without inserting D. Reattach and verify plain D, Alt+D,
Super+D, Level3+D, and Level5+D retain their prior meanings.

The extension acts only while Ptyxis is focused. Meta+D in another application
must not be consumed. Ptyxis tabs that are not running tmux remain a documented
limitation: they receive the ordinary terminal effects of Control+B followed by
D.

### Accepted MACE receipt

MACE passed this contract on 2026-07-26:

- version 3 was `ACTIVE` after reboot;
- Meta+D detached exactly once, without leaking D;
- reattachment preserved the unfinished command line in the same tmux session;
- Firefox and GNOME Text Editor continued receiving ordinary D while Mod3 was
  held, confirming that the adapter remained scoped to Ptyxis;
- `wev` outside Ptyxis showed `Meta_R`, depressed Mod3, D press/release, and
  a clean modifier release;
- the Ptyxis byte receipt was Alt+D = `27 100` and adapted Meta+D =
  `2 100`;
- the native xterm reference was Meta+D = `27 100`, Alt+D = `100`, and
  Bash Readline successfully consumed native `M-d`.

The accepted component remains intentionally command-specific. It does not
claim to make every terminal application understand semantic Meta.

Emergency rollback is immediate:

```bash
gnome-extensions disable nova-semantic-meta@wdcallahan
```

## References

- Xterm Meta-key handling: <https://invisible-island.net/xterm/xterm-meta-key.html>
- Xterm keyboard control sequences: <https://invisible-island.net/xterm/ctlseqs/ctlseqs.html>
- Kitty keyboard protocol: <https://sw.kovidgoyal.net/kitty/keyboard-protocol/>
- tmux modifier documentation: <https://github.com/tmux/tmux/wiki/Modifier-Keys>
- tmux manual extended keys: <https://man.openbsd.org/tmux.1>
- Adapter design: `docs/designs/semantic-meta-ptyxis-adapter.md`
