# ADR-0002: Separate Menu, Meta, and Compose transports

- **Version:** 1.0.0
- **Date:** 2026-07-24
- **Status:** Accepted for staged host validation
- **Behavior label:** `xkb-menu-meta-transport-v2`
- **Supersedes:** ADR-0001 / `xkb-meta-transport-v1`
- **Repository owner:** `wdcallahan/x1_keyboard_layout`

## Context

The Nova keyboard architecture separates firmware identity from host meaning. Compose already has a clean programmable-button transport and must remain independent:

```text
PB12 -> <I675> -> Multi_key
```

The original staged Meta design borrowed the right-GUI transport:

```text
evdev 126 -> <RWIN> -> Meta_R / Mod3
```

That transport survives Xwayland, but it consumes a real Super key and makes the firmware and host meanings less intuitive.

Investigation established two other low-numbered transports:

```text
KC_APP  -> USB Keyboard Application -> evdev 127 -> keycode 135 -> <COMP>
KC_MENU -> USB Keyboard Menu        -> evdev 139 -> keycode 147 -> <I147>
```

On the stock MACE keymap, `<COMP>` produces `Menu`, while `<I147>` produces `XF86MenuKB` and does not provide the normal context-menu behavior expected from the physical Menu key.

The `KEY_MENU` transport was confirmed on MACE with a complete synthetic press and release:

```text
key 147 pressed  -> XF86MenuKB
key 147 released -> XF86MenuKB
```

Both keycodes fit through native Wayland and Xwayland.

## Decision

Use the low-numbered Application and Menu transports according to their intended workstation roles:

```text
<COMP> -> Meta_R / Mod3
<I147> -> Menu
<I675> -> Multi_key / Compose
<RWIN> -> Super_R / Mod4
```

Stage 1 changes only the host XKB map:

1. restore `<RWIN>` to the inherited `Super_R` / Mod4 behavior;
2. map `<COMP>` to `Meta_R` and explicitly place it on Mod3;
3. map `<I147>` to the ordinary `Menu` keysym;
4. keep `<I690>` as a temporary native-Wayland Meta bridge for the current PB27 firmware;
5. leave PB12 Compose and every Level3/Level5 mapping unchanged.

The resulting staged bridge is:

```text
current firmware PB27 -> <I690> -> Meta_R / Mod3 (native Wayland)
future firmware KC_APP -> <COMP> -> Meta_R / Mod3 (Wayland and Xwayland)
future firmware KC_MENU -> <I147> -> Menu (Wayland and Xwayland)
current firmware PB12 -> <I675> -> Multi_key (Compose)
```

Firmware will not change until this host mapping passes acceptance tests.

## Planned firmware migration after host acceptance

The QMK dual-role definitions can then change as follows:

```text
Menu/Control tap: KC_APP -> KC_MENU
Any/Meta hold:    PB27   -> KC_APP
```

The deterministic tap-hold mechanism itself does not change.

After the firmware migration is accepted, the temporary `<I690>` Meta bridge may be removed in a later versioned change.

## Acceptance criteria

After deployment and keymap reload:

1. native Wayland shows `<COMP>` as `Meta_R` on Mod3;
2. Xwayland shows `<COMP>` as `Meta_R` on Mod3;
3. native Wayland group 2 shows `<I147>` as `Menu`;
4. Xwayland group 2 shows `<I147>` as `Menu`;
5. `<RWIN>` is again `Super_R` on Mod4;
6. left Super remains `Super_L` on Mod4;
7. existing PB27 / `<I690>` Meta still works in native Wayland;
8. PB12 Compose still produces `Multi_key` and the compact `Compose, a, e -> æ` test passes;
9. a complete synthetic Application chord releases every key and leaves no depressed modifier state;
10. a complete synthetic Menu press opens the normal context menu where the focused application supports it;
11. xterm receives the representable Meta transport through Xwayland;
12. Ptyxis/VTE behavior is measured separately because transport visibility does not guarantee Escape-prefix terminal encoding.

## Validation performed before publication

A representative three-group XKB keymap was compiled with `xkbcomp`. The compiled result contained:

```text
<COMP> Group1 = Menu, Group2 = Meta_R
<I147> Group1 = XF86MenuKB, Group2 = Menu
Mod3 includes <COMP>
Mod4 includes <LWIN> and <RWIN>
```

This validates the XKB syntax and the group-specific override model. MACE remains the acceptance environment for the real native-Wayland and Xwayland maps.

## Deployment

The authoritative file is `files/us-nova`. Deploy only through `install_layout.yml`; do not edit `~/.config/xkb/symbols/us-nova` by hand.

A GNOME session may retain its prior compiled keymap. Switch to another input source and back, or log out and in, before judging the result.

## Rollback

The normal rollback is an explicit corrective commit on `main`.

To return from v2 to the earlier staged v1 behavior:

1. revert the commit that introduces `xkb-menu-meta-transport-v2`;
2. push the revert to `origin/main`;
3. pull `main` on MACE;
4. run `ansible-playbook install_layout.yml`;
5. reload the GNOME keymap;
6. repeat the compiled-map checks.

To return all the way to the pre-transport baseline, first revert the v2 behavior commit, then revert commit `c0f3060` in a second explicit revert commit, deploy, reload, and verify.

During an input failure, switch to the ordinary `us` input source before deploying the reverted version. Published history is not rewritten.

## Review triggers

Review this decision when:

- the host acceptance tests fail;
- QMK firmware begins emitting `KC_APP` for Meta and `KC_MENU` for Menu;
- the temporary PB27 / `<I690>` bridge can be removed;
- the Xwayland keycode limitation changes;
- VTE or another terminal changes how it treats genuine Meta modifiers;
- the always-numeric keypad design frees Mod2 for Level5.