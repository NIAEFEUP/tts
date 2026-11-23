export const exchangeErrorToText = {
  'classes-overlap': 'Ao realizar esta troca, haveriam conflitos para alguma pessoa envolvida na troca.',
  'students-with-incorrect-classes': 'Alguma das pessoas envolvidas não está numa das turmas incluídas na troca.',
  'duplicate-request': 'Já existe um pedido de troca igual a este.',
}

export const enrollmentErrorToText: Record<string, string> = {
  'already-enrolled': 'Já tens inscrição numa das unidades curriculares selecionadas.',
  'duplicate-enrollment-option': 'Selecionaste a mesma unidade curricular mais do que uma vez.',
  'duplicate-enrollment-request': 'Já tens um pedido para uma das unidades curriculares selecionadas.',
  'exchange-period-closed': 'O período de trocas está encerrado para uma das unidades curriculares selecionadas.',
  'occurrence-not-found': 'Uma das unidades curriculares já não está disponível.',
  'validation-error': 'O pedido não é válido. Verifica as unidades curriculares selecionadas.',
}
