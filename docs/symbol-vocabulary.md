# Nova's Symbol Vocabulary

## Current structure, placement doctrine, and symbol neighborhoods

This document explains the symbol side of Nova's custom keyboard layout: what kinds of symbols belong on the keyboard, why they earned direct placement, how their positions are chosen, and how the layout should continue evolving without turning into a random Unicode shelf.

It is meant to survive future changes. The exact contents of the layout will continue to move as better uses are discovered, but the rules below describe the values that should govern those changes.

The short version:

> This is not an ornamental layout. It is a daily writing instrument.

Some symbols are linguistic. Some are technical. Some are emotional. Some are typographic controls. Some are jokes that grew into real infrastructure. Some are cute. Cuteness is allowed, but it must be functional.

The keyboard should remain a normal keyboard first. The extra levels exist to make written language, technical prose, teaching, markup, automation, and personal expression more precise without sacrificing ordinary typing, gaming, or application compatibility.

---

## 1. Scope and relationship to the architecture document

This document is the companion to `docs/keyboard-architecture.md`.

The canonical, version-controlled copy lives in the `x1_keyboard_layout`
repository as `docs/symbol-vocabulary.md`. The ChatGPT Library copy is a
convenient reading and sharing mirror, not a second source of truth.

The architecture document explains the input stack:

- firmware identities,
- QMK programmable buttons,
- Linux input events,
- XKB modifier allocation,
- Compose,
- AltGr,
- Level5,
- Hyper,
- Meta,
- Any,
- Whisper,
- mouse layer behavior,
- deterministic tap-hold behavior,
- and the boundaries between firmware, XKB, GNOME, and host-side daemons.

This document explains the symbol vocabulary:

- which characters are directly typable,
- how a symbol earns a direct slot,
- why a symbol is placed on a particular key,
- which symbols form families,
- which symbols merely live in the same neighborhood,
- and which principles should guide future replacements.

Do not merge these documents into one giant file. The architecture document answers, "How does the input system work?" This document answers, "Why are these symbols here?"

The authoritative source for the current direct mappings is `files/us-nova`. This document explains the rationale. If this document and `files/us-nova` disagree about the current layout, the keymap wins and this prose should be updated.

---

## 2. Source-of-truth model

The system has more than one source of truth because different layers own different kinds of truth.

| Layer | Source of truth | Owns |
| --- | --- | --- |
| Symbol mapping | `files/us-nova` | Current XKB symbol output for Levels 1–8 where explicitly defined. |
| Architecture | `docs/keyboard-architecture.md` | Why the keyboard stack is split across firmware, XKB, desktop settings, and daemons. |
| Firmware | QMK keymap | Physical matrix behavior, programmable-button identities, deterministic tap-hold behavior, mouse layer. |
| Hyper | `hyperkeyd` | Hyper as a personal command-dispatch plane. |
| Any | `press-the-any-key` | Wayland-safe synthetic input and GNOME shortcut plumbing for the Any key. |
| Whisper | `whisper-ptt` implementation plus `docs/designs/whisper-ptt-boundary.md` | Active hold-to-record, release-to-finalize local speech-to-text plane. |

This document should not duplicate the implementation details of those projects. It may mention them only when necessary to explain where the symbol layout ends and other input planes begin.

---

## 3. Level model

Most keys use ordinary US typing plus two additional XKB levels. B is the
first deliberate eight-level canary.

| Level | Gesture | Role |
| --- | --- | --- |
| Level 1 | key | ordinary US base symbol |
| Level 2 | Shift + key | ordinary US shifted symbol |
| Level 3 | AltGr + key | curated symbol vocabulary |
| Level 4 | Shift + AltGr + key | paired or related curated symbol vocabulary |
| Level 5 | Level5 + key | additional direct symbol where explicitly defined |
| Level 6 | Shift + Level5 + key | shifted Level5 symbol where explicitly defined |
| Level 7 | AltGr + Level5 + key | combined-selector symbol where explicitly defined |
| Level 8 | Shift + AltGr + Level5 + key | shifted combined-selector symbol where explicitly defined |

Levels 3 and 4 are not random decoration. They are direct access to symbols Nova actually uses, expects to use, or has strong reason to keep available.

Level5 is active as a text-symbol selector, not a command modifier. Only B
currently has an explicit eight-level type; other keys retain their existing
Level3/Level4 vocabulary. Expanding Level5 further must follow the same
admission and placement doctrine as every other direct symbol.

