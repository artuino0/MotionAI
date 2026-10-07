# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Desktop app built with Electron; the interface is web technology: Vue 3, Pinia, Vite. Windows first, Mac later.)

## Users

Three primary audiences, weighted equally:

- **Business owners with no editing experience** who need short videos for their own social accounts and have never opened a video editor.
- **Creators who already edit** in CapCut or Premiere and expect a monitor, a timeline and keyboard shortcuts; the chat saves them the manual work.
- **Agencies and teams** producing many videos for several brands, who care about brand consistency, speed and reuse.

The job in every case: get a finished short-form motion graphics video (TikTok, Reels, Shorts, Facebook, YouTube) by describing it in a chat, then refine it by pointing at what to change.

## Product Purpose

MotionAI makes motion graphics by asking Claude for them. The app supplies the canvas, the render engine and the tools; the intelligence is the user's own Claude Code with their own subscription. Success: a user goes from a text brief to an exported MP4 without editing anything by hand, and can steer changes by clicking the piece they mean.

## Positioning

- No AI of its own and no token billing: it launches the Claude Code the user already has installed and signed in (Pro or Max), the same model as pen.dev.
- Nothing is edited by hand. Content changes only through the chat; the interface shows, selects and converses. Project settings are the one hand-editable exception.
- One engine draws the live preview and the final MP4: what you see is what you export.
- Every change is a small validated command that becomes a version; brand and platform rules are enforced in code, not only in instructions.

## Operating Context

- Workflow: create a project (format, duration, fps) → write a brief in the chat → watch the monitor update live while Claude works → click a piece or a timeline clip to reference it in the next message → adjust project settings → export.
- The interface follows the montage layout already used in Flow: media panel (scenes, pieces, library, phrases), live monitor with "as seen in TikTok / Reels / Facebook" views, inspector, history, and a timeline with text, pieces, main and audio tracks.
- Projects live in a folder: `proyecto.json`, `recursos/`, `exportados/`, `.motionai/` (version history in SQLite, chat and Claude session).
- Everything runs locally: document, render, export, voice. No server, no operating cost.

## Capabilities and Constraints

- Claude creates pieces from vector primitives (rect, ellipse, SVG path, text, image, group, component instances) and animates them with keyframes, entrances, exits and loops.
- Platform safe-zone rules (TikTok, Reels, Facebook, Shorts) reject changes that put text under each app's buttons or description.
- Requires Claude Code installed and signed in; the app checks on start and explains the steps if missing. Requires ffmpeg (bundled in the installer, phase 5).
- Claude runs with its file, terminal and web tools disabled; it only reaches the project through the app's MCP tools and cannot open other projects.
- Terminology: proyecto, escena, pieza, componente, biblioteca, frase, versión, ajustes de proyecto, kit de marca.
- Open decisions: kits de marca, papel recortado style, voice transcription and SVG/.pen import arrive in phase 4.

## Brand Commitments

- The name **MotionAI** is final.
- No logo, palette, typography or voice has been defined yet: the visual identity is an open decision.
- The product is independent of any client brand. Flow is only the first test project; its rules belong to a Flow kit, not to the app.

## Evidence on Hand

- Working demos: `ejemplos/demo/proyecto.json` and the Café Luna videos produced by Claude in the phase 2 and 3 tests.
- No testimonials, customers, usage numbers or pricing exist. Do not fabricate them.

## Product Principles

1. The chat is the editing tool; the interface is for seeing, choosing and pointing.
2. Show the work live: every change Claude makes appears in the monitor as it happens, with its version.
3. Nothing is lost: every change is a version, and undoing is going back to one.
4. Serve the beginner and the editor at once: simple by default, with the montage tools an editor expects.
5. The user's subscription, the user's machine: no hidden AI cost, no cloud dependency.

## Accessibility & Inclusion

- The interface ships in **Spanish and English** from now on; all UI copy must be translatable, with Spanish (Mexico) as the reference language.
- Keyboard control for playback (space, arrows) and dismissal (Escape).
