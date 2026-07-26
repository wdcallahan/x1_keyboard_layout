# Design: Nova Level5 locked-Mod2 sentinel

- **Version:** 0.1.0
- **Date:** 2026-07-26
- **Status:** Staged prototype; MACE acceptance required
- **Prototype UUID:** `nova-level5-sentinel@wdcallahan`
- **Owner:** `wdcallahan/x1_keyboard_layout`

## Goal

Warn Nova before normal typing when Mod2 is latched or locked instead of being
momentarily depressed by the physical Level5 key.

The sentinel complements prevention. It must detect an unanticipated future
producer by observing the bad state itself rather than relying only on a list
of known producers.

## Non-goals

The sentinel must not:

- clear Mod2;
- synthesize NumLock;
- interfere with a legitimate Level5 hold;
- replace the managed GNOME false/false policy;
- claim that UEFI, Linux virtual-console, firmware, and Mutter state are one
  shared bit;
- silently repair a fault and allow a class to begin without an explanation.

A runtime watchdog that repeatedly clears effective Mod2 is forbidden because
it would race and cancel intentional Level5 chords.

## State domains and prevention

| Domain | Possible NumLock behavior | Nova boundary |
| --- | --- | --- |
| UEFI / bootloader | May use its own NumLock mode or leave an LED lit while it owns the keyboard. | Does not become a GNOME Mutter modifier state. No `rc.local` repair is required for Level5. |
| Linux virtual console | May maintain a separate console NumLock flag. | Separate from the Wayland session; `setleds` is not a GNOME repair. |
| QMK firmware | Could emit `KEY_NUMLOCK`; the former watchdog did. | Current firmware emits none and uses the lamp only as a layer indicator. |
| XKB key event | A physical NumLock event could normally lock a modifier. | `<NMLK>` is `VoidSymbol`, and `Num_Lock` owns no modifier map. |
| GNOME session startup | Mutter can restore remembered NumLock by directly locking raw Mod2. | Ansible manages both GNOME NumLock booleans as `false`. |
| Unknown runtime producer | Could latch or lock Mod2 through a future compositor or input path. | The sentinel observes the resulting state and alarms. |

## Exact distinction

XKB and Clutter carry three independent modifier components:

| Component | Nova meaning for Mod2 |
| --- | --- |
| Depressed | Legitimate physical Level5 hold. |
| Latched | Unexpected and unsafe. |
| Locked | Unexpected and unsafe. |

Clutter key events expose these masks separately through
`Clutter.Event.get_key_state()`. The prototype subscribes to the GNOME Shell
stage's capture phase but always returns `Clutter.EVENT_PROPAGATE`; it observes
events without consuming them.

The prototype also samples effective Mod2 every 250 ms. If Mod2 remains
effective for 750 ms without an observed depressed Mod2 state, it raises a
fault. This covers a bad state that existed before the extension loaded or a
future internal state change that did not arrive as an ordinary key event. The
grace interval prevents a sampling race during a real Level5 press.

Both GNOME NumLock booleans are monitored continuously. Either becoming true is
itself an immediate policy fault.

## Alarm behavior

On the first fault in a session, the extension:

1. shows a persistent error icon and `🐇` in the GNOME top bar;
2. sends a GNOME error notification explaining that B may produce a rabbit;
3. writes the reason to the GNOME Shell journal;
4. does not modify any key or modifier state.

The indicator remains until the extension or session is restarted. A fault is
a stop condition, not a condition to hide automatically.

## Staged deployment

The repository playbook installs the two prototype files under:

```text
~/.local/share/gnome-shell/extensions/nova-level5-sentinel@wdcallahan/
```

It deliberately does not manage extension enablement yet. GNOME Shell caches
extension code within a session, and this prototype must first prove both its
fault and healthy behavior on MACE.

### Fault-state proof

The first Level5 canary session currently has Mod2 locked even after the stored
GNOME booleans are corrected; changing dconf does not rewrite the already
running Mutter seat. That makes it a useful live fault fixture.

After installation, attempt explicit enablement:

```bash
gnome-extensions enable nova-level5-sentinel@wdcallahan
```

If GNOME Shell has already discovered the newly installed directory, the top
bar must show the rabbit fault within one second. If the CLI reports that the
extension is unknown, do not improvise a loader: record the result and use the
next fresh session for discovery.

Inspect extension state with:

```bash
gnome-extensions info nova-level5-sentinel@wdcallahan
```

Inspect its log with:

```bash
journalctl --user -b --grep='Nova Level5 Sentinel' --no-pager
```

### Healthy-session proof

After both GNOME booleans are false and the extension is enabled, start one
fresh GNOME session. Required behavior:

- no rabbit indicator or safety notification appears;
- ordinary B produces `b`;
- the physical Level5 hold produces `🐇`;
- holding Level5 deliberately for more than two seconds does not alarm;
- all eight B combinations remain correct;
- the extension remains active and error-free.

### Policy-alarm proof

In a disposable session, changing either managed boolean to true must raise the
alarm immediately. Restore both values to false before ending the session. This
tests policy observation; it does not intentionally re-lock Mod2.

## Acceptance boundary

Only after both fault and healthy proofs pass may `install_layout.yml` manage
the UUID as enabled. Until then the source files are managed, but enablement is
an explicit test step.

If the prototype errors, disable it with:

```bash
gnome-extensions disable nova-level5-sentinel@wdcallahan
```

Disabling the sentinel does not alter XKB, the GNOME NumLock booleans, or the
keyboard firmware.
