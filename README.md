# Decibel Meter — Frontend Sample

A modern dark dashboard matching the supplied reference design, built with plain HTML, CSS and JavaScript.

## Included
- Live microphone meter using the browser Web Audio API
- Animated 0–120 dB gauge
- Live sound graph with 1m / 5m / 10m / 30m ranges
- Start / Stop controls
- Recording timer
- Sensitivity slider + quick presets
- Recent measurement history stored in `localStorage`
- Delete history records
- Light/dark appearance toggle
- Responsive layout for desktop/tablet/mobile

## Run
Use a local web server because microphone permissions generally require HTTPS or localhost.

Example with VS Code Live Server:
1. Open this folder in VS Code.
2. Start Live Server.
3. Open the generated localhost URL.
4. Click **Start** and allow microphone access.

Or with Python:

```bash
python -m http.server 8000
```
Then open `http://localhost:8000`.

## Accuracy note
The browser microphone gives normalized audio samples; this demo converts RMS amplitude to an **estimated** dB value. It is not a calibrated sound pressure level meter. For accurate absolute SPL readings, use a calibrated sound-level meter and calibrate the software against it.
