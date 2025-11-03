/**
 * Comprehensive HTML entity decoder for client-side use
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
  'cent': '¢',
  'pound': '£',
  'yen': '¥',
  'euro': '€',
  'copy': '©',
  'reg': '®',
  'trade': '™',
  'sect': '§',
  'para': '¶',
  'dagger': '†',
  'Dagger': '‡',
  'permil': '‰',
  'deg': '°',
  'plusmn': '±',
  'times': '×',
  'divide': '÷',
  'frac14': '¼',
  'frac12': '½',
  'frac34': '¾',
  
  // Accented characters
  'Agrave': 'À',
  'Aacute': 'Á',
  'Acirc': 'Â',
  'Atilde': 'Ã',
  'Auml': 'Ä',
  'Aring': 'Å',
  'AElig': 'Æ',
  'Ccedil': 'Ç',
  'Egrave': 'È',
  'Eacute': 'É',
  'Ecirc': 'Ê',
  'Euml': 'Ë',
  'Igrave': 'Ì',
  'Iacute': 'Í',
  'Icirc': 'Î',
  'Iuml': 'Ï',
  'ETH': 'Ð',
  'Ntilde': 'Ñ',
  'Ograve': 'Ò',
  'Oacute': 'Ó',
  'Ocirc': 'Ô',
  'Otilde': 'Õ',
  'Ouml': 'Ö',
  'Oslash': 'Ø',
  'Ugrave': 'Ù',
  'Uacute': 'Ú',
  'Ucirc': 'Û',
  'Uuml': 'Ü',
  'Yacute': 'Ý',
  'THORN': 'Þ',
  'szlig': 'ß',
  'agrave': 'à',
  'aacute': 'á',
  'acirc': 'â',
  'atilde': 'ã',
  'auml': 'ä',
  'aring': 'å',
  'aelig': 'æ',
  'ccedil': 'ç',
  'egrave': 'è',
  'eacute': 'é',
  'ecirc': 'ê',
  'euml': 'ë',
  'igrave': 'ì',
  'iacute': 'í',
  'icirc': 'î',
  'iuml': 'ï',
  'eth': 'ð',
  'ntilde': 'ñ',
  'ograve': 'ò',
  'oacute': 'ó',
  'ocirc': 'ô',
  'otilde': 'õ',
  'ouml': 'ö',
  'oslash': 'ø',
  'ugrave': 'ù',
  'uacute': 'ú',
  'ucirc': 'û',
  'uuml': 'ü',
  'yacute': 'ý',
  'thorn': 'þ',
  'yuml': 'ÿ',
  
  // Math and technical symbols
  'forall': '∀',
  'exist': '∃',
  'empty': '∅',
  'nabla': '∇',
  'isin': '∈',
  'notin': '∉',
  'ni': '∋',
  'prod': '∏',
  'sum': '∑',
  'minus': '−',
  'lowast': '∗',
  'radic': '√',
  'prop': '∝',
  'infin': '∞',
  'ang': '∠',
  'and': '∧',
  'or': '∨',
  'cap': '∩',
  'cup': '∪',
  'int': '∫',
  'there4': '∴',
  'sim': '∼',
  'cong': '≅',
  'asymp': '≈',
  'ne': '≠',
  'equiv': '≡',
  'le': '≤',
  'ge': '≥',
  'sub': '⊂',
  'sup': '⊃',
  'nsub': '⊄',
  'sube': '⊆',
  'supe': '⊇',
  'oplus': '⊕',
  'otimes': '⊗',
  'perp': '⊥',
  
  // Arrows
  'larr': '←',
  'uarr': '↑',
  'rarr': '→',
  'darr': '↓',
  'harr': '↔',
  'lArr': '⇐',
  'uArr': '⇑',
  'rArr': '⇒',
  'dArr': '⇓',
  'hArr': '⇔'
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
