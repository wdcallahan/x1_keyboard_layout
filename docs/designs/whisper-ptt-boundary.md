# Design: Whisper push-to-talk service boundary

- **Version:** 0.1.0
- **Date:** 2026-07-26
- **Status:** Implemented and accepted on MACE
- **Keyboard identity:** `PB_28` / `KEY_MACRO28` / `XF86Macro28` / `<I691>`
- **Owning implementation:** [`wdcallahan/whisper-ptt`](https://github.com/wdcallahan/whisper-ptt)

This document freezes the interface between Nova's keyboard architecture and
the local dictation service. It does not put speech recognition inside the XKB
repository. The implementation fulfilled the prepared interface without
changing the firmware identity.

Every shell command is intentionally one physical line.

## User contract

| Event | Required behavior |
| --- | --- |
| Whisper press | Begin recording immediately and show an unmistakable recording state. |
| Whisper held | Continue recording without key repeat changing state. |
| Whisper release | Stop recording, show transcribing state, transcribe locally, then insert the final text at the current cursor. |
| Empty or too-short utterance | Insert nothing, return to idle, and show an informational notification. |
| Failure | Show an attention state and preserve the audio/log needed to diagnose it. Failures before injection emit nothing; a detected focus change during injection may have emitted characters already. |
| New press while busy | Reject clearly or queue by an explicit policy; never start overlapping inference silently. |

The key is a direct programmable-button identity, not a tap-hold key and not a
command-dictation mode.

## Non-negotiable boundaries

- Recognition remains local; ordinary dictation must not depend on an internet service.
- The implementation listens to `KEY_MACRO28` press and release directly.
- It does not grab or reinterpret ordinary typing keys.
- It does not replace or overload Hyper, Any, Meta, Compose, or Level5.
- Microphone selection is configurable by stable PipeWire `node.name`, not a transient numeric ID.
- A dedicated dictation microphone must remain possible while Zoom or BigBlueButton uses another microphone.
- Deployment is reproducible with Ansible and a systemd user service.
- Model, language, CPU/GPU mode, microphone, injection method, and indicator behavior are variables rather than hardcoded facts.
- The first end-to-end proof uses a direct host install; a container is only an isolation or comparison tool.

## State machine

| State | Entered by | Work | Leaves by |
| --- | --- | --- | --- |
| Idle | service start or successful completion | Wait for PB28 press. | PB28 press → Recording |
| Recording | PB28 press | Capture 16-bit mono WAV from the selected PipeWire source. | PB28 release → Transcribing |
| Transcribing | successful recorder stop | Run local ASR and normalize final text. | success → Injecting; failure → Error |
| Injecting | nonempty transcript | Insert text through the Wayland-safe input path. | success → Idle; failure → Error |
| Error | recorder, ASR, or injection failure | Preserve diagnostics and show failure. | acknowledgement or next valid press → Idle |

Repeated press events while already Recording are ignored. A release without a
matching press is logged and ignored.

## Accepted component boundary

| Component | Accepted implementation |
| --- | --- |
| Key listener | Narrow, non-grabbing evdev listener on the stable Lemokey Consumer Control by-ID path, filtered to `KEY_MACRO28`. |
| Recorder | Host `pw-record`, 16 kHz, mono, signed 16-bit WAV, exact serial-bearing RØDE `node.name`. |
| ASR | Fedora `python3-pywhispercpp`, six CPU threads. |
| Model | Verified official English `base.en`, pinned by byte count and SHA-256. |
| Text normalization | Collapse whitespace, map documented smart punctuation to ASCII, append one inter-utterance space, and suppress annotation-only results as notifications. |
| Injection | `ydotool type --file=- --escape=0`; ASCII-first, no shell evaluation, Enter, or submission key. |
| Focus safety | Window Calls captures GNOME focus; pre-injection mismatch blocks output and post-injection mismatch warns that emitted text may span windows. |
| Service | Persistent systemd user unit with bounded restart policy, journal logs, atomic state, and retained failure evidence. |
| Indicator | Replaceable desktop notifications for Recording, Transcribing, Ready, non-speech, busy, and attention-required outcomes. |
| Deployment | Dedicated idempotent Ansible role in `whisper-ptt`; managed changes restart through handlers, while a no-op run leaves the PID unchanged. |

PipeWire's recorder accepts a stable target node name and produces WAV based on
the filename. `whisper.cpp` accepts file input and supports CPU and NVIDIA GPU
paths. Those interfaces fit release-to-finalize dictation without adopting its
continuous microphone demo.

## Why CPU remained sufficient

Fedora 44's packaged `python3-pywhispercpp` 1.4 binding was the shortest
reproducible path for proving recording, model loading, transcription quality,
output parsing, and cursor injection.

The accepted five-second proof transcribed in 0.787 seconds on six Ryzen 5
5600G threads. That inference result, together with the accepted end-to-end
responsiveness, did not justify adding a CUDA compiler, GPU-specific Whisper
build, or container.

Acceleration remains a measured future optimization rather than part of the
service contract.

## Recorded host inventory

The pre-implementation inventory established Fedora 44, GNOME 50 Wayland, the
Ryzen 5 5600G, 42 GiB RAM, an RTX 2060 left unused, packaged
`python3-pywhispercpp` 1.4, PipeWire 1.6.8, active `ydotoold`, the serial-bearing
RØDE source, and the Lemokey Consumer Control interface advertising
`KEY_MACRO28`.

The original reusable inventory command was:

```bash
printf 'OS: '; rpm -E '%{fedora}' 2>/dev/null || true; printf 'kernel: '; uname -r; printf 'whisper-cpp: '; rpm -q whisper-cpp python3-pywhispercpp ibus-speech-to-text 2>/dev/null || true; printf 'PipeWire: '; pw-record --version 2>/dev/null || echo absent; printf 'ydotool: '; ydotool --version 2>/dev/null || echo absent; printf 'Podman: '; podman --version 2>/dev/null || echo absent; printf 'NVIDIA: '; nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader 2>/dev/null || echo unavailable; printf 'CUDA compiler: '; nvcc --version 2>/dev/null | tail -1 || echo absent; printf 'service: '; systemctl --user is-active ydotool.service 2>/dev/null || true
```

List audio nodes separately because `wpctl status` is multiline and useful in
full:

```bash
wpctl status --name
```

Then capture the stable source properties for likely microphones:

```bash
pw-dump | grep -E '"node.name"|"node.description"|"media.class"'
```

The accepted target is the exact serial-bearing RØDE node. Webcam and
motherboard microphones are never fallback candidates.

## Prototype phase record

### Phase 1: audio and model, no key listener

1. Record a short utterance from an explicit source with `pw-record`.
2. Transcribe the saved WAV with packaged `whisper-cpp`.
3. Measure recording-stop to final-text latency.
4. Verify quality on teaching vocabulary, punctuation, product names, and short corrections.
5. Inject a reviewed transcript manually through the chosen path.

This phase can fail safely without touching keyboard behavior.

### Phase 2: press/release daemon

Connect PB28 press to recorder start and PB28 release to recorder stop plus
asynchronous transcription. Preserve one utterance at a time and log every state
transition.

### Phase 3: feedback

Choose immediate feedback that remains visible in the corner of the eye without
stealing focus. The prototype may use replaceable desktop notifications or an
overlay; acceptance requires that Recording and Transcribing cannot be confused.
A persistent panel indicator is desirable but not a prerequisite for measuring
the core pipeline.

### Phase 4: acceleration

Benchmark CPU first. Add CUDA only when the measured delay justifies its
installation and maintenance cost. Record model, quantization, hardware,
real-time factor, and end-to-end release latency, not merely inference time.

### Phase 5: conferencing coexistence

Prove dictation while Zoom or BigBlueButton is actively using its configured
microphone. Prefer two explicitly selected sources when available. Never assume
that the conferencing application's default source is the source the daemon
should record.

## Acceptance record

MACE produced these results on 2026-07-26:

- [x] Press/release creates one utterance and hold repeat creates no second start.
- [x] Recording and Transcribing notifications appear immediately and replace one another.
- [x] Reviewed and ordinary text appears once without a submission key.
- [x] Too-short, empty, and annotation-only results emit no text; live `[BLANK_AUDIO]` became an informational notification.
- [x] Failures preserve diagnostics and raise an attention notification.
- [x] Pre-injection focus mismatch blocks output; the live post-injection audit warned when 34 emitted characters could have crossed from Ptyxis to Firefox.
- [x] The service remained enabled, active, and healthy after a system update and reboot.
- [x] A no-op Ansible run reported zero changes and did not change the daemon PID.
- [x] Ordinary typing and the accepted Any, Meta, Level3, Level5, mouse, and media boundaries remained separate.
- [ ] Concurrent live Zoom or BigBlueButton microphone use remains a classroom follow-up; the daemon's exact-source, on-demand PipeWire capture is accepted without claiming that unperformed live test.

## Resolved choices

- Microphone: serial-bearing RØDE NT-USB Mini until the planned Mackie migration.
- Model: official English `base.en` on CPU.
- Separation: exactly one managed trailing ASCII space per accepted utterance.
- Punctuation: collapse whitespace, map a narrow smart-punctuation set to ASCII, and otherwise preserve model wording for human review.
- Feedback: replaceable GNOME desktop notifications plus atomic runtime state.
- Implementation: Python modules around packaged `pywhispercpp`, `pw-record`, evdev, Window Calls, and `ydotool`.
- Repository: `wdcallahan/whisper-ptt`.

The future Mackie source migration and live classroom conferencing coexistence
remain operational follow-ups, not unresolved keyboard-transport choices.

## References

- Fedora `whisper-cpp`: <https://packages.fedoraproject.org/pkgs/whisper-cpp/whisper-cpp/>
- Fedora `python3-pywhispercpp`: <https://packages.fedoraproject.org/pkgs/pywhispercpp/python3-pywhispercpp/>
- PipeWire `pw-record`: <https://docs.pipewire.org/page_man_pw-cat_1.html>
- upstream `whisper.cpp`: <https://github.com/ggml-org/whisper.cpp>
- ydotool: <https://github.com/ReimuNotMoe/ydotool>
