# RampReady

RampReady is an airport ramp training simulator prototype. The first working scenario is a CRJ700 pushback using a towbarless Lektro-style tug.

## Current scenario

- Visual equipment check
- Nose gear/cradle alignment
- Clearance and brake release flow
- Pushback along the centerline
- Stop-line brake set
- Disconnect and scored session report

## Run locally

```bash
npm install
npm run dev
```

Then open the Vite local URL.

## Controls

Keyboard:

- `W` / `ArrowUp`: throttle forward
- `S` / `ArrowDown`: reverse
- `A` / `ArrowLeft`: steer left
- `D` / `ArrowRight`: steer right
- `Space`: brake

Touch controls are included on screen.

## Deployment options

This is a normal Vite React app, so it should be easy to host on:

- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages

For the fastest path, Vercel or Netlify is easiest: connect the GitHub repo, use `npm run build`, and publish the `dist` folder.

## First-pass fixes from the uploaded prototype

The uploaded base was a single large React/Three component that technically worked but had bugs. This repo keeps the same trainer idea but makes it deployable and easier to patch:

- connected aircraft now moves with the tug cradle so the stop line can actually be reached
- rear lights are positioned on the rear light bar
- keyboard driving controls no longer scroll the page
- reset clears runtime state
- project is scaffolded as a standard Vite React app
- first pass uses a lightweight CRJ placeholder model instead of the huge embedded aircraft payload so deployment and iteration stay simple
