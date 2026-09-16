const Icons = (() => {
  const base = (paths, label = "") => `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${label ? `aria-label="${label}" role="img"` : 'aria-hidden="true"'}>
      ${paths}
    </svg>`;

  return {
    home: () => base('<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>'),
    family: () => base('<path d="M16 11a4 4 0 1 0-8 0"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M19 8a3 3 0 0 1 2 5"/><path d="M3 13a3 3 0 0 1 2-5"/>'),
    goal: () => base('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
    money: () => base('<rect x="3" y="6" width="18" height="12" rx="3"/><circle cx="12" cy="12" r="2"/><path d="M6 10v4M18 10v4"/>'),
    calendar: () => base('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/>'),
    memory: () => base('<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5L5 19"/>'),
    settings: () => base('<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-3v-.7a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L6.7 17l.1-.1A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.6-1H5v-3h.4A1.7 1.7 0 0 0 7 10a1.7 1.7 0 0 0-.3-1.9l-.1-.1L8.8 5.9l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V4h3v.7a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L20 8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.4v3h-.4a1.7 1.7 0 0 0-1.8 1Z"/>'),
    help: () => base('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.8 2.8 0 0 1 5 1.7c0 2-2.5 2.2-2.5 4"/><path d="M12 18h.01"/>'),
    search: () => base('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    bell: () => base('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>'),
    plus: () => base('<path d="M12 5v14M5 12h14"/>'),
    arrowUp: () => base('<path d="m6 15 6-6 6 6"/>'),
    arrowDown: () => base('<path d="m6 9 6 6 6-6"/>'),
    wallet: () => base('<path d="M19 7V6a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v10H5a2 2 0 0 1-2-2V6"/><path d="M16 13h.01"/>'),
    salary: () => base('<path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/>'),
    expense: () => base('<path d="M20 12H4"/><path d="m14 6 6 6-6 6"/>'),
    savings: () => base('<path d="M19 7c-1.5-2-4-3-7-3-5 0-9 3-9 8s4 8 9 8c3 0 5.5-1 7-3"/><path d="M8 12h8"/><path d="M12 8v8"/>'),
    loan: () => base('<path d="M4 19V5"/><path d="M4 17h16"/><path d="M8 14V9"/><path d="M12 14V6"/><path d="M16 14v-4"/>'),
    bill: () => base('<path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z"/><path d="M9 7h6M9 11h6M9 15h4"/>'),
    budget: () => base('<path d="M4 4h16v16H4z"/><path d="M4 10h16M10 20V10"/>'),
    chart: () => base('<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-7"/>'),
    sun: () => base('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/>'),
    moon: () => base('<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8Z"/>'),
    user: () => base('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    spark: () => base('<path d="M12 2 9.6 8.6 3 11l6.6 2.4L12 20l2.4-6.6L21 11l-6.6-2.4Z"/><path d="M5 3v4M3 5h4M19 17v4M17 19h4"/>'),
    eye: () => base('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
    eyeOff: () => base('<path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.1 4.1"/><path d="M6.4 6.4C3.6 8.2 2 12 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4.4-.9"/>'),
    edit: () => base('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    trash: () => base('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>'),
    check: () => base('<path d="m20 6-11 11-5-5"/>'),
    close: () => base('<path d="M18 6 6 18M6 6l12 12"/>'),
    chevron: () => base('<path d="m9 18 6-6-6-6"/>'),
    menu: () => base('<path d="M4 7h16M4 12h16M4 17h16"/>')
  };
})();