---

## 4. Compose remains first-class

Compose is not obsolete just because many symbols are directly typable.

Compose is a stateful character-construction tool. It is not merely another modifier. It handles many characters that do not deserve direct placement, and it keeps the direct layout from becoming bloated.

Historically, Nova composed almost everything. Early direct mappings were limited to practical symbols such as the euro sign and possibly the rupee sign. The first major expansion came when GNOME could place Esperanto letters where they belonged. Later, direct XKB customization made it possible to place characters that Compose could not produce, followed by characters that were frequent, useful, or important enough to deserve direct access.

The modern rule is:

> Composeability affects priority; it does not determine eligibility.

A composeable symbol may still deserve a direct key if it is common, important, or ergonomically valuable. A non-composeable symbol does not automatically deserve a key if it has no real use.

Examples:

- `NBSP` remained directly available for a long time even though it could be composed, because it was useful.
- `NNBSP` displaced `NBSP` on the spacebar because it solved the common no-break use case better and was not as conveniently composeable.
- `≈` is composeable but remains useful on the equality key unless a better equality-family symbol earns the slot.
- `🄯` was composeable and eventually lost its direct slot when `∅` made a stronger claim on the minus key.
- `µ` was composeable, useful, and memorable on `M`; it stayed while the slot was free, then lost to symbols with stronger claims on that key.

---

## 5. The symbol admission rule

Every symbol must earn its own place.

A direct key is justified by some combination of:

- real use,
- likely future use,
- frequent use,
- inability or inconvenience through Compose,
- strong mnemonic placement,
- technical usefulness,
- linguistic usefulness,
- typographic usefulness,
- emotional or rhetorical usefulness,
- whitespace or line-breaking control,
- or clear improvement over ASCII approximations.

A symbol does not earn a slot merely because it is pretty, rare, clever, or part of a visually complete set.

The cautionary example is `⁑`. It once looked tempting between `*` and `⁂` for pattern completeness, but its actual meaning did not fit Nova's workflow. Completeness alone was not enough, so it had to go.

The concise rule:

> A symbol family can help place a symbol, but it cannot smuggle in a useless symbol.

---

## 6. Placement is not membership

This document uses three related terms: family, neighborhood, and overlap.

| Term | Meaning |
| --- | --- |
| Family | A group of symbols Nova actually uses as a meaningful set. |
| Neighborhood | A placement cluster created by shared shape, theme, mnemonic, physical location, or ergonomics. |
| Overlap | A symbol may participate in more than one family or neighborhood, but only when usage supports that membership. |

The core rule is:

> Placement is not membership. Usage is membership.

A symbol may sit near a group because the placement is memorable, but that does not mean Nova uses it as part of that family. Conversely, a symbol may belong conceptually to a family but live somewhere else because another placement axis was stronger.

Some groups are both families and neighborhoods. Some are only neighborhoods. Some symbols overlap between several meaningful groups.

Examples:

- `○ ☐ △` are a simple-shape family when used as circle, square, triangle.
- `○ ✗ △` are a Japanese-style judgment family when used as correct, wrong, partial.
- `☑ ☒ ☐` are a ballot-box family.
- `☐` participates in both simple shapes and ballot boxes.
- `○` participates in both simple shapes and Japanese judgment marks.
- `✗` participates in both no/rejection and Japanese judgment marks.
- Greek letters are selected notation marks, not evidence that the layout is trying to provide Greek input.

---

## 7. Placement axes

After a symbol has earned direct placement, the next question is where it belongs.

A symbol may be placed by any of these axes:

| Axis | Examples |
| --- | --- |
| Letter or name | `λ` on L, `β` on B, `℗` on P. |
| Sound | Historical letters can move to a phonetic cue when their obvious key is full. |
| Shape | Similar-looking symbols may sit together. |
| Existing shifted symbol | `≤` and `≥` live on the keys that already produce `<` and `>`. |
| Technical convention | `π` on 3 because of 3.14. |
| Family or neighborhood | `☑ ☒ ☐`, `○ ☐ △`, `⊕ ⊗ ⅋`. |
| Nearby pressure | A good second-choice home may win when the obvious key is full. |
| Ergonomics | A symbol or modifier may move because the real chord was uncomfortable. |

