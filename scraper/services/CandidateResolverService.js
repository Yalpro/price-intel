const ProductIdentity = require('../utils/ProductIdentity');
const AIProviderFactory = require('../utils/AIProviderFactory');
const ProductMetadataParser = require('../utils/ProductMetadataParser');

class CandidateResolverService {
  constructor(options = {}) {
    this.aiProvider = options.aiProvider || AIProviderFactory.getProvider(options);
    this.scraper = options.scraper || null; // Optional reference to scraper instance for evaluateCandidate
  }

  /**
   * Evaluates an ambiguous product and candidate set.
   * @param {Object} catItem - Source catalogue product
   * @param {Array<Object>} candidates - Real supplier candidate objects
   * @returns {Promise<Object>} Decision object with audit metadata
   */
  async resolveAmbiguous(catItem, candidates = []) {
    const startTime = Date.now();
    const productIdentity = new ProductIdentity({
      catalogueItemId: catItem.id,
      ean: catItem.barcode,
      rawTitle: catItem.name || catItem.product_name
    });

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return {
        finalStatus: 'NEEDS_REVIEW',
        aiCalled: false,
        recommendedCandidate: null,
        aiConfidence: 0,
        hardValidatorResult: 'NO_CANDIDATES',
        reasoningSummary: 'No candidate evidence provided.',
        latencyMs: Date.now() - startTime
      };
    }

    // STEP 1: Deterministic Candidate Elimination
    const validCandidates = [];
    for (const cand of candidates) {
      const evalRes = this.evaluateCandidateDeterministic(catItem, cand);
      if (evalRes.result_status !== 'rejected') {
        validCandidates.push({ candidate: cand, eval: evalRes });
      }
    }

    // If deterministic validation leaves exactly ONE clear valid candidate, promote WITHOUT AI
    if (validCandidates.length === 1 && validCandidates[0].eval.result_status === 'success' && validCandidates[0].eval.validation_score >= 90) {
      return {
        finalStatus: 'VERIFIED_EQUIVALENT',
        aiCalled: false,
        recommendedCandidate: validCandidates[0].candidate,
        aiConfidence: 1.0,
        hardValidatorResult: 'PASS_DETERMINISTIC',
        reasoningSummary: 'Single candidate passed deterministic validation without AI.',
        latencyMs: Date.now() - startTime
      };
    }

    // If ALL candidates were rejected by deterministic hard conflicts, return REJECTED / NEEDS_REVIEW without calling AI
    if (validCandidates.length === 0) {
      return {
        finalStatus: 'NEEDS_REVIEW',
        aiCalled: false,
        recommendedCandidate: null,
        aiConfidence: 0,
        hardValidatorResult: 'FAIL_HARD_CONFLICTS',
        reasoningSummary: 'All candidate items triggered deterministic hard conflicts.',
        latencyMs: Date.now() - startTime
      };
    }

    // STEP 2: Invoke AI Candidate Resolver for remaining ambiguous candidates
    if (!this.aiProvider || !this.aiProvider.isConfigured()) {
      return {
        finalStatus: 'NEEDS_REVIEW',
        aiCalled: false,
        recommendedCandidate: null,
        aiConfidence: 0,
        hardValidatorResult: 'AI_PROVIDER_NOT_CONFIGURED',
        reasoningSummary: 'AI provider missing or not configured in backend environment.',
        latencyMs: Date.now() - startTime
      };
    }

    const candidateList = validCandidates.map(v => v.candidate);
    const aiRes = await this.aiProvider.resolveAmbiguousCandidate(productIdentity, candidateList);
    const latencyMs = Date.now() - startTime;

    if (!aiRes.recommendedCandidateId) {
      return {
        finalStatus: 'NEEDS_REVIEW',
        aiCalled: true,
        recommendedCandidate: null,
        aiConfidence: aiRes.confidence || 0,
        hardValidatorResult: 'NO_RECOMMENDATION',
        reasoningSummary: aiRes.reasoningSummary || 'AI did not select a candidate.',
        latencyMs
      };
    }

    // STEP 3: Find recommended candidate object
    const selectedObj = candidateList.find(c => String(c.id || c.code || c.supplierProductId || c.rawProductCode) === String(aiRes.recommendedCandidateId));

    if (!selectedObj) {
      return {
        finalStatus: 'NEEDS_REVIEW',
        aiCalled: true,
        recommendedCandidate: null,
        aiConfidence: aiRes.confidence || 0,
        hardValidatorResult: 'INVALID_CANDIDATE_ID_RETURNED',
        reasoningSummary: `AI returned candidate ID "${aiRes.recommendedCandidateId}" not found in candidate set.`,
        latencyMs
      };
    }

    // STEP 4: MANDATORY POST-AI HARD VALIDATION
    const postEval = this.evaluateCandidateDeterministic(catItem, selectedObj);

    if (postEval.result_status === 'rejected' || postEval.validation_score < 90) {
      return {
        finalStatus: 'NEEDS_REVIEW',
        aiCalled: true,
        recommendedCandidate: selectedObj,
        aiConfidence: aiRes.confidence || 0,
        hardValidatorResult: `FAIL (${postEval.conflicting_fields || 'SCORE_BELOW_90'})`,
        reasoningSummary: `Post-AI hard validator blocked candidate: ${postEval.validation_reason}`,
        latencyMs
      };
    }

    // Check critical metadata completeness for VERIFIED_EQUIVALENT promotion
    const csvBrand = productIdentity.brand;
    const candBrand = ProductMetadataParser.extractBrand(selectedObj.rawTitle || selectedObj.title);

