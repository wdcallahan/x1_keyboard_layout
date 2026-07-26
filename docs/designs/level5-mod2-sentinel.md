# Design: Nova Level5 locked-Mod2 sentinel

- **Version:** 1.0.0
- **Date:** 2026-07-26
- **Status:** Accepted; Ansible-managed on MACE
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

## Managed deployment

The repository playbook installs both extension files under:

```text
~/.local/share/gnome-shell/extensions/nova-level5-sentinel@wdcallahan/
```

It also preserves the user's existing `org.gnome.shell enabled-extensions`
list and appends only the sentinel UUID when necessary. GNOME Shell caches
extension discovery within a session, so a first installation may become active
only after the next fresh login. The enabled intent already persists across that
boundary.

### MACE acceptance receipt

MACE completed the prevention, healthy-state, and alarm proofs on 2026-07-26:

- after Ansible set both GNOME NumLock booleans to `false`, a reboot restored
  ordinary B and all eight canary results exactly as
  `b B β α 🐇 🐰 🥬 🥕`;
- `gnome-extensions info` reported the sentinel `Enabled: Yes` and
  `State: ACTIVE`;
- live `wev` observation held I692/Mod2 effective for 13.398 seconds with
  Mod2 only depressed, never latched or locked, and the sentinel correctly
  remained silent;
- changing only `numlock-state` to `true` raised the persistent top-bar
  rabbit and the notification
  `Unsafe GNOME NumLock policy: remember=false, state=true.`;
- restoring both booleans to `false` and restarting the extension returned it
  to a clean active state.

The policy test changed a watched preference; it did not intentionally lock
Mod2. Together these receipts prove that legitimate Level5 use is not a false
positive and that a transient unsafe policy cannot disappear unnoticed.

## Acceptance boundary

The fault, healthy-session, and policy-alarm proofs passed on MACE, so
`install_layout.yml` now manages both the source files and persistent enabled
membership. A fresh session remains the discovery boundary after first
installation; enabled membership alone does not claim that an already-running
Shell loaded newly created source.

If the extension errors, disable it with:

```bash
gnome-extensions disable nova-level5-sentinel@wdcallahan
```

Disabling the sentinel does not alter XKB, the GNOME NumLock booleans, or the
keyboard firmware.
