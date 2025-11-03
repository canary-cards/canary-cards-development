/**
 * Comprehensive HTML entity decoder for Deno edge functions
 * Handles named entities, numeric entities, and hex entities
 */

const HTML_ENTITIES: Record<string, string> = {
  // Common entities
  'amp': '&',
  'lt': '<',
  'gt': '>',
  'quot': '"',
  'apos': "'",
  '#39': "'",
  
  // Punctuation and special characters
  'nbsp': ' ',
  'mdash': '\u2014',
  'ndash': '\u2013',
  'hellip': '\u2026',
  'rsquo': '\u2019',
  'lsquo': '\u2018',
  'rdquo': '\u201D',
  'ldquo': '\u201C',
  'laquo': '\u00AB',
  'raquo': '\u00BB',
  'bull': '\u2022',
  'middot': '\u00B7',
  'prime': '\u2032',
  'Prime': '\u2033',
  'lsaquo': '\u2039',
  'rsaquo': '\u203A',
  'sbquo': '\u201A',
  'bdquo': '\u201E',
  
  // Common symbols
  'cent': '\u00A2',
  'pound': '\u00A3',
  'yen': '\u00A5',
  'euro': '\u20AC',
  'copy': '\u00A9',
  'reg': '\u00AE',
  'trade': '\u2122',
  'sect': '\u00A7',
  'para': '\u00B6',
  'dagger': '\u2020',
  'Dagger': '\u2021',
  'permil': '\u2030',
  'deg': '\u00B0',
  'plusmn': '\u00B1',
  'times': '\u00D7',
  'divide': '\u00F7',
  'frac14': '\u00BC',
  'frac12': '\u00BD',
  'frac34': '\u00BE',
  
  // Accented characters
  'Agrave': '\u00C0',
  'Aacute': '\u00C1',
  'Acirc': '\u00C2',
  'Atilde': '\u00C3',
  'Auml': '\u00C4',
  'Aring': '\u00C5',
  'AElig': '\u00C6',
  'Ccedil': '\u00C7',
  'Egrave': '\u00C8',
  'Eacute': '\u00C9',
  'Ecirc': '\u00CA',
  'Euml': '\u00CB',
  'Igrave': '\u00CC',
  'Iacute': '\u00CD',
  'Icirc': '\u00CE',
  'Iuml': '\u00CF',
  'ETH': '\u00D0',
  'Ntilde': '\u00D1',
  'Ograve': '\u00D2',
  'Oacute': '\u00D3',
  'Ocirc': '\u00D4',
  'Otilde': '\u00D5',
  'Ouml': '\u00D6',
  'Oslash': '\u00D8',
  'Ugrave': '\u00D9',
  'Uacute': '\u00DA',
  'Ucirc': '\u00DB',
  'Uuml': '\u00DC',
  'Yacute': '\u00DD',
  'THORN': '\u00DE',
  'szlig': '\u00DF',
  'agrave': '\u00E0',
  'aacute': '\u00E1',
  'acirc': '\u00E2',
  'atilde': '\u00E3',
  'auml': '\u00E4',
  'aring': '\u00E5',
  'aelig': '\u00E6',
  'ccedil': '\u00E7',
  'egrave': '\u00E8',
  'eacute': '\u00E9',
  'ecirc': '\u00EA',
  'euml': '\u00EB',
  'igrave': '\u00EC',
  'iacute': '\u00ED',
  'icirc': '\u00EE',
  'iuml': '\u00EF',
  'eth': '\u00F0',
  'ntilde': '\u00F1',
  'ograve': '\u00F2',
  'oacute': '\u00F3',
  'ocirc': '\u00F4',
  'otilde': '\u00F5',
  'ouml': '\u00F6',
  'oslash': '\u00F8',
  'ugrave': '\u00F9',
  'uacute': '\u00FA',
  'ucirc': '\u00FB',
  'uuml': '\u00FC',
  'yacute': '\u00FD',
  'thorn': '\u00FE',
  'yuml': '\u00FF',
  
  // Math and technical symbols
  'forall': '\u2200',
  'exist': '\u2203',
  'empty': '\u2205',
  'nabla': '\u2207',
  'isin': '\u2208',
  'notin': '\u2209',
  'ni': '\u220B',
  'prod': '\u220F',
  'sum': '\u2211',
  'minus': '\u2212',
  'lowast': '\u2217',
  'radic': '\u221A',
  'prop': '\u221D',
  'infin': '\u221E',
  'ang': '\u2220',
  'and': '\u2227',
  'or': '\u2228',
  'cap': '\u2229',
  'cup': '\u222A',
  'int': '\u222B',
  'there4': '\u2234',
  'sim': '\u223C',
  'cong': '\u2245',
  'asymp': '\u2248',
  'ne': '\u2260',
  'equiv': '\u2261',
  'le': '\u2264',
  'ge': '\u2265',
  'sub': '\u2282',
  'sup': '\u2283',
  'nsub': '\u2284',
  'sube': '\u2286',
  'supe': '\u2287',
  'oplus': '\u2295',
  'otimes': '\u2297',
  'perp': '\u22A5',
  
  // Arrows
  'larr': '\u2190',
  'uarr': '\u2191',
  'rarr': '\u2192',
  'darr': '\u2193',
  'harr': '\u2194',
  'lArr': '\u21D0',
  'uArr': '\u21D1',
  'rArr': '\u21D2',
  'dArr': '\u21D3',
  'hArr': '\u21D4'
};

/**
 * Decode HTML entities in a string
 * @param text - Text containing HTML entities
 * @returns Decoded text
 */
export function decodeHtmlEntities(text: string | undefined | null): string {
  if (!text) return '';
  
  return text.replace(/&([a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/g, (match, entity) => {
    // Named entity
    if (HTML_ENTITIES[entity]) {
      return HTML_ENTITIES[entity];
    }
    
    // Numeric entity (decimal)
    if (entity.startsWith('#') && !entity.startsWith('#x')) {
      const code = parseInt(entity.slice(1), 10);
      if (!isNaN(code) && code >= 0 && code <= 0x10FFFF) {
        return String.fromCodePoint(code);
      }
    }
    
    // Numeric entity (hexadecimal)
    if (entity.startsWith('#x')) {
      const code = parseInt(entity.slice(2), 16);
      if (!isNaN(code) && code >= 0 && code <= 0x10FFFF) {
        return String.fromCodePoint(code);
      }
    }
    
    // If we can't decode it, return the original
    return match;
  });
}