    const csvVol = productIdentity.unitSize;
    const candVol = ProductMetadataParser.extractVolume(selectedObj.rawTitle || selectedObj.title) || ProductMetadataParser.extractVolume(selectedObj.rawPackInfo || selectedObj.packInfo);

    if ((csvBrand && !candBrand) || (csvVol && !candVol)) {
      return {
        finalStatus: 'NEEDS_REVIEW',
        aiCalled: true,
        recommendedCandidate: selectedObj,
        aiConfidence: aiRes.confidence || 0,
        hardValidatorResult: 'FAIL_INCOMPLETE_METADATA',
        reasoningSummary: 'Equivalence cannot be safely proven due to missing brand/volume in candidate metadata.',
        latencyMs
      };
    }

    // STEP 5: PROMOTED TO VERIFIED_EQUIVALENT
    return {
      finalStatus: 'VERIFIED_EQUIVALENT',
      aiCalled: true,
      recommendedCandidate: selectedObj,
      aiConfidence: aiRes.confidence || 0,
      hardValidatorResult: 'PASS_POST_AI_HARD_VALIDATION',
      reasoningSummary: aiRes.reasoningSummary,
      latencyMs
    };
  }

  /**
   * Strict deterministic validator for candidate checking
   */
  evaluateCandidateDeterministic(csvProduct, candidate) {
    const csvName = csvProduct.name || csvProduct.product_name || '';
    const candName = candidate.rawTitle || candidate.title || '';

    const csvBarcode = ProductMetadataParser.normalizeBarcode(csvProduct.barcode);
    let candidateBarcode = null;
    if (candidate.rawBarcode && String(candidate.rawBarcode).replace(/\D/g, '').length >= 8) {
      candidateBarcode = ProductMetadataParser.normalizeBarcode(candidate.rawBarcode);
    }

    // Barcode check
    if (csvBarcode && candidateBarcode) {
      if (csvBarcode === candidateBarcode) {
        return { result_status: 'success', validation_score: 100, validation_reason: 'Exact barcode match.' };
      } else {
        return { result_status: 'rejected', validation_score: 0, validation_reason: 'Barcode mismatch.', conflicting_fields: 'barcode' };
      }
    }

    const csvBrand = ProductMetadataParser.extractBrand(csvName);
    const candBrand = ProductMetadataParser.extractBrand(candName);

    const csvVol = ProductMetadataParser.extractVolume(csvName);
    const candVol = ProductMetadataParser.extractVolume(candName) || ProductMetadataParser.extractVolume(candidate.rawPackInfo || candidate.packInfo);

    const csvWeight = ProductMetadataParser.extractWeight(csvName);
    const candWeight = ProductMetadataParser.extractWeight(candName) || ProductMetadataParser.extractWeight(candidate.rawPackInfo || candidate.packInfo);

    const csvQty = ProductMetadataParser.extractQuantity(csvName);
    const candQty = ProductMetadataParser.extractQuantity(candName) || ProductMetadataParser.extractQuantity(candidate.rawPackInfo || candidate.packInfo);

    const csvVar = ProductMetadataParser.extractVariant(csvName);
    const candVar = ProductMetadataParser.extractVariant(candName);

    const csvPM = ProductMetadataParser.extractPriceMark(csvName);
    const candPM = ProductMetadataParser.extractPriceMark(candName);

    const conflicts = [];

    if (csvBrand && candBrand && csvBrand !== candBrand) conflicts.push('brand');
    if (csvVol && candVol && csvVol !== candVol) conflicts.push('volume');
    if (csvWeight && candWeight && csvWeight !== candWeight) conflicts.push('weight');

    // Single vs Multipack conflict
    if (csvQty && candQty && csvQty !== candQty) conflicts.push('pack');
    if (candQty && candQty > 1 && (!csvQty || csvQty !== candQty) && (candName.toLowerCase().includes('pack') || candName.toLowerCase().includes('pk'))) {
      conflicts.push('pack');
    }

    // Variant conflict
    if (csvVar && candVar && csvVar !== candVar) conflicts.push('variant');
    if (!csvVar && candVar && ['zero', 'diet', 'cherry', 'mango', 'tropical', 'strawberry', 'banana', 'peach', 'lime'].includes(candVar)) {
      conflicts.push('variant');
    }

    // PMP price mark conflict
    if (csvPM && candPM && Math.abs(parseFloat(csvPM) - parseFloat(candPM)) > 0.05) {
      conflicts.push('price_mark');
    }

    if (conflicts.length > 0) {
      return {
        result_status: 'rejected',
        validation_score: 0,
        validation_reason: `Strict metadata conflicts: ${conflicts.join(', ')}`,
        conflicting_fields: conflicts.join(',')
      };
    }

    const brandMatched = csvBrand && candBrand && csvBrand === candBrand;
    const volMatched = csvVol && candVol && csvVol === candVol;
    const coreTitleMatched = ProductMetadataParser.normalizeCoreTitle(csvName) === ProductMetadataParser.normalizeCoreTitle(candName);

    let score = 70;
    if (brandMatched && volMatched && (coreTitleMatched || !csvVar || csvVar === candVar)) {
      score = 90;
    }

    return {
      result_status: score >= 90 ? 'success' : 'ambiguous',
      validation_score: score,
      validation_reason: `Evaluated with score ${score}`
    };
  }
}

module.exports = CandidateResolverService;
