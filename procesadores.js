window.procesadoresConfig = {
  CBCO: {
    carrier: 67,
    campos: {
      // Campos visibles desde el frontend
      cb_commerce_id: { tipo: 'texto' },
      cb_terminal_code: { tipo: 'texto' },
      cb_unique_code: { tipo: 'texto' }
    },
    // Campos fijos que no se deben mostrar, pero sí enviar
    fijos: {
      cb_acquirer_id: "1",
      cb_using: true,
      cb_v2: true
    }
  },
  RB: {
    carrier: 27,
    campos: {
      rb_idAdquiriente: { tipo: 'texto' },
      rb_idTerminal: { tipo: 'texto' }
    }
    fijos: {
      rb_capacidadPIN: "Virtual",
      rb_modoCapturaPAN: "Manual",
      rb_password: "R3d3b4n$.",
      rb_tipoTerminal: "WEB",
      rb_username: "0013974936",
      rb_wsdl_cancelacion_url:"http://cdn-checkout-1.paymentez.com.s3.amazonaws.com/backend/redeban_prod/CompraCancelacion/CompraElectronicaCancelacionService.wsdl",
      rb_wsdl_compra_url: "http://cdn-checkout-1.paymentez.com.s3.amazonaws.com/backend/redeban_prod/compraElectronica/CompraElectronicaService.wsdl"
      rb_using: true
    }
  },
  PR: {
    carrier: 34,
    campos: {
      pr_retailer_id: { tipo: 'texto' },
      pr_acceptor_location_id: { tipo: 'texto' },
      pr_fiid: { tipo: 'texto' },
      pr_merchant_type: { tipo: 'texto' },
      pr_acceptor_name: { tipo: 'texto' },
      pr_using: { tipo: 'booleano' }
    }
  },
  PSE: {
  carrier: "PSE",
  campos: {
    pse_commerce_id: { tipo: 'texto', label: 'Commerce ID' },
    pse_terminal_id: { tipo: 'texto', label: 'Terminal ID' },
    beneficiaryEntityName: { tipo: 'texto', label: 'Nombre Beneficiario' },
    beneficiaryEntityCIIUCategory: { tipo: 'texto', label: 'Categoría CIIU Beneficiario' },
    beneficiaryEntityIdentification: { tipo: 'texto', label: 'Documento Beneficiario' },
    beneficiaryEntityIdentificationType: { tipo: 'texto', label: 'Tipo Documento Beneficiario' }
  },
  fijos: {
    country_default: 'COL',
    currency_default: 'COP',
    max_amount: 1000000000,
    min_amount: 1,
    agreement: {
      is_v2: true
    }
  }
}

};
