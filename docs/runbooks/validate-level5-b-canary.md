# Runbook: Validate the Level5 B canary

- **Version:** 1.2.0
- **Date:** 2026-07-26
- **Behavior label:** `nova-level5-b-canary-2026-07-26`
- **Decision:** `docs/decisions/0004-level5-b-canary.md`
- **Authoritative branch:** `main`

This runbook proves the first deliberate eight-level Nova key without changing
firmware. The destination `~/.config/xkb/symbols/us-nova` is Ansible-managed;
do not edit it directly.

Every shell command is intentionally one physical line.

## Safety boundary

The symbol change is confined to the B key's type and vocabulary. PB29, I692,
Mod2, LevelFive, the private evdev rules, the keypad, and QMK firmware remain
unchanged.

The corrective host policy also disables GNOME's remembered NumLock state.
Mutter restores NumLock by locking raw Mod2, which Nova uses for LevelFive.
This policy is required even though `<NMLK>` is void and owns no modifier map.

Compile the exact repository source offline before deployment. Stop if any
assertion or compile step fails.

## Pull and inspect

From the layout repository:

```bash
cd ~/src/x1_keyboard_layout && git status --short --branch && git pull --ff-only && git log -3 --oneline
```

Required state:

- current branch is `main`;
- there are no unexplained local changes;
- the pull is a fast-forward;
- the Level5 canary commits are present.

Inspect the only eight-level source line:

```bash
grep -Fn 'key <AB05>' files/us-nova
```

It must name `EIGHT_LEVEL_SEMIALPHABETIC` and contain, in order,
`b, B, U03B2, U03B1, U1F407, U1F430, U1F96C, U1F955`.

## Offline proof

This command creates a fresh private proof directory, compiles the repository's
symbols and rules, prints the compiled B block and relevant modifier maps, and
rejects a second symbol group:

```bash
proof_dir=$(mktemp -d /tmp/nova-level5-proof.XXXXXX) && mkdir -p "$proof_dir/symbols" "$proof_dir/rules" && cp files/us-nova "$proof_dir/symbols/us-nova" && cp files/evdev "$proof_dir/rules/evdev" && test "$(grep -Fc 'EIGHT_LEVEL_SEMIALPHABETIC' "$proof_dir/symbols/us-nova")" -eq 1 && xkbcli compile-keymap --include "$proof_dir" --include-defaults --rules evdev --model pc104 --layout us-nova --options shift:both_capslock --test && xkbcli compile-keymap --include "$proof_dir" --include-defaults --rules evdev --model pc104 --layout us-nova --options shift:both_capslock > /tmp/nova-level5-b.xkb && awk '/^[[:space:]]*key <AB05>/ { show=1 } show { print } show && /};[[:space:]]*$/ { exit }' /tmp/nova-level5-b.xkb && xkbcli compile-keymap --include "$proof_dir" --include-defaults --rules evdev --model pc104 --layout us-nova --options shift:both_capslock --modmaps > /tmp/nova-level5-b.modmaps && grep -A2 -E '^  (COMP|I688|I692):' /tmp/nova-level5-b.modmaps && if grep -qE 'symbols\[(Group)?[2-9][0-9]*\]' /tmp/nova-level5-b.xkb; then echo 'FAIL: extra symbol group found'; exit 1; else echo 'PASS: Level5 B candidate compiled in one group'; fi
```

Required compiled B state:

```text
type = EIGHT_LEVEL_SEMIALPHABETIC
symbols = b, B, β, α, 🐇, 🐰, 🥬, 🥕
```

Required modifier state:

- `I688` remains real Mod5 and virtual LevelThree;
- `I692` remains real Mod2 and virtual LevelFive;
- `COMP` remains real Mod3 and virtual Meta;
- no Group2-or-higher symbols exist.

## Deploy

Run the managed installer, compare both installed files, then prove
idempotence:

