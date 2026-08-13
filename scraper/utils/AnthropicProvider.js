const { Anthropic } = require('@anthropic-ai/sdk');
const AIProvider = require('./AIProvider');

class AnthropicProvider extends AIProvider {
  constructor(options = {}) {
    super();
    this.apiKey = options.apiKey !== undefined ? options.apiKey : (process.env.ANTHROPIC_API_KEY || null);
    this.model = options.model !== undefined ? options.model : (process.env.ANTHROPIC_MODEL || null);
    this.timeoutMs = options.timeoutMs || 8000;

    if (this.apiKey) {
      this.client = new Anthropic({ apiKey: this.apiKey });
    } else {
      this.client = null;
    }
  }

  isConfigured() {
    return Boolean(this.client && this.apiKey && this.model);
  }

  /**
   * Safe timeout wrapper for async API calls
   */
  async _withTimeout(promiseFn) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Anthropic API request timed out')), this.timeoutMs);
    });

    try {
      const result = await Promise.race([promiseFn(), timeoutPromise]);
      clearTimeout(timer);
      return result;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  /**
   * Resolves ambiguous candidate set using Claude structured output
   */
  async resolveAmbiguousCandidate(productIdentity, candidates = []) {
    if (!this.isConfigured()) {
      const reason = !this.apiKey ? 'ANTHROPIC_API_KEY not configured.' : 'ANTHROPIC_MODEL not configured.';
      const conflict = !this.apiKey ? 'API_KEY_NOT_CONFIGURED' : 'MODEL_NOT_CONFIGURED';
      return {
        recommendedCandidateId: null,
        confidence: 0,
        reasoningSummary: reason,
        conflicts: [conflict],
        requiresHumanReview: true
      };
    }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return {
        recommendedCandidateId: null,
        confidence: 0,
        reasoningSummary: 'No candidates provided for AI resolution.',
        conflicts: ['EMPTY_CANDIDATES'],
        requiresHumanReview: true
      };
    }

    // Extract valid candidate IDs set for mandatory validation
    const validCandidateIds = candidates.map(c => String(c.id || c.code || c.supplierProductId || c.rawProductCode)).filter(Boolean);

    // Minimize candidate payload sent to Claude (no secrets, cookies, or excess data)
    const sanitizedCandidates = candidates.map(c => ({
      id: String(c.id || c.code || c.supplierProductId || c.rawProductCode || ''),
      title: c.rawTitle || c.title || '',
      price: c.price || c.casePrice || null,
      packInfo: c.rawPackInfo || c.packInfo || ''
    }));

    const systemPrompt = `You are an expert UK FMCG wholesale product matching assistant.
Given a source catalogue product identity and a list of wholesaler candidate products, select the best matching candidate ID or return null if none is a genuine equivalent.
You MUST respond strictly with a valid JSON object matching this schema:
{
  "recommendedCandidateId": "candidate-id-string-or-null",
  "confidence": number_between_0_and_1,
  "reasoningSummary": "short_auditable_explanation",
  "conflicts": [],
  "requiresHumanReview": boolean
}
Rules:
1. ONLY select a candidate ID from the provided candidates list. Never invent an ID.
2. If there is a variant, flavor, multipack, or size mismatch, return "recommendedCandidateId": null and set "requiresHumanReview": true.
3. Do not include markdown codeblocks or prose outside the JSON object.`;

    const userPrompt = `Catalogue Item: ${JSON.stringify(productIdentity.toJSON())}\nWholesaler Candidates: ${JSON.stringify(sanitizedCandidates)}`;

    try {
      const response = await this._withTimeout(() =>
        this.client.messages.create({
          model: this.model,
          max_tokens: 300,
          temperature: 0.0,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      );

      const text = (response.content && response.content[0] && response.content[0].text) ? response.content[0].text.trim() : '';
      const cleanJsonStr = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJsonStr);

      const recommendedId = parsed.recommendedCandidateId ? String(parsed.recommendedCandidateId) : null;

      // MANDATORY SECURITY GATE: Validate recommended candidate ID against provided candidate set
      if (recommendedId !== null && !validCandidateIds.includes(recommendedId)) {
        return {
          recommendedCandidateId: null,
          confidence: 0,
          reasoningSummary: `AI returned invalid candidate ID "${recommendedId}" not present in candidate set. Rejected for safety.`,
          conflicts: ['INVALID_CANDIDATE_ID_RETURNED'],
          requiresHumanReview: true
        };
      }

      return {
        recommendedCandidateId: recommendedId,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        reasoningSummary: parsed.reasoningSummary || 'AI candidate resolution completed.',
        conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
        requiresHumanReview: Boolean(parsed.requiresHumanReview)
      };
    } catch (err) {
      return {
        recommendedCandidateId: null,
        confidence: 0,
        reasoningSummary: `AI resolution failed safely: ${err.message}`,
        conflicts: ['AI_RESOLUTION_ERROR'],
        requiresHumanReview: true
      };
    }
  }

  /**
   * Generates targeted alternate search queries
   */
  async generateSearchQueries(productIdentity, supplierName) {
    if (!this.isConfigured()) {
      return { queries: [], reasoningSummary: 'Anthropic API key not configured.' };
    }

    const systemPrompt = `You are a search query optimizer for UK wholesale supplier portals (${supplierName}).
Generate up to 3 short, specific search queries to locate this product on ${supplierName}.
Respond strictly with JSON:
{
  "queries": ["query 1", "query 2"],
  "reasoningSummary": "short explanation"
}`;

    const userPrompt = `Product: ${productIdentity.rawTitle || productIdentity.normalizedTitle} (Brand: ${productIdentity.brand || 'N/A'}, Variant: ${productIdentity.variant || 'N/A'}, Size: ${productIdentity.unitSize || 'N/A'})`;

    try {
      const response = await this._withTimeout(() =>
        this.client.messages.create({
          model: this.model,
          max_tokens: 200,
          temperature: 0.2,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      );

      const text = (response.content && response.content[0] && response.content[0].text) ? response.content[0].text.trim() : '';
      const cleanJsonStr = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJsonStr);

      const queries = Array.isArray(parsed.queries) ? parsed.queries.slice(0, 3).map(q => String(q).trim()).filter(Boolean) : [];
      return {
        queries,
        reasoningSummary: parsed.reasoningSummary || 'Generated alternate search queries.'
      };
    } catch (err) {
      return { queries: [], reasoningSummary: `Query generation failed safely: ${err.message}` };
    }
  }

  async enrichProductIdentity(productIdentity) {
    return { enriched: false, message: 'Enrichment not required.' };
  }
}

module.exports = AnthropicProvider;
