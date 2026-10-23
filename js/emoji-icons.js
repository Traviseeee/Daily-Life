/* Emoji → drawn icons.
   Emoji look different on every phone (Apple, Samsung, Google) and clash with the
   lime/green look. This swaps the emoji the app uses as icons (buttons, titles,
   chips, labels) for our own flat, colourful drawings in the same spirit, so they
   look like emoji but the same everywhere. User text (captions, comments, chat,
   notes) is never touched. */
const EmojiIcons = (() => {
  // Each drawing: viewBox 0 0 24 24. Soft pastel flat style (two tones, a lighter
  // and a slightly deeper half, no outlines, folded paper corners), with small
  // friendly faces on the weather and mood ones. Our own drawings, inspired by
  // the flat "interface" look; the outline UI icons in Icons.* stay as they are.
  const C = {
    salmon: "#ff7a6b", salmon2: "#ff9d90", blue: "#78a6ff", blue2: "#a8c6ff", blue3: "#5a8cf0",
    teal: "#5fd8c6", teal2: "#8fe6d8", yellow: "#ffd25e", yellow2: "#ffe395", amber: "#f9b43c",
    paper: "#e6edf9", paper2: "#cfdbef", grey: "#c4ced9", grey2: "#a3b0bf", ink: "#4d5a6b",
    pink: "#ff9fb3", green: "#7fd16e", green2: "#a6e294", brown: "#c98b5b", brown2: "#a86f45", white: "#ffffff"
  };
  const face = (x, y, k = 1, mouth = "smile") => `<g transform="translate(${x} ${y}) scale(${k})">` +
    `<path d="M-3.2-.6q.9-1 1.8 0M1.4-.6q.9-1 1.8 0" stroke="#6b4a3a" stroke-width=".9" stroke-linecap="round" fill="none"/>` +
    `<circle cx="-4" cy="1.3" r="1.05" fill="${C.pink}" opacity=".85"/><circle cx="4" cy="1.3" r="1.05" fill="${C.pink}" opacity=".85"/>` +
    (mouth === "smile" ? `<path d="M-1 1.2q1 1.1 2 0" stroke="#6b4a3a" stroke-width=".9" stroke-linecap="round" fill="none"/>`
      : `<ellipse cx="0" cy="1.7" rx=".9" ry=".7" fill="#6b4a3a"/>`) + `</g>`;
  const paper = (x, y, w, h, fill = C.paper, fold = C.paper2) =>
    `<path d="M${x + 1.2} ${y}h${w - 2.4}a1.2 1.2 0 0 1 1.2 1.2V${y + h - 3}L${x + w - 3} ${y + h}H${x + 1.2}a1.2 1.2 0 0 1-1.2-1.2V${y + 1.2}A1.2 1.2 0 0 1 ${x + 1.2} ${y}Z" fill="${fill}"/>` +
    `<path d="M${x + w} ${y + h - 3}h-2a1 1 0 0 0-1 1v2Z" fill="${fold}"/>`;
  const heart = color => `<path d="M12 20.8s-8.8-5.1-8.8-11.3a4.9 4.9 0 0 1 8.8-3 4.9 4.9 0 0 1 8.8 3c0 6.2-8.8 11.3-8.8 11.3Z" fill="${color}"/>`;

  const D = {
    moon: `<path d="M14.6 2.8a9 9 0 1 0 6.6 13.6A7.4 7.4 0 0 1 14.6 2.8Z" fill="${C.yellow}"/><path d="M21.2 16.4A9 9 0 0 1 12 21.8a9 9 0 0 1-2.6-.4 7.4 7.4 0 0 0 11.8-5Z" fill="${C.amber}" opacity=".55"/>${face(9.6, 12.4, .9)}<path d="M19 4.6l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5Z" fill="${C.yellow}"/>`,
    sun: `<g fill="${C.amber}">${[0, 45, 90, 135, 180, 225, 270, 315].map(r => `<rect x="11" y="1.2" width="2" height="3.6" rx="1" transform="rotate(${r} 12 12)"/>`).join("")}</g><circle cx="12" cy="12" r="6.6" fill="${C.yellow}"/><path d="M12 5.4a6.6 6.6 0 0 1 0 13.2Z" fill="${C.amber}" opacity=".35"/>${face(12, 12.4)}`,
    cloud: `<path d="M6.6 19.2a4.4 4.4 0 0 1-.4-8.8 6 6 0 0 1 11.6.8 4 4 0 0 1-.2 8Z" fill="#dde7f6"/><path d="M3 16.4a4.4 4.4 0 0 0 3.6 2.8h11a4 4 0 0 0 3.9-3Z" fill="#bccbe4"/>${face(12, 14, .85)}`,
    save: `<path d="M5 3h11.2L20 6.8V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="${C.blue}"/><path d="M13 3h3.2L20 6.8V19a2 2 0 0 1-2 2h-5Z" fill="${C.blue3}" opacity=".35"/><rect x="7" y="3" width="9" height="5.4" rx="1" fill="${C.paper}"/><rect x="12.6" y="4" width="2" height="3.4" rx=".6" fill="${C.blue}"/><rect x="6" y="12" width="12" height="9" rx="1.4" fill="${C.white}"/><path d="M8.4 15h7.2M8.4 17.8h5" stroke="${C.blue2}" stroke-width="1.4" stroke-linecap="round"/>`,
    bell: `<path d="M12 3a6.3 6.3 0 0 1 6.3 6.3v5.2L20 17.6H4l1.7-3.1V9.3A6.3 6.3 0 0 1 12 3Z" fill="${C.yellow}"/><path d="M12 3a6.3 6.3 0 0 1 6.3 6.3v5.2L20 17.6h-8Z" fill="${C.amber}" opacity=".4"/><rect x="10.6" y="1.6" width="2.8" height="2.6" rx="1.2" fill="${C.amber}"/><path d="M9.4 18.8a2.6 2.6 0 0 0 5.2 0Z" fill="${C.salmon}"/>`,
    lock: `<path d="M7.6 10.6V8.2a4.4 4.4 0 0 1 8.8 0v2.4" fill="none" stroke="${C.grey2}" stroke-width="2.4"/><rect x="4.4" y="10" width="15.2" height="11.6" rx="2.6" fill="${C.yellow}"/><path d="M12 10h5a2.6 2.6 0 0 1 2.6 2.6V19a2.6 2.6 0 0 1-2.6 2.6h-5Z" fill="${C.amber}" opacity=".4"/><circle cx="12" cy="14.8" r="1.7" fill="${C.ink}"/><rect x="11.2" y="15.4" width="1.6" height="3" rx=".8" fill="${C.ink}"/>`,
    zzz: `<path d="M3.6 9.4h5l-5 6h5" fill="none" stroke="${C.blue}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 4.6h4.2l-4.2 5h4.2" fill="none" stroke="${C.blue2}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.2 13.4h3.2l-3.2 4h3.2" fill="none" stroke="${C.teal}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
    robot: `<rect x="11.2" y="2" width="1.6" height="3.4" rx=".8" fill="${C.grey2}"/><circle cx="12" cy="2.4" r="1.5" fill="${C.salmon}"/><rect x="4" y="5.6" width="16" height="13.4" rx="3.6" fill="${C.teal}"/><path d="M12 5.6h4.4A3.6 3.6 0 0 1 20 9.2V15.4a3.6 3.6 0 0 1-3.6 3.6H12Z" fill="${C.teal2}" opacity=".5"/><rect x="6.4" y="8.4" width="11.2" height="6" rx="3" fill="${C.white}"/><circle cx="9.6" cy="11.4" r="1.3" fill="${C.ink}"/><circle cx="14.4" cy="11.4" r="1.3" fill="${C.ink}"/><rect x="2" y="10" width="2" height="4.4" rx="1" fill="${C.grey2}"/><rect x="20" y="10" width="2" height="4.4" rx="1" fill="${C.grey2}"/><rect x="9" y="20" width="6" height="2" rx="1" fill="${C.grey2}"/>`,
    play: `<circle cx="12" cy="12" r="9.6" fill="${C.teal}"/><path d="M12 2.4a9.6 9.6 0 0 1 0 19.2Z" fill="${C.teal2}" opacity=".45"/><path d="M10 7.8v8.4l6.6-4.2Z" fill="${C.white}"/>`,
    camera: `<path d="M8.4 5.6 9.6 3.6h4.8l1.2 2H19a2.6 2.6 0 0 1 2.6 2.6v9.6A2.6 2.6 0 0 1 19 20.4H5a2.6 2.6 0 0 1-2.6-2.6V8.2A2.6 2.6 0 0 1 5 5.6Z" fill="${C.salmon}"/><path d="M12 5.6h7a2.6 2.6 0 0 1 2.6 2.6v9.6a2.6 2.6 0 0 1-2.6 2.6h-7Z" fill="${C.salmon2}" opacity=".5"/><circle cx="12" cy="13" r="4.8" fill="${C.ink}"/><circle cx="12" cy="13" r="3.2" fill="${C.paper}"/><circle cx="12" cy="13" r="1.6" fill="${C.grey2}"/><rect x="16.8" y="7.4" width="2.6" height="1.6" rx=".8" fill="${C.white}"/>`,
    moneybag: `<path d="M9 3.4h6l-1.6 3.2h-2.8Z" fill="${C.brown}"/><path d="M10.6 6.6h2.8c4 2 6.6 5.6 6.6 9.2 0 3.4-2.8 5.6-8 5.6s-8-2.2-8-5.6c0-3.6 2.6-7.2 6.6-9.2Z" fill="${C.yellow}"/><path d="M12 6.6h1.4c4 2 6.6 5.6 6.6 9.2 0 3.4-2.8 5.6-8 5.6Z" fill="${C.amber}" opacity=".4"/><rect x="9.4" y="5.8" width="5.2" height="1.6" rx=".8" fill="${C.brown2}"/><path d="M13.7 12.2c-.4-.6-1-.9-1.7-.9-1 0-1.7.5-1.7 1.2 0 1.8 3.6 1 3.6 2.9 0 .8-.8 1.3-1.9 1.3-.9 0-1.5-.4-1.9-1M12 10.4v7.6" fill="none" stroke="${C.brown2}" stroke-width="1.3" stroke-linecap="round"/>`,
    house: `<path d="M4.6 11v8.6A1.4 1.4 0 0 0 6 21h12a1.4 1.4 0 0 0 1.4-1.4V11Z" fill="${C.paper}"/><path d="M12 11h7.4v8.6A1.4 1.4 0 0 1 18 21h-6Z" fill="${C.paper2}" opacity=".7"/><path d="M12 2.6 1.8 11.2l1.5 1.7L12 5.6l8.7 7.3 1.5-1.7Z" fill="${C.salmon}"/><rect x="9.6" y="14" width="4.8" height="7" rx="1" fill="${C.blue}"/><rect x="15.6" y="13" width="2.4" height="2.4" rx=".5" fill="${C.teal}"/>`,
    pig: `<path d="M5.4 7.4 6.6 3.6l3 2.6M18.6 7.4l-1.2-3.8-3 2.6" fill="${C.salmon2}"/><circle cx="12" cy="13" r="8" fill="${C.pink}"/><path d="M12 5a8 8 0 0 1 0 16Z" fill="${C.salmon2}" opacity=".35"/><ellipse cx="12" cy="15.2" rx="3.6" ry="2.6" fill="${C.salmon2}"/><circle cx="10.7" cy="15.2" r=".8" fill="${C.ink}"/><circle cx="13.3" cy="15.2" r=".8" fill="${C.ink}"/><path d="M7.6 10.8q.9-1 1.8 0M14.6 10.8q.9-1 1.8 0" stroke="${C.ink}" stroke-width=".9" stroke-linecap="round" fill="none"/>`,
    plane: `<path d="M21.4 2.6 2.8 10.2c-.9.4-.8 1.6.1 1.9l4.6 1.4 1.7 5.5c.2.7 1.1.9 1.6.4l2.6-2.4 4.6 3.4c.6.4 1.4.1 1.6-.6l3.2-15.6c.2-1-.7-1.9-1.6-1.6Z" fill="${C.blue}"/><path d="m7.5 13.5 11-7.5-8.6 9.6-.5 3.5Z" fill="${C.blue2}"/><path d="M9.9 15.6 13 18l-2.6 2.4Z" fill="${C.blue3}"/>`,
    chart: `${paper(3, 2.5, 18, 19)}<rect x="6.2" y="12" width="2.8" height="6.4" rx="1" fill="${C.teal}"/><rect x="10.6" y="7.6" width="2.8" height="10.8" rx="1" fill="${C.blue}"/><rect x="15" y="10" width="2.8" height="8.4" rx="1" fill="${C.salmon}"/>`,
    family: `<circle cx="7.4" cy="7" r="3" fill="${C.yellow2}"/><circle cx="16.6" cy="7" r="3" fill="${C.yellow}"/><path d="M2.4 20a5 5 0 0 1 10 0Z" fill="${C.blue}"/><path d="M11.6 20a5 5 0 0 1 10 0Z" fill="${C.salmon}"/><circle cx="12" cy="13" r="2.4" fill="${C.yellow2}"/><path d="M8 21.6a4 4 0 0 1 8 0Z" fill="${C.teal}"/>`,
    bolt: `<path d="M13.8 1.8 4.6 13.6h6l-1.4 8.6 9.2-11.8h-6Z" fill="${C.yellow}"/><path d="M13.8 1.8 12.4 10.4h6L9.2 22.2l2.6-8.6Z" fill="${C.amber}" opacity=".55"/>`,
    hourglass: `<rect x="4.6" y="2" width="14.8" height="2.6" rx="1.3" fill="${C.salmon}"/><rect x="4.6" y="19.4" width="14.8" height="2.6" rx="1.3" fill="${C.salmon}"/><path d="M6.6 4.6h10.8c0 4-2.6 5.6-4.2 7.4 1.6 1.8 4.2 3.4 4.2 7.4H6.6c0-4 2.6-5.6 4.2-7.4C9.2 10.2 6.6 8.6 6.6 4.6Z" fill="${C.paper}"/><path d="M8.6 7.6h6.8c-.7 1.5-2 2.4-3.4 3.6-1.4-1.2-2.7-2.1-3.4-3.6ZM7.6 19.4c.3-2 2.4-3 4.4-3s4.1 1 4.4 3Z" fill="${C.yellow}"/>`,
    heartWhite: `<path d="M12 20.8s-8.8-5.1-8.8-11.3a4.9 4.9 0 0 1 8.8-3 4.9 4.9 0 0 1 8.8 3c0 6.2-8.8 11.3-8.8 11.3Z" fill="${C.white}" stroke="${C.grey}" stroke-width="1.5" stroke-linejoin="round"/>`,
    heartRed: `${heart(C.salmon)}<path d="M20.8 9.5c0 6.2-8.8 11.3-8.8 11.3V6.5a4.9 4.9 0 0 1 8.8 3Z" fill="${C.salmon2}" opacity=".45"/>`,
    speech: `<path d="M4.4 3.6h15.2A2.4 2.4 0 0 1 22 6v8.6a2.4 2.4 0 0 1-2.4 2.4H11l-5 4.2V17H4.4A2.4 2.4 0 0 1 2 14.6V6a2.4 2.4 0 0 1 2.4-2.4Z" fill="${C.blue}"/><path d="M12 3.6h7.6A2.4 2.4 0 0 1 22 6v8.6a2.4 2.4 0 0 1-2.4 2.4H12Z" fill="${C.blue2}" opacity=".45"/><circle cx="8" cy="10.4" r="1.3" fill="${C.white}"/><circle cx="12" cy="10.4" r="1.3" fill="${C.white}"/><circle cx="16" cy="10.4" r="1.3" fill="${C.white}"/>`,
    pin: `<path d="M12 22s-6.6-6.6-6.6-11.6a6.6 6.6 0 0 1 13.2 0C18.6 15.4 12 22 12 22Z" fill="${C.salmon}"/><path d="M12 3.8a6.6 6.6 0 0 1 6.6 6.6C18.6 15.4 12 22 12 22Z" fill="${C.salmon2}" opacity=".45"/><circle cx="12" cy="10.2" r="2.6" fill="${C.white}"/>`,
    box: `<path d="M12 2.5 21 7v10l-9 4.5L3 17V7Z" fill="${C.brown}"/><path d="M12 11.5V21.5L21 17V7Z" fill="${C.brown2}" opacity=".45"/><path d="M12 2.5 21 7l-9 4.5L3 7Z" fill="#e3b487"/><path d="m7.5 4.8 9 4.4v3.4l-2 1v-3.4l-9-4.4Z" fill="${C.yellow2}"/>`,
    crystal: `<circle cx="12" cy="10" r="7.6" fill="${C.blue2}"/><path d="M12 2.4a7.6 7.6 0 0 1 0 15.2Z" fill="${C.blue}" opacity=".5"/><path d="M8 7.4a4.4 4.4 0 0 1 3-2.4" stroke="${C.white}" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M14.4 9.6l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z" fill="${C.white}"/><path d="M5.6 22 7.2 17.4h9.6L18.4 22Z" fill="${C.salmon}"/>`,
    moneyWings: `<path d="M3 6.4c2.2-.9 4.2-.3 5.4 1.2-1.8-.1-3.2.4-4 1.2 1-.1 2 .2 2.8.8-1.4.2-2.4.8-3 1.6C2.6 10.2 2.2 8 3 6.4ZM21 6.4c-2.2-.9-4.2-.3-5.4 1.2 1.8-.1 3.2.4 4 1.2-1-.1-2 .2-2.8.8 1.4.2 2.4.8 3 1.6 1.6-1 2-3.2 1.2-4.8Z" fill="${C.blue2}"/><g transform="rotate(-8 12 14)"><rect x="5" y="9" width="14" height="10" rx="1.8" fill="${C.green}"/><path d="M12 9h5.2a1.8 1.8 0 0 1 1.8 1.8v6.4a1.8 1.8 0 0 1-1.8 1.8H12Z" fill="${C.green2}" opacity=".6"/><circle cx="12" cy="14" r="2.3" fill="${C.white}"/><path d="M12 12.8v2.4" stroke="${C.green}" stroke-width="1.1" stroke-linecap="round"/></g>`,
    star: `<path d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9Z" fill="${C.yellow}"/><path d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4Z" fill="${C.amber}" opacity=".45"/>`,
    pencil: `<path d="M16.2 3.2 20.8 7.8 9 19.6 4.4 15Z" fill="${C.yellow}"/><path d="M18.5 5.5 20.8 7.8 9 19.6 6.7 17.3Z" fill="${C.amber}" opacity=".5"/><path d="M16.2 3.2l1.6-1.6a1.6 1.6 0 0 1 2.3 0l2.3 2.3a1.6 1.6 0 0 1 0 2.3l-1.6 1.6Z" fill="${C.salmon}"/><path d="M4.4 15 9 19.6l-6.2 1.6Z" fill="${C.paper2}"/><path d="M2.8 21.2l.7-2.6 1.9 1.9Z" fill="${C.ink}"/>`,
    receipt: `<path d="M5 2.5h14v19l-2.3-1.6-2.4 1.6-2.3-1.6-2.4 1.6-2.3-1.6L5 21.5Z" fill="${C.paper}"/><path d="M12 2.5h7v19l-2.3-1.6-2.4 1.6-2.3-1.6Z" fill="${C.paper2}" opacity=".6"/><path d="M8 7.5h8M8 11h8M8 14.5h5" stroke="${C.blue}" stroke-width="1.5" stroke-linecap="round"/>`,
    calendar: `${paper(3, 4, 18, 17.6)}<path d="M3 6.4A2.4 2.4 0 0 1 5.4 4h13.2A2.4 2.4 0 0 1 21 6.4V9H3Z" fill="${C.salmon}"/><rect x="7" y="2" width="2" height="4.2" rx="1" fill="${C.grey2}"/><rect x="15" y="2" width="2" height="4.2" rx="1" fill="${C.grey2}"/><path d="m8.6 14.2 2.3 2.3 4.6-4.6" stroke="${C.teal}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    check: `<circle cx="12" cy="12" r="9.6" fill="${C.teal}"/><path d="M12 2.4a9.6 9.6 0 0 1 0 19.2Z" fill="${C.teal2}" opacity=".45"/><path d="M7.4 12.4l3.1 3.1 6.1-6.2" fill="none" stroke="${C.white}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    alarm: `<circle cx="12" cy="13" r="8" fill="${C.salmon}"/><circle cx="12" cy="13" r="6" fill="${C.paper}"/><path d="M12 9v4.4l2.6 1.6" stroke="${C.ink}" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M2.8 6.4a3.6 3.6 0 0 1 4.8-3.8M21.2 6.4a3.6 3.6 0 0 0-4.8-3.8" stroke="${C.salmon}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`,
    party: `<path d="M3 21.5 8.4 7l8.6 8.6Z" fill="${C.yellow}"/><path d="M3 21.5 6.2 13l4.8 4.8Z" fill="${C.amber}" opacity=".6"/><path d="M14 3.5c.8 1.2.7 2.6-.2 3.6M19.6 9c-1.2-.4-2.6 0-3.4 1M18 2.5l.6 1.6M21.5 5.5l-1.6.4" stroke="${C.salmon}" stroke-width="1.6" stroke-linecap="round" fill="none"/><circle cx="20" cy="13" r="1.1" fill="${C.blue}"/><circle cx="11" cy="3" r="1" fill="${C.teal}"/>`,
    umbrella: `<path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9Z" fill="${C.teal}"/><path d="M12 3a9 9 0 0 1 9 9h-9Z" fill="${C.teal2}" opacity=".5"/><path d="M12 12v6.6a2 2 0 0 1-4 0" stroke="${C.brown2}" stroke-width="1.8" stroke-linecap="round" fill="none"/>`,
    drop: `<path d="M12 2.5s6.6 7.2 6.6 11.8a6.6 6.6 0 0 1-13.2 0C5.4 9.7 12 2.5 12 2.5Z" fill="${C.blue}"/><path d="M12 2.5s6.6 7.2 6.6 11.8A6.6 6.6 0 0 1 12 20.9Z" fill="${C.blue2}" opacity=".45"/>${face(12, 14.6, .75)}`,
    noodles: `<path d="M2.5 11.5h19a9.5 9.5 0 0 1-19 0Z" fill="${C.salmon}"/><path d="M12 11.5h9.5A9.5 9.5 0 0 1 12 21Z" fill="${C.salmon2}" opacity=".5"/><path d="M6 11.5c0-2 1.4-2.6 2-4.6M9.5 11.5c0-2 1.4-2.6 2-4.6M13 11.5c0-2 1.4-2.6 2-4.6" stroke="${C.yellow}" stroke-width="1.5" stroke-linecap="round" fill="none"/><path d="M15 2.5 20 10M18 2l2.6 8" stroke="${C.brown}" stroke-width="1.4" stroke-linecap="round"/>`,
    car: `<path d="M4.5 11 6.6 5.6A2 2 0 0 1 8.5 4.3h7a2 2 0 0 1 1.9 1.3L19.5 11Z" fill="${C.salmon}"/><rect x="2.5" y="10" width="19" height="7.5" rx="2.4" fill="${C.salmon}"/><path d="M12 10h7.1a2.4 2.4 0 0 1 2.4 2.4V15a2.4 2.4 0 0 1-2.4 2.5H12Z" fill="${C.salmon2}" opacity=".5"/><path d="M7.3 10l1.4-3.6h6.6L16.7 10Z" fill="${C.blue2}"/><circle cx="7" cy="17.5" r="2.4" fill="${C.ink}"/><circle cx="17" cy="17.5" r="2.4" fill="${C.ink}"/><rect x="3.6" y="12" width="2.8" height="1.6" rx=".8" fill="${C.yellow}"/><rect x="17.6" y="12" width="2.8" height="1.6" rx=".8" fill="${C.yellow}"/>`,
    bag: `<path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" fill="none" stroke="${C.ink}" stroke-width="1.8"/><path d="M4.6 7.5h14.8l1.1 13a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5Z" fill="${C.teal}"/><path d="M12 7.5h7.4l1.1 13a1.5 1.5 0 0 1-1.5 1.5H12Z" fill="${C.teal2}" opacity=".5"/><circle cx="8.5" cy="10.5" r=".9" fill="${C.ink}"/><circle cx="15.5" cy="10.5" r=".9" fill="${C.ink}"/>`,
    bank: `<path d="M12 2.5 22 7.5v1.5H2V7.5Z" fill="${C.blue}"/><path d="M12 2.5 22 7.5v1.5h-10Z" fill="${C.blue3}" opacity=".4"/><g fill="${C.paper}"><rect x="4" y="10" width="2.6" height="8" rx=".6"/><rect x="8.6" y="10" width="2.6" height="8" rx=".6"/><rect x="12.8" y="10" width="2.6" height="8" rx=".6"/><rect x="17.4" y="10" width="2.6" height="8" rx=".6"/></g><rect x="2.5" y="18.5" width="19" height="3" rx="1" fill="${C.blue}"/><circle cx="12" cy="6.4" r="1.4" fill="${C.yellow}"/>`,
    pill: `<g transform="rotate(-40 12 12)"><rect x="2.2" y="8.4" width="19.6" height="7.2" rx="3.6" fill="${C.paper}"/><path d="M12 8.4H5.8a3.6 3.6 0 0 0 0 7.2H12Z" fill="${C.salmon}"/><path d="M5.6 10.6h3" stroke="${C.salmon2}" stroke-width="1.2" stroke-linecap="round"/></g>`,
    books: `<rect x="3" y="4" width="5" height="17" rx="1.2" fill="${C.blue}"/><rect x="8.6" y="6" width="5" height="15" rx="1.2" fill="${C.teal}"/><rect x="14.2" y="3.8" width="4.6" height="17" rx="1.2" transform="rotate(12 16.5 12.3)" fill="${C.salmon}"/><path d="M3 8h5M8.6 9.4h5" stroke="${C.white}" stroke-width="1.2" opacity=".8"/>`,
    clapper: `<rect x="2.5" y="9" width="19" height="12.5" rx="2" fill="${C.ink}"/><path d="M12 9h7.5a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H12Z" fill="#5f6d80"/><path d="M2.2 5.6 20.6 2.4l.6 3.4L2.8 9Z" fill="${C.paper}"/><path d="M6.4 4.9 5.6 8.4M11 4.1l-.8 3.5M15.6 3.3l-.8 3.5" stroke="${C.ink}" stroke-width="1.6"/><path d="M10 13.6v5l4.2-2.5Z" fill="${C.yellow}"/>`,
    globe: `<circle cx="12" cy="12" r="9.5" fill="${C.blue}"/><path d="M8 5.4c1.6 1 2.6 2.6 1.6 4-1.2 1.6-3.4 1-4 3.2-.4 1.6.8 3 .4 4.6A9.5 9.5 0 0 1 8 5.4ZM14.6 3c.4 1.6 2 2 3.4 2.4 1.2 1.6.8 3.6-.6 4.4-1.6.8-1.2 2.8-2.6 3.8-1 .7-2.4.2-2.6 1.6-.2 1.8 1.8 2.6 1.6 4.6A9.5 9.5 0 0 0 14.6 3Z" fill="${C.teal}"/><path d="M12 2.5a9.5 9.5 0 0 1 0 19Z" fill="${C.blue3}" opacity=".2"/>`,
    phone: `<rect x="6" y="1.8" width="12" height="20.4" rx="3" fill="${C.ink}"/><rect x="7.4" y="4.2" width="9.2" height="14.6" rx="1.2" fill="${C.blue2}"/><path d="M12 4.2h3.4a1.2 1.2 0 0 1 1.2 1.2v12.2a1.2 1.2 0 0 1-1.2 1.2H12Z" fill="${C.blue}" opacity=".5"/><rect x="10.4" y="19.6" width="3.2" height="1.1" rx=".55" fill="${C.grey}"/>`,
    sparkles: `<path d="M10 2.5l1.7 5.1 5.1 1.7-5.1 1.7L10 16.1l-1.7-5.1-5.1-1.7 5.1-1.7Z" fill="${C.yellow}"/><path d="M18 13l.9 2.6 2.6.9-2.6.9L18 20l-.9-2.6-2.6-.9 2.6-.9Z" fill="${C.teal}"/><path d="M18.5 2.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6Z" fill="${C.salmon}"/>`,
    seedling: `<path d="M12 21.5V12" stroke="${C.green}" stroke-width="2" stroke-linecap="round"/><path d="M12 13C12 8 8.6 5 3.5 5.2 3.5 10 6.6 13 12 13Z" fill="${C.green}"/><path d="M12 11.5c0-4.4 3-7.2 8.5-7 0 4.6-3.2 7.2-8.5 7Z" fill="${C.green2}"/><path d="M6.5 21.5h11" stroke="${C.brown}" stroke-width="2" stroke-linecap="round"/>`,
    leaf: `<path d="M20.5 3.5C9 3.5 3.5 9 3.5 16.5c0 1.4.3 2.6.8 3.6C12.5 20.6 20.5 15 20.5 3.5Z" fill="${C.green}"/><path d="M20.5 3.5C20.5 15 12.5 20.6 4.3 20.1c5-2.6 10.6-8.4 16.2-16.6Z" fill="${C.green2}" opacity=".6"/><path d="M4.5 20 15 9" stroke="${C.white}" stroke-width="1.3" stroke-linecap="round" opacity=".8"/>`,
    heartYellow: `${heart(C.yellow)}<path d="M20.8 9.5c0 6.2-8.8 11.3-8.8 11.3V6.5a4.9 4.9 0 0 1 8.8 3Z" fill="${C.amber}" opacity=".4"/>`,
    muscle: `<path d="M5 20.5c-1.5-3.5-1-8 1.2-11.2L9 4.6c.5-.9 1.6-1.3 2.6-.8l1.4.7c.9.5 1.2 1.6.7 2.5l-1.6 2.6c2-1.2 4.8-1.3 6.6.3 2.4 2.1 2.2 6.2-.6 8.6-2.4 2.1-6.2 2.6-13.1 2Z" fill="${C.yellow2}"/><path d="M12.1 10.6c2-1.2 4.8-1.3 6.6.3 2.4 2.1 2.2 6.2-.6 8.6-1.4 1.2-3.2 1.8-6 2 4.4-1.6 6.4-4.6 5.2-7.8-.8-2-2.8-3-5.2-3.1Z" fill="${C.amber}" opacity=".5"/><path d="M9 13.6c1.2 1.6 3.2 2 5 1.2" stroke="${C.brown}" stroke-width="1.3" stroke-linecap="round" fill="none"/>`,
    smile: `<circle cx="12" cy="12" r="9.5" fill="${C.yellow}"/><path d="M12 2.5a9.5 9.5 0 0 1 0 19Z" fill="${C.amber}" opacity=".3"/>${face(12, 12.4, 1.35)}`,
    shield: `<path d="M12 2 20 5v6.4c0 5-3.4 8.8-8 10.6-4.6-1.8-8-5.6-8-10.6V5Z" fill="${C.blue}"/><path d="M12 2 20 5v6.4c0 5-3.4 8.8-8 10.6Z" fill="${C.blue2}" opacity=".5"/><path d="m8.4 11.8 2.6 2.6 4.8-5" stroke="${C.white}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  };

  // emoji (without the U+FE0F variation selector) → drawing
  const MAP = {
    "🌙": "moon", "☀": "sun", "🌞": "sun", "☁": "cloud", "💾": "save", "🔔": "bell", "🔒": "lock", "🔐": "lock",
    "💤": "zzz", "🤖": "robot", "▶": "play", "📸": "camera", "📷": "camera", "💰": "moneybag", "🏠": "house",
    "🐷": "pig", "✈": "plane", "📊": "chart", "👨‍👩‍👧": "family", "👨‍👩‍👧‍👦": "family", "⚡": "bolt", "⏳": "hourglass",
    "🤍": "heartWhite", "❤": "heartRed", "💬": "speech", "📍": "pin", "📦": "box", "🔮": "crystal", "💸": "moneyWings",
    "★": "star", "⭐": "star", "✏": "pencil", "🧾": "receipt", "📅": "calendar", "📆": "calendar", "✅": "check",
    "⏰": "alarm", "🎉": "party", "☂": "umbrella", "☔": "umbrella", "💧": "drop", "🍜": "noodles", "🚗": "car",
    "🛍": "bag", "🏦": "bank", "💊": "pill", "📚": "books", "🎬": "clapper", "🌐": "globe", "📱": "phone", "🛡": "shield", "✨": "sparkles", "🌱": "seedling", "🍃": "leaf", "💛": "heartYellow", "💪": "muscle", "😊": "smile"
  };
  const keys = Object.keys(MAP).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const RE = new RegExp(`(${keys.join("|")})\\uFE0F?`, "gu");
  const TEST = new RegExp(`(${keys.join("|")})`, "u");

  // where an emoji is an icon (UI chrome), and where it is someone's words
  const ICON_PLACES = "button, a, h1, h2, h3, h4, summary, label, strong, .pill, .chip, [class*='chip'], [class*='icon'], [class*='badge'], [class*='tab'], .settings-summary-chips, .page-subtitle, .settings-whats-new li, .settings-release li, .ai-set-status, .home-hero-panel, .home-challenge-card, .settings-preference-row, .mf-teaser-head, .tw-card-tip, .tw-hour, .toast, .qx-bolt, .ai-set-note, .nc-icon, .eyebrow, .section-title, .mf-meta, .mf-post-who";
  const NEVER = "textarea, input, select, [contenteditable], code, pre, .mf-caption, .mf-comment, .mf-comment-text, .mlc-messages, .chat-message, .cb-msg, .tip-body, .memory-text, .reflection-textarea, script, style, svg, .emo";

  function svg(name, label) {
    const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
    return `<svg class="emo emo-${name}" viewBox="0 0 24 24" ${a11y} focusable="false">${D[name]}</svg>`;
  }

  function swapText(node) {
    const text = node.nodeValue;
    if (!text || !TEST.test(text)) return;
    const host = node.parentElement;
    if (!host || host.closest(NEVER) || !host.closest(ICON_PLACES)) return;
    const alone = text.replace(RE, "").trim() === "" && !host.textContent.replace(RE, "").trim();
    const frag = document.createDocumentFragment();
    let last = 0;
    text.replace(RE, (match, emoji, offset) => {
      if (offset > last) frag.appendChild(document.createTextNode(text.slice(last, offset)));
      const holder = document.createElement("span");
      holder.innerHTML = svg(MAP[emoji], alone ? match : "");
      frag.appendChild(holder.firstChild);
      last = offset + match.length;
      return match;
    });
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.replaceWith(frag);
  }

  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) return swapText(root);
    if (root.nodeType !== 1 || root.closest?.(NEVER)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (TEST.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
    });
    const found = [];
    while (walker.nextNode()) found.push(walker.currentNode);
    found.forEach(swapText);
  }

  let queued = new Set();
  let timer = 0;
  function queue(node) {
    queued.add(node);
    if (timer) return;
    timer = requestAnimationFrame(() => {
      const nodes = queued; queued = new Set(); timer = 0;
      nodes.forEach(n => n.isConnected && scan(n));
    });
  }

  function start() {
    scan(document.body);
    new MutationObserver(list => {
      for (const m of list) {
        if (m.type === "characterData") queue(m.target);
        else m.addedNodes.forEach(queue);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (typeof window !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }
  return { svg, scan, names: Object.keys(D) };
})();

if (typeof window !== "undefined") window.EmojiIcons = EmojiIcons;
