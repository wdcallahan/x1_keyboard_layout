# Runbook: Validate the single-group Nova keypad map

- **Version:** 1.2.1
- **Date:** 2026-07-26
- **Behavior label:** `nova-single-group-keypad-2026-07-26`
- **Authoritative branch:** `main`

The installed symbols and private rules files are Ansible-managed. Do not edit
`~/.config/xkb/symbols/us-nova` or `~/.config/xkb/rules/evdev` directly.

The project-local `ansible.cfg` selects its explicit localhost inventory and
disables cowsay so validation output remains compact and selectable.

All commands below are intentionally one physical line. Terminal wrapping is
display only.

## Pre-deployment checks

From `~/src/x1_keyboard_layout`:

```bash
git status --short --branch
```

Required state:

- current branch is `main`;
- no unexplained local changes exist;
- `main` tracks `origin/main`.

Update only by fast-forward:

```bash
git pull --ff-only
```

## Build the isolated candidate

```bash
rm -rf /tmp/nova-xkb-proof && mkdir -p /tmp/nova-xkb-proof/symbols /tmp/nova-xkb-proof/rules && cp files/us-nova /tmp/nova-xkb-proof/symbols/us-nova && cp files/evdev /tmp/nova-xkb-proof/rules/evdev && xkbcli compile-keymap --include /tmp/nova-xkb-proof --include-defaults --rules evdev --model pc104 --layout us-nova --options shift:both_capslock --test
```

No output and exit status zero means compilation succeeded.

## Inspect component assembly

```bash
xkbcli compile-keymap --include /tmp/nova-xkb-proof --include-defaults --rules evdev --model pc104 --layout us-nova --options shift:both_capslock --kccgst
```

Required symbols recipe:

```text
pc+us-nova+shift(both_capslock)
```

Stop if `inet(evdev)` or a second layout appears.

## Inspect modifier ownership

```bash
xkbcli compile-keymap --include /tmp/nova-xkb-proof --include-defaults --rules evdev --model pc104 --layout us-nova --options shift:both_capslock --modmaps
```

Required state:

- `<NMLK>` is absent from `Keys modifier maps`;
- `<I692>` is Mod2 / LevelFive;
- `<COMP>` is Mod3 / Meta and is absent from Mod1;
- `<I688>` is Mod5 / LevelThree;
- ordinary Alt remains Mod1;
- ordinary Super remains Mod4.

## Save the expanded keymap

```bash
xkbcli compile-keymap --include /tmp/nova-xkb-proof --include-defaults --rules evdev --model pc104 --layout us-nova --options shift:both_capslock > /tmp/nova-single-group-keypad.xkb
```

The expanded map is the evidence source for the keypad key types, symbols,
group count, and special transport definitions. Do not deploy until those
details have been reviewed.

Extract the relevant key blocks and reject any extra symbol group:

```bash
awk '/^[[:space:]]*key <(I674|I675|I688|I689|I691|I692|COMP|PROP|NMLK|KP7|KP8|KP9|KP4|KP5|KP6|KP1|KP2|KP3|KP0|KPDL|KPPT|KPEN|KPEQ|KPDV|KPMU|KPSU|KPAD)>/ { show=1 } show { print } show && /};[[:space:]]*$/ { show=0 }' /tmp/nova-single-group-keypad.xkb && if grep -nE 'symbols\[(Group)?([2-9]|[1-9][0-9]+)\]' /tmp/nova-single-group-keypad.xkb; then echo 'FAIL: extra symbol group found'; else echo 'PASS: no Group2-or-higher symbols found'; fi
```

Required state:

- `<NMLK>` is `ONE_LEVEL` / `VoidSymbol`;
- every keypad number and operator is `ONE_LEVEL` with exactly one keypad
  symbol;
- each current firmware transport has its documented keysym;
- no Group2-or-higher symbol assignment exists.

## Deploy only after offline acceptance

```bash
ansible-playbook install_layout.yml
```

Verify both managed files:

```bash
cmp files/us-nova ~/.config/xkb/symbols/us-nova && cmp files/evdev ~/.config/xkb/rules/evdev
```

No output means the files match.

Verify GNOME configuration:

```bash
gsettings get org.gnome.desktop.input-sources sources && gsettings get org.gnome.desktop.input-sources xkb-options
```

Required output:

```text
[('xkb', 'us-nova')]
['shift:both_capslock']
```

Run the playbook a second time before restarting the session:

```bash
ansible-playbook install_layout.yml
```

Every task should report `ok`, not `changed`.

Only after all offline and deployment checks pass should GNOME be logged out or
restarted to load the new map.