No axis is absolute. Family does not always win. Letter name does not always win. Shape does not always win. Usage determines admission; placement is the best available explanation after admission.

---

## 8. Direct-placement decision tree

A symbol candidate should be evaluated roughly like this:

1. **Is there a real use for it?**
   - If no, leave it out.
   - If yes, continue.
2. **Is it impossible, difficult, or annoying to produce through Compose or another existing method?**
   - If yes, it has a stronger claim.
   - If no, it may still qualify through frequency, importance, or convenience.
3. **Is it used often enough that Compose becomes friction?**
   - If yes, direct placement may be justified.
4. **Would direct placement make it genuinely useful?**
   - Some symbols become useful only when they are no longer buried.
5. **Does it improve expression, precision, teaching, technical discussion, or typography?**
   - If yes, that weighs in its favor.
6. **Does it have a memorable home?**
   - If no good placement exists, defer it.
7. **Is the intended slot already occupied by a symbol with a stronger claim?**
   - If yes, do not displace it.
   - If no, the candidate may replace it.

Nothing gets seniority merely by arriving first. A symbol that already has a slot keeps that slot only as long as it still wins under the same rules. This does not require a separate eviction doctrine; it is simply the admission and placement doctrine applied again as the layout matures.

---

## 9. Current row inventory

This section records the current Level3 and Level4 inventory plus the one
explicit Level5–Level8 canary from `files/us-nova`. Base and Shift levels
remain standard US except where noted elsewhere.

### 9.1 Number row and grave key

| Key | Level3 | Level4 | Notes |
| --- | --- | --- | --- |
| `` ` `` | `⎓` | `⏦` | DC / AC current symbols. |
| `1` | `‼` | `⚠` | Intensity and warning. |
| `2` | `₿` | `☡` | Bitcoin; caution. |
| `3` | `π` | `τ` | Mathematical notation. |
| `4` | `₹` | `φ` | Rupee; phi notation. |
| `5` | `€` | `⅌` | Euro; per sign. |
| `6` | `∑` | `θ` | Sum; theta notation. |
| `7` | `⅋` | `⊕` | Linear logic neighborhood. |
| `8` | `⁂` | `⊗` | Section/attention marker; linear logic tensor. |
| `9` | `△` | `Δ` | Simple shape / Japanese judgment / delta. |
| `0` | `○` | `☐` | Simple shapes; ballot/judgment overlap. |
| `-` | `∅` | `🅭` | Empty-set / Creative Commons-style mark. |
| `=` | `≈` | `≡` | Approximate equality / identity or equivalence. |

### 9.2 Q row

| Key | Level3 | Level4 | Notes |
| --- | --- | --- | --- |
| `Q` | `☠` | `☣` | Skull/crossbones; biohazard. |
| `W` | `ŭ` | `Ŭ` | Esperanto U-breve, W-like sound. |
| `E` | `ë` | `Ë` | Diaeresis vowel. |
| `R` | `ƿ` | `Ƿ` | Wynn, displaced from W. |
| `T` | `þ` | `Þ` | Thorn. |
| `Y` | `✓` | `☑` | Yes/check family. |
| `U` | `ü` | `Ü` | Diaeresis vowel. |
| `I` | `ï` | `Ï` | Diaeresis vowel. |
| `O` | `ö` | `Ö` | Diaeresis vowel. |
| `P` | `Φ` | `℗` | Phi / phonographic copyright. |
| `[` | `⧘` | `∵` | Left wiggly fence; because. |
| `]` | `⧙` | `∴` | Right wiggly fence; therefore. |
| `\` | `❣` | `❢` | Emotional punctuation. |

### 9.3 Home row

| Key | Level3 | Level4 | Notes |
| --- | --- | --- | --- |
| `A` | `ä` | `Ä` | Diaeresis vowel. |
| `S` | `ŝ` | `Ŝ` | Esperanto. |
| `D` | `ð` | `Ð` | Eth. |
| `F` | `℉` | `℃` | Temperature pair. |
| `G` | `ĝ` | `Ĝ` | Esperanto. |
| `H` | `ĥ` | `Ĥ` | Esperanto. |
| `J` | `ĵ` | `Ĵ` | Esperanto. |
| `K` | `ȝ` | `Ȝ` | Yogh. |
| `L` | `λ` | — | Lambda. |
| `;` | `∶` | `∷` | Ratio and proportion/type-style notation. |
| `'` | `′` | `″` | Prime and double prime. |

