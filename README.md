# Red Dwarf Mission Status Dashboard

Smeggin' hell, welcome to the dashboard. This is what happens when you've got
too many sensors in your house, a curry in the microwave, and nothing good on
the telly. Basically it's a starship HUD for real life.

## What it does

Shoves all this onto one screen so you don't have to click around like a
smeghead:

- **Ship status** — temperature, humidity, power usage, gas consumption, wind,
  pressure, rain, UV. All piped in from Home Assistant. Holly says it's
  "running at peak efficiency" which probably means it's about to explode.
- **Destination weather** — three UK spots worth knowing about: Altrincham,
  Overseal, and Llandudno. Rimmer keeps asking why Llandudno's on there. He
  wouldn't get it.
- **The Register headlines** — the latest tech news. Good toilet reading.
- **Metrolink tram alerts** — so you know if the bloody trams are delayed again.
- **Crew status** — five indicator lights for the holoship crew. Green means
  they're functional. Red means... well, you know.
- **Crew quotes** — random bits of wisdom from the lads. Or Holly, more likely.

## How it works (dead simple)

```
cron job  ──→  collect.py  ──→  data.json  ──→  index.html + CSS + JS
   ↑                ↑
  every 5    Home Assistant
  minutes    + wttr.in + The Register RSS
```

**collect.py** — runs every 5 minutes via the server's cron. Grabs sensor data
from Home Assistant, weather from wttr.in, headlines from The Register's RSS
feed, and tram alerts from Transport for Greater Manchester's API. Chucks it
all into `data.json`.

**data.json** — the middleman. Static file that the frontend reads. That's it.
No database, no backend, no headache.

**index.html + style.css + main.js + design.js** — the frontend. Loads
`data.json`, renders the whole lot in a retro-styled dashboard that looks like
it belongs on a 1980s spaceship console. The Cat designed the UI so it's
immaculate. Obviously.

## Tech stack

- **Python 3** — for the collector. Kryten wrote it, so it's tidy. He even
  commented the code. Smegging show-off.
- **Plain HTML/CSS/JS** — no frameworks, no build tools, no nonsense. Served
  as static files. Loads instantly.
- **Home Assistant** — feeds the ship sensors via REST API.
- **wttr.in** — dead simple weather API, just curl and go.
- **The Register RSS** — scraped and parsed. For the headlines.
- **Netlify** — free hosting, zero config, deploys from a git push. Rimmer set
  up the CI pipeline and he won't shut up about it.

## How to deploy to Netlify

This is the easy bit. Even Rimmer can do it, and he's a hologram.

1. Push this repo to your GitHub/GitLab/whatever.
2. Go to [netlify.com](https://netlify.com), click "Add new site" → "Import
   an existing project".
3. Connect your git provider and pick the repo.
4. Netlify auto-detects the `netlify.toml` config — it's already there.
   Publish directory is `/`, no build command needed. It's just static files.
5. Click "Deploy site". Done.

Every time you push to the main branch, Netlify re-deploys automatically.
Rimmer calls it "continuous delivery and I am the delivery boy". We just
ignore him.

**One thing** — the `data.json` file is generated on your server, not in the
Netlify build. So you need to either:

- **Option A** (easy): Run the cron job on a machine you control (a Raspberry
  Pi, an old laptop, whatever). Every 5 minutes it runs `collect.py` and
  `scp`s or `rsync`s the resulting `data.json` to wherever this repo lives.
  Then `git push`. The Netlify hook triggers and boom, fresh data.
- **Option B** (simpler): Host the whole thing on the same machine that runs
  cron and serve it with Python's `http.server`. Doesn't need Netlify at all.
- **Option C** (laziest): Put the repo on Netlify, run the cron on your server
  and have it `curl` the data to Netlify Functions or a hosted JSON endpoint.
  Or just let `data.json` go stale and have a nice cup of tea instead.

I use Option A because I can set it and forget it and go eat a vindaloo.

## Who built this

- **Rimmer** — did the CI/CD and Netlify config. Won't let anyone forget it.
- **Cat** — designed the UI. It's beautiful. He knows it.
- **Kryten** — wrote the data collector. Proper engineering, silicon-matic
  precision.
- **Lister** — wrote the docs. Had a curry halfway through. You can tell.

## Licence

MIT or whatever. Look, I just wanted a dashboard that tells me the weather
while I'm eating a korma. Do what you want with it.