const moduleConfig = {
  resolveDocumentContext: null,
  models: {
    CustomerModel: null,
    InvoiceModel: null,
    QuotationModel: null,
    CompanySettingsModel: null,
  },
};

function configureWhatsAppModule(config = {}) {
  if (typeof config.resolveDocumentContext === 'function') {
    moduleConfig.resolveDocumentContext = config.resolveDocumentContext;
  }

  if (config.models && typeof config.models === 'object') {
    moduleConfig.models = {
      ...moduleConfig.models,
      ...config.models,
    };
  }

  return getWhatsAppModuleConfig();
}

function getWhatsAppModuleConfig() {
  return {
    resolveDocumentContext: moduleConfig.resolveDocumentContext,
    models: {
      ...moduleConfig.models,
    },
  };
}

module.exports = {
  configureWhatsAppModule,
  getWhatsAppModuleConfig,
};
