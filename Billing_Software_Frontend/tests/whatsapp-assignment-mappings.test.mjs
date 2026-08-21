import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const assignmentsSource = readFileSync(
  new URL('../src/pages/admin/whatsapp/AssignmentsTab.tsx', import.meta.url),
  'utf8',
);

test('BODY and BUTTON mapping dropdowns use component-specific source lists', () => {
  assert.match(assignmentsSource, /bodyVariablesForType/);
  assert.match(assignmentsSource, /buttonVariablesForType/);
  assert.match(assignmentsSource, /BODY MAPPINGS[\s\S]*bodyVariablesForType\.map/);
  assert.match(assignmentsSource, /BUTTON MAPPINGS[\s\S]*buttonVariablesForType\.map/);
  assert.doesNotMatch(assignmentsSource, /BUTTON MAPPINGS[\s\S]*varsForType\.map/);
});

test('quotation and exchange buttons expose only their public share ID', () => {
  assert.match(assignmentsSource, /Quotation Public Share ID[^\n]*quotationPublicShareId/);
  assert.match(assignmentsSource, /Exchange Public Share ID[^\n]*exchangePublicShareId/);
  assert.match(assignmentsSource, /Invoice Public Share ID[^\n]*publicShareId/);
  assert.doesNotMatch(assignmentsSource, /Exchange Number/);
  assert.doesNotMatch(assignmentsSource, /Company Phone/);
});

test('new mappings remain unselected and save validation rejects invalid public-link sources', () => {
  assert.match(assignmentsSource, /component: 'BODY',[\s\S]*sourceValue: ''/);
  assert.match(assignmentsSource, /component: 'BUTTONS',[\s\S]*sourceValue: ''/);
  assert.match(assignmentsSource, /getAssignmentMappingError/);
  assert.match(assignmentsSource, /toast\.error\(mappingError\)/);
});

test('advertisement is not exposed as a template assignment type', () => {
  assert.doesNotMatch(assignmentsSource, /ADVERTISEMENT/);
});