### 9.4 Bottom letter row

| Key | Level3 | Level4 | Notes |
| --- | --- | --- | --- |
| `Z` | `Ω` | — | Omega. |
| `X` | `ƒ` | `ſ` | Function sign / long s visual neighborhood. |
| `C` | `ĉ` | `Ĉ` | Esperanto. |
| `V` | `⚛` | `☢` | Atom / radiation. |
| `B` | `β` | `α` | Beta / alpha. |
| `N` | `✗` | `☒` | No/rejection family. |
| `M` | `℞` | `⚕` | Prescription / medical neighborhood. |
| `,` | `≤` | `≲` | Less-than comparison family. |
| `.` | `≥` | `≳` | Greater-than comparison family. |
| `/` | `⁇` | `⸮` | Question intensity / rhetorical question mark. |

### 9.5 Arrows and space

| Key | Level3 | Level4 | Notes |
| --- | --- | --- | --- |
| Up | `↑` | `👆` | Direction/motion vs pointing at screen content. |
| Left | `←` | `👈` | Direction/motion vs pointing at screen content. |
| Down | `↓` | `👇` | Direction/motion vs pointing at screen content. |
| Right | `→` | `👉` | Direction/motion vs pointing at screen content. |
| Space | `NNBSP` | `SHY` | Narrow no-break space; soft hyphen. |

### 9.6 Level5 B canary

B is the first key to populate all eight levels:

| Level | Gesture | Output |
| --- | --- | --- |
| 1 | B | `b` |
| 2 | Shift+B | `B` |
| 3 | AltGr+B | `β` |
| 4 | Shift+AltGr+B | `α` |
| 5 | Level5+B | `🐇` |
| 6 | Shift+Level5+B | `🐰` |
| 7 | AltGr+Level5+B | `🥬` |
| 8 | Shift+AltGr+Level5+B | `🥕` |

The family is memorable, easy to test, and deliberately cute while still
serving as a technical acceptance canary. It proves the selector architecture
without forcing speculative Level5 assignments onto every other key.

---

## 10. Language families

### 10.1 Esperanto

Esperanto letters are part of the daily purpose of the layout, not a novelty. Nova communicates in Esperanto and does not want to rely on the H-system or X-system except as compromises.

Current mappings:

| Letter | Key |
| --- | --- |
| `ĉ Ĉ` | C |
| `ĝ Ĝ` | G |
| `ĥ Ĥ` | H |
| `ĵ Ĵ` | J |
| `ŝ Ŝ` | S |
| `ŭ Ŭ` | W |

The U-breve on W is not arbitrary. It has a W-like sound relationship, and U is already serving the diaeresis vowel family with `ü Ü`.

### 10.2 Diaeresis vowels

The diaeresis vowels are placed on their corresponding Latin vowels:

| Letter | Key |
| --- | --- |
| `ä Ä` | A |
| `ë Ë` | E |
| `ï Ï` | I |
| `ö Ö` | O |
| `ü Ü` | U |

These are valuable enough to occupy prime vowel positions. They also create pressure that pushes other symbols to second-best homes.

### 10.3 Historical English and old letters

The layout supports real discussion of Old English, Middle English, and historical letterforms.

| Symbol | Key | Placement reason |
| --- | --- | --- |
| `þ Þ` | T | Thorn belongs on T. |
| `ð Ð` | D | Eth resembles D and E was already occupied. |
| `ƿ Ƿ` | R | Wynn could not live on W; R gives a visual fallback. |
| `ȝ Ȝ` | K | Yogh could not live on Y; K approximates one of its sound associations. |
| `ſ` | X | Long s could not live on S; it shares a visual neighborhood with `ƒ`. |

These are not general medieval decoration. They are tools for linguistic and historical discussion.

---

## 11. Technical and mathematical neighborhoods

### 11.1 Selected Greek notation, not Greek input

The layout contains selected Greek letters because they are useful in technical, mathematical, scientific, programming, or explanatory prose. It is not trying to provide a Greek alphabet layout.

Case-pairing is not assumed. A capital and lowercase Greek letter may have completely different reasons for existing.

