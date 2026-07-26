# ADR-0003: Use one Nova group and an always-numeric keypad

- **Version:** 1.0.0
- **Date:** 2026-07-26
- **Status:** Accepted for staged offline validation
- **Behavior label:** `nova-single-group-keypad-2026-07-26`
- **Supersedes:** the separate `nova:transports` assembly from ADR-0002
- **Validation runbook:** `docs/runbooks/validate-single-group-keypad.md`
- **Repository owner:** `wdcallahan/x1_keyboard_layout`

## Context

The previous host design kept ordinary US and Nova as two GNOME input sources,
then used an `evdev.post` rule and the `nova:transports` option to apply transport
meanings after `inet(evdev)`.

That arrangement solved an earlier two-group transport problem, but it is no
longer the intended architecture:

- Nova must be the sole GNOME input source and sole XKB group.
- Nova must not inherit `inet(evdev)`.
- transport definitions must contain only identities the current firmware uses;
- Alt and Meta must remain separately addressable;
- the physical NumLock position toggles the firmware mouse layer, not host
  NumLock;
- keypad keys must remain numeric regardless of modifier or lock state;
- Level5 needs Mod2, which conventional PC maps otherwise reserve for NumLock.

The current firmware transports are:

```text
PB11   -> <I674> -> Hyper_L
PB12   -> <I675> -> Multi_key
PB25   -> <I688> -> ISO_Level3_Shift / Mod5
PB26   -> <I689> -> XF86Macro26
PB28   -> <I691> -> XF86Macro28
PB29   -> <I692> -> ISO_Level5_Shift / Mod2
KC_APP -> <COMP> -> Meta_R / Mod3
KC_MENU -> <PROP> -> Menu
```

The former `<I690>` Meta and `<I147>` Menu bridges are no longer part of the
current transport set.

## Decision

`files/us-nova` contains one default `base` section. That section owns:

1. the ordinary US-derived character layout;
2. Nova's Level3 and Level4 symbol vocabulary;
3. all current dedicated firmware transport meanings;
4. the real modifier allocation;
5. NumLock suppression;
6. one-level numeric keypad definitions.

GNOME state is exact:

```text
sources     = [('xkb', 'us-nova')]
xkb-options = ['shift:both_capslock']
```

The `nova:transports` option and `files/evdev.post` are removed. The installer
also removes a previously deployed `~/.config/xkb/rules/evdev.post`.

The real modifier allocation remains:

| Real modifier | Role |
| --- | --- |
| Mod1 | Alt |
| Mod2 | Level5 |
| Mod3 | Meta |
| Mod4 | Super |
| Mod5 | Level3 / AltGr |

The stock PC symbols map NumLock indirectly with the keysym target
`Num_Lock`. XKB requires `modifier_map None` to use the same target form as the
mapping it removes. The correct removal is therefore:

```text
modifier_map None { Num_Lock };
```

Using `<NMLK>` does not cancel that inherited keysym-based mapping.

`<NMLK>` itself is replaced with a one-level `NoSymbol` key. Every keypad
number and operator is replaced with a `ONE_LEVEL` definition containing only
its keypad symbol.

## Safety boundary

This change does not flash firmware and must not be deployed merely because its
source looks correct.

The exact repository candidate must first compile on MACE with its installed
libxkbcommon and xkeyboard-config data. Its resolved component and modifier maps
must pass the runbook before `install_layout.yml` is run.

## Acceptance criteria

Before deployment:

1. the candidate compiles with `xkbcli` 1.13.1;
2. KcCGST symbols resolve to `pc+us-nova+shift(both_capslock)`;
3. `inet(evdev)` is absent;
4. `<NMLK>` is absent from every real modifier map;
5. `<I692>` owns Mod2 / LevelFive;
6. `<COMP>` owns Mod3 / Meta and is absent from Mod1;
7. `<I688>` owns Mod5 / LevelThree;
8. keypad keys compile as `ONE_LEVEL` numeric/operator keys;
9. there is exactly one layout group.

After deployment and one deliberate GNOME reload:

1. GNOME reports only `us-nova`;
2. GNOME reports only `shift:both_capslock`;
3. the live Wayland keymap has the same modifier ownership as the offline map;
4. the keypad always types keypad numbers and operators;
5. host NumLock cannot activate Level5;
6. Compose, AltGr, Meta, Super, Any, Whisper, Hyper, and both-Shift Caps retain
   their intended identities.

## Firmware follow-up

After the host map is accepted, one deliberate firmware flash remains:

1. remove the watchdog that repeatedly forces host NumLock on;
2. drive the A4 NumLock lamp from the firmware `MOUSE` layer state.

That firmware work is separate from this host-side decision.

## Rollback

Rollback is an explicit corrective commit on linear `main`, followed by
`git pull --ff-only` and `ansible-playbook install_layout.yml` on MACE.
Published history is not rewritten.
