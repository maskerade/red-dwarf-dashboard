/**
 * Red Dwarf Dashboard — main.js
 * Data fetching, panel population, ticker, quote, clock
 */
(function () {
  'use strict';

  // --- DOM refs ---
  const $ = (id) => document.getElementById(id);

  // --- Units & formatting for ship data ---
  const UNIT_MAP = {
    indoor_temp:       { suffix: '°C',     decimals: 1 },
    indoor_humidity:   { suffix: '%',      decimals: 0 },
    outdoor_temp:      { suffix: '°C',     decimals: 1 },
    outdoor_humidity:  { suffix: '%',      decimals: 0 },
    wind_speed:        { suffix: ' km/h',  decimals: 1 },
    wind_direction:    { suffix: '°',      decimals: 0, raw: true },
    pressure:          { suffix: ' hPa',   decimals: 0 },
    rain_today:        { suffix: ' mm',    decimals: 1 },
    uv_index:          { suffix: '',       decimals: 1 },
    power_usage:       { suffix: ' kWh',   decimals: 1 },
    gas_consumption:   { suffix: ' m³',    decimals: 1 },
    heating_active:    { suffix: '',       boolean: true },
  };

  /**
   * Format a ship value for display
   */
  function formatShipValue(key, value) {
    const cfg = UNIT_MAP[key];
    if (!cfg) return value ?? '--';

    // Null / undefined
    if (value === null || value === undefined) {
      return { text: 'OFFLINE', cls: 'null-value' };
    }

    // Boolean field
    if (cfg.boolean) {
      return value
        ? { text: 'ACTIVE', cls: '' }
        : { text: 'STANDBY', cls: 'null-value' };
    }

    // Wind direction — cardinal + arrow
    if (key === 'wind_direction') {
      const num = Number(value);
      if (isNaN(num)) return { text: 'ERR', cls: 'null-value' };
      const directions = ['N','NNE','NE','ENE','E','ESE','SE','SSE',
                          'S','SSW','SW','WSW','W','WNW','NW','NNW'];
      const idx = Math.round(num / 22.5) % 16;
      const cardinal = directions[idx];
      return { text: cardinal + ' ' + degArrow(num), cls: 'wind-rose' };
    }

    // Number formatting
    let num = Number(value);
    if (isNaN(num)) return { text: 'ERR', cls: 'null-value' };

    let text;
    if (cfg.raw) {
      text = String(Math.round(num));
    } else {
      text = num.toFixed(cfg.decimals);
    }
    text += cfg.suffix;
    return { text, cls: '' };
  }

  function degArrow(deg) {
    // Returns directional arrow based on angle
    if (deg >= 337.5 || deg < 22.5) return '↑';
    if (deg < 67.5) return '↗';
    if (deg < 112.5) return '→';
    if (deg < 157.5) return '↘';
    if (deg < 202.5) return '↓';
    if (deg < 247.5) return '↙';
    if (deg < 292.5) return '←';
    return '↖';
  }

  /**
   * Populate ship diagnostic panel
   */
  function renderShip(data) {
    const house = data.house || {};
    for (const key of Object.keys(UNIT_MAP)) {
      const el = $('ship-' + key);
      if (!el) continue;
      const result = formatShipValue(key, house[key]);
      el.textContent = result.text;
      el.className = 'ship-value' + (result.cls ? ' ' + result.cls : '');
    }
  }

  // ── Astronomy rendering ───────────────────────────────────────────
  function getMoonIcon(phase) {
    if (!phase) return '';
    const p = phase.toLowerCase();
    if (p.includes('new')) return '\uD83C\uDF11';   // 🌑
    if (p.includes('waxing crescent')) return '\uD83C\uDF12'; // 🌒
    if (p.includes('first quarter')) return '\uD83C\uDF13'; // 🌓
    if (p.includes('waxing gibbous')) return '\uD83C\uDF14'; // 🌔
    if (p.includes('full')) return '\uD83C\uDF15';   // 🌕
    if (p.includes('waning gibbous')) return '\uD83C\uDF16'; // 🌖
    if (p.includes('last quarter')) return '\uD83C\uDF17'; // 🌗
    if (p.includes('waning crescent')) return '\uD83C\uDF18'; // 🌘
    return '';
  }

  function renderAstronomy(data) {
    const astro = data.astronomy || {};
    const sunriseEl = $('ship-sunrise');
    const sunsetEl = $('ship-sunset');
    const moonEl = $('ship-moon_phase');
    const moonIllumEl = $('ship-moon_illumination');
    const moonriseEl = $('ship-moonrise');
    const moonsetEl = $('ship-moonset');

    if (sunriseEl) {
      sunriseEl.textContent = astro.sunrise || '--';
      sunriseEl.className = 'ship-value';
    }
    if (sunsetEl) {
      sunsetEl.textContent = astro.sunset || '--';
      sunsetEl.className = 'ship-value';
    }
    if (moonEl) {
      const icon = getMoonIcon(astro.moon_phase);
      moonEl.textContent = (icon ? icon + ' ' : '') + (astro.moon_phase || '--');
      moonEl.className = 'ship-value';
    }
    if (moonIllumEl) {
      moonIllumEl.textContent = astro.moon_illumination ? astro.moon_illumination + '%' : '--';
      moonIllumEl.className = 'ship-value';
    }
    if (moonriseEl) {
      const icon = getMoonIcon(astro.moon_phase);
      moonriseEl.textContent = (icon ? icon + ' ' : '') + (astro.moonrise || '--');
      moonriseEl.className = 'ship-value';
    }
    if (moonsetEl) {
      moonsetEl.textContent = astro.moonset || '--';
      moonsetEl.className = 'ship-value';
    }
  }

  // ── Data Source Health Strip (#2) ─────────────────────────────────
    function renderHealthStrip(data) {
      const setDot = (id, status) => {
        const el = $('health-' + id);
        if (!el) return;
        el.className = 'health-dot ' + status;
      };

      // HA sensors: at least 8 ship keys have values
      const house = data.house || {};
      const haKeys = Object.keys(house).filter(k => house[k] !== null && house[k] !== undefined);
      setDot('ha', haKeys.length >= 8 ? 'online' : haKeys.length > 0 ? 'stale' : 'offline');

      // Weather: at least 1 location has temp
      const locs = data.locations || {};
      const weatherOk = Object.values(locs).some(l => l.temp !== null && l.temp !== undefined);
      setDot('weather', weatherOk ? 'online' : 'stale');

      // Headlines: array with items
      const hl = data.headlines || [];
      setDot('headlines', hl.length > 0 ? 'online' : 'stale');

      // Quote: crew_quote string present
      setDot('quote', data.crew_quote ? 'online' : 'stale');
    }

    // ── Weather Trend Arrows (#3) ────────────────────────────────────
    const TREND_KEYS = ['indoor_temp', 'outdoor_temp', 'pressure', 'indoor_humidity'];
    const TREND_STORAGE_KEY = 'rdwd_trends';

    function renderTrendArrows(data) {
      const house = data.house || {};
      const prev = JSON.parse(localStorage.getItem(TREND_STORAGE_KEY) || '{}');
      const curr = {};

      for (const key of TREND_KEYS) {
        const val = house[key];
        if (val === null || val === undefined) continue;
        curr[key] = Number(val);

        const prevVal = prev[key];
        if (prevVal !== undefined && !isNaN(prevVal)) {
          const el = $('ship-' + key);
          if (!el) continue;
          const diff = curr[key] - prevVal;
          // Remove old trend span
          const oldSpan = el.querySelector('.trend-up, .trend-down, .trend-flat');
          if (oldSpan) oldSpan.remove();

          const span = document.createElement('span');
          if (Math.abs(diff) < 0.3) {
            span.className = 'trend-flat';
            span.textContent = '➡';
          } else if (diff > 0) {
            span.className = 'trend-up';
            span.textContent = '▲';
          } else {
            span.className = 'trend-down';
            span.textContent = '▼';
          }
          el.appendChild(span);
        }
      }

      // Save current values for next comparison
      localStorage.setItem(TREND_STORAGE_KEY, JSON.stringify(curr));
    }
  function getWeatherIcon(conditions) {
    if (!conditions) return '';
    const c = conditions.toLowerCase();
    if (c.includes('sunny') || c.includes('clear')) return '\u2600';       // ☀
    if (c.includes('partly cloudy')) return '\u26C5';                      // ⛅
    if (c.includes('cloudy') || c.includes('overcast')) return '\u2601';   // ☁
    if (c.includes('thunder') || c.includes('storm')) return '\u26C8';     // ⛈
    if (c.includes('heavy rain') || c.includes('torrential')) return '\uD83C\uDF27'; // 🌧
    if (c.includes('light rain') || c.includes('drizzle')) return '\uD83C\uDF26';    // 🌦
    if (c.includes('rain')) return '\uD83C\uDF27';                         // 🌧
    if (c.includes('snow') || c.includes('sleet') || c.includes('ice')) return '\u2744'; // ❄
    if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return '\uD83C\uDF2B'; // 🌫
    if (c.includes('wind') || c.includes('breez')) return '\uD83C\uDF2C';  // 🌬
    return '';  // unknown — show no icon
  }

  /**
   * Populate destination weather cards
   */
  function renderWeather(data) {
    const locations = data.locations || {};
    for (const [loc, info] of Object.entries(locations)) {
      const tempEl  = $('weather-' + loc + '-temp');
      const condEl  = $('weather-' + loc + '-conditions');
      if (tempEl) {
        if (info.temp !== null && info.temp !== undefined) {
          tempEl.textContent = Number(info.temp).toFixed(1) + '°C';
        } else {
          tempEl.textContent = '--';
        }
      }
      if (condEl) {
        if (info.conditions) {
          const icon = getWeatherIcon(info.conditions);
          const iconHtml = icon ? '<span class="weather-icon">' + icon + '</span> ' : '';
          condEl.innerHTML = iconHtml + info.conditions;
          condEl.className = 'weather-cond';
        } else {
          condEl.textContent = 'NO DATA';
          condEl.className = 'weather-cond null-value';
        }
      }
    }
  }

  // ── DECK ENTERTAINMENT ──────────────────────────────────────────
  // Data arrays
  const IQ_REASONS = [
    'NOMINAL', 'RECALCULATING PI', 'THINKING ABOUT TOAST',
    'RUNNING DIAGNOSTIC', 'COUNTING STARS', 'PONDERING EXISTENCE',
    'IQ DIP — COFFEE BREAK', 'SIMULATING CHESS GAME',
    'ANALYSING LISTER\'S LAUNDRY', 'CALCULATING ODDS OF SURVIVAL',
    'OVERCLOCKING... IQ: 6001', 'DEFRAGGING MEMORY BANKS',
    'WONDERING WHY RIMMER EXISTS', 'PROCESSING "SMEG" ETYMOLOGY',
  ];

  const DIRECTIVES = [
    'No. 271: No jaywalking in deep space.',
    'No. 34: All personnel must salute the vending machine.',
    'No. 892: Holograms are not entitled to tea breaks.',
    'No. 12: Curry consumption must be logged in triplicate.',
    'No. 456: Mirror admiration sessions limited to 4 hours.',
    'No. 73: Toast is not a breakfast item — it is a lifestyle.',
    'No. 618: Any crew member turning into a wax dummy must report to sick bay.',
    'No. 201: Space Corps Directive 201 — never talk about Space Corps Directive 201.',
    'No. 999: In the event of a total existential crisis, refer to Directive 1.',
    'No. 1: The needs of the many outweigh the needs of the few. Or the one.',
    'No. 47: All cleaning robots must be addressed as "sir" at all times.',
    'No. 88: Hologram stability is inversely proportional to ego size.',
    'No. 314: Any curry older than 3 weeks must be declared a biohazard.',
    'No. 555: The Cat is exempt from all Space Corps Directives.',
  ];

  const CURRY_NAMES = [
    'VINDALOO', 'CHICKEN TIKKA MASALA', 'LAMB BHUNA', 'PRAWN KORMA',
    'SAG ALOO', 'DAAL MAKHANI', 'BEEF MADRAS', 'ROGAN JOSH',
    'CHICKEN JALFREZI', 'PALAK PANEER', 'BIRYANI', 'KEEMA NAAN',
    'ONION BHAJI SPECIAL', 'LISTER\'S MYSTERY CURRY',
  ];

  const CAT_COMMENTS = [
    'FABULOUS', 'STUNNING', 'MAGNIFICENT', 'DAZZLING', 'PERFECT',
    'IRRESISTIBLE', 'GORGEOUS', 'SPECTACULAR', 'BREATHTAKING',
    'THE BEST I\'VE EVER LOOKED', 'AN ABSOLUTE MASTERPIECE',
    'EVEN BETTER THAN YESTERDAY', 'A WORK OF ART',
  ];

  const CLEANING_TASKS = [
    'Polished 847 rivets on Deck 7',
    'Waxed the floor — again',
    'Disinfected Rimmer\'s ego',
    'Reorganised the cutlery drawer by size, colour, and purpose',
    'Dusted Holly\'s IQ display',
    'Cleaned 3 million years of stardust off the viewscreen',
    'Ironed Lister\'s string vest (again)',
    'Sanitised the Cat\'s mirror collection',
    'Re-folded all towels into perfect right angles',
    'Polished Starbug\'s nose cone',
    'Vacuumed the cargo bay (found 47 lost socks)',
    'De-greased the curry machine',
    'Windexed the hologram projection array',
    'Organised the spice rack alphabetically by heat level',
  ];

  const STARBUG_EXCUSES = [
    'FLUX CAPACITOR NEEDS RECALIBRATING',
    'ENGINE WARMING UP',
    'NAV COMPUTER RUNNING DIAGNOSTIC',
    'FUEL MIXTURE OPTIMISING',
    'STARBUG FEELING SHY TODAY',
    'WAITING FOR LISTER TO FINISH HIS CURRY',
    'HULL INTEGRITY CHECK IN PROGRESS',
    'THRUSTERS AT STANDBY',
    'ALL SYSTEMS NOMINAL',
    'JUST NEEDS A GOOD WAX',
  ];

  const EPISODES = [
    { title: 'The End', series: 'S1E1' },
    { title: 'Future Echoes', series: 'S1E2' },
    { title: 'Balance of Power', series: 'S1E3' },
    { title: 'Waiting for God', series: 'S1E4' },
    { title: 'Confidence and Paranoia', series: 'S1E5' },
    { title: 'Me²', series: 'S1E6' },
    { title: 'Kryten', series: 'S2E1' },
    { title: 'Better Than Life', series: 'S2E2' },
    { title: 'Thanks for the Memory', series: 'S2E4' },
    { title: 'Queeg', series: 'S2E6' },
    { title: 'Backwards', series: 'S3E1' },
    { title: 'Marooned', series: 'S3E2' },
    { title: 'Polymorph', series: 'S3E3' },
    { title: 'Timeslides', series: 'S3E5' },
    { title: 'The Last Day', series: 'S3E6' },
    { title: 'Camille', series: 'S4E1' },
    { title: 'DNA', series: 'S4E4' },
    { title: 'Justice', series: 'S4E5' },
    { title: 'White Hole', series: 'S4E6' },
    { title: 'Quarantine', series: 'S5E2' },
    { title: 'Demons & Angels', series: 'S5E3' },
    { title: 'Back to Reality', series: 'S5E5' },
    { title: 'Psirens', series: 'S5E6' },
    { title: 'Gunmen of the Apocalypse', series: 'S6E3' },
    { title: 'Emohawk: Polymorph II', series: 'S6E4' },
    { title: 'Out of Time', series: 'S6E6' },
    { title: 'Tikka to Ride', series: 'S7E3' },
    { title: 'Ouroboros', series: 'S7E5' },
    { title: 'Only the Good...', series: 'S8E8' },
    { title: 'The Promised Land', series: 'Special' },
  ];

  const LOG_ENTRIES = [
    '[CREW] Lister requested curry for breakfast again',
    '[CREW] Cat found a new hat — declared it "the one"',
    '[CREW] Rimmer filed complaint about the lack of proper respect',
    '[CREW] Kryten reorganised the cutlery drawer',
    '[SYSTEM] Holly\'s IQ fluctuating — within normal parameters',
    '[CREW] Lister\'s laundry has developed its own ecosystem',
    '[CREW] Cat spent 4 hours in front of the mirror',
    '[CREW] Rimmer attempted to form a committee. It was ignored.',
    '[SYSTEM] Starbug passed pre-flight check (barely)',
    '[CREW] Kryten offered toast to everyone. Again.',
    '[CREW] Lister claims he\'ll clean his bunk "tomorrow"',
    '[CREW] Cat declared today "a good fur day"',
    '[SYSTEM] Radiation levels nominal (for deep space)',
    '[CREW] Rimmer is writing a new Space Corps Directive',
    '[CREW] Kryten has polished the same rivet 847 times',
    '[CREW] Lister is trying to grow a plant in his locker',
    '[CREW] Cat is considering a wardrobe change (again)',
    '[SYSTEM] Holly running background diagnostics',
    '[CREW] Rimmer\'s ego has exceeded safe levels',
    '[CREW] Kryten has prepared a 14-day cleaning schedule',
  ];

  let smegCount = 0;
  let logIndex = 0;
  let cleaningIndex = 0;
  let episodeIndex = Math.floor(Math.random() * EPISODES.length);

  // ── Daily items (set once on page load) ──────────────────────
  function renderDeckDaily() {
    // Rimmer's Directive — one per day
    const dirEl = $('deck-directive');
    if (dirEl) {
      dirEl.textContent = DIRECTIVES[Math.floor(Math.random() * DIRECTIVES.length)];
    }

    // Episode of the Day — one per day
    const epEl = $('deck-episode');
    const epSeriesEl = $('deck-episode-series');
    if (epEl && epSeriesEl) {
      const ep = EPISODES[Math.floor(Math.random() * EPISODES.length)];
      epEl.textContent = ep.title;
      epSeriesEl.textContent = ep.series;
    }

    // Curry name — one per day
    const curryNameEl = $('deck-curry-name');
    if (curryNameEl) {
      curryNameEl.textContent = CURRY_NAMES[Math.floor(Math.random() * CURRY_NAMES.length)];
    }
  }

  // ── Every-30s items ──────────────────────────────────────────
  function renderDeckPerMinute() {
    // 1. Smeg Counter — slow increment
    smegCount += Math.floor(Math.random() * 2) + 1;
    const smegEl = $('deck-smeg');
    if (smegEl) smegEl.textContent = smegCount.toLocaleString();

    // 6. Kryten's Cleaning Log — cycle task
    const cleaningEl = $('deck-cleaning');
    if (cleaningEl) {
      cleaningIndex = (cleaningIndex + 1) % CLEANING_TASKS.length;
      cleaningEl.textContent = '▸ ' + CLEANING_TASKS[cleaningIndex];
    }

    // 8. Radiation Level
    const radEl = $('deck-radiation');
    if (radEl) {
      const spike = Math.random() < 0.1; // 10% chance
      const base = 0.08 + Math.random() * 0.15;
      const val = spike ? base + Math.random() * 0.5 : base;
      radEl.textContent = val.toFixed(2);
      radEl.className = 'deck-value' + (spike ? ' spike' : '');
    }

    // 10. Ship's Log — new entry
    const logEl = $('deck-log');
    if (logEl) {
      logIndex = (logIndex + 1) % LOG_ENTRIES.length;
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.textContent = LOG_ENTRIES[logIndex];
      logEl.appendChild(entry);
      while (logEl.children.length > 20) {
        logEl.removeChild(logEl.firstChild);
      }
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  // ── Every-8s items (subtle live updates) ─────────────────────
  function renderDeckFrequent() {
    // 2. Holly's IQ
    const iqEl = $('deck-iq');
    const iqReasonEl = $('deck-iq-reason');
    if (iqEl) {
      const fluctuation = Math.floor(Math.random() * 11) - 5;
      iqEl.textContent = 6000 + fluctuation;
      iqEl.style.color = fluctuation === 0 ? 'var(--cyan)' : fluctuation > 0 ? 'var(--green)' : 'var(--amber)';
    }
    if (iqReasonEl) {
      iqReasonEl.textContent = IQ_REASONS[Math.floor(Math.random() * IQ_REASONS.length)];
    }

    // 4. Curry Readiness gauge — time-based
    const curryGauge = $('deck-curry-gauge');
    if (curryGauge) {
      const hour = new Date().getHours();
      let readiness;
      if (hour >= 11 && hour <= 14) readiness = 70 + Math.floor(Math.random() * 25);
      else if (hour >= 17 && hour <= 21) readiness = 80 + Math.floor(Math.random() * 20);
      else if (hour >= 6 && hour <= 10) readiness = 20 + Math.floor(Math.random() * 30);
      else readiness = 10 + Math.floor(Math.random() * 20);
      curryGauge.style.width = readiness + '%';
      curryGauge.style.background = readiness > 70
        ? 'linear-gradient(90deg, var(--red), var(--amber))'
        : 'linear-gradient(90deg, var(--red-dim), var(--amber-dim))';
    }

    // 5. Cat's Mirror Time
    const catEl = $('deck-cat');
    const catCommentEl = $('deck-cat-comment');
    if (catEl) {
      catEl.textContent = (95 + Math.random() * 5).toFixed(1) + '%';
    }
    if (catCommentEl) {
      catCommentEl.textContent = CAT_COMMENTS[Math.floor(Math.random() * CAT_COMMENTS.length)];
    }

    // 7. Starbug Readiness
    const starbugGauge = $('deck-starbug-gauge');
    const starbugReasonEl = $('deck-starbug-reason');
    if (starbugGauge) {
      const readiness = 60 + Math.floor(Math.random() * 36);
      starbugGauge.style.width = readiness + '%';
      starbugGauge.style.background = readiness > 85
        ? 'linear-gradient(90deg, var(--amber), var(--green))'
        : 'linear-gradient(90deg, var(--red), var(--amber))';
    }
    if (starbugReasonEl) {
      starbugReasonEl.textContent = STARBUG_EXCUSES[Math.floor(Math.random() * STARBUG_EXCUSES.length)];
    }
  }

  // ── Toast-O-Matic state ────────────────────────────────────────
  let toastCount = 0;
  const TOAST_MESSAGES = [
    'Would anyone like any toast?',
    'Toast, sirs? Freshly toasted!',
    'I have prepared toast. Would you care for some?',
    'Toast is ready. I used the good bread.',
    'I\'ve taken the liberty of making toast.',
    'More toast? I anticipated this request.',
    'Toast! Lovely, lovely toast!',
    'I\'ve calibrated the toaster to perfection.',
    'A fresh batch of toast, sir. Golden brown.',
    'Toast — the universal constant.',
    'Crumpets are also available, but toast is preferable.',
    'Your toast, sir. I\'ve buttered it diagonally.',
    'I\'ve prepared toast with a variety of preserves.',
    'Toast. Because everything else is just bread.',
    'The toaster and I have reached an understanding.',
  ];

  function setupToast() {
    const btn = $('toast-btn');
    const msg = $('toast-message');
    const gauge = $('toast-gauge');
    const quality = $('toast-quality');
    const count = $('toast-count');

    if (!btn) return;

    btn.addEventListener('click', function() {
      toastCount++;
      if (count) count.textContent = toastCount;

      // Random toast message
      if (msg) {
        msg.style.opacity = '0';
        setTimeout(() => {
          msg.textContent = TOAST_MESSAGES[Math.floor(Math.random() * TOAST_MESSAGES.length)];
          msg.style.opacity = '1';
        }, 200);
      }

      // Toast quality gauge wobbles
      if (gauge) {
        const qualityPct = 50 + Math.floor(Math.random() * 46);
        gauge.style.width = qualityPct + '%';
        gauge.style.background = qualityPct > 80
          ? 'linear-gradient(90deg, var(--amber), var(--green))'
          : qualityPct > 60
          ? 'linear-gradient(90deg, var(--red), var(--amber))'
          : 'linear-gradient(90deg, var(--red-dim), var(--red))';
      }

      // Quality comment
      if (quality) {
        const comments = ['PERFECTLY TOASTED', 'GOLDEN BROWN', 'SLIGHTLY CRISPY', 'A BIT DARK', 'ALMOST BURNT', 'EXQUISITE', 'JUST RIGHT'];
        quality.textContent = 'TOAST QUALITY: ' + comments[Math.floor(Math.random() * comments.length)];
      }
    });
  }

  // ── Condition Threshold Alarms (#3, Kryten) ─────────────────────
  const THRESHOLDS = {
    wind_speed:       { amber: 30,  red: 50 },
    indoor_humidity:  { amber: 70,  red: 85 },
    outdoor_humidity: { amber: 80,  red: 95 },
    pressure:         { amber_min: 990, amber_max: 1030, red_min: 975, red_max: 1045 },
    rain_today:       { amber: 5,   red: 15 },
    uv_index:         { amber: 6,   red: 8 },
    power_usage:      { amber: 500, red: 1000 },
  };

  function renderThresholdAlarms(data) {
    const house = data.house || {};
    for (const [key, threshold] of Object.entries(THRESHOLDS)) {
      const val = house[key];
      if (val === null || val === undefined) continue;
      const num = Number(val);
      if (isNaN(num)) continue;

      const item = document.querySelector(`.ship-item[data-key="${key}"]`);
      if (!item) continue;

      item.classList.remove('alert-amber', 'alert-red');

      let isAlert = false;
      if (threshold.amber !== undefined && num >= threshold.amber) {
        item.classList.add(num >= threshold.red ? 'alert-red' : 'alert-amber');
        isAlert = true;
      } else if (threshold.amber_min !== undefined) {
        if (num <= threshold.amber_min || num >= threshold.amber_max) {
          item.classList.add((num <= threshold.red_min || num >= threshold.red_max) ? 'alert-red' : 'alert-amber');
          isAlert = true;
        }
      }
    }
  }

  // ── Mini Sparkline Trends (#2, Holly) ──────────────────────────
  const SPARKLINE_KEYS = ['indoor_temp', 'outdoor_temp', 'pressure', 'indoor_humidity', 'wind_speed', 'power_usage'];
  const SPARKLINE_MAX = 288; // 24h at 5-min intervals

  function setupSparklineWrappers() {
    for (const key of SPARKLINE_KEYS) {
      const el = $(key === 'indoor_temp' ? 'ship-indoor_temp' : 'ship-' + key);
      if (!el) continue;
      const parentSpan = el.parentElement;
      if (!parentSpan) continue;
      // Check if wrapper already exists
      if (parentSpan.querySelector('.ship-sparkline-wrap')) continue;
      const wrap = document.createElement('span');
      wrap.className = 'ship-sparkline-wrap';
      wrap.innerHTML = '<svg viewBox="0 0 40 16" preserveAspectRatio="none"><polyline fill="none" class="spark-flat" points="0,8 40,8" /></svg>';
      parentSpan.appendChild(wrap);
    }
  }

  function renderSparklines(data) {
    const house = data.house || {};
    const stored = JSON.parse(localStorage.getItem('rdwd_sparklines') || '{}');
    const now = Date.now();

    for (const key of SPARKLINE_KEYS) {
      const val = house[key];
      if (val === null || val === undefined) continue;
      if (!stored[key]) stored[key] = [];

      // Add current value with timestamp
      stored[key].push({ v: Number(val), t: now });

      // Trim to 24h
      const cutoff = now - 86400000;
      stored[key] = stored[key].filter(p => p.t >= cutoff);

      // Keep max SPARKLINE_MAX
      if (stored[key].length > SPARKLINE_MAX) {
        stored[key] = stored[key].slice(-SPARKLINE_MAX);
      }
    }

    localStorage.setItem('rdwd_sparklines', JSON.stringify(stored));

    // Render SVGs
    for (const key of SPARKLINE_KEYS) {
      const points = stored[key];
      if (!points || points.length < 2) continue;

      const el = $(key === 'indoor_temp' ? 'ship-indoor_temp' : 'ship-' + key);
      if (!el) continue;
      const parentSpan = el.parentElement;
      if (!parentSpan) continue;
      const wrap = parentSpan.querySelector('.ship-sparkline-wrap');
      if (!wrap) continue;

      const values = points.map(p => p.v);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = (max - min) || 1;
      const w = 40, h = 16;

      // Build polyline points
      const stepX = w / (values.length - 1);
      const pts = values.map((v, i) => {
        const x = i * stepX;
        const y = h - ((v - min) / range) * (h - 2) - 1;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');

      // Determine trend color
      const trend = values[values.length - 1] - values[0];
      const cls = Math.abs(trend) < 0.5 ? 'spark-flat' : trend > 0 ? 'spark-up' : 'spark-down';

      wrap.innerHTML = `<svg viewBox="0 0 40 16" preserveAspectRatio="none">
        <polyline fill="none" stroke-width="1.5" class="${cls}" points="${pts}" />
      </svg>`;
    }
  }

  // ── Digital Pot Plant (#1, Lister) ─────────────────────────────
  const PLANT_STAGES = [
    { emoji: '🌰', stage: 'SEED',       waterNeeded: 0 },
    { emoji: '🌱', stage: 'SPROUT',     waterNeeded: 1 },
    { emoji: '🌿', stage: 'SEEDLING',   waterNeeded: 3 },
    { emoji: '🪴', stage: 'YOUNG PLANT', waterNeeded: 6 },
    { emoji: '🌳', stage: 'FULL GROWN', waterNeeded: 12 },
    { emoji: '🌺', stage: 'BLOOMING',   waterNeeded: 20 },
  ];

  function renderPotPlant() {
    const stored = JSON.parse(localStorage.getItem('rdwd_potplant') || '{"refreshCount":0,"lastWaterDay":""}');
    const plantArt = $('plant-art');
    const plantStage = $('plant-stage');
    const plantRefreshes = $('plant-refreshes');
    const waterFill = $('plant-water-fill');

    if (!plantArt) return;

    // Increment refresh count
    stored.refreshCount = (stored.refreshCount || 0) + 1;

    // Watering: once per day
    const today = new Date().toDateString();
    if (stored.lastWaterDay !== today) {
      stored.lastWaterDay = today;
    }

    const todayWatered = stored.lastWaterDay === today;
    const waterPct = todayWatered ? Math.min(100, (stored.refreshCount / 24) * 100) : 50;

    // Determine growth stage
    let stageIdx = 0;
    for (let i = PLANT_STAGES.length - 1; i >= 0; i--) {
      if (stored.refreshCount >= PLANT_STAGES[i].waterNeeded) {
        stageIdx = i;
        break;
      }
    }
    const stage = PLANT_STAGES[stageIdx];

    plantArt.textContent = stage.emoji;
    if (plantStage) {
      plantStage.textContent = stage.stage;
      // Color changes as it grows
      plantStage.style.color = stageIdx < 2 ? 'var(--green-dim)' :
                               stageIdx < 4 ? 'var(--green)' : 'var(--amber)';
    }
    if (plantRefreshes) {
      const nextStage = PLANT_STAGES[stageIdx + 1];
      if (nextStage) {
        plantRefreshes.textContent = `${stored.refreshCount} refreshes (${nextStage.waterNeeded - stored.refreshCount} to next)`;
      } else {
        plantRefreshes.textContent = `${stored.refreshCount} refreshes — FULLY GROWN!`;
      }
    }
    if (waterFill) {
      waterFill.style.width = waterPct + '%';
      waterFill.style.background = todayWatered
        ? 'linear-gradient(90deg, var(--cyan), var(--green))'
        : 'linear-gradient(90deg, var(--red-dim), var(--amber))';
    }

    localStorage.setItem('rdwd_potplant', JSON.stringify(stored));
  }

  // ── Rimmer's Exam Study Clock (#4) ────────────────────────────
  function setupStudyClock() {
    const btn = $('clock-btn');
    const resetBtn = $('clock-reset');
    const timerEl = $('clock-timer');
    const phaseEl = $('clock-phase');
    const logEl = $('clock-log');

    if (!btn || !timerEl) return;

    const STUDY_MS = 25 * 60 * 1000;   // 25 min
    const BREAK_MS = 5 * 60 * 1000;    // 5 min

    let state = JSON.parse(localStorage.getItem('rdwd_studyclock') || '{"running":false,"phase":"study","elapsed":0,"totalStudyMs":0,"startTime":null}');
    let intervalId = null;

    // Restore previous state
    if (state.running && state.startTime) {
      const elapsedSinceStart = Date.now() - state.startTime;
      if (state.phase === 'study') {
        state.elapsed = Math.min(elapsedSinceStart, STUDY_MS);
        if (state.elapsed >= STUDY_MS) {
          // Auto-switch to break if timer expired while away
          state.phase = 'break';
          state.elapsed = 0;
          state.startTime = Date.now();
        }
      } else {
        state.elapsed = Math.min(elapsedSinceStart, BREAK_MS);
        if (state.elapsed >= BREAK_MS) {
          state.phase = 'study';
          state.elapsed = 0;
          state.startTime = Date.now();
        }
      }
      startTimer();
    }

    function updateDisplay() {
      const phaseDuration = state.phase === 'study' ? STUDY_MS : BREAK_MS;
      const remaining = Math.max(0, phaseDuration - state.elapsed);
      const totalSec = Math.round(remaining / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;

      timerEl.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
      timerEl.className = 'clock-timer' + (state.phase === 'break' ? ' break-mode' : '');

      phaseEl.textContent = state.phase === 'study' ? 'STUDY SESSION' : 'BREAK TIME';
      phaseEl.className = 'clock-phase ' + (state.phase === 'study' ? 'study-phase' : 'break-phase');

      btn.textContent = state.running ? '⏸ PAUSE' : '▶ START';

      // Study log
      if (logEl) {
        const totalHrs = Math.floor(state.totalStudyMs / 3600000);
        const totalMins = Math.floor((state.totalStudyMs % 3600000) / 60000);
        logEl.textContent = `STUDY LOG: ${totalHrs}h ${totalMins}m`;
      }

      saveState();
    }

    function startTimer() {
      if (intervalId) clearInterval(intervalId);
      state.running = true;
      state.startTime = Date.now();
      intervalId = setInterval(function() {
        const elapsedSinceStart = Date.now() - state.startTime;
        const phaseDuration = state.phase === 'study' ? STUDY_MS : BREAK_MS;
        state.elapsed = elapsedSinceStart;

        if (state.elapsed >= phaseDuration) {
          // Phase complete
          if (state.phase === 'study') {
            state.totalStudyMs += STUDY_MS;
          }
          state.phase = state.phase === 'study' ? 'break' : 'study';
          state.elapsed = 0;
          state.startTime = Date.now();
        }

        updateDisplay();
      }, 1000);
    }

    function stopTimer() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      state.running = false;
      state.startTime = null;
      updateDisplay();
    }

    function saveState() {
      localStorage.setItem('rdwd_studyclock', JSON.stringify({
        running: state.running,
        phase: state.phase,
        elapsed: state.elapsed,
        totalStudyMs: state.totalStudyMs,
        startTime: state.startTime,
      }));
    }

    // Toggle start/pause
    btn.addEventListener('click', function() {
      if (state.running) {
        // Pause: add elapsed so far
        if (state.startTime) {
          state.elapsed += Date.now() - state.startTime;
        }
        stopTimer();
      } else {
        state.startTime = Date.now();
        startTimer();
      }
    });

    // Reset
    resetBtn.addEventListener('click', function() {
      stopTimer();
      state.elapsed = 0;
      state.phase = 'study';
      state.totalStudyMs = 0;
      state.running = false;
      state.startTime = null;
      updateDisplay();
    });

    // Initial display
    updateDisplay();
  }

  // ── Tonight's Sky Report (#5, Holly) ─────────────────────────
  const CELESTIAL_EVENTS = [
    { desc: 'Venus visible in SW after sunset', time: '21:20' },
    { desc: 'Jupiter high in S sky at midnight', time: '00:15' },
    { desc: 'Mars rising in E around 02:00', time: '02:00' },
    { desc: 'Saturn near the Moon tonight', time: '22:30' },
    { desc: 'ISS pass — look SW at', time: null },
    { desc: 'Pleiades cluster visible in E', time: '23:00' },
    { desc: 'Andromeda Galaxy visible (dark sky)', time: '01:00' },
    { desc: 'Mercury low in W after sunset', time: '20:45' },
    { desc: 'Orion Nebula visible in SE', time: '03:30' },
    { desc: 'Lyrid meteor shower — 10/h', time: '02:00' },
  ];

  let lastIisfetch = 0;
  let lastIssData = null;

  async function renderSkyReport(data) {
    const primaryEl = $('sky-primary');
    const secondaryEl = $('sky-secondary');
    const subEl = $('sky-sub');
    if (!primaryEl) return;

    // Use astronomy data from data.json
    const astro = data.astronomy || {};
    const moonPhase = astro.moon_phase || 'Unknown';
    const sunrise = astro.sunrise || '--';
    const sunset = astro.sunset || '--';

    // Show moon + sunrise/sunset as baseline
    let primary = `${moonPhase} Moon`;
    let secondary = `Sunrise: ${sunrise}  /  Sunset: ${sunset}`;
    let sub = '';

    // Fetch ISS position (throttled to once per 5 min)
    try {
      const now = Date.now();
      if (now - lastIisfetch > 300000) {
        const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
        if (res.ok) {
          lastIssData = await res.json();
        }
        lastIisfetch = now;
      }
    } catch (_) {
      // ISS fetch failed — no big deal
    }

    if (lastIssData && lastIssData.latitude !== undefined) {
      const lat = Number(lastIssData.latitude).toFixed(1);
      const lon = Number(lastIssData.longitude).toFixed(1);
      const alt = Number(lastIssData.altitude).toFixed(0);
      const vis = lastIssData.visibility || 'unknown';

      // Pick a random celestial event (deterministic based on day)
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
      const event = CELESTIAL_EVENTS[dayOfYear % CELESTIAL_EVENTS.length];

      const issLine = `🛰 ISS at ${lat}°, ${lon}° (${alt} km, ${vis})`;
      primary = event.desc + (event.time ? ` ~${event.time}` : '');
      secondary = issLine;
      sub = `🌙 ${moonPhase}  ☀ Rise ${sunrise} / Set ${sunset}`;
    } else {
      sub = `🌙 ${moonPhase}  ☀ Rise ${sunrise} / Set ${sunset}`;
    }

    primaryEl.textContent = primary;
    if (secondaryEl) secondaryEl.textContent = secondary;
    if (subEl) subEl.textContent = sub;
  }

  // ── Weather Alert Banner (#1, Kryten) ───────────────────────────
  const BANNER_ALERT_KEYS = {
    wind_speed:  { amber: 30, red: 50, label: 'Wind Speed' },
    rain_today:  { amber: 5,  red: 15, label: 'Rain Today' },
    uv_index:    { amber: 6,  red: 8,  label: 'UV Index' },
    power_usage: { amber: 500, red: 1000, label: 'Power Usage' },
    indoor_humidity: { amber: 75, red: 90, label: 'Indoor Humidity' },
  };

  function renderWeatherAlertBanner(data) {
    const banner = $('alert-banner');
    const bannerText = $('alert-banner-text');
    const bannerIcon = $('alert-banner-icon');
    const closeBtn = $('alert-banner-close');
    if (!banner || !bannerText) return;

    const house = data.house || {};
    let highestLevel = null;
    let alerts = [];

    for (const [key, cfg] of Object.entries(BANNER_ALERT_KEYS)) {
      const val = house[key];
      if (val === null || val === undefined) continue;
      const num = Number(val);
      if (isNaN(num)) continue;

      if (num >= cfg.red) {
        highestLevel = 'red';
        alerts.push(`${cfg.label}: ${num.toFixed(1)}`);
      } else if (num >= cfg.amber) {
        if (highestLevel !== 'red') highestLevel = 'amber';
        alerts.push(`${cfg.label}: ${num.toFixed(1)}`);
      }
    }

    if (alerts.length === 0) {
      banner.classList.remove('active', 'alert-level-amber', 'alert-level-red');
      return;
    }

    banner.classList.add('active');
    banner.classList.remove('alert-level-amber', 'alert-level-red');
    banner.classList.add('alert-level-' + highestLevel);

    const levelWord = highestLevel === 'red' ? 'CRITICAL' : 'WARNING';
    bannerIcon.textContent = highestLevel === 'red' ? '⚠' : '⚡';
    bannerText.textContent = levelWord + ` — ${alerts.join(', ')}`;

    // Close button
    if (closeBtn) {
      closeBtn.onclick = function() {
        banner.classList.remove('active', 'alert-level-amber', 'alert-level-red');
      };
    }
  }

  // ── Day-at-a-Glance Summary Strip (#2, Holly) ──────────────────
  function renderDayGlance(data) {
    const moonEl = $('glance-moon');
    const sunsetEl = $('glance-sunset');
    const weatherIconEl = $('glance-weather-icon');
    const weatherDigestEl = $('glance-weather-digest');
    if (!moonEl || !sunsetEl) return;

    const astro = data.astronomy || {};
    const moonPhase = astro.moon_phase || 'Unknown';
    const moonIcon = getMoonIcon(moonPhase);

    // Moon
    moonEl.textContent = (moonIcon ? moonIcon + ' ' : '') + moonPhase;

    // Sunset countdown
    if (astro.sunset) {
      try {
        const now = new Date();
        const sunsetMatch = astro.sunset.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (sunsetMatch) {
          let sunsetH = parseInt(sunsetMatch[1], 10);
          const sunsetM = parseInt(sunsetMatch[2], 10);
          const ampm = sunsetMatch[3].toUpperCase();
          if (ampm === 'PM' && sunsetH !== 12) sunsetH += 12;
          if (ampm === 'AM' && sunsetH === 12) sunsetH = 0;
          const sunsetDate = new Date(now);
          sunsetDate.setHours(sunsetH, sunsetM, 0, 0);

          if (sunsetDate > now) {
            const diffMs = sunsetDate - now;
            const hrs = Math.floor(diffMs / 3600000);
            const mins = Math.floor((diffMs % 3600000) / 60000);
            sunsetEl.textContent = `Sunset in ${hrs}h ${mins}m`;
          } else {
            // Already past sunset — show tomorrow
            sunsetEl.textContent = `Sunset was at ${astro.sunset}`;
          }
        } else {
          sunsetEl.textContent = 'Sunset: ' + astro.sunset;
        }
      } catch (_) {
        sunsetEl.textContent = 'Sunset: ' + astro.sunset;
      }
    } else {
      sunsetEl.textContent = 'Sunset: --';
    }

    // Weather digest — best location's conditions
    const locs = data.locations || {};
    let bestLoc = null;
    for (const [loc, info] of Object.entries(locs)) {
      if (info.temp !== null && info.temp !== undefined) {
        bestLoc = { name: loc, temp: info.temp, conditions: info.conditions };
        break;
      }
    }

    if (bestLoc && weatherIconEl && weatherDigestEl) {
      const icon = getWeatherIcon(bestLoc.conditions);
      weatherIconEl.textContent = icon || '☁';
      const locName = bestLoc.name.charAt(0).toUpperCase() + bestLoc.name.slice(1);
      const cond = bestLoc.conditions || 'N/A';
      weatherDigestEl.textContent = `${locName}: ${cond}, ${Number(bestLoc.temp).toFixed(0)}°C`;
    } else if (weatherDigestEl) {
      weatherDigestEl.textContent = 'Weather: --';
    }
  }

  // ── Ambient Ship Hum (#4, Lister) ──────────────────────────────
  let humAudioCtx = null;
  let humOscillator = null;
  let humGain = null;
  let humEnabled = false;

  function setupShipHum() {
    const btn = $('hum-btn');
    if (!btn) return;

    btn.addEventListener('click', function() {
      if (humEnabled) {
        stopHum();
        btn.textContent = '🔇';
        btn.classList.remove('active');
        humEnabled = false;
      } else {
        startHum();
        btn.textContent = '🔊';
        btn.classList.add('active');
        humEnabled = true;
      }
    });
  }

  function startHum() {
    try {
      humAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // Resume if suspended (autoplay policy)
      if (humAudioCtx.state === 'suspended') {
        humAudioCtx.resume();
      }

      humOscillator = humAudioCtx.createOscillator();
      humGain = humAudioCtx.createGain();

      humOscillator.type = 'sawtooth';  // Gritty engine feel
      humOscillator.frequency.value = 55; // A1 — low engine rumble
      humGain.gain.value = 0.03; // Very subtle

      humOscillator.connect(humGain);
      humGain.connect(humAudioCtx.destination);
      humOscillator.start();

      // Update pitch based on power usage
      updateHumPitch();

      console.log('[Hum] Ship engine started');
    } catch (e) {
      console.warn('[Hum] Web Audio not available:', e);
    }
  }

  function stopHum() {
    try {
      if (humOscillator) {
        humOscillator.stop();
        humOscillator.disconnect();
        humOscillator = null;
      }
      if (humGain) {
        humGain.disconnect();
        humGain = null;
      }
      if (humAudioCtx) {
        humAudioCtx.close();
        humAudioCtx = null;
      }
      console.log('[Hum] Ship engine stopped');
    } catch (_) {}
  }

  function updateHumPitch() {
    if (!humOscillator || !humAudioCtx) return;

    const data = window.__dashboardData;
    const power = data && data.house ? Number(data.house.power_usage) : 200;
    if (isNaN(power)) return;

    // Map power usage (0-1000 kWh) to frequency (65-45 Hz)
    // More power = lower/deeper hum
    const freq = Math.max(42, Math.min(70, 65 - (power / 1000) * 20));
    humOscillator.frequency.setTargetAtTime(freq, humAudioCtx.currentTime, 0.5);
  }

  // ── 3-Day Forecast Strip (#2, Holly) ──────────────────────────
  function renderForecast(data) {
    const container = $('forecast-days');
    if (!container) return;

    const locs = data.locations || {};
    // Use the first location that has forecast data
    let forecastLoc = null;
    for (const [loc, info] of Object.entries(locs)) {
      if (info.forecast && info.forecast.length >= 2) {
        forecastLoc = { name: loc, data: info.forecast };
        break;
      }
    }

    if (!forecastLoc) {
      container.innerHTML = '<span class="forecast-day">No forecast data</span>';
      return;
    }

    // Skip today (index 0), show tomorrow and day after
    const days = forecastLoc.data.slice(1, 3);
    if (days.length === 0) {
      container.innerHTML = '<span class="forecast-day">No extended forecast</span>';
      return;
    }

    container.innerHTML = days.map(d => {
      const dateObj = new Date(d.date + 'T12:00:00');
      const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'short' });
      const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
      return `<div class="forecast-day">
        <span class="fc-date">${dayName} ${dateStr}</span>
        <span class="fc-temps"><span class="fc-high">↑${d.max}°</span><span class="fc-low">↓${d.min}°</span></span>
      </div>`;
    }).join('');
  }

  // ── Cat's Weather Verdict (#3) ────────────────────────────────
  function renderCatVerdict(data) {
    const el = $('cat-verdict-text');
    if (!el) return;

    const locs = data.locations || {};
    let bestLoc = null;
    for (const [loc, info] of Object.entries(locs)) {
      if (info.temp !== null && info.temp !== undefined) {
        bestLoc = { key: loc, temp: info.temp, conditions: info.conditions };
        break;
      }
    }

    if (!bestLoc) {
      el.textContent = 'No weather data for The Cat to judge.';
      return;
    }

    const catReactions = [
      `Hm. ${bestLoc.key}, ${Number(bestLoc.temp).toFixed(0)}°C. The temperature is adequate — just — but the conditions lack commitment.`,
      `${bestLoc.key} at ${Number(bestLoc.temp).toFixed(0)}°C. I could work with this. My fur looks sensational in this light.`,
      `Darling, ${Number(bestLoc.temp).toFixed(0)}°C in ${bestLoc.key}? That's not a temperature, that's a suggestion. I'm staying inside until the sun learns what it's doing.`,
      `${bestLoc.key}: ${bestLoc.conditions} at ${Number(bestLoc.temp).toFixed(0)}°C. The lighting situation needs addressing. I've seen brighter days inside a cupboard.`,
      `I've reviewed the ${bestLoc.key} situation. ${Number(bestLoc.temp).toFixed(0)}°C. It's fine. Not fabulous. Fine. But I can make anything work.`,
      `${bestLoc.key} at ${Number(bestLoc.temp).toFixed(0)}°C and ${bestLoc.conditions.toLowerCase()}. The humidity is a problem. Do you know what humidity does to a coat?`,
    ];
    const idx = Math.floor(Math.random() * catReactions.length);
    el.textContent = catReactions[idx];
  }

  // ── Power & Gas Gauges (#4, Rimmer) ──────────────────────────
  const GAUGE_THRESHOLDS = {
    power: { max: 500, amber: 300, red: 450 },
    gas: { max: 150, amber: 100, red: 130 },
  };

  function renderPowerGasGauges(data) {
    const house = data.house || {};
    const power = Number(house.power_usage) || 0;
    const gas = Number(house.gas_consumption) || 0;

    const powerGauge = $('gauge-power');
    const powerVal = $('gauge-power-val');
    const gasGauge = $('gauge-gas');
    const gasVal = $('gauge-gas-val');

    function setGauge(gaugeEl, valEl, val, cfg, suffix) {
      if (!gaugeEl || !valEl) return;
      const pct = Math.min(100, Math.round((val / cfg.max) * 100));
      gaugeEl.style.width = Math.max(2, pct) + '%';
      valEl.textContent = val.toFixed(1) + suffix;

      let color;
      if (val >= cfg.red) color = 'var(--red)';
      else if (val >= cfg.amber) color = 'var(--amber)';
      else color = 'var(--green)';
      gaugeEl.style.background = `linear-gradient(90deg, ${color}, var(--amber-dim))`;
    }

    setGauge(powerGauge, powerVal, power, GAUGE_THRESHOLDS.power, ' kWh');
    setGauge(gasGauge, gasVal, gas, GAUGE_THRESHOLDS.gas, ' m³');
  }

  // ── Lister's Day Counter (#5) ────────────────────────────────
  const COUNTER_DEFAULT = { laundry: 0, curry: 0, rimmer: 0, date: new Date().toDateString() };
  const COUNTER_MESSAGES = [
    'DAYS WITHOUT INCIDENT',
    'LISTER IS DOING... OKAY',
    'THINGS ARE GETTING WORSE',
    'SOMEONE\'S GONNA DO SOMETHING SOON',
    'THIS IS FINE. EVERYTHING IS FINE.',
    'A SITUATION IS DEVELOPING',
    'DISASTER IMMINENT',
    'ABSOLUTE STATE OF THINGS',
    'LISTER\'S LAUNDRY HAS DEVELOPED SENTIENCE',
    'THE SMELL IS NOW VISIBLE',
  ];

  function setupDayCounter() {
    const stored = JSON.parse(localStorage.getItem('rdwd_daycounter') || 'null');
    let state;
    if (stored && stored.date && stored.date !== new Date().toDateString()) {
      // New day — increment counters
      state = {
        laundry: (stored.laundry || 0) + 1,
        curry: (stored.curry || 0) + 1,
        rimmer: (stored.rimmer || 0) + 1,
        date: new Date().toDateString(),
      };
    } else if (stored) {
      state = stored;
    } else {
      state = { ...COUNTER_DEFAULT };
    }
    localStorage.setItem('rdwd_daycounter', JSON.stringify(state));

    // Render
    const counters = ['laundry', 'curry', 'rimmer'];
    for (const c of counters) {
      const el = $(`counter-${c}`);
      if (el) el.textContent = state[c];
    }

    const msgEl = $('counter-message');
    if (msgEl) {
      const highest = Math.max(state.laundry, state.curry, state.rimmer);
      const idx = Math.min(highest, COUNTER_MESSAGES.length - 1);
      msgEl.textContent = COUNTER_MESSAGES[idx];
    }

    // Reset buttons
    document.querySelectorAll('.counter-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const counter = this.dataset.counter;
        if (!counter) return;
        const current = JSON.parse(localStorage.getItem('rdwd_daycounter') || '{}');
        current[counter] = 0;
        current.date = new Date().toDateString();
        localStorage.setItem('rdwd_daycounter', JSON.stringify(current));
        const el = $(`counter-${counter}`);
        if (el) el.textContent = '0';

        const allCounters = ['laundry', 'curry', 'rimmer'];
        const vals = allCounters.map(c => {
          const e = $(`counter-${c}`);
          return e ? parseInt(e.textContent) : 0;
        });
        const highest = Math.max(...vals);
        const msgEl = $('counter-message');
        if (msgEl) {
          const idx = Math.min(highest, COUNTER_MESSAGES.length - 1);
          msgEl.textContent = COUNTER_MESSAGES[idx];
        }
      });
    });
  }

  // ── Rimmer's Efficiency Report (#1, June 19) ─────────────────
  function renderEfficiencyReport(data) {
    const el = $('efficiency-text');
    if (!el) return;
    const house = data.house || {};
    const power = Number(house.power_usage) || 0;
    const gas = Number(house.gas_consumption) || 0;
    const indoorTemp = Number(house.indoor_temp) || 0;
    const heating = house.heating_active;

    const templates = [
      `Attention! I've reviewed today's resource consumption and I must register my extreme displeasure. Power usage is at ${power.toFixed(1)} kWh — that's enough to run a small moonbase. Gas consumption at ${gas.toFixed(1)} m³. And the indoor temperature is ${indoorTemp.toFixed(1)}°C, which is either too hot or too cold depending on which regulation you're consulting. In my day, we didn't have thermostats. We had discipline.`,
      `Right then. Another day, another catalogue of inefficiencies. Power: ${power.toFixed(1)} kWh. Do you know what that could power? A lightbulb. For a considerable amount of time. And gas at ${gas.toFixed(1)} m³ — I assume you're heating the entire block of flats? The indoor temperature reading of ${indoorTemp.toFixed(1)}°C is frankly indulgent. I'm logging this.`,
      `Daily efficiency report. ${power.toFixed(1)} kWh. ${gas.toFixed(1)} m³. ${indoorTemp.toFixed(1)}°C. These numbers are NOT within acceptable parameters. I checked. I have a list of acceptable parameters somewhere. If the heating is ${heating ? 'ON' : 'OFF'}, someone's made a serious error in judgment. I expect better. Or at least, different.`,
      `I've compiled today's figures: power draw of ${power.toFixed(1)} kWh, gas at ${gas.toFixed(1)} m³, internal climate reading ${indoorTemp.toFixed(1)}°C. I could present a 27-point improvement plan, but given the general level of competence around here, I'll simply note my dissatisfaction and await the inevitable crisis.`,
    ];
    const idx = Math.floor(Math.random() * templates.length);
    el.textContent = templates[idx];
  }

  // ── Cat's Daily Colour Accent (#2, June 19) ─────────────────
  function renderColourAccent(data) {
    const locs = data.locations || {};
    // Pick the first location's conditions
    let conditions = '';
    for (const info of Object.values(locs)) {
      if (info.conditions) { conditions = info.conditions.toLowerCase(); break; }
    }

    let colour, accentName;
    if (!conditions) { colour = '#00ccff'; accentName = 'CYAN'; }
    else if (conditions.includes('sunny') || conditions.includes('clear')) {
      colour = '#ffd700'; accentName = 'GOLD';
    } else if (conditions.includes('rain') || conditions.includes('drizzle') || conditions.includes('storm')) {
      colour = '#c0c0c0'; accentName = 'SILVER';
    } else if (conditions.includes('cloud') || conditions.includes('overcast')) {
      colour = '#ff8c00'; accentName = 'AMBER';
    } else if (conditions.includes('fog') || conditions.includes('mist')) {
      colour = '#87ceeb'; accentName = 'SKY BLUE';
    } else if (conditions.includes('snow') || conditions.includes('ice')) {
      colour = '#ffffff'; accentName = 'ICE';
    } else if (conditions.includes('wind')) {
      colour = '#00ff88'; accentName = 'EMERALD';
    } else {
      colour = '#ffb000'; accentName = 'AMBER';
    }

    // Apply as CSS custom property on body
    document.body.style.setProperty('--cat-accent', colour);
    document.body.classList.add('cat-accent-active');
  }

  // ── Lister's Tinned Curry Countdown (#3, June 19) ────────────
  function setupCurryStockpile() {
    const expiryEl = $('curry-expiry');
    const findBtn = $('curry-find-btn');
    const cooldownEl = $('curry-cooldown');
    if (!expiryEl) return;

    // Base date: ten years ago today
    const base = new Date();
    base.setFullYear(base.getFullYear() - 10);
    const daysSince = Math.floor((Date.now() - base.getTime()) / 86400000);
    expiryEl.textContent = daysSince.toLocaleString();

    if (findBtn) {
      let onCooldown = false;
      findBtn.addEventListener('click', function() {
        if (onCooldown) return;
        onCooldown = true;
        findBtn.disabled = true;

        // Celebration animation
        expiryEl.classList.add('curry-celebration');
        expiryEl.style.color = 'var(--green)';
        setTimeout(() => {
          expiryEl.classList.remove('curry-celebration');
          expiryEl.style.color = '';
        }, 500);

        // Cooldown countdown
        if (cooldownEl) {
          cooldownEl.style.display = '';
          let remaining = 30;
          cooldownEl.textContent = `🔍 Searching pantry... ${remaining}s`;
          const interval = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
              clearInterval(interval);
              cooldownEl.style.display = 'none';
              onCooldown = false;
              findBtn.disabled = false;
              cooldownEl.textContent = '';
            } else {
              cooldownEl.textContent = `🔍 Searching pantry... ${remaining}s`;
            }
          }, 1000);
        }
      });
    }
  }

  // ── Holly's Trivia Fact of the Day (#4, June 19) ─────────────
  const TRIVIA_FACTS = [
    "The original working title for Red Dwarf was 'Red Dwarf XI' (as in the 11th series).",
    "Kryten's head has 37 separate moving parts and cost £32,000 to build.",
    "The Cat costume had to be replaced 14 times during Series 1 because of wear and tear.",
    "Chris Barrie (Rimmer) performed all his own stunts, including the famous hologram 'de-resolution' sequence.",
    "The original script for 'The End' had Lister being 2 million years old, increased to 3 million for dramatic effect.",
    "Craig Charles was cast as Lister just two days after auditioning — he didn't even have time to learn his lines.",
    "The set for the sleeping quarters was actually half the size it appeared on screen, achieved with forced perspective.",
    "Norman Lovett (Holly) improvised most of his computer voice lines on the spot.",
    "The show's theme song was written in just one evening by Howard Goodall.",
    "Danny John-Jules (Cat) was a professional dancer before joining Red Dwarf and choreographed his own movements.",
    "The original pilot episode had a different actor playing Cat — David Gillespie, before Danny John-Jules took over.",
    "Kryten was originally written as a one-off character but was brought back due to popular demand.",
    "Rimmer's hologram suit cost £15,000 and had to be specially lit to create the transparent effect.",
    "The model shots of Red Dwarf ship were over 12 feet long and took two weeks to build.",
    "Lister's curry obsession was based on Craig Charles's own love of Indian food.",
    "The show was rejected by BBC1 before finding a home on BBC2, where it became a cult hit.",
    "Holly's IQ display was manually operated by a crew member off-camera.",
    "The toaster prop from Series 1 is now in the Science Museum in London.",
    "'Smoke me a kipper, I'll be back for breakfast' was voted the funniest Red Dwarf line in a 2004 poll.",
    "The original Cat costume was made from a modified sheepskin rug.",
    "Series 3 was the first to use the updated, larger Red Dwarf model.",
    "Rob Grant and Doug Naylor wrote every episode together until Series 6, then parted ways.",
    "The 'Better Than Life' virtual reality game helmet was actually a repurposed hair dryer.",
    "Hattie Hayridge took over as Holly from Series 3 after Norman Lovett left.",
    "The space suits worn by the cast were modified Royal Navy survival suits.",
    "Rimmer's Light Bee — the device that projects his hologram — was never fully explained on screen.",
    "The show was originally conceived as a sitcom version of Alien meets The Odd Couple.",
    "Kryten's head mechanism required a puppeteer hidden behind the set operating cables.",
    "The Polymorph episode was inspired by a real dream Doug Naylor had.",
    "'Queeg' was named after a character from the original Grant Naylor pitch document.",
    "Starbug was originally designed to look like a small red car with wings.",
    "Cat's wardrobe had to be replaced every series as Danny John-Jules changed his fashion preferences.",
    "The 'Backwards' episode required actors to perform scenes in reverse and then reverse the film.",
    "The Red Dwarf theme was originally recorded with a full orchestra.",
    "Rimmer's middle name is Judas — revealed in the book 'Last Human'.",
    "Lister's first name is Dave, but his full name is David Lister.",
    "The 'White Hole' episode featured one of the most expensive visual effects shots in BBC history at the time.",
    "Cat's obsession with fashion was inspired by Danny John-Jules's own interest in clothing.",
    "The set for the corridor was redressed 15 different ways across the series to look like different parts of the ship.",
    "Kryten's full designation is Kryten Series 4000, though he was actually a Series 3000 unit.",
    "The original ending for 'The End' had Lister giving birth to twins, which was cut for time.",
    "Craig Charles and Chris Barrie did not get along at first but became close friends over the course of filming.",
    "The 'Queeg' episode was the first to reveal that Holly had accidentally wiped out the crew.",
    "The theme song lyrics were written by Rob Grant and Doug Naylor.",
    "Lister's string vest was deliberately distressed to look 3 million years old.",
    "The original Cat had no speaking lines in the first draft of the pilot.",
    "Rimmer's hologrammatic nature means he can't touch anything — but this rule was broken frequently.",
    "The series has won multiple international Emmy awards.",
    "Every episode title in Series 1 and 2 was a single word or short phrase ending in 's'.",
    "The show's working title in the US was 'Space Life'.",
    "Kryten's head contains a working light that was originally intended to flash when he spoke.",
    "The cat litter tray joke in 'Kryten' was ad-libbed by Danny John-Jules.",
    "No episode has ever been entirely set outside the ship's environment.",
    "The sets were so hot under studio lights that actors often fainted during summer recordings.",
    "The original Holly was written as male, but Norman Lovett's performance redefined the character.",
    "Red Dwarf has a dedicated fan club that has been running continuously since 1989.",
    "Lister's record collection was stated to contain over 1,000 albums.",
    "Kryten's first words on screen were 'Would anyone like any toast?'",
    "The show's canned laughter was recorded from live studio audiences.",
    "Rimmer's exam failure (the 'Astro-Navigation' paper) is the defining failure of his life.",
  ];

  function renderTriviaFact() {
    const el = $('trivia-text');
    if (!el) return;
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const idx = dayOfYear % TRIVIA_FACTS.length;
    el.textContent = TRIVIA_FACTS[idx];
  }

  // ── Kryten's System Uptime (#5, June 19) ─────────────────────
  function setupUptimeCounter() {
    const valEl = $('uptime-value');
    const msgEl = $('uptime-message');
    if (!valEl) return;

    let state = JSON.parse(localStorage.getItem('rdwd_uptime') || '{"startTime":null,"totalMs":0,"lastVisit":null}');
    const now = Date.now();

    // Check if away more than 24h
    if (state.lastVisit && (now - state.lastVisit) > 86400000) {
      state = { startTime: now, totalMs: 0, lastVisit: now };
    }

    if (!state.startTime) {
      state.startTime = now;
      state.totalMs = 0;
    }

    state.lastVisit = now;
    localStorage.setItem('rdwd_uptime', JSON.stringify(state));

    function updateUptime() {
      const elapsed = state.totalMs + (Date.now() - state.startTime);
      const totalSec = Math.floor(elapsed / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);

      valEl.textContent = `${days}d ${hours}h ${mins}m`;

      if (msgEl) {
        const msgs = [
          'I have been monitoring the dashboard without incident.',
          'All systems nominal. I have prepared a 14-day projection, just in case.',
          'Still watching. Still cleaning. Still waiting for someone to ask for toast.',
          `I have now been operational for ${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}, and ${mins} minute${mins !== 1 ? 's' : ''}. Everything is in order.`,
        ];
        // Pick based on days running
        const msgIdx = Math.min(days, msgs.length - 1);
        msgEl.textContent = msgs[msgIdx];
      }
    }

    updateUptime();
    setInterval(updateUptime, 60000); // Update every minute
  }

  // ── Cat's Colour Accent CSS ──────────────────────────────────
  // Inject cat accent CSS once
  (function injectCatAccentCSS() {
    // Only inject once
    if (document.getElementById('cat-accent-style')) return;
    const style = document.createElement('style');
    style.id = 'cat-accent-style';
    style.textContent = `
      body.cat-accent-active {
        --cat-accent: #ffb000;
      }
      body.cat-accent-active .panel-title {
        border-bottom-color: color-mix(in srgb, var(--cat-accent) 30%, transparent);
      }
      body.cat-accent-active .panel-corner {
        border-color: var(--cat-accent);
        opacity: 0.6;
      }
      body.cat-accent-active .panel-header {
        border-color: color-mix(in srgb, var(--cat-accent) 40%, transparent);
      }
    `;
    document.head.appendChild(style);
  })();

  // ── Starbug (NAS) Status Panel ────────────────────────────────
  function renderStarbug(data) {
    const panel = $('panel-starbug');
    const statusEl = $('starbug-status');
    const uptimeEl = $('starbug-uptime');
    const cpuEl = $('starbug-cpu');
    const ramEl = $('starbug-ram');
    const dockerEl = $('starbug-docker');
    const containersEl = $('starbug-containers');
    const diskEl = $('starbug-disk');
    const jellyfinEl = $('starbug-jellyfin');
    if (!panel || !statusEl) return;

    if (!data || data.status !== 'online') {
      panel.style.display = '';
      statusEl.textContent = 'OFFLINE';
      statusEl.className = 'starbug-value offline';
      if (uptimeEl) uptimeEl.textContent = '--';
      if (cpuEl) cpuEl.textContent = '--';
      if (ramEl) ramEl.textContent = '--';
      if (dockerEl) dockerEl.textContent = '--';
      if (containersEl) containersEl.textContent = '--';
      if (diskEl) diskEl.textContent = '--';
      if (jellyfinEl) jellyfinEl.textContent = '--';
      return;
    }

    panel.style.display = '';
    statusEl.textContent = '🟢 ONLINE';
    statusEl.className = 'starbug-value';
    if (cpuEl) cpuEl.textContent = `${data.system.cpu_count} cores`;
    if (ramEl) ramEl.textContent = `${data.system.memory_gb} GB`;
    if (dockerEl) dockerEl.textContent = `v${data.docker.version}`;

    // Containers summary
    const c = data.docker.containers;
    if (containersEl) {
      containersEl.textContent = `${c.total} (${c.running} up)`;
      if (c.stopped > 0) containersEl.style.color = 'var(--amber)';
    }

    // Disk
    if (diskEl && data.system.docker_disk_gb) {
      diskEl.textContent = `${data.system.docker_disk_gb} GB`;
    }

    // Find key containers
    const containers = data.containers || [];
    const sc = containers.find(c => c.name === 'starbug-cockpit');
    if (uptimeEl && sc) {
      uptimeEl.textContent = sc.status;
    }

    const jf = containers.find(c => c.name === 'Jellyfin');
    if (jellyfinEl && jf) {
      jellyfinEl.textContent = jf.state === 'running' ? '✅ ' + jf.status : '❌ DOWN';
      jellyfinEl.style.color = jf.state === 'running' ? '' : 'var(--red)';
    }
  }

  // Init: set daily items, then start timers
  renderDeckDaily();
  renderDeckPerMinute();
  renderDeckFrequent();
  setupToast();
  setupSparklineWrappers();
  setupStudyClock();
  setupShipHum();
  setupDayCounter();
  setupCurryStockpile();
  setupUptimeCounter();

  // Timers at different cadences
  setInterval(renderDeckPerMinute, 30000);  // every 30s
  setInterval(renderDeckFrequent, 8000);    // every 8s
  const LOCATION_NAMES = { altrincham: 'Altrincham', overseal: 'Overseal', llandudno: 'Llandudno' };

  function generateCrewReports(locKey, temp, conditions) {
    const name = LOCATION_NAMES[locKey] || locKey;
    const t = temp !== null ? temp : 'unknown';
    const c = conditions || 'unknown';
    return {
      rimmer:  `I've reviewed the ${name} meteorological data. ${t}°C and "${c}." That's not a weather report, that's a guess. On Red Dwarf we had proper forecasts — isobars, fronts, the lot. This is an abdication of climatological responsibility. I'm logging it.`,
      kryten:  `I have completed a thorough analysis of the ${name} atmospheric conditions. The temperature is ${t}°C with ${c.toLowerCase()} skies. I would rate this as acceptable for human habitation, sir. Would you like me to prepare a 14-day probabilistic projection? I've already done one, just in case.`,
      cat:     `${name}: ${t}°C and ${c.toLowerCase()}. Hm. The temperature is adequate — just — but the conditions lack commitment. "Partly cloudy" is the meteorological equivalent of a maybe. Pick a look and own it. Though I will say, the lighting at ${t}°C is actually rather flattering for my fur.`,
      lister:  `${name}, ${t}°C, ${c.toLowerCase()}. Sound. Not too hot, not too cold. You could stick a jacket on and have a walk without breaking a sweat. That's all you can ask for really, innit? Probably nice near the beach at Llandudno. If they do chips by the pier, even better.`
    };
  }

  // ── Weather card click → crew report modal ────────────────────
  function setupWeatherClicks() {
    const cards = document.querySelectorAll('.weather-card');
    const modal = document.getElementById('crew-report-modal');
    const closeBtn = document.getElementById('modal-close');
    const titleEl = document.getElementById('modal-title');
    const reportEls = {
      rimmer: document.getElementById('report-rimmer'),
      kryten: document.getElementById('report-kryten'),
      cat: document.getElementById('report-cat'),
      lister: document.getElementById('report-lister')
    };
    if (!modal || !closeBtn) return;
    closeBtn.addEventListener('click', function() { modal.style.display = 'none'; });
    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.style.display = 'none';
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') modal.style.display = 'none';
    });
    for (const card of cards) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', function() {
        const loc = card.dataset.location;
        if (!loc) return;
        const data = window.__dashboardData;
        if (!data || !data.locations || !data.locations[loc]) return;
        const info = data.locations[loc];
        const reports = generateCrewReports(loc, info.temp, info.conditions);
        titleEl.textContent = '> CREW REPORT — ' + (LOCATION_NAMES[loc] || loc).toUpperCase();
        for (const [crew, text] of Object.entries(reports)) {
          if (reportEls[crew]) reportEls[crew].textContent = text;
        }
        modal.style.display = 'flex';
      });
    }
  }

  /**
   * Show/hide and populate metrolink ticker
   */
  function renderMetrolink(data) {
    const panel = $('panel-metrolink');
    const track = $('ticker-track');
    if (!panel || !track) return;

    const msg = data.metrolink;
    if (msg && typeof msg === 'string' && msg.trim().length > 0) {
      panel.style.display = '';
      track.textContent = '⚠  ' + msg + '  ⚠';
      // Restart animation by reflow
      track.style.animation = 'none';
      void track.offsetHeight; // trigger reflow
      track.style.animation = '';
    } else {
      panel.style.display = 'none';
    }
  }

  /**
   * Populate headlines panel
   */
  function renderHeadlines(data) {
    const list = $('headlines-list');
    if (!list) return;

    const headlines = data.headlines;
    if (!headlines || headlines.length === 0) {
      list.innerHTML = '<div class="headline-placeholder">No headlines received.</div>';
      return;
    }

    list.innerHTML = '';
    for (const h of headlines) {
      const div = document.createElement('div');
      div.className = 'headline-item';
      div.textContent = '› ' + h;
      list.appendChild(div);
    }
  }

  /**
   * Set crew status indicators
   */
  function renderCrew() {
    // Crew statuses aren't in the schema, so we simulate a realistic default set.
    const statuses = {
      holly:  'online',
      rimmer: 'offline',
      kryten: 'online',
      cat:    'online',
      lister: 'online',
    };
    for (const [name, state] of Object.entries(statuses)) {
      const dot = $('dot-' + name);
      if (dot) {
        dot.className = 'crew-dot ' + state;
      }
    }
  }

  /**
   * Set random crew quote
   */
  function renderQuote(data) {
    const el = $('quote-text');
    if (!el) return;

    const DEFAULT_QUOTES = [
      '"I\'m a genius — unfortunately, my brain\'s just too advanced for this century." — Holly',
      '"Smoke me a kipper, I\'ll be back for breakfast." — Ace Rimmer',
      '"I\'m a space adventurer! I\'ve got a string vest and everything!" — Lister',
      '"What a guy!" — Lister (about Rimmer)',
      '"I\'m not a hologram, I\'m a person who happens to be dead." — Rimmer',
      '"Would anyone like any toast?" — Kryten',
      '"I am a sophisticated mechanical being. I can speak six thousand languages, I can play chess, I can... make a very good cup of coffee." — Kryten',
      '"Stoke me a clipper, I\'ll be back for Christmas." — Ace Rimmer',
      '"Better dead than smeg!" — Lister',
      '"It\'s cold outside, there\'s no kind of atmosphere..." — The crew',
      '"I\'m a total, complete, utter, and absolute... smeghead." — Rimmer',
      '"Fish! Today fish, tomorrow... fish!" — Cat',
      '"The needs of the many outweigh the needs of the few. Or the one." — Holly (quoting Star Trek)',
      '"This is Red Dwarf. Please hold the line." — Holly',
    ];

    let quote = data.crew_quote;
    if (!quote || typeof quote !== 'string') {
      // Pick a random default quote
      quote = DEFAULT_QUOTES[Math.floor(Math.random() * DEFAULT_QUOTES.length)];
    }

    el.textContent = quote;
    el.className = 'quote-text';
  }

  /**
   * Update footer timestamp and header date/time
   */
  function updateTimestamps(dataTimestamp) {
    // Footer: use data.json timestamp if available, otherwise current time
    const footerEl = $('footer-timestamp');
    if (footerEl) {
      let ts = dataTimestamp;
      if (!ts) {
        ts = new Date().toISOString();
      }
      try {
        const d = new Date(ts);
        footerEl.textContent = d.toLocaleString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false,
        });

        // Freshness badge
        updateFreshness(d);
      } catch (_) {
        footerEl.textContent = ts;
      }
    }
  }

  // ── Data freshness badge ──────────────────────────────────────────
  function updateFreshness(dataTime) {
    const badge = document.getElementById('freshness-badge');
    if (!badge) return;

    const now = Date.now();
    const ageMs = now - dataTime.getTime();
    const ageMin = Math.floor(ageMs / 60000);

    // Remove all state classes
    badge.className = 'freshness-badge';

    if (ageMin < 0) {
      // Future timestamp — clock skew
      badge.classList.add('freshness-fresh');
      badge.textContent = '\u25C9  LIVE';
    } else if (ageMin < 15) {
      badge.classList.add('freshness-fresh');
      badge.textContent = '\u25C9  ' + ageMin + 'm ago';
    } else if (ageMin < 60) {
      badge.classList.add('freshness-aging');
      badge.textContent = '\u25D0  ' + ageMin + 'm ago';
    } else {
      badge.classList.add('freshness-stale');
      badge.textContent = '\u26A0  ' + Math.floor(ageMin / 60) + 'h ' + (ageMin % 60) + 'm ago';
    }
  }

  /**
   * Live clock in header
   */
  function startClock() {
    function tick() {
      const now = new Date();
      const dateEl = $('header-date');
      const timeEl = $('header-time');
      if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
        });
      }
      if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('en-GB', { hour12: false });
      }
    }
    tick();
    setInterval(tick, 1000);
  }

  /**
   * Main: fetch data.json and render everything
   */
  async function loadDashboard() {
    try {
      console.log('[Dashboard] Fetching data.json...');
      const res = await fetch('data.json?_=' + Date.now()); // cache-bust
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      console.log('[Dashboard] Data loaded:', data);
      window.__dashboardData = data;

      renderShip(data);
      renderWeatherAlertBanner(data);
      renderThresholdAlarms(data);
      renderAstronomy(data);
      renderHealthStrip(data);
      renderDayGlance(data);
      renderForecast(data);
      renderColourAccent(data);
      renderTrendArrows(data);
      renderSparklines(data);
      renderWeather(data);
      renderCatVerdict(data);
      renderEfficiencyReport(data);
      renderMetrolink(data);
      renderHeadlines(data);
      renderCrew();
      renderQuote(data);
      renderPotPlant();
      renderSkyReport(data);
      renderPowerGasGauges(data);
      renderTriviaFact();
      updateHumPitch();
      updateTimestamps(data.timestamp);
      setupWeatherClicks();
      fetchStarbugData();
    } catch (err) {
      console.error('[Dashboard] Failed to load data:', err);
      // Still render what we can with defaults
      renderCrew();
      renderQuote({});
      updateTimestamps(null);
      // Show error in ship panel
      const els = document.querySelectorAll('.ship-value');
      els.forEach(el => { el.textContent = 'ERR'; el.className = 'ship-value null-value'; });
    }
  }

  async function fetchStarbugData() {
    try {
      const res = await fetch('starbug.json?_=' + Date.now());
      if (!res.ok) return;
      const data = await res.json();
      console.log('[Dashboard] Starbug data:', data.status);
      renderStarbug(data);
    } catch (_) {
      // Starbug offline or not yet collected — fine
    }
  }

  // --- Init ---
    document.addEventListener('DOMContentLoaded', function () {
      startClock();
      loadDashboard();

      const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
      let countdownMs = REFRESH_INTERVAL;

      // Countdown bar — updates every second
      const countdownBar = $('countdown-bar');
      const countdownText = $('countdown-text');
      const countdownBtn = $('countdown-btn');

      function updateCountdown() {
        countdownMs -= 1000;
        if (countdownMs <= 0) countdownMs = REFRESH_INTERVAL;

        const totalSec = Math.round(countdownMs / 1000);
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        const pct = (countdownMs / REFRESH_INTERVAL) * 100;

        if (countdownText) {
          countdownText.textContent = 'NEXT REFRESH IN ' + mins + ':' + String(secs).padStart(2, '0');
        }
        if (countdownBar) {
          countdownBar.style.width = pct + '%';
          // Shift from cyan toward amber as it approaches zero
          if (pct < 20) {
            countdownBar.style.background = 'linear-gradient(90deg, var(--red), var(--amber))';
          } else if (pct < 50) {
            countdownBar.style.background = 'linear-gradient(90deg, var(--amber), var(--cyan))';
          } else {
            countdownBar.style.background = 'linear-gradient(90deg, var(--cyan), var(--amber))';
          }
        }
      }

      // Reset countdown when data refreshes
      const origLoadDashboard = loadDashboard;
      loadDashboard = async function() {
        countdownMs = REFRESH_INTERVAL;
        await origLoadDashboard.apply(this, arguments);
      };

      // SYNC NOW button
      if (countdownBtn) {
        countdownBtn.addEventListener('click', function() {
          countdownMs = REFRESH_INTERVAL;
          loadDashboard();
        });
      }

      // Start countdown ticker
      setInterval(updateCountdown, 1000);
      updateCountdown();

      // Refresh every 5 minutes
      setInterval(loadDashboard, REFRESH_INTERVAL);

      // Live display refreshes (every 60s)
      setInterval(function() {
        const data = window.__dashboardData;
        if (data) renderDayGlance(data);
      }, 60000);

      // --- Theme toggle ---
      initThemeToggle();
    });

    // ── Theme toggle ─────────────────────────────────────────────────
    function initThemeToggle() {
      const btn = document.getElementById('theme-toggle');
      if (!btn) return;

      // Restore saved preference
      const saved = localStorage.getItem('dashboard-theme');
      if (saved === 'light') {
        document.body.classList.add('light-mode');
        btn.textContent = '\u263C'; // ☼
      }

      btn.addEventListener('click', function () {
        const isLight = document.body.classList.toggle('light-mode');
        btn.textContent = isLight ? '\u263C' : '\u263E'; // ☼ / ☾
        localStorage.setItem('dashboard-theme', isLight ? 'light' : 'dark');
      });
    }
  })();