| Symbol | Key | Use / placement note |
| --- | --- | --- |
| `π` | 3 | Pi, placed by 3.14. |
| `τ` | 3 | Tau, near pi as math notation. |
| `φ` | 4 | Phi in the number-row math/science neighborhood. |
| `θ` | 6 | Theta in the math/science neighborhood. |
| `Φ` | P | Phi by P-related mnemonic/use, not because it must pair with `φ`. |
| `∑` | 6 | Summation near the number-row math cluster. |
| `λ` | L | Lambda for Lisp/Scheme/type discussion. |
| `Ω` | Z | Omega as the end of the Greek alphabet; Z is the end of the Latin alphabet. |
| `β α` | B | Beta belongs on B; alpha pairs there because A is occupied. |
| `Δ` | 9 | Delta because of triangle shape and technical use. |
| `∅` | - | Empty set; the minus key supplies an absence/subtraction mnemonic. |

The important principle is that Greek letters appear only when they have a job.

### 11.2 Equality and comparison

The equality and comparison family is one of the cleanest direct-placement families.

| Key | Symbols | Meaning |
| --- | --- | --- |
| `=` | `≈ ≡` | Approximate equality; stronger identity/equivalence. |
| `<` key | `≤ ≲` | Less-than-or-equal; less-than-or-equivalent. |
| `>` key | `≥ ≳` | Greater-than-or-equal; greater-than-or-equivalent. |

`≈` is easy to compose, but it is useful enough to remain direct unless a stronger candidate earns the spot. Composeability lowers urgency; it does not automatically revoke a slot.

### 11.3 Ratio, proportion, and type-style notation

The semicolon/colon key now carries:

| Symbol | Role |
| --- | --- |
| `∶` | Ratio. |
| `∷` | Proportion; also useful in type-signature-style prose. |

This supports compact technical writing such as type explanations and symbolic analogies.

### 11.4 Linear logic group

The layout includes a real linear-logic group:

| Symbol | Key | Note |
| --- | --- | --- |
| `⅋` | 7 | Par / turned ampersand. |
| `⊕` | 7 | Circled plus. |
| `⊗` | 8 | Tensor / circled times. |

These belong together by use, not merely by appearance. They are a genuine technical family/neighborhood.

### 11.5 Function, prime, and measurement notation

| Symbol | Key | Role |
| --- | --- | --- |
| `ƒ` | X | Function sign, with `ƒ(x)` as the mnemonic. |
| `′` | apostrophe | Prime. |
| `″` | apostrophe | Double prime. |
| `℉ ℃` | F | Temperature pair. |
| `⚛` | V | Atom/science symbol. |
| `⚕ ℞` | M | Medical/prescription neighborhood. |

The M key formerly had `µ`, which was useful and memorable there. It lost the slot when the current medical/prescription symbols had stronger claims.

---

## 12. Direction, deixis, and screen pointing

The physical arrow keys preserve ordinary navigation on levels 1 and 2. Levels 3 and 4 distinguish two different concepts:

| Level | Symbols | Meaning |
| --- | --- | --- |
| Level3 | `← ↑ → ↓` | Real direction, motion, flow, type signatures, diagrams. |
| Level4 | `👈 👆 👉 👇` | Pointing at something on screen or in the surrounding text. |

This distinction matters. An arrow indicates motion or direction. A pointing hand indicates reference: "look here," "this thing," "the item over there."

This is one of the strongest examples of the layout using the physical keyboard intelligently. The arrow keys remain arrow keys, but higher levels turn them into typographic direction and deixis tools.

---

## 13. Punctuation, tone, and text structure

### 13.1 Intensity punctuation

| Symbol | Key | Role |
| --- | --- | --- |
| `‼` | 1 | Controlled double-exclamation emphasis. |
| `⁇` | / | Controlled double-question emphasis. |

These symbols replace noisy ASCII repetition. They let Nova write with strong tone without degenerating into `!!!!!` or `?????`.

### 13.2 Rhetorical punctuation

| Symbol | Key | Role |
| --- | --- | --- |
| `⸮` | / | Reversed question mark; marks a question that should be read with extra rhetorical, ironic, or sardonic attention. |

This is not an interrobang. It signals that the question is not plain.

### 13.3 Emotional punctuation

| Symbol | Key | Role |
| --- | --- | --- |
| `❣` | backslash | Emotional punctuation. |
| `❢` | backslash | Emotional punctuation. |

Unicode names may call these ornaments, but in this layout they are not ornamental. They are tone marks. Functional cuteness is allowed; decorative filler is not.

### 13.4 Section, attention, and withholding marker

