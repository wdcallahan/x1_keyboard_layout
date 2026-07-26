import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const PTYXIS_IDS = new Set([
    'org.gnome.Ptyxis',
    'app.devsuite.Ptyxis',
]);
const RELEASE_POLL_MS = 10;

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
        this._metaKeyDown = false;
        this._pendingDetach = false;
        this._swallowD = false;
        this._swallowedKeyCode = 0;
        this._releasePollId = 0;
        this._windowTracker = Shell.WindowTracker.get_default();
        this._ydotool = GLib.find_program_in_path('ydotool');

        if (!this._ydotool)
            this._raiseFault('ydotool is not installed or is not in GNOME Shellʼs PATH.');

        this._stageSignal = global.stage.connect(
            'captured-event',
            this._onCapturedEvent.bind(this));
    }

    _onCapturedEvent(_actor, event) {
        const type = event.type();
        if (type !== Clutter.EventType.KEY_PRESS &&
            type !== Clutter.EventType.KEY_RELEASE)
            return Clutter.EVENT_PROPAGATE;

        const symbol = event.get_key_symbol();
        const keyCode = event.get_key_code();
        const isD = symbol === Clutter.KEY_d || symbol === Clutter.KEY_D;

        if (symbol === Clutter.KEY_Meta_R) {
            this._metaKeyDown = type === Clutter.EventType.KEY_PRESS;
            if (!this._metaKeyDown)
                this._armReleasePoll();
            return Clutter.EVENT_PROPAGATE;
        }

        // Once this physical D press has been claimed, consume its repeats and
        // release even if Meta is released first.
        if (this._swallowD && keyCode === this._swallowedKeyCode) {
            if (type === Clutter.EventType.KEY_RELEASE) {
                this._swallowD = false;
                this._swallowedKeyCode = 0;
            }

            this._armReleasePoll();
            return Clutter.EVENT_STOP;
        }

        if (type !== Clutter.EventType.KEY_PRESS || !isD ||
            !this._metaKeyDown)
            return Clutter.EVENT_PROPAGATE;

        const focus = this._getFocusIdentity();
        if (!focus.isPtyxis) {
            console.log(
                `Nova Semantic Meta: ignored Meta+D outside Ptyxis: ${JSON.stringify(focus)}.`);
            return Clutter.EVENT_PROPAGATE;
        }

        this._pendingDetach = true;
        this._swallowD = true;
        this._swallowedKeyCode = keyCode;
        console.log(
            `Nova Semantic Meta: claimed Meta+D in ${JSON.stringify(focus)}.`);
        this._armReleasePoll();
        return Clutter.EVENT_STOP;
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
                    this._releasePollId = 0;
                    return GLib.SOURCE_REMOVE;
                }

                if (this._swallowD || this._metaKeyDown)
                    return GLib.SOURCE_CONTINUE;

                this._pendingDetach = false;
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

        if (this._stageSignal) {
            global.stage.disconnect(this._stageSignal);
            this._stageSignal = 0;
        }

        this._metaKeyDown = false;
        this._pendingDetach = false;
        this._swallowD = false;
        this._swallowedKeyCode = 0;
        this._windowTracker = null;
        this._ydotool = null;
    }
}
