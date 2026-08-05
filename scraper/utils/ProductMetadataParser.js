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
   * Extracts volume (ml, l, cl, litre)
   */
  static extractVolume(text) {
    if (!text) return null;
    const regex = /(?:[xX*]|\b)(\d+(?:\.\d+)?\s*(?:ml|l|cl|litre|ltr|pint|pt))\b/i;
    const match = text.match(regex);
    return match ? this.normalizeText(match[1]) : null;
  }

  /**
   * Extracts weight (g, kg, oz)
   */
  static extractWeight(text) {
    if (!text) return null;
    const regex = /(?:[xX*]|\b)(\d+(?:\.\d+)?\s*(?:g|kg|oz))\b/i;
    const match = text.match(regex);
    return match ? this.normalizeText(match[1]) : null;
  }

  /**
   * Attempts to extract the brand based on common known brands or simple 
   * heuristic (first 1-2 words).
   */
  static extractBrand(text) {
    if (!text) return null;
    const knownBrands = [
      'coca cola', 'pepsi', 'sprite', 'fanta', 'dr pepper', 'cadbury', 'nestle',
      'mars', 'snickers', 'walkers', 'kelloggs', 'heinz', 'red bull', 'monster',
      'lucozade', 'ribena', 'oasis', 'gatorade', 'robinsons', 'schweppes',
      'pringles', 'doritos', 'mccoys', 'hula hoops', 'haribo', 'rowntrees',
      'smirnoff', 'gordons', 'fosters', 'carling', 'stella artois', 'budweiser',
      'guinness', 'strongbow', 'thatchers', 'kopparberg', 'magners',
      'volvic', 'evian', 'buxton', 'highland spring'
    ];
    
    const lowerText = text.toLowerCase().replace(/[\-_]/g, ' ');
    for (const brand of knownBrands) {
      if (lowerText.includes(brand)) return brand;
    }
    
    // Fallback: use first word if longer than 2 characters
    const words = this.cleanName(text).split(/\s+/).filter(Boolean);
    if (words.length > 0 && words[0].length > 2) {
      return words[0].toLowerCase();
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