```bash
ansible-playbook install_layout.yml && cmp files/us-nova ~/.config/xkb/symbols/us-nova && cmp files/evdev ~/.config/xkb/rules/evdev && cmp files/gnome-shell/extensions/nova-level5-sentinel@wdcallahan/extension.js ~/.local/share/gnome-shell/extensions/nova-level5-sentinel@wdcallahan/extension.js && cmp files/gnome-shell/extensions/nova-level5-sentinel@wdcallahan/metadata.json ~/.local/share/gnome-shell/extensions/nova-level5-sentinel@wdcallahan/metadata.json && test "$(gsettings get org.gnome.desktop.peripherals.keyboard remember-numlock-state)" = false && test "$(gsettings get org.gnome.desktop.peripherals.keyboard numlock-state)" = false && ansible-playbook install_layout.yml
```

The corrective first run may change `remember-numlock-state` and
`numlock-state` from `true` to `false` and install the staged sentinel
files. The second run must report zero changes. All four byte comparisons and
both boolean assertions are silent on success. The playbook does not yet enable
the extension; follow `docs/designs/level5-mod2-sentinel.md` for its explicit
fault/healthy proof.

## Reload boundary

The managed files being correct does not prove that the current GNOME Wayland
session rebuilt its active keymap. Log out and back in, or reboot once at a
convenient point, after all offline and deployment checks pass.

Do not spend a session restart on a candidate that did not pass the offline
proof.

Changing the two GNOME booleans does not clear Mod2 from the already-running
Mutter seat. Confirm both values are false, then perform one fresh login or
reboot. On the next session Mutter will skip its raw-Mod2 NumLock restoration.

## Known canary failure signature

The first live deployment on 2026-07-26 produced:

```text
🐇 🐰 🥬 🥕 🐇 🐰 🥬 🥕
```

That exact repeated upper half means LevelFive was active before the physical
hold. On MACE it coincided with both GNOME NumLock settings being `true`.
Treat this as the compositor-state failure documented in ADR-0004, not as a
symbol-order or QMK failure.

## Live physical acceptance

After the session reload, open a text field and produce these eight results in
order:

```text
b B β α 🐇 🐰 🥬 🥕
```

Use:

| Result | Physical chord |
| --- | --- |
| `b` | B |
| `B` | Shift+B |
| `β` | Level3+B |
| `α` | Shift+Level3+B |
| `🐇` | Level5+B |
| `🐰` | Shift+Level5+B |
| `🥬` | Level3+Level5+B |
| `🥕` | Shift+Level3+Level5+B |

On the Lemokey X2, Level3 is the hold side of Compose/AltGr and Level5 is the
hold side of Insert/Level5. The deterministic dual-role logic promotes those
holds when the next key is pressed; no timing guess is required.

Then toggle Caps Lock with both Shifts and verify:

```text
B b Β Α 🐰 🐇 🥬 🥕
```

This second line is the documented behavior of the standard
`EIGHT_LEVEL_SEMIALPHABETIC` type, not an accidental side effect.

## Regression checks

Verify all of the following before accepting the deployment:

- Compose, A, E still produces `æ`;
- Level3+1 still produces `‼`;
- Shift+Level3+1 still produces `⚠`;
- Any still runs on a tap and semantic Meta still appears on its hold;
- Insert still taps Insert;
- the keypad remains numeric;
- the mouse and scroll layers and their lamp states remain unchanged.

For a modifier-level observer when needed:

```bash
xkbcli interactive-wayland
```

## Acceptance receipt

After the physical test succeeds, record the exact commit, MACE's xkbcommon
version, offline proof result, both GNOME NumLock booleans, session reload
method, eight-symbol line, Caps line, and regression results in ADR-0004.

## Rollback

Rollback uses a new commit on `main` that restores the four-symbol B
definition. Pull that commit with `git pull --ff-only`, deploy with the managed
playbook, and reload the GNOME keymap once. Do not rewrite published history.
