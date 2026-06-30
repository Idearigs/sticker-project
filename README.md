# Live Action Stickers

A glossy kawaii **slime mascot** built from scratch in React — hand-rolled
spring physics on `requestAnimationFrame`, no animation libraries.

- **Squishy body** — a gumdrop silhouette where every point springs along its
  own normal, so it wobbles and jiggles.
- **Emotions** — `neutral · happy · sad · angry · surprised · love · sleepy · shy`,
  each reshaping the eyes / brows / mouth and shifting the colour.
- **Actions** — `shake` and `bounce` cues.
- **Live interaction** — blinks with real eyelids, eyes track the cursor,
  poke to jiggle, drag to fling with squash-and-stretch.
- **Password demo** — the slime shyly covers its eyes while you type, turns
  red and shakes on a wrong password, bounces happily on the right one
  (the password is `claude`).

## Run locally

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

## Usage

```jsx
import JellyBlob from './JellyBlob'

<JellyBlob size={300} hue={265} mood="angry" cue={{ type: 'shake', id: Date.now() }} />
```

Built with React + Vite.
