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
- **Glassmorphism "Log Out?" modal** — a frosted liquid-glass card where the
  slime reacts to the buttons: happy + bounce on *Cancel*, sad + shake on
  *Log Out*, with a glass speech bubble. Colour swatches re-skin it live.
- **Password (demo constant)** — `sample`.

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
