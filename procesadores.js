const processorSchemas = {
  CBCO: {
    visible: ['prefix', 'max', 'min', 'order'],
    fixed: { prefix: 'CBCO', max: 10000000000.0, min: 1.0, order: 1 },
    internal: ['carrier'] // se asigna automáticamente como "CBCO"
  },
  RB: {
    visible: ['prefix', 'max', 'min', 'order'],
    fixed: { prefix: 'RB', max: 1000000000000.0, min: 1.0, order: 1 },
    internal: ['carrier']
  },
  PSE: {
    visible: [
      'commerce_id', 'terminal_id', 'ciiu',
      'beneficiaryEntityName', 'beneficiaryEntityCIIUCategory',
      'beneficiaryEntityIdentification', 'beneficiaryEntityIdentificationType'
    ],
    fixed: {
      carrier: 'PSE',
      country_default: 'COL',
      currency_default: 'COP',
      max_amount: 1000000000,
      min_amount: 1,
      is_v2: true
    },
    internal: []
  },
  ccapi: {
    visible: [],
    fixed: {
      carrier: 'ccapi',
      country_default: 'COL',
      currency_default: 'COP',
      agreement: {},
      max_amount: 1000000000,
      min_amount: 1
    },
    internal: []
  }
};
