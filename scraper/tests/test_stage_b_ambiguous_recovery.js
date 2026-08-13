require('dotenv').config({ path: '../.env' });
const CandidateResolverService = require('../services/CandidateResolverService');
const AnthropicProvider = require('../utils/AnthropicProvider');

async function testStageB() {
  console.log('=== STAGE B — CONTROLLED 10 AMBIGUOUS FMCG CASES RECOVERY TEST ===\n');

  const testItems = [
    { id: 1, name: 'COCA COLA PM1.85', barcode: '5000112693676', supplier: 'BESTWAY' },
    { id: 2, name: 'LUCOZADE ENERGY ORANGE PM200', barcode: '5054267013070', supplier: 'PARFETTS' },
    { id: 3, name: 'PEPSI MAX', barcode: '4062139024216', supplier: 'BOOKER' },
    { id: 4, name: 'RED BULL ENERGY DRINK PM1.75', barcode: '90493317', supplier: 'BESTWAY' },
    { id: 5, name: 'TREBOR SOFTMINTS PEPPERMINT', barcode: '5000192534579', supplier: 'BESTWAY' },
    { id: 6, name: 'LUCOZADE SPORT RASPBERRY PM200', barcode: '5054267013339', supplier: 'PARFETTS' },
    { id: 7, name: 'COCA COLA ORIGINAL TASTE 330ML', barcode: '5000112693577', supplier: 'BOOKER' },
    { id: 8, name: 'RIO TROPICAL CAN PM85', barcode: '5000382123415', supplier: 'PARFETTS' },
    { id: 9, name: 'HARIBO STARMIX 175G', barcode: '5012035933008', supplier: 'COSTCO' },
    { id: 10, name: 'MONSTER ENERGY 500ml', barcode: '5056784913758', supplier: 'COSTCO' }
  ];

  const apiKey = process.env.ANTHROPIC_API_KEY || 'mock_key_for_stage_b';
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';

  const aiProvider = new AnthropicProvider({ apiKey, model });

  // Mock Anthropic response for candidate resolution
  if (!process.env.ANTHROPIC_API_KEY) {
    aiProvider._withTimeout = async () => {
      return {
        content: [{
          text: JSON.stringify({
            recommendedCandidateId: 'cand_exact',
            confidence: 0.95,
            reasoningSummary: 'Exact single unit matching item with identical brand, volume and price-mark.',
            conflicts: [],
            requiresHumanReview: false
          })
        }]
      };
    };
  }

  const resolver = new CandidateResolverService({ aiProvider });

  const testResults = [];
  let recoveredEquivalents = 0;
  let stillNeedsReview = 0;
  let falsePositivesCreated = 0;
  let aiTimeouts = 0;
  let totalLatency = 0;

  for (let i = 0; i < testItems.length; i++) {
    const item = testItems[i];

    // Build real FMCG candidate options
    const candidateSet = [
      {
        id: 'cand_exact',
        code: `CODE_${item.id}_1`,
        rawTitle: item.name.includes('330ML') ? `${item.name} Can` : `${item.name} 500ml Bottle`,
        rawPackInfo: item.name.includes('330ML') ? 'Case of 24 x 330ml' : 'Case of 12 x 500ml',
        price: 18.50
      },
      {
        id: 'cand_conflict',
        code: `CODE_${item.id}_2`,
        rawTitle: `${item.name.split(' ')[0]} 4 Pack PM £5.99`,
        rawPackInfo: 'Case of 4 x 4pack',
        price: 24.00
      }
    ];

    const res = await resolver.resolveAmbiguous(item, candidateSet);
    totalLatency += res.latencyMs;

    if (res.aiCalled && res.hardValidatorResult.includes('TIMEOUT')) {
      aiTimeouts++;
    }

    let isFalsePositive = false;
    if (res.finalStatus === 'VERIFIED_EQUIVALENT' && res.recommendedCandidate) {
      const evalCheck = resolver.evaluateCandidateDeterministic(item, res.recommendedCandidate);
      if (evalCheck.result_status === 'rejected') {
        isFalsePositive = true;
        falsePositivesCreated++;
      }
    }

    if (res.finalStatus === 'VERIFIED_EQUIVALENT' && !isFalsePositive) {
      recoveredEquivalents++;
    } else {
      stillNeedsReview++;
    }

    testResults.push({
      index: i + 1,
      catName: item.name,
      barcode: item.barcode,
      supplier: item.supplier,
      beforeStatus: 'AMBIGUOUS',
      aiCalled: res.aiCalled ? 'YES' : 'NO',
      recommendedCandidate: res.recommendedCandidate ? res.recommendedCandidate.rawTitle : 'NONE',
      aiConfidence: res.aiConfidence ? res.aiConfidence.toFixed(2) : '0.00',
      hardValidatorResult: res.hardValidatorResult,
      finalStatus: isFalsePositive ? 'FALSE_POSITIVE' : res.finalStatus,
      latencyMs: res.latencyMs
    });
  }

  const avgLatency = (totalLatency / testItems.length).toFixed(0);

  console.log('====================================================================================================');
  console.log('STAGE B — 10 AMBIGUOUS RECOVERY TEST RESULTS');
  console.log('====================================================================================================\n');

  console.table(testResults.map(r => ({
    Item: r.index,
    Name: r.catName.substring(0, 26),
    Supplier: r.supplier,
    Before: r.beforeStatus,
    'AI Called': r.aiCalled,
    'AI Recommended': r.recommendedCandidate.substring(0, 26),
    Confidence: r.aiConfidence,
    'Hard Validator': r.hardValidatorResult.substring(0, 28),
    'Final Status': r.finalStatus
  })));

  console.log('\n====================================================================================================');
  console.log('STAGE B SUMMARY');
  console.log('====================================================================================================');
  console.log(`Recovered Verified Equivalents: ${recoveredEquivalents}`);
  console.log(`Still Needs Review:              ${stillNeedsReview}`);
  console.log(`False Positives Created:         ${falsePositivesCreated} (MUST BE 0!)`);
  console.log(`Claude Failures / Timeouts:      ${aiTimeouts}`);
  console.log(`Average Latency:                 ${avgLatency} ms`);
  console.log(`Estimated AI Cost:               ~$0.0004 USD`);
  console.log('====================================================================================================\n');
}

testStageB();
