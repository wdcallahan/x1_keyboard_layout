# Runbook: Validate Menu/Meta transport v2

- **Version:** 1.2.0
- **Date:** 2026-07-26
- **Status:** Superseded; historical only
- **Behavior label:** `xkb-menu-meta-transport-v2.1`
- **Applies to commit:** `7db85a2c1c42ce2033969f1f4be591d273b6ef45`
- **Authoritative branch:** `main`

This runbook validates the staged host-side Menu and Meta transport mapping before any QMK firmware change.

> **Do not execute this runbook on the current layout.** ADR-0003 replaced the transitional two-group and PB27 paths with the deployed single-group `KC_APP` / `<COMP>` Meta route. Use `docs/runbooks/validate-single-group-keypad.md` for the current transport assembly.

The destination `~/.config/xkb/symbols/us-nova` is Ansible-managed. Do not edit it directly.

## Safety boundary

This stage changes only the host-side XKB symbols file. It does not alter or flash keyboard firmware.

The current PB27 Meta and PB12 Compose paths remain active during host validation. Never send a standalone synthetic modifier press; every synthetic modifier test below presses and releases the complete chord in one invocation.

Do not spend a logout or reboot merely to discover whether an unproven candidate compiles correctly. Compile and inspect the candidate offline first, deploy only the proven source, and use one session restart only after all pre-restart checks pass.

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

A separate `ansible-playbook --syntax-check` is unnecessary when the next action is to run the same playbook immediately. Normal execution performs the required parse and syntax validation before any task runs. Use a standalone syntax check only when validating without executing.

## Offline candidate proof

Compile the exact two-layout arrangement without changing the live session:

```bash
rm -rf /tmp/nova-xkb-proof && mkdir -p /tmp/nova-xkb-proof/symbols && cp files/us-nova /tmp/nova-xkb-proof/symbols/us-nova && xkbcli compile-keymap --include /tmp/nova-xkb-proof --include-defaults --rules evdev --model pc105 --layout us,us-nova --variant , --options shift:both_capslock > /tmp/nova-menu-meta-v2.1.xkb
```

Inspect the relevant key and modifier definitions:

```bash
grep -n -e 'key <COMP>' -e 'key <I147>' -e 'key <I675>' -e 'key <I690>' -e 'key <RWIN>' -e 'modifier_map Mod1' -e 'modifier_map Mod3' -e 'modifier_map Mod4' /tmp/nova-menu-meta-v2.1.xkb
```

Inspect the complete blocks when needed:

```bash
sed -n '1820,1850p;2165,2200p;2210,2222p' /tmp/nova-menu-meta-v2.1.xkb
```

Required offline state:

- `<COMP>` has Group1 `Menu` and Group2 `Meta_R`;
- `<I147>` has Group1 `XF86MenuKB` and Group2 `Menu`;
- `<COMP>` is absent from Mod1;
- `<COMP>` and transitional `<I690>` are on Mod3;
- `<RWIN>` remains `Super_R` on Mod4;
- PB12 / `<I675>` remains Compose;
- existing Level3 and Level5 mappings are unchanged by this repair.

Stop before deployment if the offline map differs materially from this state.

## Deploy

```bash
ansible-playbook install_layout.yml
```

Verify that the deployed symbols file exactly matches the repository source:

```bash
cmp files/us-nova ~/.config/xkb/symbols/us-nova
```

No output and exit status zero means the files match.

Run the playbook a second time before restarting the session:

```bash
ansible-playbook install_layout.yml
```

The symbols-file task should report `ok`, not `changed`.

Switching temporarily to ordinary `us` and back to `us-nova` may rebuild the map. If it does not, preserve the running session and wait until one deliberate logout or reboot is practical.

## Inspect the live compiled maps after reload

Native Wayland:

```bash
xkbcli dump-keymap-wayland > /tmp/wayland-menu-meta-v2.1.xkb
```

```bash
grep -n -e '<COMP>' -e '<I147>' -e '<I675>' -e '<I690>' -e '<RWIN>' -e 'modifier_map Mod1' -e 'modifier_map Mod3' -e 'modifier_map Mod4' /tmp/wayland-menu-meta-v2.1.xkb
```

Xwayland:

```bash
xkbcomp -xkb "$DISPLAY" /tmp/xwayland-menu-meta-v2.1.xkb
```

```bash
grep -n -e '<COMP>' -e '<I147>' -e '<I675>' -e '<I690>' -e '<RWIN>' -e 'modifier_map Mod1' -e 'modifier_map Mod3' -e 'modifier_map Mod4' /tmp/xwayland-menu-meta-v2.1.xkb
```

Required live state:

- `<COMP>` resolves to `Meta_R`, belongs to Mod3, and does not belong to Mod1;
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
- Mod1 is not depressed by the Meta transport;
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

## Rollback

Rollback uses new commits on `main`; published history is not rewritten.

To remove the v2.1 correction, revert commit `7db85a2c1c42ce2033969f1f4be591d273b6ef45`. Because the preceding v2 implementation did not compile into the intended live map, returning fully to the pre-transport baseline also requires reverting `60e8227754fd224530f40a926ed36d0876bdedac` and then `c0f3060b131120d1a19e6793b98e7c0797eb199a` in explicit corrective commits.

After any rollback, push `main`, pull with `git pull --ff-only`, deploy with `ansible-playbook install_layout.yml`, and reload the GNOME keymap once.

During an input failure, switch to the ordinary `us` input source before deployment. Do not repair the managed destination by hand.

## Firmware boundary

Do not change or flash QMK firmware until all host acceptance checks pass. The planned later firmware migration is:

```text
Menu/Control tap: KC_APP -> KC_MENU
Any/Meta hold:    PB27   -> KC_APP
```

The deterministic tap-hold implementation itself remains unchanged.
