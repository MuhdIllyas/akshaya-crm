// src/components/files/malayalamFont.js
// Malayalam support for the PDF form filler: Noto Sans Malayalam (SIL OFL, see assets/fonts/NotoSansMalayalam-OFL.txt)
// is used on screen and embedded into the filled PDF, shaped by fontkit so conjuncts and vowel signs come out right.
// The font also has Latin letters and digits, so a box with mixed English and Malayalam is drawn entirely in it.
// The fontkit part (large) lives in malayalamPdfFont.js and is only loaded when a filled PDF has Malayalam in it.
import fontUrl from '@/assets/fonts/NotoSansMalayalam-Regular.ttf?url';

export const MALAYALAM_FONT_URL = fontUrl;

export const MALAYALAM_FAMILY = 'Sahayi Noto Sans Malayalam';
export const MALAYALAM_FONT_CSS = `"${MALAYALAM_FAMILY}", sans-serif`;
// First baseline as a fraction of font size, at line-height 1.2: (1.2 - (ascent - descent)) / 2 + ascent,
// with this font's ascent 0.864 and descent -0.383 (hhea and typo metrics agree, useTypoMetrics is set).
export const MALAYALAM_BASELINE = (1.2 - (0.864 + 0.383)) / 2 + 0.864;

const MALAYALAM_RE = /[\u0D00-\u0D7F]/;
export const hasMalayalam = (text) => MALAYALAM_RE.test(text || '');

// ----- on screen -----
let screenFont = null;
export const loadMalayalamForScreen = () => {
  if (!screenFont) {
    const face = new FontFace(MALAYALAM_FAMILY, `url(${fontUrl})`);
    screenFont = face.load().then(f => { document.fonts.add(f); return true; }).catch(() => false);
  }
  return screenFont;
};
