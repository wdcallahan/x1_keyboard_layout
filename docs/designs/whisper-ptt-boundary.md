# Design: Whisper push-to-talk service boundary

- **Version:** 0.1.0
- **Date:** 2026-07-26
- **Status:** Prepared; implementation repository not yet created
- **Keyboard identity:** `PB_28` / `KEY_MACRO28` / `XF86Macro28` / `<I691>`
- **Owning implementation:** future dedicated Whisper/PTT repository

This document freezes the interface between Nova's keyboard architecture and a
future local dictation service. It does not put speech recognition inside the
XKB repository and does not choose hardware that has not been inventoried.

## User contract

| Event | Required behavior |
| --- | --- |
| Whisper press | Begin recording immediately and show an unmistakable recording state. |
| Whisper held | Continue recording without key repeat changing state. |
| Whisper release | Stop recording, show transcribing state, transcribe locally, then insert the final text at the current cursor. |
| Empty or too-short utterance | Insert nothing and return to idle. |
| Failure | Insert nothing, show an error state, preserve the audio/log needed to diagnose it. |
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

## Proposed component boundary

| Component | First implementation |
| --- | --- |
| Key listener | Narrow evdev listener filtered to `KEY_MACRO28`. |
| Recorder | Host `pw-record`, 16 kHz, mono, signed 16-bit WAV, explicit `--target=node.name`. |
| ASR | Fedora's direct-host `whisper-cpp` package for the first CPU benchmark. |
| Model | Small English model initially; model path and name are variables. |
| Text normalization | Trim model framing, reject empty output, preserve intended punctuation, apply only documented transformations. |
| Injection | Reuse the established Wayland-safe ydotool/ydotoold path for the ASCII-first proof; test Unicode and clipboard-preservation behavior before claiming general text support. |
| Service | systemd user unit with journal logs and restart policy. |
| Indicator | At minimum distinct Idle, Recording, Transcribing, and Error feedback; exact persistent UI selected after prototype. |
| Deployment | Dedicated Ansible playbook/role in the future project. |

PipeWire's recorder accepts a stable target node name and produces WAV based on
the filename. `whisper.cpp` accepts file input and supports CPU and NVIDIA GPU
paths. Those interfaces fit release-to-finalize dictation without adopting its
continuous microphone demo.

## Why CPU proof comes first

Fedora 44 packages `whisper-cpp` 1.8.x and `python3-pywhispercpp`. A packaged
CPU run is the shortest reproducible path for proving recording, model loading,
transcription quality, output parsing, and cursor injection.

Only measured release-to-text latency determines whether GPU acceleration is
needed. If CPU latency is unacceptable, benchmark a direct CUDA-enabled
`whisper.cpp` build. Keep `faster-whisper` as a comparison candidate, noting
that its current GPU requirements are CUDA 12 plus cuDNN 9.

This ordering avoids entangling the service contract with uncertain historical
facts about MACE's older Whisper container or current NVIDIA stack.

## Host inventory

Run this before installing or creating the implementation repository:

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

Known historical names include RODE Microphones, rear/front HD-Audio inputs,
and a USB camera microphone, but none is accepted as the current dictation
target until this inventory is run.

## Prototype phases

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

## Acceptance tests

The first releasable service must pass all of these:

- a brief press/release creates one and only one utterance;
- holding the key does not create repeated starts;
- the recording indicator appears immediately;
- release changes the indicator to Transcribing immediately;
- successful text appears once at the original cursor target;
- an empty utterance inserts nothing;
- an ASR failure inserts nothing and exposes a diagnostic;
- ordinary typing, Meta, Level3, Level5, Any, Hyper, mouse layers, and media controls are unaffected;
- logging out/in or rebooting starts the user service reliably;
- a second Ansible run reports no changes;
- conferencing coexistence is tested with the actual selected microphones.

## Open choices that require Nova

- preferred microphone after the live PipeWire inventory;
- first model and acceptable release-to-text latency;
- whether injected dictation should include a trailing space;
- punctuation normalization policy;
- exact visual indicator form;
- whether the first implementation is Rust, Python, or a small shell-assisted daemon;
- implementation repository name.

## References

- Fedora `whisper-cpp`: <https://packages.fedoraproject.org/pkgs/whisper-cpp/whisper-cpp/>
- Fedora `python3-pywhispercpp`: <https://packages.fedoraproject.org/pkgs/pywhispercpp/python3-pywhispercpp/>
- PipeWire `pw-record`: <https://docs.pipewire.org/page_man_pw-cat_1.html>
- upstream `whisper.cpp`: <https://github.com/ggml-org/whisper.cpp>
- ydotool: <https://github.com/ReimuNotMoe/ydotool>
