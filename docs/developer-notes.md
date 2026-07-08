# RampReady Developer Notes

## Current development workflow

RampReady is being developed in small, verifiable patches.

When a larger GitHub write is blocked or fails, the next step is to split the work into smaller commits until a safe patch lands. Every pass should favor:

1. verifying the active app path,
2. making the smallest useful fix,
3. checking that the change is committed,
4. keeping the clean pushback trainer focused on aircraft, tug, ground, controls, and verification before scenery is reintroduced.

## Active app path

`src/App.jsx` imports `src/components/PushbackTrainer.jsx`.

`src/components/PushbackTrainer.jsx` intentionally routes to `src/components/RampReadyTrainer.jsx` so old imports keep working while the clean trainer evolves.

## Verification

Run:

```bash
npm run verify
npm run build
```

The custom verification script checks the current trainer wiring, Netlify config, clean-scene assumptions, and required control markers.
