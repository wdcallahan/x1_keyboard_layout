# ADR-0001: Xwayland-compatible Meta transport

- **Version:** 1.0.1
- **Date:** 2026-07-23
- **Status:** Superseded before host deployment
- **Behavior label:** `xkb-meta-transport-v1`
- **Superseded by:** ADR-0002 / `xkb-menu-meta-transport-v2`
- **Repository owner:** `wdcallahan/x1_keyboard_layout`

## Context

The Nova keyboard architecture separates firmware identity from host meaning. The current firmware emits programmable-button identities for Compose, AltGr, Meta, and Level5. Native Wayland preserves the extended Linux/XKB keycodes used by those programmable buttons, but Xwayland cannot represent keycodes above its 8-bit keycode range.

Observed compiled keymaps on MACE established the following:

- native Wayland contains `<I690>` at keycode 690 and maps it to `Meta_R`;
- native Wayland contains `<I692>` at keycode 692 and maps it to `ISO_Level5_Shift`;
- Xwayland drops both `<I690>` and `<I692>`;
- evdev code 126 reaches Wayland/XKB as keycode 134, `<RWIN>`, and therefore survives both native Wayland and Xwayland;
- the stock `us` symbols map `<RWIN>` to `Super_R` on Mod4.

The present firmware still emits PB27 / `<I690>` for Meta. A host-side migration must therefore preserve `<I690>` temporarily while adding a representable transport that future firmware can emit.

## Decision

Stage 1 changes only Meta.

The `us-nova` symbols file will:

1. replace `<RWIN>` with `Meta_R`;
2. explicitly remove `<RWIN>` from its inherited Mod4 map;
3. explicitly assign both `<RWIN>` and the existing `<I690>` transport to Mod3;
4. leave left Super on Mod4;
5. retain the current programmable-button mappings so the existing keyboard firmware continues to work in native Wayland.

This creates a compatibility bridge:

```text
current firmware PB27 -> <I690> -> Meta_R / Mod3 (native Wayland)
future firmware Right GUI transport -> evdev 126 -> <RWIN> -> Meta_R / Mod3 (Wayland and Xwayland)
```

The change is intentionally limited to the host map. Firmware will not change until the host mapping passes acceptance tests.

## Deliberately deferred work

### Compose

The initially considered evdev 127 / `<COMP>` transport is already produced by the current `KC_APP` Menu/Application tap on the Fn/Menu key. Reassigning `<COMP>` to Compose now would silently turn that Menu key into another Compose key. A collision-free low-numbered Compose transport must be selected and tested first.

### Level5

The initially considered evdev 95 / `<JPCM>` transport is representable and currently harmless, but Level5 cannot be moved onto Mod2 safely yet. NumLock currently occupies and locks Mod2, the firmware actively reasserts host NumLock, and the keypad's numeric behavior depends on the existing NumLock path. The keypad must first be made unconditionally numeric without consuming Mod2, and the firmware NumLock guard must then be revised or removed.

These deferrals prevent the staged Meta repair from breaking Menu, the keypad, or the NumLock watchdog.

## Acceptance criteria

After deployment and keymap reload:

1. The native Wayland compiled map contains both `<RWIN>` and `<I690>` on Mod3.
2. The native Wayland compiled map does not contain `<RWIN>` on Mod4.
3. The Xwayland compiled map contains `<RWIN>` on Mod3 and does not contain `<RWIN>` on Mod4.
4. Left Super remains `Super_L` on Mod4.
5. A complete synthetic Right-Meta chord releases every key and leaves no depressed modifier state.
6. Native Wayland applications see `Meta_R` / Mod3 for the new transport.
7. xterm receives the new representable transport through Xwayland.
8. Ptyxis/VTE behavior is measured separately; transport compatibility does not imply that VTE encodes a genuine Meta modifier into terminal bytes.
9. Existing PB27 Meta continues to work in native Wayland until firmware migration.

## Deployment

The authoritative file is `files/us-nova`. It is installed only through `install_layout.yml`; the deployed copy under `~/.config/xkb/symbols/` must not be edited by hand.

A GNOME session may retain its previous compiled keymap after the file is installed. Switch to another input source and back, or log out and in, before judging the result.

## Rollback

The normal rollback is an explicit Git revert on `main`, followed by normal deployment:

1. revert the commit that introduces `xkb-meta-transport-v1`;
2. push the revert to `origin/main`;
3. pull `main` on MACE;
4. run `ansible-playbook install_layout.yml`;
5. reload the GNOME keymap by switching input sources or logging out and in;
6. repeat the compiled-map checks.

During an input failure, switch to the ordinary `us` input source before deploying the reverted version. Do not repair the Ansible-managed deployed file by hand.

The documentation commit may remain as a historical record even if the behavior commit is reverted. Published history is not rewritten.

## Supersession note

MACE confirmed that evdev 139 reaches XKB as keycode 147 / `<I147>` with `XF86MenuKB`. ADR-0002 therefore adopts a cleaner design: `<I147>` carries Menu, `<COMP>` carries Meta, PB12 continues to carry Compose, and `<RWIN>` remains Super. This document remains as the historical record of the rejected staged alternative.

## Review triggers

Review this decision when:

- the Xwayland keycode limitation changes;
- QMK firmware begins emitting the low-numbered Meta transport;
- a collision-free Compose transport is selected;
- the always-numeric keypad design frees Mod2 for Level5;
- VTE or another terminal changes how it treats genuine Meta modifiers;
- an acceptance test contradicts the assumptions recorded here.
