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
          condEl.textContent = info.conditions;
          condEl.className = 'weather-cond';
        } else {
          condEl.textContent = 'NO DATA';
          condEl.className = 'weather-cond null-value';
        }
      }
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
      } catch (_) {
        footerEl.textContent = ts;
      }
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

      renderShip(data);
      renderWeather(data);
      renderMetrolink(data);
      renderHeadlines(data);
      renderCrew();
      renderQuote(data);
      updateTimestamps(data.timestamp);
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
  });

})();