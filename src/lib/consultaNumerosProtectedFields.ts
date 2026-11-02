const protectedMetadataFields = new Set([
  'astros_solicitacao_id',
  'astros_alteracao_linha_em',
]);

export function isProtectedConsultaNumerosField(name: string): boolean {
  return protectedMetadataFields.has(name.trim().toLowerCase());
}

// Never send automatic metadata back from a manual form, even unchanged:
// its current value may have advanced in Baserow since the dialog opened.
export function omitProtectedConsultaNumerosFields<T>(values: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(values).filter(([name]) => !isProtectedConsultaNumerosField(name)),
  );
}