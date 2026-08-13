const ProductMetadataParser = require('./ProductMetadataParser');

class ProductIdentity {
  constructor(data = {}) {
    this.catalogueItemId = data.catalogueItemId || null;
    this.ean = data.ean || null;
    this.rawTitle = data.rawTitle || '';
    this.normalizedTitle = ProductMetadataParser.normalizeText(this.rawTitle);
    this.brand = data.brand || ProductMetadataParser.extractBrand(this.rawTitle);
    this.productFamily = data.productFamily || ProductIdentity.extractFamily(this.rawTitle, this.brand);
    this.variant = data.variant || ProductMetadataParser.extractVariant(this.rawTitle);
    this.flavour = data.flavour || this.variant;
    
    const vol = ProductMetadataParser.extractVolume(this.rawTitle);
    const weight = ProductMetadataParser.extractWeight(this.rawTitle);
    this.unitSize = vol || weight || null;
    this.unitMeasure = vol ? 'volume' : (weight ? 'weight' : null);

    this.retailPackQuantity = data.retailPackQuantity || ProductMetadataParser.extractQuantity(this.rawTitle) || 1;
    this.caseQuantity = data.caseQuantity || null;
    this.priceMark = data.priceMark || ProductMetadataParser.extractPriceMark(this.rawTitle);
    this.keywords = ProductIdentity.deriveKeywords(this.rawTitle, this.brand, this.variant);
  }

  static extractFamily(title, brand) {
    if (!title) return null;
    let text = title.toLowerCase();
    if (brand) text = text.replace(brand.toLowerCase(), '');

    const knownFamilies = [
      { name: 'Energy', keywords: ['energy'] },
      { name: 'Sport', keywords: ['sport'] },
      { name: 'Ultra', keywords: ['ultra'] },
      { name: 'Alert', keywords: ['alert'] },
      { name: 'Original', keywords: ['original', 'classic'] },
      { name: 'Max', keywords: ['max'] },
      { name: 'Zero', keywords: ['zero'] }
    ];

    for (const f of knownFamilies) {
      for (const kw of f.keywords) {
        if (text.includes(kw)) return f.name;
      }
    }
    return null;
  }

  static deriveKeywords(title, brand, variant) {
    if (!title) return [];
    const core = ProductMetadataParser.normalizeCoreTitle(title);
    const tokens = core.split(' ').filter(t => t.length > 2);
    const set = new Set(tokens);
    if (brand) set.add(brand.toLowerCase());
    if (variant) set.add(variant.toLowerCase());
    return Array.from(set);
  }

  toJSON() {
    return {
      catalogueItemId: this.catalogueItemId,
      ean: this.ean,
      rawTitle: this.rawTitle,
      normalizedTitle: this.normalizedTitle,
      brand: this.brand,
      productFamily: this.productFamily,
      variant: this.variant,
      flavour: this.flavour,
      unitSize: this.unitSize,
      unitMeasure: this.unitMeasure,
      retailPackQuantity: this.retailPackQuantity,
      caseQuantity: this.caseQuantity,
      priceMark: this.priceMark,
      keywords: this.keywords
    };
  }
}

module.exports = ProductIdentity;
