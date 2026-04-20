// Shared utility to detect whether a phone number is international (non-Brazilian)

const VALID_BR_DDDS = new Set([
  '11','12','13','14','15','16','17','18','19', // SP
  '21','22','24', // RJ
  '27','28', // ES
  '31','32','33','34','35','37','38', // MG
  '41','42','43','44','45','46', // PR
  '47','48','49', // SC
  '51','53','54','55', // RS
  '61', // DF
  '62','64', // GO
  '63', // TO
  '65','66', // MT
  '67', // MS
  '68', // AC
  '69', // RO
  '71','73','74','75','77', // BA
  '79', // SE
  '81','87', // PE
  '82', // AL
  '83', // PB
  '84', // RN
  '85','88', // CE
  '86','89', // PI
  '91','93','94', // PA
  '92','97', // AM
  '95', // RR
  '96', // AP
  '98','99', // MA
]);

/**
 * Returns true when the local part of a Brazilian phone is structurally valid:
 *  - 11 digits: DDD + 9 + 8 digits (current mobile)
 *  - 10 digits: DDD + [2-9] + 7 digits (landline or legacy mobile already normalized)
 */
const isValidBrazilianLocal = (digits: string): boolean => {
  if (digits.length === 11) {
    const ddd = digits.slice(0, 2);
    return VALID_BR_DDDS.has(ddd) && digits[2] === '9';
  }
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    return VALID_BR_DDDS.has(ddd) && /[2-9]/.test(digits[2]);
  }
  return false;
};

/**
 * Returns true when the phone number does not match a Brazilian pattern.
 * Handles:
 *  - With DDI 55 (12-13 digits) → validates the local part
 *  - Without DDI (10-11 digits) → must match BR mobile/landline pattern
 *  - Anything else → international
 */
export const isInternationalPhoneNumber = (numero: string | null | undefined): boolean => {
  if (!numero) return false;
  const clean = numero.replace(/\D/g, '');
  if (!clean) return false;

  if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) {
    return !isValidBrazilianLocal(clean.slice(2));
  }

  if ((clean.length === 10 || clean.length === 11) && isValidBrazilianLocal(clean)) {
    return false;
  }

  return true;
};
