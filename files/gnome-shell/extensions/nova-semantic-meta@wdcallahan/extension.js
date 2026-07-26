import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const PTYXIS_IDS = new Set([
    'org.gnome.Ptyxis',
    'app.devsuite.Ptyxis',
]);
const META_D_ACCELERATOR = '<Mod3>d';
const RELEASE_POLL_MS = 10;
const RELEASE_TIMEOUT_MS = 15000;

// Linux input-event-codes.h:
// KEY_LEFTCTRL=29, KEY_D=32, KEY_B=48.
const TMUX_DETACH_SEQUENCE = [
    'key',
    '29:1',
    '48:1',
    '48:0',
    '29:0',
    '32:1',
    '32:0',
];

export default class NovaSemanticMeta extends Extension {
    enable() {
        this._faulted = false;
        this._acceleratorAction = Meta.KeyBindingAction.NONE;
        this._acceleratorActivatedSignal = 0;
        this._acceleratorDeactivatedSignal = 0;
        this._acceleratorDown = false;
        this._bindingAllowed = null;
        this._bindingName = null;
        this._focusSignal = 0;
        this._pendingDetach = false;
        this._pendingSinceUs = 0;
        this._releasePollId = 0;
        this._windowTracker = Shell.WindowTracker.get_default();
        this._ydotool = GLib.find_program_in_path('ydotool');

        if (!this._ydotool) {
            this._raiseFault('ydotool is not installed or is not in GNOME Shellʼs PATH.');
            return;
        }

        this._acceleratorAction = global.display.grab_accelerator(
            META_D_ACCELERATOR,
            Meta.KeyBindingFlags.TRIGGER_RELEASE |
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT);
        if (this._acceleratorAction === Meta.KeyBindingAction.NONE) {
            this._raiseFault(`Could not grab ${META_D_ACCELERATOR}.`);
            return;
        }

        this._bindingName =
            Meta.external_binding_name_for_action(this._acceleratorAction);
        this._acceleratorActivatedSignal = global.display.connect(
            'accelerator-activated',
            this._onAcceleratorActivated.bind(this));
        this._acceleratorDeactivatedSignal = global.display.connect(
            'accelerator-deactivated',
            this._onAcceleratorDeactivated.bind(this));
        this._focusSignal = global.display.connect(
            'notify::focus-window',
            this._syncBindingScope.bind(this));
        this._syncBindingScope();
    }

    _onAcceleratorActivated(_display, action) {
        if (action !== this._acceleratorAction)
            return;

        this._acceleratorDown = true;
        const focus = this._getFocusIdentity();
        if (!focus.isPtyxis) {
            console.warn(
                `Nova Semantic Meta: compositor activated Meta+D after Ptyxis lost focus: ${JSON.stringify(focus)}.`);
            return;
        }

        if (!this._pendingDetach) {
            this._pendingDetach = true;
            this._pendingSinceUs = GLib.get_monotonic_time();
            console.log(
                `Nova Semantic Meta: claimed Meta+D in ${JSON.stringify(focus)}.`);
        }
        this._armReleasePoll();
    }

    _onAcceleratorDeactivated(_display, action) {
        if (action !== this._acceleratorAction)
            return;

        this._acceleratorDown = false;
        this._armReleasePoll();
    }

    _syncBindingScope() {
        if (!this._bindingName)
            return;

        const focus = this._getFocusIdentity();
        const allow = focus.isPtyxis;
        if (allow === this._bindingAllowed)
            return;

        this._bindingAllowed = allow;
        Main.wm.allowKeybinding(
            this._bindingName,
            allow ? Shell.ActionMode.NORMAL : Shell.ActionMode.NONE);

        if (!allow) {
            this._pendingDetach = false;
            this._pendingSinceUs = 0;
            this._acceleratorDown = false;
        }

        console.log(
            `Nova Semantic Meta: ${allow ? 'armed' : 'disarmed'} for ${JSON.stringify(focus)}.`);
    }

    _getFocusIdentity() {
        const window = global.display.focus_window;
        const app = window ? this._windowTracker.get_window_app(window) : null;
        const appId = app?.get_id?.() ?? null;
        const gtkApplicationId = window?.get_gtk_application_id?.() ?? null;
        const wmClass = window?.get_wm_class?.() ?? null;
        const wmClassInstance = window?.get_wm_class_instance?.() ?? null;
        const identities = [
            appId,
            gtkApplicationId,
            wmClass,
            wmClassInstance,
        ].map(identity => identity?.replace(/\.desktop$/, '') ?? null);

        return {
            appId,
            gtkApplicationId,
            wmClass,
            wmClassInstance,
            isPtyxis: identities.some(identity => PTYXIS_IDS.has(identity)),
        };
    }

