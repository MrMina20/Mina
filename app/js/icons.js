/* أيقونات موحدة: نفس الشبكة (24)، نفس سمك الخط، وكل وحدة لها لون ثابت داخل مربع شفاف */
(function (w) {
  'use strict';
  const g = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;

  // رموز الوحدات الثماني (class="f" = تعبئة خفيفة بنفس اللون)
  const TILE = {
    contracts: g('<path class="f" d="M7 3.5h7l4 4v13H7z"/><path d="M7 3.5h7l4 4v13H7zM14 3.5v4h4"/><path d="M9.5 13l1.8 1.8 3.2-3.4M9.5 18h5"/>'),
    properties: g('<path class="f" d="M5.5 10.5L12 5l6.5 5.5V20h-13z"/><path d="M3.5 11.5L12 4l8.5 7.5M5.5 10v10h13V10M10 20v-5h4v5"/>'),
    projects: g('<path class="f" d="M5 21V9.5L11 6l6 3.5V21z"/><path d="M4 21h16M5 21V9.5L11 6l6 3.5V21M9 21v-4h4v4M9 11h.01M13 11h.01M9 14h.01M13 14h.01"/>'),
    reports: g('<rect class="f" x="4" y="11" width="4" height="9" rx="1"/><rect class="f" x="10" y="4" width="4" height="16" rx="1"/><rect class="f" x="16" y="8" width="4" height="12" rx="1"/><path d="M4 20.5h16M4 11h4v9.5M10 4h4v16.5M16 8h4v12.5"/>'),
    treasury: g('<rect class="f" x="3.5" y="4.5" width="17" height="14" rx="2.5"/><rect x="3.5" y="4.5" width="17" height="14" rx="2.5"/><circle cx="12" cy="11.5" r="3.2"/><path d="M12 8.3v1.4M12 13.3v1.4M8.8 11.5h1.4M13.8 11.5h1.4M7 18.5v2M17 18.5v2"/>'),
    stock: g('<path class="f" d="M3.5 9.5L12 4.5l8.5 5V20h-17z"/><path d="M3.5 9.5L12 4.5l8.5 5V20h-17zM8 20v-6h8v6M8 17h8"/>'),
    team: g('<path class="f" d="M5 15a7 7 0 0 1 14 0z"/><path d="M5 15a7 7 0 0 1 14 0M3.5 15h17v3.5h-17zM12 8v7"/>'),
    suppliers: g('<path class="f" d="M3 7h10.5v9.5H3z"/><path d="M3 7h10.5v9.5H3zM13.5 10.5h4l3 3.2v2.8h-7"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>')
  };
  const HUE = { contracts: 'h-pink', properties: 'h-orange', projects: 'h-blue', reports: 'h-indigo', treasury: 'h-green', stock: 'h-cyan', team: 'h-amber', suppliers: 'h-purple' };
  const badgeIcon = (k) => `<span class="ti ${HUE[k] || 'h-blue'}">${TILE[k] || ''}</span>`;

  const s = (p) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const UI = {
    download: s('<path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>'),
    bell: s('<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7.5 2 7.5H4S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
    sun: s('<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>'),
    moon: s('<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>'),
    sound: s('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
    mute: s('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
    gear: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    back: s('<path d="M9 5l7 7-7 7"/>'),
    plus: s('<path d="M12 5v14M5 12h14"/>'),
    trash: s('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    print: s('<path d="M7 9V3h10v6M7 17H4v-6h16v6h-3M7 14h10v7H7z"/>'),
    search: s('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>'),
    close: s('<path d="M6 6l12 12M18 6L6 18"/>'),
    csv: s('<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6"/>'),
    file: s('<path d="M7 3h7l4 4v14H7zM14 3v4h4"/>'),
    calc: s('<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>')
  };

  const BRAND = '<svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true"><rect width="48" height="48" rx="13" fill="#4f83f1"/><rect x="10" y="9" width="18" height="29" rx="2" fill="#fff"/><rect x="28" y="20" width="10" height="18" rx="2" fill="#cfe0ff"/><g fill="#4f83f1"><rect x="14" y="14" width="4" height="4" rx="1"/><rect x="20" y="14" width="4" height="4" rx="1"/><rect x="14" y="22" width="4" height="4" rx="1"/><rect x="20" y="22" width="4" height="4" rx="1"/><rect x="16.5" y="30" width="5" height="8" rx="1"/></g><path d="M8 40h32" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>';

  w.Omran = w.Omran || {};
  Object.assign(w.Omran, { TILE, HUE, badgeIcon, ICON: UI, BRAND });
})(window);
