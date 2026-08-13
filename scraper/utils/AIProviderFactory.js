const AnthropicProvider = require('./AnthropicProvider');

class AIProviderFactory {
  static getProvider(overrideOptions = {}) {
    const providerName = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();

    switch (providerName) {
      case 'anthropic':
      case 'claude':
        return new AnthropicProvider(overrideOptions);
      default:
        return new AnthropicProvider(overrideOptions);
    }
  }
}

module.exports = AIProviderFactory;
