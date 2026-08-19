const mongoose = require('mongoose');

const whatsAppTemplateAssignmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    messageType: {
      type: String,
      required: true,
      index: true,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    metaTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WhatsAppMetaTemplate',
      required: true,
    },
    metaTemplateName: {
      type: String,
      required: true,
    },
    languageCode: {
      type: String,
      required: true,
    },
    headerMapping: {
      sourceType: {
        type: String,
        default: 'NONE', // NONE, DOCUMENT_PDF, CAMPAIGN_IMAGE
      },
      // If we need to support hardcoded URLs or specific document fields
      value: {
        type: String,
        default: '',
      },
    },
    variableMappings: [
      {
        component: {
          type: String, // HEADER, BODY, FOOTER, BUTTONS
          required: true,
        },
        parameterIndex: {
          type: Number,
          required: true,
        },
        sourceType: {
          type: String,
          required: true, // VARIABLE, FIXED
        },
        sourceValue: {
          type: String,
          required: true, // customerName, amount, publicShareId, etc.
        },
        buttonIndex: {
          type: Number,
          default: null, // Only used if component is BUTTONS
        },
      },
    ],
  },
  { timestamps: true }
);

whatsAppTemplateAssignmentSchema.index({ userId: 1, messageType: 1 }, { unique: true });

module.exports = mongoose.model('WhatsAppTemplateAssignment', whatsAppTemplateAssignmentSchema);
