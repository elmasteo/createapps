window.procesadoresConfig = {
  CBCO: {
    carrier: 67,
    campos: {
      cb_acquirer_id: { tipo: 'texto' },
      cb_commerce_id: { tipo: 'texto' },
      cb_terminal_code: { tipo: 'texto' },
      cb_unique_code: { tipo: 'texto' },
      cb_using: { tipo: 'booleano' },
      cb_v2: { tipo: 'booleano' }
    }
  },
  PSE: {
    carrier: 100,
    campos: {
      commerce_id: { tipo: 'texto' },
      terminal_id: { tipo: 'texto' },
      nombre_beneficiario: { tipo: 'texto' },
      tipo_documento: { tipo: 'texto' },
      numero_documento: { tipo: 'texto' },
      cuenta_bancaria: { tipo: 'texto' },
      tipo_cuenta: { tipo: 'texto' },
      banco: { tipo: 'texto' }
    }
  }
};
