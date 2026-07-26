# ADR-0003: Use one Nova group and an always-numeric keypad

- **Version:** 1.3.0
- **Date:** 2026-07-26
- **Status:** Accepted for deployment
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

`files/evdev` is a Nova-managed private copy of the generated xkeyboard-config
`evdev` rules. The installer deploys it to
`~/.config/xkb/rules/evdev`, ahead of the system XKB include path. It preserves
the ordinary rules but deliberately omits the automatic model-to-`inet(evdev)`
symbols mapping. The system copy under `/usr/share/X11/xkb` remains untouched.

The `nova:transports` option and `files/evdev.post` are removed. The installer
also removes a previously deployed `~/.config/xkb/rules/evdev.post`.

Because this complete private rule shadows the generated system rule, an
xkeyboard-config update does not automatically update it. Refreshes must start
from the newly generated system `evdev` rule, preserve the omission of the
automatic inet symbols stanza, and pass this decision's validation runbook
before deployment.

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

The outer symbols recipe merges `pc+us-nova`. In that outer override merge,
`NoSymbol` is transparent and therefore does not erase the `Num_Lock` supplied
by `pc`; a local `replace key` qualifier inside `us-nova` does not propagate
into its parent merge. `<NMLK>` therefore uses the explicit `VoidSymbol`
keysym, which replaces the inherited value. Every keypad number and operator
is replaced with a `ONE_LEVEL` definition containing only its keypad symbol.

## Safety boundary

This change does not flash firmware and must not be deployed merely because its
source looks correct.

The exact repository candidate—including both `files/us-nova` and
`files/evdev`—must first compile on MACE with its installed libxkbcommon and
xkeyboard-config data. Its resolved component and modifier maps must pass the
runbook before `install_layout.yml` is run.

## Acceptance criteria

Before deployment:

1. the candidate compiles with `xkbcli` 1.13.1;
2. KcCGST symbols resolve to `pc+us-nova+shift(both_capslock)`;
3. `inet(evdev)` is absent;
4. `<NMLK>` compiles as `ONE_LEVEL` / `VoidSymbol`;
5. `<NMLK>` is absent from every real modifier map;
6. `<I692>` owns Mod2 / LevelFive;
7. `<COMP>` owns Mod3 / Meta and is absent from Mod1;
8. `<I688>` owns Mod5 / LevelThree;
9. keypad keys compile as `ONE_LEVEL` numeric/operator keys;
10. there is exactly one layout group;
11. the proof sandbox uses the repository's `files/evdev`, not the system rule.

### Offline validation receipt

MACE passed all pre-deployment criteria on 2026-07-26 with `xkbcli` 1.13.1.
The compiled recipe was exactly
`pc+us-nova+shift(both_capslock)`, `<NMLK>` was
`ONE_LEVEL` / `VoidSymbol` with no modifier mapping, the dedicated Level3,
Level5, and Meta transports retained both their real and virtual modifiers,
every keypad key was one-level numeric/operator, and no Group2-or-higher
symbols were present.

After deployment and one deliberate GNOME reload:

1. GNOME reports only `us-nova`;
2. GNOME reports only `shift:both_capslock`;
3. the live Wayland keymap has the same modifier ownership as the offline map;
4. the keypad always types keypad numbers and operators;
5. host NumLock cannot activate Level5;
6. Compose, AltGr, Meta, Super, Any, Whisper, Hyper, and both-Shift Caps retain
   their intended identities.

## Firmware follow-up

The source-side firmware follow-up is complete in
`lemokey-x2-qmk` commit `daa4650f55df`:

1. the watchdog that repeatedly forced host NumLock on is removed;
2. the A4 NumLock lamp is off on `BASE`, solid on `MOUSE`, and blinking on
   `SCROLL`;
3. suspend turns the repurposed lamp off and wake restores the layer indication.

One deliberate QMK build, flash, and live event validation on MACE remain. That
deployment is separate from this host-side decision.

## Rollback

Rollback is an explicit corrective commit on linear `main`, followed by
`git pull --ff-only` and `ansible-playbook install_layout.yml` on MACE.
The rollback commit must explicitly remove or replace the deployed private
`~/.config/xkb/rules/evdev`; merely deleting `files/evdev` from the repository
would leave the managed copy active. Published history is not rewritten.