    _armReleasePoll() {
        if (this._releasePollId)
            return;

        this._releasePollId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            RELEASE_POLL_MS,
            () => {
                if (!this._pendingDetach) {
                    this._pendingSinceUs = 0;
                    this._releasePollId = 0;
                    return GLib.SOURCE_REMOVE;
                }

                const elapsedMs =
                    (GLib.get_monotonic_time() - this._pendingSinceUs) / 1000;
                if (elapsedMs >= RELEASE_TIMEOUT_MS) {
                    this._pendingDetach = false;
                    this._pendingSinceUs = 0;
                    this._acceleratorDown = false;
                    this._releasePollId = 0;
                    this._raiseFault(
                        'Timed out waiting for Meta+D to be released; no keys were injected.');
                    return GLib.SOURCE_REMOVE;
                }

                const [, , modifiers] = global.get_pointer();
                const metaDown =
                    (modifiers & Clutter.ModifierType.MOD3_MASK) !== 0;
                if (this._acceleratorDown || metaDown)
                    return GLib.SOURCE_CONTINUE;

                this._pendingDetach = false;
                this._pendingSinceUs = 0;
                this._releasePollId = 0;
                this._injectTmuxDetach();
                return GLib.SOURCE_REMOVE;
            });
    }

    _injectTmuxDetach() {
        const focus = this._getFocusIdentity();
        if (!focus.isPtyxis) {
            console.warn(
                `Nova Semantic Meta: focus left Ptyxis before Meta+D completed; injection canceled: ${JSON.stringify(focus)}.`);
            return;
        }

        if (!this._ydotool) {
            this._raiseFault('Meta+D was recognized, but ydotool is unavailable.');
            return;
        }

        try {
            const process = Gio.Subprocess.new(
                [this._ydotool, ...TMUX_DETACH_SEQUENCE],
                Gio.SubprocessFlags.STDOUT_SILENCE |
                Gio.SubprocessFlags.STDERR_PIPE);

            process.communicate_utf8_async(null, null, (source, result) => {
                try {
                    const [, , stderr] = source.communicate_utf8_finish(result);
                    if (!source.get_successful()) {
                        const detail = stderr?.trim() || 'ydotool exited unsuccessfully.';
                        this._raiseFault(`Could not inject tmux detach: ${detail}`);
                    } else
                        console.log('Nova Semantic Meta: injected tmux detach sequence.');
                } catch (error) {
                    this._raiseFault(`Could not finish tmux detach: ${error.message}`);
                }
            });
        } catch (error) {
            this._raiseFault(`Could not start ydotool: ${error.message}`);
        }
    }

    _raiseFault(reason) {
        if (this._faulted)
            return;

        this._faulted = true;
        Main.notifyError('Nova Meta consumer fault', reason);
        console.error(`Nova Semantic Meta: ${reason}`);
    }

    disable() {
        if (this._releasePollId) {
            GLib.source_remove(this._releasePollId);
            this._releasePollId = 0;
        }

        if (this._focusSignal) {
            global.display.disconnect(this._focusSignal);
            this._focusSignal = 0;
        }

        if (this._acceleratorActivatedSignal) {
            global.display.disconnect(this._acceleratorActivatedSignal);
            this._acceleratorActivatedSignal = 0;
        }

        if (this._acceleratorDeactivatedSignal) {
            global.display.disconnect(this._acceleratorDeactivatedSignal);
            this._acceleratorDeactivatedSignal = 0;
        }

        if (this._bindingName)
            Main.wm.allowKeybinding(this._bindingName, Shell.ActionMode.NONE);

        if (this._acceleratorAction !== Meta.KeyBindingAction.NONE) {
            global.display.ungrab_accelerator(this._acceleratorAction);
            this._acceleratorAction = Meta.KeyBindingAction.NONE;
        }

        this._acceleratorDown = false;
        this._bindingAllowed = false;
        this._bindingName = null;
        this._pendingDetach = false;
        this._pendingSinceUs = 0;
        this._windowTracker = null;
        this._ydotool = null;
    }
}