| Symbol | Key | Role |
| --- | --- | --- |
| `⁂` | 8 | Section marker, attention marker, separator; also useful where a title or author is withheld. |

`⁂` has a textual job. It is not included for decoration.

`⁑` is intentionally absent. It once looked tempting as a visual completion between `*` and `⁂`, but its actual meaning did not fit Nova's workflow.

---

## 14. Shapes, judgments, and ballot marks

### 14.1 Simple-shape family

| Symbol | Role |
| --- | --- |
| `○` | Circle. |
| `☐` | Square / empty box. |
| `△` | Triangle. |

This is a simple shape family when the symbols are used as shapes.

### 14.2 Japanese-style judgment family

| Symbol | Role |
| --- | --- |
| `○` | Correct / OK / accepted. |
| `✗` | Wrong / rejected. |
| `△` | Partial / questionable / maybe / not ideal. |

This family exists by usage. It overlaps with the simple-shape family but is not the same thing.

### 14.3 Yes/no and ballot-box family

| Symbol | Key | Role |
| --- | --- | --- |
| `✓` | Y | Yes / check. |
| `☑` | Y | Checked / selected / yes in a box. |
| `✗` | N | No / rejection. |
| `☒` | N | Rejected / no in a box. |
| `☐` | 0 | Empty / unselected / pending box. |

`☐` participates in both the simple-shape group and the ballot-box family. That overlap is legitimate because it reflects usage.

---

## 15. Warning, danger, and hazard neighborhood

The layout contains a warning/danger/hazard neighborhood, but not all members have exactly the same use.

| Symbol | Key | Role |
| --- | --- | --- |
| `⚠` | 1 | Warning sign; belongs naturally with exclamation. |
| `☡` | 2 | Caution sign. |
| `☠` | Q | Skull and crossbones. |
| `☢` | V | Radioactive sign. |
| `☣` | Q | Biohazard sign. |

These are not Halloween decorations. They communicate warning, danger, hazard, risk, or emphasis depending on context.

---

## 16. Whitespace and line-breaking control

The spacebar is special because it controls invisible structure.

| Gesture | Output | Role |
| --- | --- | --- |
| Space | ordinary space | Normal separation. |
| Shift+Space | ordinary space | Avoid accidental invisible/special insertion. |
| AltGr+Space | `NNBSP` | Narrow no-break space. |
| Shift+AltGr+Space | `SHY` | Soft hyphen. |

The old model was based around telling the computer where it could break and where it could not break, using NBSP and ZWSP. The current model is more precise.

`NNBSP` is useful when two parts should stay together but a full no-break space is visually too wide: examples include units, time expressions, key names, or attached labels. It says, "do not break here, but keep the spacing narrow."

`SHY` is discretionary hyphenation. It says, "you may break here; if you do, show a hyphen."

`NBSP` was not retired merely because it could be composed. It was retired because it could be composed and a better direct-space candidate needed the slot. If no better special-space character had existed, NBSP would still have deserved direct placement.

---

## 17. Legal, licensing, and currency symbols

### 17.1 Legal / licensing neighborhood

| Symbol | Key | Role |
| --- | --- | --- |
| `℗` | P | Sound recording copyright. |
| `🅭` | - | Creative Commons-style circled mark. |

`©` and `🄯` are not directly mapped because they are available through
Compose and stronger candidates won the direct slots. The minus key now pairs
`∅` with `🅭`; that is a placement neighborhood, not a claim that the empty-set
symbol belongs to a licensing family.

### 17.2 Currency and practical signs

| Symbol | Key | Role |
| --- | --- | --- |
| `₿` | 2 | Bitcoin sign. |
| `₹` | 4 | Indian rupee sign. |
| `€` | 5 | Euro sign. |

These are practical symbols, not a general currency keyboard. Currency signs remain only when they have enough use or significance to justify direct placement.

---

## 18. Electronics and current symbols

The grave key currently carries:

| Symbol | Role |
| --- | --- |
| `⎓` | Direct current symbol form two. |
| `⏦` | AC current. |

These occupy an electronics/current neighborhood. Their placement on the grave key is not obvious by ordinary typing logic, so the justification depends on the current symbol inventory and available space. If their actual use fades or a stronger placement emerges, they should be re-evaluated by the normal rules.

---

## 19. Brackets, fences, because, and therefore

The bracket keys carry a small reasoning/structure neighborhood:

