// Format CPF: 000.000.000-00
export const formatCPF = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

// Format CNPJ: 00.000.000/0000-00
export const formatCNPJ = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

// Auto-detect and format CPF or CNPJ
export const formatCPFOrCNPJ = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length <= 11) {
    return formatCPF(value);
  }
  return formatCNPJ(value);
};

// Format currency: R$ 0,00
export const formatCurrency = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  if (!digits) return '';
  
  const numValue = parseInt(digits, 10) / 100;
  return numValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

// Parse currency back to number
export const parseCurrency = (value: string): number => {
  const digits = value.replace(/\D/g, '');
  return parseInt(digits, 10) / 100 || 0;
};

// Format phone: (00) 00000-0000 or (00) 0000-0000
export const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

// Remove formatting and get raw digits
export const unformat = (value: string): string => {
  return value.replace(/\D/g, '');
};
