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
    const regex = /\b(\d+(?:\.\d+)?\s*(?:ml|l|cl|litre|ltr|pint|pt))\b/i;
    const match = text.match(regex);
    return match ? this.normalizeText(match[1]) : null;
  }

  /**
   * Extracts weight (g, kg, oz)
   */
  static extractWeight(text) {
    if (!text) return null;
    const regex = /\b(\d+(?:\.\d+)?\s*(?:g|kg|oz))\b/i;
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
    
    const lowerText = text.toLowerCase();
    for (const brand of knownBrands) {
      if (lowerText.includes(brand)) return brand;
    }
    
    // Fallback: use first word if longer than 2 characters
    const words = this.cleanName(text).split(' ');
    if (words.length > 0 && words[0].length > 2) {
      return words[0].toLowerCase();
    }
    
    return null;
  }
}

module.exports = ProductMetadataParser;