| Key | Level3 | Level4 |
| --- | --- | --- |
| `[` | `⧘` | `∵` |
| `]` | `⧙` | `∴` |

The wiggly fences belong naturally on bracket keys by shape and enclosure. `∵` and `∴` are paired reasoning marks: because and therefore.

This is a neighborhood rather than a single family. The bracket placement helps memory and physical logic.

---

## 20. Personal command planes are not symbol families

The symbol layout does not own Hyper, Meta, Super, Any, or Whisper. Those belong to the larger input architecture.

Still, this document should record the conceptual separation because it protects the symbol layout from being confused with command dispatch.

| Plane | Role |
| --- | --- |
| Super | Desktop and window-manager playground. |
| Meta | Application and terminal command playground. |
| Hyper | Nova-level personal command playground. |
| Any | Tap-side utility, randomness, and automation reference path. |
| Whisper | Hold-to-talk speech input plane. |
| Compose | Character construction system. |
| AltGr / Level3 | Direct symbol selector. |
| Level5 | Active direct symbol selector; B is the first eight-level canary. |

This separation is the real answer to oversized keyboards that add more physical keys without a clear theory of use. The power comes from meaningful namespaces, not from key count alone.

---

## 21. Deterministic tap-hold boundary

Older versions of the philosophy rejected tap-hold because the available implementations depended on timing thresholds. That objection was correct.

The current system accepts tap-hold only where it is deterministic. A key does not become a hold because enough milliseconds passed. It becomes a hold because another key was pressed while the key was pending.

The principle is:

> The keyboard must not guess.

Tap-hold is therefore acceptable only when:

- the tap role is a discrete action or prefix,
- the hold role is a modifier or mode,
- the decision is based on key-event structure rather than timing,
- and the key is one of the limited places where the ergonomic gain is worth the extra behavior.

This belongs primarily to the architecture document, but it matters here because it explains how Level3, Compose, Any, Meta, and Level5 can coexist without making the keyboard feel unstable.

---

## 22. Preservation principles

If this symbol vocabulary is rebuilt years from now, preserve these principles before preserving exact placements.

1. **The base keyboard must remain boring.** Ordinary typing, gaming, shortcuts, and muscle memory matter.
2. **Compose remains central.** Direct symbols supplement Compose; they do not replace it.
3. **Every symbol must earn its slot.** No filler, no decoration-only symbols, no completeness for its own sake.
4. **Functional cuteness is allowed.** A symbol may be cute, emotional, or playful if it still has a job.
5. **Family helps placement, not admission.** A family can make a symbol easier to remember; it cannot justify a useless symbol.
6. **Neighborhoods are placement aids.** Symbols may sit together because of shape, meaning, or memory without becoming a formal family.
7. **Usage determines membership.** Placement alone does not make a symbol part of a family.
8. **Composeability affects priority, not eligibility.** Composeable symbols can stay direct if they are useful enough.
9. **No seniority.** A symbol keeps its place only as long as it still wins under the same rules.
10. **Case pairs are not automatic.** Greek, historical, or technical symbols appear only when the specific form has a job.
11. **Whitespace is text control.** Invisible characters are powerful and should be chosen by actual behavior in real tools.
12. **The keyboard should disappear.** If a common action makes the user think about the keyboard instead of the work, the layout is wrong.

---

## 23. Suggested cross-reference for `keyboard-architecture.md`

The architecture document should not absorb this entire symbol discussion. It
only needs a cross-reference in the text-level section, such as:

> The detailed rationale for individual symbols, symbol neighborhoods, placement rules, and the current vocabulary lives in `docs/symbol-vocabulary.md`. This architecture document explains how Level3, Level4, and Level5 work; the symbol vocabulary document explains why particular characters earned particular homes.

And in the repository split section, add:

> `docs/symbol-vocabulary.md` documents the current direct symbol vocabulary and placement doctrine. It is a companion to this architecture document, not a replacement for it.

---

## 24. Closing doctrine

This layout began as a practical way to type the things Compose could not easily provide. It grew through Esperanto, technical writing, historical letters, precise punctuation, whitespace control, and finally a programmable keyboard that made the physical side clean enough to match the symbolic side.

The result is not a Unicode trophy case.

It is a written instrument.

It should keep evolving, but it should evolve by the same rule that made it useful in the first place:

> Put the thing where the hand can find it, only if the mind has a reason to reach for it.
