import internalAdapter from './adapters/internalAdapter.js';
// We will import whatsappAdapter and portalAdapter here later

class CommunicationEngine {
  constructor() {
    this.adapters = {
      internal: internalAdapter,
    };
  }

  async send(payload) {
    try {
      const { channel } = payload;
      const adapter = this.adapters[channel];

      if (!adapter) {
        throw new Error(`[CommunicationEngine] Unsupported channel: ${channel}`);
      }

      // 1. Process via the selected Adapter
      const result = await adapter.process(payload);

      // 2. (Future) Emit event to Audit Log or Activity Feed here
      
      return result;
    } catch (error) {
      console.error(`[CommunicationEngine] Failed to send via ${payload.channel}:`, error);
      throw error; 
    }
  }
}

export default new CommunicationEngine();