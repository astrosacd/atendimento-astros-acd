// Format CPF: 000.000.000-00
export const formatCPF = (value: string | null | undefined): string => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 11);
  
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

// Format CNPJ: 00.000.000/0000-00
export const formatCNPJ = (value: string | null | undefined): string => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 14);
  
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

// Auto-detect and format CPF or CNPJ
export const formatCPFOrCNPJ = (value: string | null | undefined): string => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  
  if (digits.length <= 11) {
    return formatCPF(value);
  }
  return formatCNPJ(value);
};

// Format currency from cents: R$ 0,00
export const formatCurrency = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  if (!digits) return '';
  
  // Limit to a reasonable number of digits to prevent overflow
  const limitedDigits = digits.slice(0, 12);
  const numValue = parseInt(limitedDigits, 10) / 100;
  return numValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

// Format currency for input field (handles user typing)
export const formatCurrencyInput = (value: string, moeda: 'BRL' | 'USD' = 'BRL'): string => {
  // Remove everything except digits
  const digits = value.replace(/\D/g, '');
  
  if (!digits) return '';
  
  // Limit to prevent overflow (max 999.999.999,99)
  const limitedDigits = digits.slice(0, 11);
  const numValue = parseInt(limitedDigits, 10) / 100;
  
  if (moeda === 'USD') {
    return numValue.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  }
  
  return numValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

// Format a number as currency display (for showing existing values)
export const formatCurrencyDisplay = (value: number, moeda: 'BRL' | 'USD' = 'BRL'): string => {
  if (moeda === 'USD') {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  }
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

// Parse currency back to number (returns value in reais, not cents)
export const parseCurrency = (value: string): number => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 0;
  // Limit digits to prevent overflow
  const limitedDigits = digits.slice(0, 11);
  return parseInt(limitedDigits, 10) / 100 || 0;
};

// Format phone with DDI support: (DDI) (DD) 00000-0000
export const formatPhone = (value: string | null | undefined): string => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  
  if (!digits) return '';
  
  // Check if number has DDI (more than 11 digits for Brazil, or starts with known DDIs)
  // Brazilian numbers with DDI: 55 + 2 (DDD) + 8 or 9 digits = 12-13 digits
  // Other countries may vary
  
  // If number has 12+ digits, assume it has DDI
  if (digits.length >= 12) {
    // Extract DDI (first 2 digits for most countries, 3 for some)
    let ddi = '';
    let phoneWithoutDDI = '';
    
    // Common 2-digit DDIs
    const twoDigitDDIs = ['55', '54', '56', '57', '51', '52', '58', '34', '39', '49', '33', '44', '61', '81', '86', '91', '27'];
    // Common 3-digit DDIs
    const threeDigitDDIs = ['351', '598', '595', '593', '591', '971'];
    
    if (threeDigitDDIs.includes(digits.slice(0, 3))) {
      ddi = digits.slice(0, 3);
      phoneWithoutDDI = digits.slice(3);
    } else if (twoDigitDDIs.includes(digits.slice(0, 2))) {
      ddi = digits.slice(0, 2);
      phoneWithoutDDI = digits.slice(2);
    } else {
      // Default: assume 2-digit DDI
      ddi = digits.slice(0, 2);
      phoneWithoutDDI = digits.slice(2);
    }
    
    // Format Brazilian phone (DDI 55)
    if (ddi === '55') {
      const ddd = phoneWithoutDDI.slice(0, 2);
      const number = phoneWithoutDDI.slice(2);
      if (number.length <= 4) {
        return `(${ddi}) ${ddd} ${number}`;
      }
      if (number.length <= 8) {
        return `(${ddi}) ${ddd} ${number.slice(0, 4)}-${number.slice(4)}`;
      }
      // 9-digit mobile
      return `(${ddi}) ${ddd} ${number.slice(0, 5)}-${number.slice(5, 9)}`;
    }
    
    // Format other countries: (DDI) rest of number with spaces
    return `(${ddi}) ${phoneWithoutDDI.replace(/(\d{3,4})(?=\d)/g, '$1-').slice(0, 15)}`;
  }
  
  // No DDI - format as local Brazilian number
  const localDigits = digits.slice(0, 11);
  
  if (localDigits.length <= 2) return localDigits.length ? `(${localDigits}` : '';
  if (localDigits.length <= 6) return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2)}`;
  if (localDigits.length <= 10) return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 6)}-${localDigits.slice(6)}`;
  return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7)}`;
};

// Remove formatting and get raw digits
export const unformat = (value: string | null | undefined): string => {
  if (!value) return '';
  return value.replace(/\D/g, '');
};
