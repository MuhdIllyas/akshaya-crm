// services/communication/communicationEngine.js
import { resolveConversation } from '../../utils/conversationService.js';
import internalAdapter from '../adapters/internalAdapter.js';

class CommunicationEngine {
  constructor() {
    this.adapters = new Map();
    
    // Register default built-in adapters
    this.register('internal', internalAdapter);
  }

  // ⭐ Point 9: Plugin architecture for adapters
  register(channel, adapter) {
    if (typeof adapter.send !== 'function') {
      throw new Error(`[CommunicationEngine] Adapter for ${channel} must implement a send() method.`);
    }
    this.adapters.set(channel, adapter);
  }

  async send(payload) {
    // ⚠️ Point 10: Strict payload validation
    this.validatePayload(payload);

    const { channel, conversation_id, sender, recipients = {}, context = {}, metadata = {} } = payload;
    const adapter = this.adapters.get(channel);

    if (!adapter) {
      throw new Error(`[CommunicationEngine] No adapter registered for channel: ${channel}`);
    }

    let targetConversationId = conversation_id;

    // ⚠️ Point 2 & 7: Engine orchestrates conversation resolution ONLY if no ID is provided
    if (!targetConversationId) {
      
      // ⚠️ Point 4 & 5: Normalize, deduplicate, and sort participants
      const rawParticipants = [sender.id, ...(recipients.staff || [])];
      const uniqueParticipants = [...new Set(rawParticipants)].sort((a, b) => a - b);
      
      // ⚠️ Point 6: True group calculation
      const isGroup = uniqueParticipants.length > 2 || context.is_group === true;

      // ⚠️ Point 3: Scope-based centre_id assignment (no hardcoded nulls)
      const scope = payload.scope || channel; 
      const isTenantOwned = (scope === 'whatsapp' || scope === 'portal' || context.type === 'service_entry');
      const resolvedCentreId = isTenantOwned ? metadata.centre_id : null;

      const conversation = await resolveConversation({
        channel,
        context_type: context.type || null,
        context_id: context.id || null,
        participant_ids: uniqueParticipants,
        is_group: isGroup,
        name: context.name || null,
        created_by: sender.id,
        centre_id: resolvedCentreId
      });
      
      targetConversationId = conversation.id;
    }

    // Pass the finalized routing data to the dumb adapter
    const deliveryPayload = {
      ...payload,
      conversation_id: targetConversationId
    };

    // ⭐ Biggest Suggestion: Standardized adapter.send()
    const result = await adapter.send(deliveryPayload);

    // (Future) Fire After-Send hooks here (Audit log, Activity Feed)

    return result;
  }

  validatePayload(payload) {
    if (!payload.channel) throw new Error("Missing 'channel' in payload.");
    if (!payload.sender || !payload.sender.id) throw new Error("Missing 'sender.id' in payload.");
    if (!payload.message) throw new Error("Missing 'message' object in payload.");
  }
}

export default new CommunicationEngine();