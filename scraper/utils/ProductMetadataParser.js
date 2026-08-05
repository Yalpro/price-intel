/**
 * ProductMetadataParser.js
 * Centralized utility for extracting metadata (volume, weight, pack sizes) 
 * from product titles and descriptions for deterministic validation.
 */

class ProductMetadataParser {
  /**
   * Normalizes barcode by removing non-digits, hyphens, spaces. Preserves leading zeros.
   */
  static normalizeBarcode(barcode) {
    if (!barcode) return null;
    return String(barcode).replace(/\D/g, '');
  }

  /**
   * Cleans text to produce a standardized comparison string.
   */
  static normalizeText(text) {
    if (!text) return '';
    return String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // strip all spaces/punctuation
      .trim();
  }

  /**
   * Cleans name by removing pack size, PM (price mark), and punctuation to aid search.
   * Example: "Coca Cola Original Taste 24x330ml PM £1.99" -> "Coca Cola Original Taste"
   */
  static cleanName(name) {
    if (!name) return '';
    let cleaned = name;
    
    // Remove PM £x.xx or PM x.xx
    cleaned = cleaned.replace(/\b(?:PM\s*£?\d+(?:\.\d{2})?|£\d+(?:\.\d{2})?)\b/gi, '');
    
    // Remove pack sizes (e.g. 24x330ml, 1kg, 500g, 12 pack, etc.)
    const packRegex = /\b(\d+\s*(?:x|\*)\s*\d+(?:\.\d+)?\s*(?:ml|l|g|kg|cl|litre|ltr|oz|pt|pint)\b|\d+\s*(?:ml|l|g|kg|cl|litre|ltr|oz|pt|pint)\b|\d+\s*(?:pack|pk|can|cans|bottle|bottles|box|boxes)\b)/gi;
    cleaned = cleaned.replace(packRegex, '');
    
    // Remove stray punctuation and extra spaces
    cleaned = cleaned.replace(/[,\-_()]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    return cleaned;
  }

  /**
   * Extracts pack size explicitly. Examples: "24 x 330ml", "12 pack", "4x500g"
   */
  static extractPackSize(text) {
    if (!text) return null;
    const regex = /\b(\d+\s*(?:x|\*)\s*\d+(?:\.\d+)?\s*(?:ml|l|g|kg|cl|litre|ltr)\b|\d+\s*(?:pack|pk|can|cans|bottle|bottles))\b/i;
    const match = text.match(regex);
    return match ? this.normalizeText(match[1]) : null;
  }

  /**
   * Sanitizes raw_pack_info string by stripping embedded price notations
   * and VAT text, while preserving valid pack descriptors (e.g., "1 x 12", "12 x 500ml", "Case of 24").
   *
   * Returns null if the resulting text does not contain a valid pack or volume pattern,
   * or if the input consists solely of prices or UI labels.
   */
  static sanitizePackInfo(text) {
    if (!text || typeof text !== 'string') return null;
    let s = text.trim();
    if (!s) return null;

    // 1. Remove parenthesized price/VAT expressions e.g. (£5.69), (excl. VAT £12.50), (£5.69 incl VAT)
    s = s.replace(/\s*\([^)]*£[^)]*\)/gi, '');
    s = s.replace(/\s*\([^)]*\b(?:excl|incl|inc|ex)\.?:?\s*vat\b[^)]*\)/gi, '');

    // 2. Remove standalone VAT phrases e.g. "incl VAT", "excl VAT", "ex VAT", "inc. VAT"
    s = s.replace(/\s*\(?\b(?:excl|incl|inc|ex)\.?:?\s*vat\b\)?/gi, '');

    // 3. Remove standalone price notations e.g. £5.69, £14.99, £5
    s = s.replace(/£\s?\d+(?:\.\d{1,2})?/g, '');

    // Clean stray spaces/punctuation
    s = s.replace(/[,\-_()]/g, ' ').replace(/\s{2,}/g, ' ').trim();

    if (!s) return null;

    // 4. Blacklist obvious non-pack UI terms
    const lower = s.toLowerCase();
    const blacklisted = ['in stock', 'out of stock', 'add to trolley', 'add to basket', 'promo', 'offer', 'featured', 'go local'];
    if (blacklisted.includes(lower)) return null;

    // 5. Must contain valid pack/volume/weight pattern or structure
    const validPackPattern = /\b(\d+\s*(?:x|\*)\s*[\d.]+(?:\s*(?:ml|l|g|kg|cl|oz|pt|pint))?|\d+\s*(?:ml|l|g|kg|cl|oz|pt|pint)|\d+\s*(?:pack|pk|can|cans|bottle|bottles|box|boxes|sheets|wipes|sachets|units)|case\s+of\s+\d+|\d+\s*x\s*\d+)\b/i;

    if (!validPackPattern.test(s)) {
      return null;
    }

    return s;
  }

  /**
   * Extracts raw numeric pack quantity (e.g. "24x" -> 24)
   */
  static extractQuantity(text) {
    if (!text) return null;
    const match = text.match(/\b(\d+)\s*(?:x|\*|pack|pk|cans|bottles)\b/i);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Extracts volume (ml, l, cl, litre, ltr) with canonical unit & value normalization.
   * Examples: "1.5L", "1.5LTR", "1.5 litre" -> "1.5l"; "1500ml" -> "1.5l"; "500ml" -> "500ml".
   */
  static extractVolume(text) {
    if (!text) return null;
    const regex = /(?:[xX*]|\b)(\d+(?:\.\d+)?\s*(?:ml|l|cl|litre|ltr|liter|pint|pt))\b/i;
    const match = text.match(regex);
    if (!match) return null;

    let raw = match[1].toLowerCase().replace(/\s+/g, '');
    const valMatch = raw.match(/^(\d+(?:\.\d+)?)([a-z]+)$/);
    if (!valMatch) return this.normalizeText(raw);

    let num = parseFloat(valMatch[1]);
    let unit = valMatch[2];

    if (['litre', 'ltr', 'liter'].includes(unit)) unit = 'l';
    if (['mls', 'millilitre', 'millilitres'].includes(unit)) unit = 'ml';

    // 1500ml -> 1.5l conversion if whole/decimal litres
    if (unit === 'ml' && num >= 1000 && num % 100 === 0) {
      return `${(num / 1000).toString()}l`;
    }
    if (unit === 'l') {
      return `${num.toString()}l`;
    }
    return `${num.toString()}${unit}`;
  }

  /**
   * Extracts weight (g, kg, oz) with canonical unit & value normalization.
   * Examples: "1000g" -> "1kg"; "110g" -> "110g"; "1.5kg" -> "1.5kg".
   */
  static extractWeight(text) {
    if (!text) return null;
    const regex = /(?:[xX*]|\b)(\d+(?:\.\d+)?\s*(?:g|kg|oz))\b/i;
    const match = text.match(regex);
    if (!match) return null;

    let raw = match[1].toLowerCase().replace(/\s+/g, '');
    const valMatch = raw.match(/^(\d+(?:\.\d+)?)([a-z]+)$/);
    if (!valMatch) return this.normalizeText(raw);

    let num = parseFloat(valMatch[1]);
    let unit = valMatch[2];

    if (unit === 'g' && num >= 1000 && num % 100 === 0) {
      return `${(num / 1000).toString()}kg`;
    }
    if (unit === 'kg') {
      return `${num.toString()}kg`;
    }
    return `${num.toString()}${unit}`;
  }

  /**
   * Conservative variant/flavour detection.
   * Rejects only when BOTH source and candidate specify explicit, conflicting variants.
   */
  static extractVariant(text) {
    if (!text) return null;
    const lower = text.toLowerCase().replace(/[\-_/()]/g, ' ');

    const knownVariants = [
      { canonical: 'lime', patterns: ['lime'] },
      { canonical: 'cherry', patterns: ['cherry float', 'cherry'] },
      { canonical: 'zero', patterns: ['zero sugar', 'zero'] },
      { canonical: 'diet', patterns: ['diet'] },
      { canonical: 'original', patterns: ['original taste', 'original'] },
      { canonical: 'mango', patterns: ['mango loco', 'mango'] },
      { canonical: 'tropical', patterns: ['tropical'] },
      { canonical: 'strawberry', patterns: ['strawberry'] },
      { canonical: 'banana', patterns: ['banana'] },
      { canonical: 'peach', patterns: ['peach'] },
      { canonical: 'orange', patterns: ['orange'] },
      { canonical: 'apple', patterns: ['apple'] },
      { canonical: 'vanilla', patterns: ['vanilla'] },
      { canonical: 'sparkling', patterns: ['sparkling'] },
      { canonical: 'still', patterns: ['still'] },
      { canonical: 'salted', patterns: ['salted'] },
      { canonical: 'sweet', patterns: ['sweet'] },
      { canonical: 'bbq', patterns: ['bbq beef', 'bbq'] },
      { canonical: 'cheese_onion', patterns: ['cheese & onion', 'cheese and onion'] },
      { canonical: 'salt_vinegar', patterns: ['salt & vinegar', 'salt and vinegar'] },
    ];

    for (const item of knownVariants) {
      for (const p of item.patterns) {
        const escaped = p.replace('&', '(?:&|and)');
        const reg = new RegExp(`\\b${escaped}\\b`, 'i');
        if (reg.test(lower)) return item.canonical;
      }
    }

    return null;
  }

  /**
   * Normalizes core product title by stripping volume, weight, pack, PM pricing marks, container descriptors (bar, can, bottle), filler words (original, taste, pm, pmp), and brand.
   */
  static normalizeCoreTitle(text) {
    if (!text) return '';
    let cleaned = this.cleanName(text);
    const brand = this.extractBrand(text);
    if (brand) {
      const reg = new RegExp(`\\b${brand.replace(/\s+/g, '\\s+')}\\b`, 'gi');
      cleaned = cleaned.replace(reg, '');
    }
    // Strip generic container terms (bar, can, bottle, box, pk, pack) and filler words (original, taste, pm, pmp)
    cleaned = cleaned.replace(/\b(?:bar|can|cans|bottle|bottles|box|boxes|pk|pack|sheet|sheets|wipes|original|taste|pm|pmp)\b/gi, '');
    return this.normalizeText(cleaned);
  }

  static isKnownBrand(brand) {
    if (!brand) return false;
    const knownBrands = [
      'coca cola', 'pepsi', 'sprite', 'fanta', 'dr pepper', 'cadbury', 'nestle',
      'mars', 'snickers', 'walkers', 'kelloggs', 'heinz', 'red bull', 'monster',
      'lucozade', 'ribena', 'oasis', 'gatorade', 'robinsons', 'schweppes',
      'pringles', 'doritos', 'mccoys', 'hula hoops', 'haribo', 'rowntrees',
      'smirnoff', 'gordons', 'fosters', 'carling', 'stella artois', 'budweiser',
      'guinness', 'strongbow', 'thatchers', 'kopparberg', 'magners',
      'volvic', 'evian', 'buxton', 'highland spring', 'delamere', 'go local'
    ];
    return knownBrands.includes(brand.toLowerCase());
  }

  static extractBrand(text) {
    if (!text) return null;
    const knownBrands = [
      'coca cola', 'pepsi', 'sprite', 'fanta', 'dr pepper', 'cadbury', 'nestle',
      'mars', 'snickers', 'walkers', 'kelloggs', 'heinz', 'red bull', 'monster',
      'lucozade', 'ribena', 'oasis', 'gatorade', 'robinsons', 'schweppes',
      'pringles', 'doritos', 'mccoys', 'hula hoops', 'haribo', 'rowntrees',
      'smirnoff', 'gordons', 'fosters', 'carling', 'stella artois', 'budweiser',
      'guinness', 'strongbow', 'thatchers', 'kopparberg', 'magners',
      'volvic', 'evian', 'buxton', 'highland spring', 'delamere', 'go local'
    ];

    const lowerText = text.toLowerCase().replace(/[\-_]/g, ' ');
    for (const brand of knownBrands) {
      if (lowerText.includes(brand)) return brand;
    }
    return null;
  }
  /**
   * Strips trailing pack-count quantity suffixes that supplier titles append
   * but source catalogue titles omit. Examples: "54s", "24s", "12s".
   *
   * These are pack quantity descriptors (e.g. "54 sheets", "24 sachets") that
   * Parfetts adds to the end of product titles. They are NOT volumes (ml, l),
   * weights (g, kg), or meaningful product discriminators.
   *
   * Pattern: \b\d{1,3}s\b at the very end of the string (trailing only).
   * - Matches: "54s", "24s", "12s"
   * - Does NOT match: "500ml", "89p", "PM", mid-title occurrences
   *
   * @returns {string} text with trailing pack-count suffix removed, or original text unchanged
   */
  static stripPackCountSuffix(text) {
    if (!text) return text;
    return String(text).replace(/\s+\d{1,3}s\b\s*$/i, '').trim();
  }

  /**
   * Compares two product titles for a near-exact match after stripping trailing
   * pack-count suffixes (e.g. "54s", "24s") from both sides.
   *
   * Safety rules:
   *   1. If BOTH sides have a trailing pack-count suffix AND the suffix values differ
   *      (e.g. source "24s" vs candidate "54s"), returns false — prevents a 24-sheet
   *      product matching a 54-sheet product.
   *   2. If only the candidate has the suffix (typical case: Parfetts adds "54s",
   *      source catalogue does not), strip it from the candidate and compare.
   *   3. If neither side has the suffix, compare as-is (equivalent to a normal
   *      normalizeText comparison).
   *
   * @param {string} csvTitle   - Source catalogue product name
   * @param {string} candTitle  - Supplier product title from scraper
   * @returns {boolean}
   */
  static titlesMatchAfterSuffixStrip(csvTitle, candTitle) {
    if (!csvTitle || !candTitle) return false;

    const SUFFIX_RE = /\s+(\d{1,3})s\b\s*$/i;

    const csvSuffixMatch  = String(csvTitle).match(SUFFIX_RE);
    const candSuffixMatch = String(candTitle).match(SUFFIX_RE);

    // Safety rule 1: both have a suffix — compare the suffix values.
    // If they differ (e.g. "24s" vs "54s"), these are different pack sizes → no match.
    if (csvSuffixMatch && candSuffixMatch) {
      if (csvSuffixMatch[1] !== candSuffixMatch[1]) return false;
    }

    // Strip suffix from both sides and normalize
    const csvStripped  = this.normalizeText(this.stripPackCountSuffix(csvTitle));
    const candStripped = this.normalizeText(this.stripPackCountSuffix(candTitle));

    return csvStripped.length > 0 && csvStripped === candStripped;
  }
}

module.exports = ProductMetadataParser;
