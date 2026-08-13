const assert = require('assert');
const ProductIdentity = require('../utils/ProductIdentity');
const AIProviderFactory = require('../utils/AIProviderFactory');
const AnthropicProvider = require('../utils/AnthropicProvider');

function runStageATests() {
  console.log('=== RUNNING STAGE A UNIT TEST SUITE ===\n');

  // Test 1: ProductIdentity Extraction
  console.log('Test 1: ProductIdentity Metadata Extraction');
  const p1 = new ProductIdentity({ rawTitle: 'LUCOZADE ENERGY ORANGE PM200', ean: '5054267013070' });
  console.log('P1 Identity:', p1.toJSON());

  assert.strictEqual(p1.brand, 'lucozade', 'Brand must be lucozade');
  assert.strictEqual(p1.productFamily, 'Energy', 'Product family must be Energy');
  assert.strictEqual(p1.variant, 'orange', 'Variant must be orange');
  assert.strictEqual(p1.priceMark, '2.00', 'Price mark must be 2.00');

  const p2 = new ProductIdentity({ rawTitle: 'COCA COLA PM1.85', ean: '5000112693676' });
  assert.strictEqual(p2.brand, 'coca cola', 'Brand must be coca cola');
  assert.strictEqual(p2.priceMark, '1.85', 'Price mark must be 1.85');
  console.log('✓ ProductIdentity tests passed!\n');

  // Test 2: Unconfigured Provider Fallback
  console.log('Test 2: Unconfigured AnthropicProvider Fallback');
  const unconfiguredProvider = new AnthropicProvider({ apiKey: null, model: null });
  assert.strictEqual(unconfiguredProvider.isConfigured(), false, 'Provider must report not configured when apiKey/model is null');

  unconfiguredProvider.resolveAmbiguousCandidate(p1, [{ id: '123', rawTitle: 'Test' }]).then(res => {
    assert.strictEqual(res.recommendedCandidateId, null, 'Unconfigured provider must return null candidate ID');
    assert.strictEqual(res.requiresHumanReview, true, 'Unconfigured provider must set requiresHumanReview = true');
    console.log('✓ Unconfigured provider fallback test passed!\n');
  });

  // Test 3: Mandatory Candidate ID Validation (Reject Invalid Candidate ID)
  console.log('Test 3: Candidate Set Security Validation (Invalid Candidate ID Rejection)');
  const provider = new AnthropicProvider({ apiKey: 'mock_key', model: 'claude-3-haiku-20240307' });

  // Override internal _withTimeout for mock testing
  provider._withTimeout = async () => ({
    content: [{ text: JSON.stringify({ recommendedCandidateId: 'HALLUCINATED_ID_999', confidence: 0.9, reasoningSummary: 'Hallucinated candidate' }) }]
  });

  const candidateSet = [
    { id: 'real_cand_1', rawTitle: 'Lucozade Energy Orange 500ml', casePrice: 27.79 },
    { id: 'real_cand_2', rawTitle: 'Lucozade Energy Orange 24x500ml', casePrice: 27.79 }
  ];

  provider.resolveAmbiguousCandidate(p1, candidateSet).then(res => {
    console.log('AI Resolution Result for Hallucinated ID:', res);
    assert.strictEqual(res.recommendedCandidateId, null, 'Must reject candidate ID not present in candidate set');
    assert.strictEqual(res.requiresHumanReview, true, 'Must require human review when candidate ID is rejected');
    assert.ok(res.conflicts.includes('INVALID_CANDIDATE_ID_RETURNED'), 'Must log INVALID_CANDIDATE_ID_RETURNED conflict');
    console.log('✓ Candidate set validation test passed!\n');
  });

  // Test 4: Valid Candidate ID Acceptance
  console.log('Test 4: Valid Candidate ID Acceptance');
  provider._withTimeout = async () => ({
    content: [{ text: JSON.stringify({ recommendedCandidateId: 'real_cand_1', confidence: 0.95, reasoningSummary: 'Exact matching item' }) }]
  });

  provider.resolveAmbiguousCandidate(p1, candidateSet).then(res => {
    console.log('AI Resolution Result for Valid Candidate ID:', res);
    assert.strictEqual(res.recommendedCandidateId, 'real_cand_1', 'Must accept valid candidate ID present in candidate set');
    assert.strictEqual(res.confidence, 0.95, 'Confidence must match parsed value');
    console.log('✓ Valid candidate ID acceptance test passed!\n');
  });

  // Test 5: Timeout & Error Handling
  console.log('Test 5: Timeout & Error Handling');
  provider._withTimeout = async () => {
    throw new Error('Anthropic API request timed out');
  };

  provider.resolveAmbiguousCandidate(p1, candidateSet).then(res => {
    console.log('AI Resolution Result for Timeout:', res);
    assert.strictEqual(res.recommendedCandidateId, null, 'Must fail safely on timeout');
    assert.strictEqual(res.requiresHumanReview, true, 'Must set requiresHumanReview = true on timeout');
    assert.ok(res.reasoningSummary.includes('timed out'), 'Reasoning summary must mention timeout');
    console.log('✓ Timeout handling test passed!\n');

    console.log('==================================================');
    console.log('ALL STAGE A UNIT TESTS PASSED SUCCESSFULLY!');
    console.log('==================================================');
  });
}

runStageATests();
