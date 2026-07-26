# Nova keyboard host layout

This repository is the canonical documentation and host-configuration hub for
Nova's Lemokey X2 input architecture. It owns the custom single-group XKB
layout, GNOME settings and extensions, the Ansible installer, design records,
and validation runbooks.

The firmware, Any Key, and experimental Hyper dispatcher remain separate
projects because they operate at different layers.

## Current accepted state

| Area | Status |
| --- | --- |
| Base, Shift, Level3, and Level4 symbols | Active in the Nova single-group XKB layout. |
| Level5 | Active; B is the first accepted eight-level canary: `b B β α 🐇 🐰 🥬 🥕`. |
| Numeric keypad | Always numeric; `<NMLK>` is void and owns no modifier map. |
| Physical NumLock position | Firmware mouse-layer toggle; its lamp is off on Base, solid on Mouse, and blinking on Scroll. |
| Level5 safety | GNOME NumLock restoration is disabled and the managed sentinel alerts on unexpected latched or locked Mod2. |
| Meta transport | Active as `KC_APP` → `<COMP>` → `Meta_R` / Mod3. |
| Meta consumption | Native Bash Readline Meta+D is proven in xterm. Ptyxis/VTE discards Mod3; the accepted adapter handles only Meta+D → tmux detach. General Bash Meta in Ptyxis is not implemented. |
| Whisper/PTT | Physical `PB_28` transport and design boundary are prepared. No recording/transcription service exists yet. |

“Transport active” and “every application consumes it” are deliberately not
treated as the same claim.

## Documentation map

- [Guided tour](docs/nova-keyboard-input-architecture.md) — the readable
  whole-system explanation originally assembled for Joule.
- [Technical architecture](docs/keyboard-architecture.md) — exact current
  behavior, implementation boundaries, and acceptance evidence.
- [Symbol vocabulary](docs/symbol-vocabulary.md) — current direct symbols and
  the doctrine behind their placement.
- [Decision records](docs/decisions/) — accepted architectural decisions.
- [Designs](docs/designs/) — implemented boundaries and prepared future work.
- [Validation runbooks](docs/runbooks/) — reproducible proof procedures.

The two long-form guides are also mirrored in ChatGPT Library for convenient
reading and sharing. The repository copies are canonical.

## Related repositories

- [`wdcallahan/lemokey-x2-qmk`](https://github.com/wdcallahan/lemokey-x2-qmk)
  — Lemokey X2 firmware and physical behavior.
- [`wdcallahan/press-the-any-key`](https://github.com/wdcallahan/press-the-any-key)
  — Any Key GNOME shortcut and `ydotool` injection path.
- [`wdcallahan/hyperkeyd`](https://github.com/wdcallahan/hyperkeyd)
  — experimental passive Hyper command dispatcher.

## Install

Run from the repository root:

```bash
ansible-playbook install_layout.yml
```

The playbook installs the XKB files and managed GNOME Shell extensions,
enforces the GNOME input policy, and verifies the result. A second routine run
is not required; use the individual runbooks when proving a particular
boundary.

XKB or GNOME Shell changes may require a logout/login or reboot before the
active Wayland session reflects the newly installed state.
