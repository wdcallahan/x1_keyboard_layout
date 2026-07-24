# Runbook: Validate Menu/Meta transport v2

- **Version:** 1.0.0
- **Date:** 2026-07-24
- **Behavior label:** `xkb-menu-meta-transport-v2`
- **Applies to commit:** `60e8227754fd224530f40a926ed36d0876bdedac`
- **Authoritative branch:** `main`

This runbook validates the staged host-side Menu and Meta transport mapping before any QMK firmware change.

The destination `~/.config/xkb/symbols/us-nova` is Ansible-managed. Do not edit it directly.

## Safety boundary

This stage changes only the host-side XKB symbols file. It does not alter or flash keyboard firmware.

The current PB27 Meta and PB12 Compose paths remain active during host validation. Never send a standalone synthetic modifier press; every synthetic modifier test below presses and releases the complete chord in one invocation.

## Pre-deployment checks

From `~/src/x1_keyboard_layout`:

```bash
git status --short --branch
```

Required state:

- current branch is `main`;
- no unexplained modified, staged, or untracked files;
- `main` tracks `origin/main`.

Update only by fast-forward:

```bash
git pull --ff-only
```

Check the playbook syntax:

```bash
ansible-playbook --syntax-check install_layout.yml
```

## Deploy

```bash
ansible-playbook install_layout.yml
```

Verify that the deployed symbols file exactly matches the repository source:

```bash
cmp files/us-nova ~/.config/xkb/symbols/us-nova
```

No output and exit status zero means the files match.

Switch GNOME temporarily to the ordinary `us` input source and then back to `us-nova`. If the active map does not rebuild, log out and back in.

## Inspect the compiled maps

Native Wayland:

```bash
xkbcli dump-keymap-wayland > /tmp/wayland-menu-meta-v2.xkb
```

```bash
grep -n -e '<COMP>' -e '<I147>' -e '<I675>' -e '<I690>' -e '<RWIN>' -e 'modifier_map Mod3' -e 'modifier_map Mod4' /tmp/wayland-menu-meta-v2.xkb
```

Xwayland:

```bash
xkbcomp -xkb "$DISPLAY" /tmp/xwayland-menu-meta-v2.xkb
```

```bash
grep -n -e '<COMP>' -e '<I147>' -e '<I675>' -e '<I690>' -e '<RWIN>' -e 'modifier_map Mod3' -e 'modifier_map Mod4' /tmp/xwayland-menu-meta-v2.xkb
```

Required state:

- `<COMP>` resolves to `Meta_R` and belongs to Mod3;
- `<I147>` resolves to `Menu`;
- `<RWIN>` remains `Super_R` on Mod4;
- `<I690>` remains a transitional Meta path in native Wayland;
- PB12 / `<I675>` remains Compose;
- Xwayland omits extended PB keycodes but retains `<COMP>` and `<I147>`.

Stop and roll back if the compiled maps differ materially from this state.

## Observe synthetic transports

Start the observer:

```bash
wev -f wl_keyboard
```

In another terminal, test Meta with one complete chord:

```bash
sleep 4; ydotool key 127:1 33:1 33:0 127:0
```

Expected:

- keycode 135 produces `Meta_R`;
- Mod3 is depressed only while the chord is held;
- all depressed modifiers return to zero after release.

Test Menu with one complete press and release:

```bash
sleep 4; ydotool key 139:1 139:0
```

Expected:

- keycode 147 produces `Menu`;
- no modifier remains depressed.

## Physical-key regression checks

Verify:

- the current PB27 Meta hold still appears as `Meta_R` / Mod3 in native Wayland;
- the physical Compose tap still starts Compose;
- Compose, `a`, `e` produces `æ`;
- left and right Super remain Super;
- Alt remains Alt;
- AltGr still selects Level3;
- the keypad remains numeric;
- both Shifts still toggle Caps Lock;
- the current Menu/Control tap temporarily behaves as Meta until firmware migration, because it still emits `KC_APP`.

## Terminal behavior

In Ptyxis and then xterm, run:

```bash
od -An -tx1
```

Trigger the complete synthetic Meta+F chord from another terminal:

```bash
sleep 4; ydotool key 127:1 33:1 33:0 127:0
```

Record the bytes. Transport visibility and terminal Meta encoding are separate results; do not assume an Escape prefix.

## Idempotence

Run the playbook again:

```bash
ansible-playbook install_layout.yml
```

The symbols-file task should report `ok`, not `changed`.

## Rollback

Rollback uses new commits on `main`; published history is not rewritten.

To return from v2 to the staged v1 behavior, revert commit `60e8227754fd224530f40a926ed36d0876bdedac`, push the revert, pull with `git pull --ff-only`, redeploy, reload the GNOME keymap, and repeat the compiled-map checks.

To return to the pre-transport baseline, first revert v2, then revert `c0f3060b131120d1a19e6793b98e7c0797eb199a` in a second explicit revert commit.

During an input failure, switch to the ordinary `us` input source before deployment. Do not repair the managed destination by hand.

## Firmware boundary

Do not change or flash QMK firmware until all host acceptance checks pass. The planned later firmware migration is:

```text
Menu/Control tap: KC_APP -> KC_MENU
Any/Meta hold:    PB27   -> KC_APP
```

The deterministic tap-hold implementation itself remains unchanged.
