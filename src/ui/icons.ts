/** Iconos SVG en línea (decorativos: aria-hidden). Sin dependencias externas. */
const svg = (size: number, body: string, extra = '') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${extra}>${body}</svg>`;

export const icons = {
  logo: `<svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="#11141b" stroke="#cfff45" stroke-width="1.5"/><path d="M10 8.5h8.5l4 4V23a1.5 1.5 0 0 1-1.5 1.5H10A1.5 1.5 0 0 1 8.5 23V10A1.5 1.5 0 0 1 10 8.5Z" fill="none" stroke="#eceee6" stroke-width="1.6"/><path d="M12 17.5l2.6 2.5 5-5.2" fill="none" stroke="#cfff45" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  lock: (s = 22) => svg(s, '<rect x="4" y="10.5" width="16" height="10.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'),
  upload: (s = 18) => svg(s, '<path d="M12 15V4"/><path d="m7 9 5-5 5 5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'),
  spark: (s = 18) => svg(s, '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"/>'),
  download: (s = 16) => svg(s, '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>'),
  print: (s = 16) => svg(s, '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'),
  trash: (s = 16) => svg(s, '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>'),
  info: (s = 18) => svg(s, '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.01"/>'),
  alert: (s = 18) => svg(s, '<path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 10v4.5"/><path d="M12 17.3v.01"/>'),
  external: (s = 14) => svg(s, '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  close: (s = 18) => svg(s, '<path d="M6 6l12 12M18 6 6 18"/>'),
  copy: (s = 14) => svg(s, '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  sortUp: (s = 12) => svg(s, '<path d="m6 15 6-6 6 6"/>'),
  sortDown: (s = 12) => svg(s, '<path d="m6 9 6 6 6-6"/>'),
  sortNone: (s = 12) => svg(s, '<path d="m8 10 4-4 4 4M8 14l4 4 4-4"/>'),
  status: {
    likely: (s = 13) => svg(s, '<path d="m5 12.5 4.5 4.5L19 7.5"/>', ' stroke-width="2.6"'),
    review: (s = 13) => svg(s, '<path d="M12 5v9"/><path d="M12 18.5v.01"/>', ' stroke-width="2.8"'),
    no: (s = 13) => svg(s, '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', ' stroke-width="2.6"'),
    na: (s = 13) => svg(s, '<path d="M6 12h12"/>', ' stroke-width="2.6"'),
  },
};
