const test = require('node:test');
const assert = require('node:assert/strict');

const assignmentController = require('./whatsappTemplateAssignmentController');

const quotationTemplate = {
  components: [
    { type: 'BODY', text: 'Hello {{1}}, quotation {{2}} for {{3}} from {{4}}.' },
    {
      type: 'BUTTONS',
      buttons: [{ type: 'URL', url: 'https://app.nareshsareecollection.com/quotation/{{1}}' }],
    },
  ],
};

const quotationMappings = [
  { component: 'BODY', parameterIndex: 1, sourceType: 'VARIABLE', sourceValue: 'customerName' },
  { component: 'BODY', parameterIndex: 2, sourceType: 'VARIABLE', sourceValue: 'documentNumber' },
  { component: 'BODY', parameterIndex: 3, sourceType: 'VARIABLE', sourceValue: 'amount' },
  { component: 'BODY', parameterIndex: 4, sourceType: 'VARIABLE', sourceValue: 'companyName' },
  { component: 'BUTTONS', parameterIndex: 1, buttonIndex: 0, sourceType: 'VARIABLE', sourceValue: 'quotationPublicShareId' },
];

test('quotation assignment validation requires every Meta variable and its share-id button source', () => {
  assert.equal(typeof assignmentController.getAssignmentMappingError, 'function');
  assert.equal(
    assignmentController.getAssignmentMappingError('QUOTATION', quotationTemplate, quotationMappings),
    null,
  );

  assert.match(
    assignmentController.getAssignmentMappingError(
      'QUOTATION',
      quotationTemplate,
      quotationMappings.filter((mapping) => !(mapping.component === 'BODY' && mapping.parameterIndex === 4)),
    ),
    /BODY \{\{4\}\}/,
  );

  assert.match(
    assignmentController.getAssignmentMappingError(
      'QUOTATION',
      quotationTemplate,
      quotationMappings.map((mapping) => (
        mapping.component === 'BUTTONS' ? { ...mapping, sourceValue: 'customerName' } : mapping
      )),
    ),
    /Quotation Public Share ID/,
  );

  assert.match(
    assignmentController.getAssignmentMappingError(
      'QUOTATION',
      quotationTemplate,
      quotationMappings.concat({
        component: 'BUTTONS',
        parameterIndex: 1,
        buttonIndex: 1,
        sourceType: 'VARIABLE',
        sourceValue: 'customerName',
      }),
    ),
    /Quotation Public Share ID/,
  );
});

test('exchange and invoice URL buttons accept only their document share-id source', () => {
  assert.equal(typeof assignmentController.getAssignmentMappingError, 'function');

  const exchangeTemplate = {
    components: [
      { type: 'BODY', text: 'Hello {{1}}, exchange invoice {{2}} from {{3}}.' },
      { type: 'BUTTONS', buttons: [{ type: 'URL', url: 'https://app.nareshsareecollection.com/exchange/{{1}}' }] },
    ],
  };
  const exchangeMappings = [
    { component: 'BODY', parameterIndex: 1, sourceType: 'VARIABLE', sourceValue: 'customerName' },
    { component: 'BODY', parameterIndex: 2, sourceType: 'VARIABLE', sourceValue: 'documentNumber' },
    { component: 'BODY', parameterIndex: 3, sourceType: 'VARIABLE', sourceValue: 'companyName' },
    { component: 'BUTTONS', parameterIndex: 1, buttonIndex: 0, sourceType: 'VARIABLE', sourceValue: 'exchangePublicShareId' },
  ];

  assert.equal(
    assignmentController.getAssignmentMappingError('EXCHANGE', exchangeTemplate, exchangeMappings),
    null,
  );
  assert.match(
    assignmentController.getAssignmentMappingError(
      'EXCHANGE',
      exchangeTemplate,
      exchangeMappings.map((mapping) => (
        mapping.component === 'BUTTONS' ? { ...mapping, sourceValue: 'documentNumber' } : mapping
      )),
    ),
    /Exchange Public Share ID/,
  );

  const invoiceMappings = exchangeMappings.map((mapping) => (
    mapping.component === 'BUTTONS' ? { ...mapping, sourceValue: 'publicShareId' } : mapping
  ));
  assert.equal(
    assignmentController.getAssignmentMappingError('INVOICE', exchangeTemplate, invoiceMappings),
    null,
  );
});
