// src/components/files/malayalamPdfFont.js
// Embeds Noto Sans Malayalam into a pdf-lib document, shaped by fontkit so conjuncts and vowel signs come out right.
// Loaded on demand (fontkit is large) by PdfFormFiller only when some text is Malayalam.
import regeneratorRuntime from 'regenerator-runtime';
import fontkit from '@pdf-lib/fontkit';
import { MALAYALAM_FONT_URL } from './malayalamFont';

// fontkit's Indic shaper is built with generators that expect this global.
globalThis.regeneratorRuntime ||= regeneratorRuntime;

let fontBytes = null;
const getMalayalamFontBytes = async () => {
  if (!fontBytes) {
    fontBytes = fetch(MALAYALAM_FONT_URL).then(r => {
      if (!r.ok) throw new Error('Malayalam font missing');
      return r.arrayBuffer();
    }).catch(e => { fontBytes = null; throw e; });
  }
  return fontBytes;
};

// fontkit crashes on a NULL mark or base anchor, which Noto Sans Malayalam uses for some pairs
// (e.g. സ്ത്രീ, കൃഷ്ണൻ). OpenType says a NULL anchor means "don't attach", so skip it, as HarfBuzz does.
let anchorPatched = false;
const patchNullAnchors = (font) => {
  if (anchorPatched) return;
  const gpos = font?._layoutEngine?.engine?.GPOSProcessor;
  if (!gpos) return;
  const proto = Object.getPrototypeOf(gpos);
  const applyAnchor = proto.applyAnchor;
  proto.applyAnchor = function (markRecord, baseAnchor, baseGlyphIndex) {
    if (!baseAnchor || !markRecord?.markAnchor) return;
    return applyAnchor.call(this, markRecord, baseAnchor, baseGlyphIndex);
  };
  anchorPatched = true;
};

const malayalamFontkit = {
  ...fontkit,
  create(...args) {
    const font = fontkit.create(...args);
    patchNullAnchors(font);
    return font;
  },
};

// Embed the font (subset: only the glyphs used) into a pdf-lib document.
export const embedMalayalamFont = async (pdfDoc) => {
  pdfDoc.registerFontkit(malayalamFontkit);
  return pdfDoc.embedFont(await getMalayalamFontBytes(), { subset: true });
};
