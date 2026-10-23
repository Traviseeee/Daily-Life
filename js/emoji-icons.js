/* Emoji → drawn icons.
   Emoji look different on every phone (Apple, Samsung, Google) and clash with the
   lime/green look. This swaps the emoji the app uses as icons (buttons, titles,
   chips, labels) for our own flat, colourful drawings in the same spirit, so they
   look like emoji but the same everywhere. User text (captions, comments, chat,
   notes) is never touched. */
const EmojiIcons = (() => {
  // each drawing: viewBox 0 0 24 24, flat colours + one darker shade + a soft highlight
  const D = {
    moon: '<path d="M15.5 3.2A9 9 0 1 0 20.8 15 7.5 7.5 0 0 1 15.5 3.2Z" fill="#ffcf3f"/><path d="M20.8 15a9 9 0 0 1-15.9 2.6A7.6 7.6 0 0 0 18.4 15.4c.8 0 1.6-.1 2.4-.4Z" fill="#f2ab1b"/><circle cx="10" cy="9" r="1.3" fill="#f2ab1b" opacity=".55"/><circle cx="8.4" cy="14" r=".9" fill="#f2ab1b" opacity=".55"/>',
    sun: '<g fill="#ffb21e"><rect x="11" y="1" width="2" height="4.2" rx="1"/><rect x="11" y="18.8" width="2" height="4.2" rx="1"/><rect x="1" y="11" width="4.2" height="2" rx="1"/><rect x="18.8" y="11" width="4.2" height="2" rx="1"/><rect x="3.6" y="3.6" width="2" height="4" rx="1" transform="rotate(-45 4.6 5.6)"/><rect x="18.4" y="16.4" width="2" height="4" rx="1" transform="rotate(-45 19.4 18.4)"/><rect x="16.4" y="3.6" width="4" height="2" rx="1" transform="rotate(-45 18.4 4.6)"/><rect x="3.6" y="18.4" width="4" height="2" rx="1" transform="rotate(-45 5.6 19.4)"/></g><circle cx="12" cy="12" r="5.6" fill="#ffd23f"/><path d="M12 6.4a5.6 5.6 0 0 1 0 11.2 5.6 5.6 0 0 0 0-11.2Z" fill="#f5b51c"/>',
    cloud: '<path d="M7 19a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5 4.8 4.8 0 0 1 17.5 19Z" fill="#eef3f7" stroke="#aebfcc" stroke-width="1.1"/><path d="M5 17.6A4.4 4.4 0 0 0 7 19h10.5a4.8 4.8 0 0 0 4.4-3H5Z" fill="#c6d3dd"/>',
    save: '<rect x="3" y="3" width="18" height="18" rx="3" fill="#3f86c8"/><rect x="7" y="3" width="10" height="6.5" rx="1" fill="#e9f1f8"/><rect x="13.4" y="4.2" width="2" height="4" rx=".6" fill="#3f86c8"/><rect x="6" y="13" width="12" height="8" rx="1.2" fill="#f7fafc"/><path d="M8 15.6h8M8 18h6" stroke="#9fb7cc" stroke-width="1.2" stroke-linecap="round"/>',
    bell: '<path d="M12 2.6a1.6 1.6 0 0 1 1.6 1.6v.5a6.4 6.4 0 0 1 4.8 6.2v4.3l1.8 2.4H3.8l1.8-2.4v-4.3a6.4 6.4 0 0 1 4.8-6.2v-.5A1.6 1.6 0 0 1 12 2.6Z" fill="#ffc531"/><path d="M18.4 15.2v-4.3a6.4 6.4 0 0 0-4.2-6 6.4 6.4 0 0 1 1.2 3.8v8.9h4.8Z" fill="#eaa416"/><circle cx="12" cy="19.6" r="2.4" fill="#c27c0e"/><path d="M8 9.2a4 4 0 0 1 2.2-3" stroke="#fff3c4" stroke-width="1.3" stroke-linecap="round" fill="none"/>',
    lock: '<path d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5" fill="none" stroke="#9aa7b4" stroke-width="2.4"/><rect x="4.5" y="10" width="15" height="11.5" rx="3" fill="#ffc531"/><path d="M19.5 13v5.5a3 3 0 0 1-3 3h-4.4l7.4-8.5Z" fill="#eaa416"/><circle cx="12" cy="15" r="1.7" fill="#8a5a0b"/><rect x="11.2" y="15.6" width="1.6" height="3" rx=".8" fill="#8a5a0b"/>',
    zzz: '<path d="M4 9h5l-5 6h5" fill="none" stroke="#6aa8ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 5h4l-4 5h4" fill="none" stroke="#8fc0ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 13h3l-3 4h3" fill="none" stroke="#4f8ff0" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    robot: '<rect x="11.2" y="1.5" width="1.6" height="4" rx=".8" fill="#9aa7b4"/><circle cx="12" cy="2.2" r="1.6" fill="#ff5d5d"/><rect x="4" y="5.5" width="16" height="13" rx="4" fill="#d9e3ea"/><rect x="6.2" y="8" width="11.6" height="6.4" rx="3" fill="#0f3326"/><circle cx="9.4" cy="11.2" r="1.4" fill="#c5ff60"/><circle cx="14.6" cy="11.2" r="1.4" fill="#c5ff60"/><rect x="2" y="9.5" width="2.2" height="5" rx="1" fill="#9aa7b4"/><rect x="19.8" y="9.5" width="2.2" height="5" rx="1" fill="#9aa7b4"/><path d="M9 21.5h6" stroke="#9aa7b4" stroke-width="2" stroke-linecap="round"/>',
    play: '<rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="#36b26b"/><path d="M10 7.8v8.4l6.6-4.2Z" fill="#fff"/>',
    camera: '<path d="M8.5 5.5 9.8 3.6h4.4l1.3 1.9H19a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8.5a3 3 0 0 1 3-3Z" fill="#4a5563"/><path d="M2 15h20v3a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z" fill="#3a434f"/><circle cx="12" cy="13" r="5" fill="#d9e3ea"/><circle cx="12" cy="13" r="3.4" fill="#5aa9e6"/><circle cx="10.8" cy="11.8" r="1.1" fill="#e6f4ff"/><rect x="17.4" y="7.4" width="2.6" height="1.6" rx=".8" fill="#ffd23f"/>',
    moneybag: '<path d="M9 3.5h6l-1.6 3.3h-2.8Z" fill="#d79a3d"/><path d="M10.6 6.8h2.8c4 2 6.6 5.6 6.6 9.2 0 3.3-2.8 5.5-8 5.5s-8-2.2-8-5.5c0-3.6 2.6-7.2 6.6-9.2Z" fill="#f0b955"/><path d="M20 16c0 3.3-2.8 5.5-8 5.5-2 0-3.7-.3-5-.9 6.8.4 10.6-2.6 9.8-9.4A8.6 8.6 0 0 1 20 16Z" fill="#d79a3d"/><rect x="9.2" y="6" width="5.6" height="1.6" rx=".8" fill="#9c6a1f"/><path d="M13.8 12.4c-.4-.7-1-1-1.8-1-1 0-1.8.5-1.8 1.3 0 1.9 3.8 1 3.8 3 0 .9-.9 1.4-2 1.4-.9 0-1.6-.4-2-1.1M12 10.4v8" fill="none" stroke="#7a5214" stroke-width="1.3" stroke-linecap="round"/>',
    house: '<path d="M4.5 11.2V20a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-8.8Z" fill="#f6dcae"/><path d="M12 2.8 1.8 11.4l1.4 1.6L12 5.6l8.8 7.4 1.4-1.6Z" fill="#e3533c"/><rect x="9.6" y="14" width="4.8" height="7.5" rx="1" fill="#9a5f33"/><rect x="15.6" y="13" width="2.6" height="2.6" rx=".5" fill="#7cc4f2"/><path d="M19.5 13v7a1.5 1.5 0 0 1-1.5 1.5h-3.6v-7.5" fill="#000" opacity=".06"/>',
    pig: '<circle cx="12" cy="13" r="8" fill="#ffb4c8"/><path d="M5 7.5 6.5 3.5 9.5 6M19 7.5 17.5 3.5 14.5 6" fill="#ff94b0"/><ellipse cx="12" cy="15.4" rx="3.6" ry="2.6" fill="#ff8fab"/><circle cx="10.7" cy="15.4" r=".8" fill="#b4466a"/><circle cx="13.3" cy="15.4" r=".8" fill="#b4466a"/><circle cx="8.7" cy="11" r="1" fill="#3a2a2f"/><circle cx="15.3" cy="11" r="1" fill="#3a2a2f"/>',
    plane: '<path d="M21.4 2.6 2.8 10.2c-.9.4-.8 1.6.1 1.9l4.6 1.4 1.7 5.5c.2.7 1.1.9 1.6.4l2.6-2.4 4.6 3.4c.6.4 1.4.1 1.6-.6l3.2-15.6c.2-1-.7-1.9-1.6-1.6Z" fill="#45a6e8"/><path d="m7.5 13.5 11-7.5-8.6 9.6-.5 3.5Z" fill="#c9e7fb"/><path d="M9.9 15.6 13 18l-2.6 2.4Z" fill="#2a7fbc"/>',
    chart: '<rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="#f4f7f9" stroke="#c4ced6" stroke-width="1"/><rect x="5.8" y="11.5" width="3" height="7" rx="1" fill="#4a9be0"/><rect x="10.5" y="7" width="3" height="11.5" rx="1" fill="#36b26b"/><rect x="15.2" y="9.5" width="3" height="9" rx="1" fill="#f59a3a"/><path d="M5 19.5h14" stroke="#c4ced6" stroke-width="1.2" stroke-linecap="round"/>',
    family: '<circle cx="7.5" cy="7" r="3" fill="#f2b277"/><circle cx="16.5" cy="7" r="3" fill="#e79c62"/><path d="M2.5 20a5 5 0 0 1 10 0Z" fill="#4a9be0"/><path d="M11.5 20a5 5 0 0 1 10 0Z" fill="#ef6f8e"/><circle cx="12" cy="13" r="2.4" fill="#f6c08f"/><path d="M8 21.5a4 4 0 0 1 8 0Z" fill="#36b26b"/>',
    bolt: '<path d="M13.8 1.8 4.6 13.6h6l-1.4 8.6 9.2-11.8h-6Z" fill="#ffc531"/><path d="M13.8 1.8 12.4 10.4h6L9.2 22.2l2.6-8.6Z" fill="#f5a316"/>',
    hourglass: '<rect x="4.5" y="2" width="15" height="2.6" rx="1.3" fill="#a8692c"/><rect x="4.5" y="19.4" width="15" height="2.6" rx="1.3" fill="#a8692c"/><path d="M6.5 4.6h11c0 4-2.6 5.6-4.2 7.4 1.6 1.8 4.2 3.4 4.2 7.4h-11c0-4 2.6-5.6 4.2-7.4C9.1 10.2 6.5 8.6 6.5 4.6Z" fill="#e8f2f8"/><path d="M8.6 7.6h6.8c-.7 1.5-2 2.4-3.4 3.6-1.4-1.2-2.7-2.1-3.4-3.6ZM7.6 19.4c.3-2 2.4-3 4.4-3s4.1 1 4.4 3Z" fill="#ffbf3c"/>',
    heartWhite: '<path d="M12 20.6s-8.6-5.2-8.6-11.2A4.9 4.9 0 0 1 12 6.6a4.9 4.9 0 0 1 8.6 2.8c0 6-8.6 11.2-8.6 11.2Z" fill="#fff" stroke="#c3ccd4" stroke-width="1.4" stroke-linejoin="round"/>',
    heartRed: '<path d="M12 20.6s-8.6-5.2-8.6-11.2A4.9 4.9 0 0 1 12 6.6a4.9 4.9 0 0 1 8.6 2.8c0 6-8.6 11.2-8.6 11.2Z" fill="#ff4d6a"/><path d="M20.6 9.4c0 6-8.6 11.2-8.6 11.2s-1.6-1-3.4-2.6c6.4 2.2 11.4-3.8 10.2-10.6a4.9 4.9 0 0 1 1.8 2Z" fill="#e0304f"/><path d="M6.4 8.6a2.4 2.4 0 0 1 2.2-1.4" stroke="#ffc2cc" stroke-width="1.4" stroke-linecap="round" fill="none"/>',
    speech: '<path d="M4.5 3.5h15a2.5 2.5 0 0 1 2.5 2.5v9a2.5 2.5 0 0 1-2.5 2.5H11l-5 4v-4H4.5A2.5 2.5 0 0 1 2 15V6a2.5 2.5 0 0 1 2.5-2.5Z" fill="#e6eef5"/><path d="M22 13v2a2.5 2.5 0 0 1-2.5 2.5H11l-5 4v-4H4.5A2.5 2.5 0 0 1 2 15v-2Z" fill="#c9d6e1"/><circle cx="8" cy="10.5" r="1.3" fill="#6b7c8c"/><circle cx="12" cy="10.5" r="1.3" fill="#6b7c8c"/><circle cx="16" cy="10.5" r="1.3" fill="#6b7c8c"/>',
    pin: '<path d="M12 22.5 9.8 13h4.4Z" fill="#8c98a4"/><circle cx="12" cy="8.5" r="6.5" fill="#ef4848"/><path d="M18.5 8.5a6.5 6.5 0 0 1-10.6 5 6.5 6.5 0 0 0 7.2-11 6.5 6.5 0 0 1 3.4 6Z" fill="#cf2f34"/><circle cx="9.8" cy="6.4" r="1.7" fill="#ffb3b3"/>',
    box: '<path d="M12 2.5 21 7v10l-9 4.5L3 17V7Z" fill="#d49a5a"/><path d="M12 11.5V21.5L3 17V7Z" fill="#c0844a"/><path d="M12 2.5 21 7l-9 4.5L3 7Z" fill="#e5b47a"/><path d="m7.5 4.8 9 4.4v3.4l-2 1v-3.4l-9-4.4Z" fill="#f3d9ae"/>',
    crystal: '<circle cx="12" cy="10" r="7.6" fill="#a98bf5"/><path d="M19.6 10a7.6 7.6 0 0 1-13 5.4A7.6 7.6 0 0 0 16.8 4.1 7.6 7.6 0 0 1 19.6 10Z" fill="#8b6be8"/><path d="M8 7.4a4.4 4.4 0 0 1 3-2.4" stroke="#e7dcff" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M14.4 9.6l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z" fill="#fff"/><path d="M5.5 22 7 17.4h10l1.5 4.6Z" fill="#9b6a3b"/>',
    moneyWings: '<path d="M3 6.2c2.2-.9 4.2-.3 5.4 1.2-1.8-.1-3.2.4-4 1.2 1-.1 2 .2 2.8.8-1.4.2-2.4.8-3 1.6C2.6 10 2.2 7.8 3 6.2ZM21 6.2c-2.2-.9-4.2-.3-5.4 1.2 1.8-.1 3.2.4 4 1.2-1-.1-2 .2-2.8.8 1.4.2 2.4.8 3 1.6 1.6-1 2-3.2 1.2-4.8Z" fill="#f4f7f9" stroke="#aebfcc" stroke-width=".9" stroke-linejoin="round"/><g transform="rotate(-8 12 14)"><rect x="5" y="9" width="14" height="10" rx="1.8" fill="#5cc27a"/><rect x="5" y="15.6" width="14" height="3.4" rx="1.2" fill="#3fa35f"/><rect x="6.6" y="10.6" width="10.8" height="6.8" rx="1" fill="none" stroke="#c8f0d2" stroke-width=".9"/><circle cx="12" cy="14" r="2.1" fill="#c8f0d2"/><path d="M12 12.8v2.4" stroke="#3fa35f" stroke-width="1" stroke-linecap="round"/></g>',
    star: '<path d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9Z" fill="#ffc531"/><path d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4Z" fill="#f2a516"/>',
    pencil: '<path d="M16.2 3.2 20.8 7.8 9 19.6 4.4 15Z" fill="#ffc531"/><path d="M18.5 5.5 20.8 7.8 9 19.6 6.7 17.3Z" fill="#f2a516"/><path d="M16.2 3.2l1.6-1.6a1.6 1.6 0 0 1 2.3 0l2.3 2.3a1.6 1.6 0 0 1 0 2.3l-1.6 1.6Z" fill="#ff8fab"/><path d="M4.4 15 9 19.6l-6.2 1.6Z" fill="#f6dcae"/><path d="M2.8 21.2l.7-2.6 1.9 1.9Z" fill="#4a5563"/>',
    receipt: '<path d="M5 2.5h14v19l-2.3-1.6-2.4 1.6-2.3-1.6-2.4 1.6-2.3-1.6L5 21.5Z" fill="#f4f7f9" stroke="#b9c6d0" stroke-width="1" stroke-linejoin="round"/><path d="M19 2.5v19l-2.3-1.6-2.4 1.6V2.5Z" fill="#dfe6ec"/><path d="M8 7.5h8M8 11h8M8 14.5h5" stroke="#8c98a4" stroke-width="1.4" stroke-linecap="round"/>',
    calendar: '<rect x="3" y="4" width="18" height="17.5" rx="3" fill="#f4f7f9" stroke="#c4ced6" stroke-width="1"/><path d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2.5H3Z" fill="#ef4848"/><rect x="7" y="2" width="2" height="4.4" rx="1" fill="#8c98a4"/><rect x="15" y="2" width="2" height="4.4" rx="1" fill="#8c98a4"/><text x="12" y="18.6" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="8" font-weight="800" fill="#3a434f">17</text>',
    check: '<rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="#36b26b"/><path d="M7 12.4l3.2 3.2L17.2 8.6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    alarm: '<circle cx="12" cy="13" r="8" fill="#ef4848"/><circle cx="12" cy="13" r="6" fill="#fff"/><path d="M12 9v4.4l2.6 1.6" stroke="#3a434f" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M2.8 6.4a3.6 3.6 0 0 1 4.8-3.8M21.2 6.4a3.6 3.6 0 0 0-4.8-3.8" stroke="#cf2f34" stroke-width="2.2" stroke-linecap="round" fill="none"/>',
    party: '<path d="M3 21.5 8.4 7l8.6 8.6Z" fill="#ffc531"/><path d="M3 21.5 6.2 13l4.8 4.8Z" fill="#f2a516"/><path d="M14 3.5c.8 1.2.7 2.6-.2 3.6M19.6 9c-1.2-.4-2.6 0-3.4 1M18 2.5l.6 1.6M21.5 5.5l-1.6.4" stroke="#ef4f7b" stroke-width="1.6" stroke-linecap="round" fill="none"/><circle cx="20" cy="13" r="1.1" fill="#4a9be0"/><circle cx="11" cy="3" r="1" fill="#36b26b"/>',
    umbrella: '<path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9Z" fill="#3f86c8"/><path d="M12 3c2.6 2 3.6 5.6 3.6 9h-7.2C8.4 8.6 9.4 5 12 3Z" fill="#5aa9e6"/><path d="M12 12v6.6a2 2 0 0 1-4 0" stroke="#4a5563" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
    drop: '<path d="M12 2.5s6.5 7.2 6.5 11.7a6.5 6.5 0 0 1-13 0C5.5 9.7 12 2.5 12 2.5Z" fill="#3fb6ee"/><path d="M18.5 14.2a6.5 6.5 0 0 1-11 4.7 6.5 6.5 0 0 0 9.5-8.7c1 1.4 1.5 2.8 1.5 4Z" fill="#1f95cf"/><path d="M8.8 14.6a3.4 3.4 0 0 0 2 3" stroke="#c9eeff" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
    noodles: '<path d="M2.5 11.5h19a9.5 9.5 0 0 1-19 0Z" fill="#ef6f3f"/><path d="M21.5 11.5a9.5 9.5 0 0 1-15.6 7.3 9.5 9.5 0 0 0 13.3-7.3Z" fill="#cf5226"/><path d="M6 11.5c0-2 1.4-2.6 2-4.6M9.5 11.5c0-2 1.4-2.6 2-4.6M13 11.5c0-2 1.4-2.6 2-4.6" stroke="#ffe08a" stroke-width="1.4" stroke-linecap="round" fill="none"/><path d="M15 2.5 20 10M18 2l2.6 8" stroke="#a8692c" stroke-width="1.4" stroke-linecap="round"/>',
    car: '<path d="M4.5 11 6.6 5.6A2 2 0 0 1 8.5 4.3h7a2 2 0 0 1 1.9 1.3L19.5 11Z" fill="#ef4848"/><rect x="2.5" y="10" width="19" height="7.5" rx="2.4" fill="#ef4848"/><path d="M7.3 10l1.4-3.6h6.6L16.7 10Z" fill="#bfe3fa"/><path d="M21.5 14v1a2.4 2.4 0 0 1-2.4 2.5H4.9A2.4 2.4 0 0 1 2.5 15v-1Z" fill="#cf2f34"/><circle cx="7" cy="17.5" r="2.4" fill="#3a434f"/><circle cx="17" cy="17.5" r="2.4" fill="#3a434f"/><rect x="3.6" y="12" width="2.8" height="1.6" rx=".8" fill="#ffe08a"/><rect x="17.6" y="12" width="2.8" height="1.6" rx=".8" fill="#ffe08a"/>',
    bag: '<path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" fill="none" stroke="#a8692c" stroke-width="1.8"/><path d="M4.6 7.5h14.8l1.1 13a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5Z" fill="#ef6f8e"/><path d="M19.4 7.5l1.1 13a1.5 1.5 0 0 1-1.5 1.5h-3.4l1.6-14.5Z" fill="#d94f72"/><circle cx="8.5" cy="10.5" r=".9" fill="#7a2840"/><circle cx="15.5" cy="10.5" r=".9" fill="#7a2840"/>',
    bank: '<path d="M12 2.5 22 7.5v1.5H2V7.5Z" fill="#8c98a4"/><path d="M12 2.5 22 7.5v1.5h-10Z" fill="#76828e"/><g fill="#d9e3ea"><rect x="4" y="10" width="2.6" height="8" rx=".6"/><rect x="8.6" y="10" width="2.6" height="8" rx=".6"/><rect x="12.8" y="10" width="2.6" height="8" rx=".6"/><rect x="17.4" y="10" width="2.6" height="8" rx=".6"/></g><rect x="2.5" y="18.5" width="19" height="3" rx="1" fill="#8c98a4"/><circle cx="12" cy="6.4" r="1.4" fill="#ffc531"/>',
    pill: '<rect x="2.2" y="8.6" width="19.6" height="6.8" rx="3.4" transform="rotate(-40 12 12)" fill="#f4f7f9" stroke="#b9c6d0" stroke-width="1"/><path d="M12 12 7.6 17.2a3.4 3.4 0 0 1-5.2-4.4l4.4-5.2Z" transform="translate(1.2 .6)" fill="#ef4848"/><path d="M5.6 9.4l2.2-2.6" stroke="#ffb3b3" stroke-width="1.3" stroke-linecap="round"/>',
    books: '<rect x="3" y="4" width="5" height="17" rx="1.2" fill="#4a9be0"/><rect x="8.6" y="6" width="5" height="15" rx="1.2" fill="#36b26b"/><rect x="14.2" y="3.8" width="4.6" height="17" rx="1.2" transform="rotate(12 16.5 12.3)" fill="#f59a3a"/><path d="M3 8h5M8.6 9.4h5" stroke="#fff" stroke-width="1.2" opacity=".7"/>',
    clapper: '<rect x="2.5" y="9" width="19" height="12.5" rx="2" fill="#3a434f"/><path d="M2.5 9h19v3h-19Z" fill="#4a5563"/><path d="M2.2 5.6 20.6 2.4l.6 3.4L2.8 9Z" fill="#f4f7f9"/><path d="M6.4 4.9 5.6 8.4M11 4.1l-.8 3.5M15.6 3.3l-.8 3.5" stroke="#3a434f" stroke-width="1.6"/><path d="M10 13.6v5l4.2-2.5Z" fill="#c5ff60"/>',
    globe: '<circle cx="12" cy="12" r="9.5" fill="#4a9be0"/><path d="M8 5.4c1.6 1 2.6 2.6 1.6 4-1.2 1.6-3.4 1-4 3.2-.4 1.6.8 3 .4 4.6A9.5 9.5 0 0 1 8 5.4ZM14.6 3c.4 1.6 2 2 3.4 2.4 1.2 1.6.8 3.6-.6 4.4-1.6.8-1.2 2.8-2.6 3.8-1 .7-2.4.2-2.6 1.6-.2 1.8 1.8 2.6 1.6 4.6A9.5 9.5 0 0 0 14.6 3Z" fill="#5cc27a"/><path d="M21.5 12A9.5 9.5 0 0 1 9 21a9.5 9.5 0 0 0 9.4-15.6 9.5 9.5 0 0 1 3.1 6.6Z" fill="#000" opacity=".1"/>',
    phone: '<rect x="6" y="1.8" width="12" height="20.4" rx="3" fill="#3a434f"/><rect x="7.4" y="4.2" width="9.2" height="14.6" rx="1.2" fill="#5aa9e6"/><path d="M7.4 13.8 16.6 6v4.4l-9.2 7.6Z" fill="#8fc8f2" opacity=".55"/><rect x="10.4" y="19.6" width="3.2" height="1.1" rx=".55" fill="#8c98a4"/>',
    sparkles: '<path d="M10 2.5l1.7 5.1 5.1 1.7-5.1 1.7L10 16.1l-1.7-5.1-5.1-1.7 5.1-1.7Z" fill="#ffc531"/><path d="M18 13l.9 2.6 2.6.9-2.6.9L18 20l-.9-2.6-2.6-.9 2.6-.9Z" fill="#ffd96b"/><path d="M18.5 2.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6Z" fill="#f2a516"/>',
    seedling: '<path d="M12 21.5V12" stroke="#3fa35f" stroke-width="2" stroke-linecap="round"/><path d="M12 13C12 8 8.6 5 3.5 5.2 3.5 10 6.6 13 12 13Z" fill="#5cc27a"/><path d="M12 11.5c0-4.4 3-7.2 8.5-7 0 4.6-3.2 7.2-8.5 7Z" fill="#7fd68f"/><path d="M6.5 21.5h11" stroke="#a8692c" stroke-width="2" stroke-linecap="round"/>',
    leaf: '<path d="M20.5 3.5C9 3.5 3.5 9 3.5 16.5c0 1.4.3 2.6.8 3.6C12.5 20.6 20.5 15 20.5 3.5Z" fill="#5cc27a"/><path d="M20.5 3.5C20.5 15 12.5 20.6 4.3 20.1c5-2.6 10.6-8.4 16.2-16.6Z" fill="#3fa35f"/><path d="M4.5 20 15 9" stroke="#c8f0d2" stroke-width="1.3" stroke-linecap="round"/>',
    heartYellow: '<path d="M12 20.6s-8.6-5.2-8.6-11.2A4.9 4.9 0 0 1 12 6.6a4.9 4.9 0 0 1 8.6 2.8c0 6-8.6 11.2-8.6 11.2Z" fill="#ffcf3f"/><path d="M20.6 9.4c0 6-8.6 11.2-8.6 11.2s-1.6-1-3.4-2.6c6.4 2.2 11.4-3.8 10.2-10.6a4.9 4.9 0 0 1 1.8 2Z" fill="#f2ab1b"/>',
    muscle: '<path d="M5 20.5c-1.5-3.5-1-8 1.2-11.2L9 4.6c.5-.9 1.6-1.3 2.6-.8l1.4.7c.9.5 1.2 1.6.7 2.5l-1.6 2.6c2-1.2 4.8-1.3 6.6.3 2.4 2.1 2.2 6.2-.6 8.6-2.4 2.1-6.2 2.6-13.1 2Z" fill="#f6c08f"/><path d="M12.1 10.6c2-1.2 4.8-1.3 6.6.3 2.4 2.1 2.2 6.2-.6 8.6-1.4 1.2-3.2 1.8-6 2 4.4-1.6 6.4-4.6 5.2-7.8-.8-2-2.8-3-5.2-3.1Z" fill="#e79c62"/><path d="M9 13.6c1.2 1.6 3.2 2 5 1.2" stroke="#c97b44" stroke-width="1.3" stroke-linecap="round" fill="none"/>',
    smile: '<circle cx="12" cy="12" r="9.5" fill="#ffcf3f"/><path d="M21.5 12a9.5 9.5 0 0 1-17.2 5.6A9.5 9.5 0 0 0 18.6 5.2a9.4 9.4 0 0 1 2.9 6.8Z" fill="#f2ab1b"/><path d="M8 9.6c.4-.7 1.2-.7 1.6 0M14.4 9.6c.4-.7 1.2-.7 1.6 0" stroke="#7a4a0c" stroke-width="1.5" stroke-linecap="round" fill="none"/><path d="M7.6 13.4c1 2.2 2.6 3.2 4.4 3.2s3.4-1 4.4-3.2" stroke="#7a4a0c" stroke-width="1.6" stroke-linecap="round" fill="none"/><circle cx="7" cy="13" r="1.3" fill="#ff8fab" opacity=".55"/><circle cx="17" cy="13" r="1.3" fill="#ff8fab" opacity=".55"/>',
    shield: '<path d="M12 2 20 5v6.4c0 5-3.4 8.8-8 10.6-4.6-1.8-8-5.6-8-10.6V5Z" fill="#4a9be0"/><path d="M12 2 20 5v6.4c0 5-3.4 8.8-8 10.6Z" fill="#3a7fc0"/><path d="m8.4 11.8 2.6 2.6 4.8-5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
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
