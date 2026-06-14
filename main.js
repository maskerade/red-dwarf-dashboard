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
  }

  // ── Weather icon mapping ─────────────────────────────────────────
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

  function renderDeckEntertainment() {
    // 1. Smeg Counter — random increment
    smegCount += Math.floor(Math.random() * 3) + 1;
    const smegEl = $('deck-smeg');
    if (smegEl) smegEl.textContent = smegCount.toLocaleString();

    // 2. Holly's IQ
    const iqEl = $('deck-iq');
    const iqReasonEl = $('deck-iq-reason');
    if (iqEl) {
      const baseIQ = 6000;
      const fluctuation = Math.floor(Math.random() * 11) - 5; // -5 to +5
      const iq = baseIQ + fluctuation;
      iqEl.textContent = iq;
      iqEl.style.color = fluctuation === 0 ? 'var(--cyan)' : fluctuation > 0 ? 'var(--green)' : 'var(--amber)';
    }
    if (iqReasonEl) {
      iqReasonEl.textContent = IQ_REASONS[Math.floor(Math.random() * IQ_REASONS.length)];
    }

    // 3. Rimmer's Directive
    const dirEl = $('deck-directive');
    if (dirEl) {
      dirEl.textContent = DIRECTIVES[Math.floor(Math.random() * DIRECTIVES.length)];
    }

    // 4. Curry Tracker
    const curryGauge = $('deck-curry-gauge');
    const curryNameEl = $('deck-curry-name');
    if (curryGauge) {
      const hour = new Date().getHours();
      // Peaks at lunch (12-14) and dinner (18-21)
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
    if (curryNameEl) {
      curryNameEl.textContent = CURRY_NAMES[Math.floor(Math.random() * CURRY_NAMES.length)];
    }

    // 5. Cat's Mirror Time
    const catEl = $('deck-cat');
    const catCommentEl = $('deck-cat-comment');
    if (catEl) {
      const pct = (95 + Math.random() * 5).toFixed(1);
      catEl.textContent = pct + '%';
    }
    if (catCommentEl) {
      catCommentEl.textContent = CAT_COMMENTS[Math.floor(Math.random() * CAT_COMMENTS.length)];
    }

    // 6. Kryten's Cleaning Log
    const cleaningEl = $('deck-cleaning');
    if (cleaningEl) {
      cleaningIndex = (cleaningIndex + 1) % CLEANING_TASKS.length;
      cleaningEl.textContent = '▸ ' + CLEANING_TASKS[cleaningIndex];
    }

    // 7. Starbug Readiness
    const starbugGauge = $('deck-starbug-gauge');
    const starbugReasonEl = $('deck-starbug-reason');
    if (starbugGauge) {
      const readiness = 60 + Math.floor(Math.random() * 36); // 60-95%
      starbugGauge.style.width = readiness + '%';
      starbugGauge.style.background = readiness > 85
        ? 'linear-gradient(90deg, var(--amber), var(--green))'
        : 'linear-gradient(90deg, var(--red), var(--amber))';
    }
    if (starbugReasonEl) {
      starbugReasonEl.textContent = STARBUG_EXCUSES[Math.floor(Math.random() * STARBUG_EXCUSES.length)];
    }

    // 8. Radiation Level
    const radEl = $('deck-radiation');
    if (radEl) {
      const spike = Math.random() < 0.08; // 8% chance of spike
      const base = 0.08 + Math.random() * 0.15;
      const val = spike ? base + Math.random() * 0.5 : base;
      radEl.textContent = val.toFixed(2);
      radEl.className = 'deck-value' + (spike ? ' spike' : '');
    }

    // 9. Episode of the Day (changes every 30s)
    const epEl = $('deck-episode');
    const epSeriesEl = $('deck-episode-series');
    if (epEl && epSeriesEl) {
      const ep = EPISODES[episodeIndex];
      epEl.textContent = ep.title;
      epSeriesEl.textContent = ep.series;
    }

    // 10. Ship's Log
    const logEl = $('deck-log');
    if (logEl) {
      logIndex = (logIndex + 1) % LOG_ENTRIES.length;
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.textContent = LOG_ENTRIES[logIndex];
      logEl.appendChild(entry);
      // Keep last 20 entries
      while (logEl.children.length > 20) {
        logEl.removeChild(logEl.firstChild);
      }
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  // Initial render
  renderDeckEntertainment();

  // Live updates every 4 seconds
  setInterval(renderDeckEntertainment, 4000);

  // Episode changes every 30 seconds
  setInterval(function() {
    episodeIndex = (episodeIndex + 1) % EPISODES.length;
  }, 30000);
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
      renderAstronomy(data);
      renderWeather(data);
      renderMetrolink(data);
      renderHeadlines(data);
      renderCrew();
      renderQuote(data);
      updateTimestamps(data.timestamp);
      setupWeatherClicks();
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

  // --- Init ---
    document.addEventListener('DOMContentLoaded', function () {
      startClock();
      loadDashboard();
      // Refresh every 5 minutes
      setInterval(loadDashboard, 5 * 60 * 1000);

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