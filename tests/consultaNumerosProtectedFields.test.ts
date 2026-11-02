import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isProtectedConsultaNumerosField, omitProtectedConsultaNumerosFields } from '../src/lib/consultaNumerosProtectedFields';

describe('Consulta Números automatic metadata protection', () => {
  for (const field of ['astros_solicitacao_id', 'astros_alteracao_linha_em']) {
    test(`${field} cannot be manually edited or sent by create/update forms`, () => {
      assert.equal(isProtectedConsultaNumerosField(field), true);
      assert.equal(isProtectedConsultaNumerosField(` ${field.toUpperCase()} `), true);
      const values = { [field]: 'manual alteration', observacoes: 'observação permitida' };
      assert.deepEqual(omitProtectedConsultaNumerosFields(values), { observacoes: 'observação permitida' });
      assert.equal(values[field], 'manual alteration');
    });
  }

  test('ordinary fields remain editable and retain their values', () => {
    assert.equal(isProtectedConsultaNumerosField('observacoes'), false);
    assert.equal(isProtectedConsultaNumerosField('excluido_da_base'), false);
    const values = { observacoes: 'Nova observação', excluido_da_base: 'EM ANÁLISE PELA META' };
    assert.deepEqual(omitProtectedConsultaNumerosFields(values), values);
  });
});