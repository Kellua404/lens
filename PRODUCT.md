# Lens — Product Definition

> The "why and for whom." `PLAN.md` is the "how." When a build decision isn't
> covered by the plan, decide in favor of these principles.
>
> Portfolio Project **B3** — the third *backend* project (computer vision), and the
> closer of Phase 2. Read alongside `PLAN.md` and the Phase-2 section of the root
> `PORTFOLIO_PLAN.md`.

## One-liner

**Lens looks at an image and shows you what the machine sees — what it is (classification),
what it says (OCR text), and what it's made of (color) — with every model running on our
own Vercel server, no paid Vision API, no API key.**

## What it actually is

A single-page **forensic light table**. You drop in an image and it lands on a dark
analysis surface. A scan sweeps across it once, and three real, server-side results bloom
*onto* the image:

1. **Classification** — a real ONNX vision transformer (running inside a Vercel serverless
   function via `transformers.js`) names what it sees, ranked with confidence scores.
2. **OCR** — Tesseract runs in the same backend and pulls out any text, drawn back as
   highlighted boxes over the words it found.
3. **Palette** — the image's dominant colors, quantized straight from its pixels, swatched
   as a strip.

A precise **instrument readout** proves the backend is real and fast: model id,
classification latency, OCR latency, image dimensions, top-1 confidence, words found —
and the honest fact that it all ran server-side for **$0**, no rented API.

> This is the computer-vision sibling to Resonance (which proved *"I can run a real NLP
> model server-side"*). Lens proves the same self-hosted-inference muscle applied to
> **pixels** — the third distinct backend domain in the portfolio (NLP → distributed
> systems → vision). Deliberately its own look and mood, not a Resonance reskin.

## Who it's for

- **Recruiters / engineers** evaluating the portfolio — Lens is proof of **computer-vision
  + applied-ML** skill: running real image classification *and* OCR server-side, with no
  Vision API, deployed on Vercel within a tight function-size budget (the hard-won lesson
  from Resonance). The telemetry makes that legible at a glance.
- **Curious visitors** who'll drop in a meme, a sign, a receipt, a photo, a screenshot —
  and enjoy watching the machine actually *read* and *recognize* it in front of them.
- **Anyone who's wondered "what would an AI think this is?"** — and gets an honest,
  inspectable answer instead of a black box.

## The job it does

> "Show me what a machine actually perceives in this image — name it, read its text, take
> its colors — instantly, beautifully, and in a way that makes it obvious there's a real
> model running, not a call to someone else's cloud."

## Brand & personality

- **Mood:** a **forensic light table / optical bench in a darkroom**. Cool, precise, a
  little clinical, calm. The image is the specimen; the UI is the instrument examining it.
  Analysis feels like a careful *scan*, not a flashy reveal.
- **Voice:** exact and observational, like a lab readout. Labels read like an optical
  instrument (`CLASSIFY`, `READ`, `PALETTE`, `CONFIDENCE`, `LATENCY`, `DIMENSIONS`).
  Spare, literal, no marketing.
- **Visual signature:** near-black darkroom surface; the uploaded image sits on a subtly
  lit **light table**; results are drawn *on the specimen* — OCR word-boxes overlaid in
  place, a ranked classification readout, a palette strip pulled from the real pixels. A
  single **optical-cyan scan line** sweeps once on analyze (the signal accent). Hairline
  technical grid + mono telemetry.
- **Type signature:** **Schibsted Grotesk** (display/UI — an optical, modern grotesque;
  precise but human) + **DM Mono** (telemetry, IDs, confidence %, dimensions — a clean
  lab-readout mono). A deliberately *new* pairing: distinct from Aurora's Instrument Serif
  + IBM Plex Mono, Resonance's Fraunces + Geist Mono, and Conveyor's Space Grotesk +
  JetBrains Mono. The portfolio never reuses a font pairing.
- **Anti-brand:** NOT a generic "AI image tagger" SaaS. No Inter/Roboto, no
  drag-a-cloud-icon upload clipart, no purple-gradient hero, no corporate confidence-bar
  dashboard, no "Powered by Google Vision / AWS Rekognition" badge, no spinner hiding a
  paid API. The model runs on *our* server and the readout proves it.

## Design principles (in priority order)

1. **The backend is the substance; the light table is its instrument.** Every visible
   thing exists to make the on-server inference *felt* — its perception, its speed, its
   honesty. The image is the subject; the analysis is the proof.
2. **Show the engine, don't hide it.** Telemetry (model id, classify ms, OCR ms, confidence,
   dimensions) is a first-class design element. We never fake a label or a box.
3. **Draw results on the specimen.** OCR boxes sit over the real words; the palette is the
   real pixels; the classification is the real top-k. Understanding is shown *in place*,
   not in a detached panel of strings.
4. **Calm, forensic, unhurried.** A single scan, slow settle, generous dark space. It
   should feel like examining something under good light — not a flashy "AI magic" pop.
5. **Honest, not magical.** No paid API, no hidden cloud — the models run on our Vercel
   function and we say so. "$0, no Vision API, no key" is a feature we surface.
6. **Genuinely useful + inclusive.** Real extracted text you can copy, a real palette you
   can take, a shareable analysis card. Graceful cold start, AA accessible, reduced-motion
   respected, sensible on a phone, works without GPU.

## Success looks like

- A visitor drops in a photo of a street sign, watches the scan sweep, and sees the right
  object named, the sign's text pulled out into copyable strings, and the scene's palette
  swatched — in about a second (warm) — and thinks *"wait, this is running real vision
  models on their own server, for free?"* That reaction is the North Star.
- A reviewing engineer reads the telemetry + the fact that classification **and** OCR both
  run server-side under Vercel's function-size limit, and immediately trusts there's real
  CV/backend work here, not an API wrapper.
- Someone exports the analysis card or copies the extracted text / palette because the
  output is good enough to keep.

## Explicit non-goals (v1)

Accounts/history, object **detection**/bounding boxes for *objects* (we do whole-image
classification + OCR word boxes, not a detector), face recognition (deliberately — privacy),
image **captioning** or CLIP-large (too big for the function-size budget — see `PLAN.md`
§4/§13), video, multi-language OCR (English v1), batch upload, any paid API. Several live
in `PLAN.md` §15 as stretch goals. Keep v1 small and perfect.
