/**
 * Abstract Interface for AI-assisted matching operations.
 * Concrete providers (e.g. AnthropicProvider) implement this class.
 */
class AIProvider {
  constructor() {
    if (new.target === AIProvider) {
      throw new Error('AIProvider is an abstract class and cannot be instantiated directly.');
    }
  }

  /**
   * Resolves ambiguous candidate set using AI advisory evaluation.
   * @param {Object} productIdentity - Canonical ProductIdentity metadata
   * @param {Array<Object>} candidates - Array of real supplier candidates
   * @returns {Promise<Object>} Structured JSON decision object
   */
  async resolveAmbiguousCandidate(productIdentity, candidates) {
    throw new Error('resolveAmbiguousCandidate must be implemented by concrete subclass.');
  }

  /**
   * Generates targeted alternate search queries when deterministic queries fail.
   * @param {Object} productIdentity - Canonical ProductIdentity metadata
   * @param {string} supplierName - Name of the target wholesaler
   * @returns {Promise<Object>} Object with queries array
   */
  async generateSearchQueries(productIdentity, supplierName) {
    throw new Error('generateSearchQueries must be implemented by concrete subclass.');
  }

  /**
   * Generates metadata enrichment suggestions for missing product attributes.
   * @param {Object} productIdentity - Canonical ProductIdentity metadata
   * @returns {Promise<Object>} Enriched metadata suggestion object
   */
  async enrichProductIdentity(productIdentity) {
    throw new Error('enrichProductIdentity must be implemented by concrete subclass.');
  }
}

module.exports = AIProvider;
