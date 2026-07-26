import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const KEYBOARD_SCHEMA = 'org.gnome.desktop.peripherals.keyboard';
const MOD2_MASK = Clutter.ModifierType.MOD2_MASK;
const POLL_INTERVAL_MS = 250;
const ANOMALY_GRACE_US = 750 * 1000;

const FaultIndicator = GObject.registerClass(
class FaultIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Nova Level5 Sentinel');

        const box = new St.BoxLayout({
            style_class: 'panel-status-menu-box',
        });
        box.add_child(new St.Icon({
            icon_name: 'dialog-error-symbolic',
            style_class: 'system-status-icon',
        }));
        box.add_child(new St.Label({
            text: '🐇',
            y_align: Clutter.ActorAlign.CENTER,
        }));
        this.add_child(box);

        this._detail = new PopupMenu.PopupMenuItem(
            'Mod2 safety fault detected',
            {reactive: false});
        this.menu.addMenuItem(this._detail);
        this.visible = false;
    }

    showFault(reason) {
        this._detail.label.set_text(reason);
        this.visible = true;
    }
});

export default class NovaLevel5Sentinel extends Extension {
    enable() {
        this._faulted = false;
        this._mod2Pressed = false;
        this._anomalySince = 0;

        this._indicator = new FaultIndicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._settings = new Gio.Settings({schema_id: KEYBOARD_SCHEMA});
        this._settingsSignals = [
            this._settings.connect(
                'changed::remember-numlock-state',
                () => this._checkPolicy()),
            this._settings.connect(
                'changed::numlock-state',
                () => this._checkPolicy()),
        ];

        this._stageSignal = global.stage.connect(
            'captured-event',
            this._onCapturedEvent.bind(this));

        this._checkPolicy();
        this._sampleEffectiveState();
        this._pollId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            POLL_INTERVAL_MS,
            () => {
                this._sampleEffectiveState();
                return GLib.SOURCE_CONTINUE;
            });
    }

    _onCapturedEvent(_actor, event) {
        const type = event.type();
        if (type !== Clutter.EventType.KEY_PRESS &&
            type !== Clutter.EventType.KEY_RELEASE &&
            type !== Clutter.EventType.KEY_STATE)
            return Clutter.EVENT_PROPAGATE;

        try {
            const [pressed, latched, locked] = event.get_key_state();
            this._mod2Pressed = (pressed & MOD2_MASK) !== 0;

            if ((latched & MOD2_MASK) !== 0)
                this._raiseFault('Mod2 is latched outside Novaʼs Level5 contract.');
            else if ((locked & MOD2_MASK) !== 0)
                this._raiseFault('Mod2 is locked; B may type 🐇 instead of b.');

            if (this._mod2Pressed)
                this._anomalySince = 0;
        } catch (error) {
            this._raiseFault(`The sentinel could not inspect modifier state: ${error.message}`);
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _checkPolicy() {
        const remember = this._settings.get_boolean('remember-numlock-state');
        const numlock = this._settings.get_boolean('numlock-state');

        if (remember || numlock) {
            this._raiseFault(
                `Unsafe GNOME NumLock policy: remember=${remember}, state=${numlock}.`);
        }
    }

    _sampleEffectiveState() {
        const [, , modifiers] = global.get_pointer();
        const mod2Effective = (modifiers & MOD2_MASK) !== 0;

        if (!mod2Effective || this._mod2Pressed) {
            this._anomalySince = 0;
            return;
        }

        const now = GLib.get_monotonic_time();
        if (this._anomalySince === 0) {
            this._anomalySince = now;
            return;
        }

        if (now - this._anomalySince >= ANOMALY_GRACE_US) {
            this._raiseFault(
                'Mod2 is active without a depressed Level5 key; B may type 🐇.');
        }
    }

    _raiseFault(reason) {
        if (this._faulted)
            return;

        this._faulted = true;
        this._indicator.showFault(reason);
        Main.notifyError(
            'Nova Level5 safety fault',
            `${reason} Do not begin class typing until the keyboard session is repaired.`);
        console.error(`Nova Level5 Sentinel: ${reason}`);
    }

    disable() {
        if (this._pollId) {
            GLib.source_remove(this._pollId);
            this._pollId = 0;
        }

        if (this._stageSignal) {
            global.stage.disconnect(this._stageSignal);
            this._stageSignal = 0;
        }

        if (this._settings) {
            for (const signal of this._settingsSignals)
                this._settings.disconnect(signal);
        }

        this._settingsSignals = null;
        this._settings = null;
        this._indicator?.destroy();
        this._indicator = null;
    }
}
