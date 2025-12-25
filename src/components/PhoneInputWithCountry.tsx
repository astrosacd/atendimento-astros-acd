import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatPhone, unformat } from '@/utils/formatters';

interface Country {
  code: string;
  name: string;
  ddi: string;
  flag: string;
}

const countries: Country[] = [
  { code: 'BR', name: 'Brasil', ddi: '+55', flag: '🇧🇷' },
  { code: 'US', name: 'Estados Unidos', ddi: '+1', flag: '🇺🇸' },
  { code: 'PT', name: 'Portugal', ddi: '+351', flag: '🇵🇹' },
  { code: 'ES', name: 'Espanha', ddi: '+34', flag: '🇪🇸' },
  { code: 'AR', name: 'Argentina', ddi: '+54', flag: '🇦🇷' },
  { code: 'MX', name: 'México', ddi: '+52', flag: '🇲🇽' },
  { code: 'CL', name: 'Chile', ddi: '+56', flag: '🇨🇱' },
  { code: 'CO', name: 'Colômbia', ddi: '+57', flag: '🇨🇴' },
  { code: 'PE', name: 'Peru', ddi: '+51', flag: '🇵🇪' },
  { code: 'UY', name: 'Uruguai', ddi: '+598', flag: '🇺🇾' },
  { code: 'PY', name: 'Paraguai', ddi: '+595', flag: '🇵🇾' },
  { code: 'VE', name: 'Venezuela', ddi: '+58', flag: '🇻🇪' },
  { code: 'EC', name: 'Equador', ddi: '+593', flag: '🇪🇨' },
  { code: 'BO', name: 'Bolívia', ddi: '+591', flag: '🇧🇴' },
  { code: 'GB', name: 'Reino Unido', ddi: '+44', flag: '🇬🇧' },
  { code: 'DE', name: 'Alemanha', ddi: '+49', flag: '🇩🇪' },
  { code: 'FR', name: 'França', ddi: '+33', flag: '🇫🇷' },
  { code: 'IT', name: 'Itália', ddi: '+39', flag: '🇮🇹' },
  { code: 'CA', name: 'Canadá', ddi: '+1', flag: '🇨🇦' },
  { code: 'AU', name: 'Austrália', ddi: '+61', flag: '🇦🇺' },
  { code: 'JP', name: 'Japão', ddi: '+81', flag: '🇯🇵' },
  { code: 'CN', name: 'China', ddi: '+86', flag: '🇨🇳' },
  { code: 'IN', name: 'Índia', ddi: '+91', flag: '🇮🇳' },
  { code: 'ZA', name: 'África do Sul', ddi: '+27', flag: '🇿🇦' },
  { code: 'AE', name: 'Emirados Árabes', ddi: '+971', flag: '🇦🇪' },
];

interface PhoneInputWithCountryProps {
  value: string;
  onChange: (phoneWithDDI: string, countryCode: string, rawPhone: string) => void;
  countryCode?: string;
  className?: string;
  required?: boolean;
}

export function PhoneInputWithCountry({ 
  value, 
  onChange, 
  countryCode = 'BR',
  className = '',
  required = false
}: PhoneInputWithCountryProps) {
  const [selectedCountry, setSelectedCountry] = useState(countryCode);
  // Extract just the phone part (without DDI) for display
  const [phoneOnly, setPhoneOnly] = useState(() => {
    // If value starts with +, try to extract phone part
    const currentDDI = countries.find(c => c.code === countryCode)?.ddi || '+55';
    if (value.startsWith(currentDDI.replace('+', ''))) {
      return value.slice(currentDDI.replace('+', '').length);
    }
    return value;
  });
  
  
  const currentCountry = countries.find(c => c.code === selectedCountry) || countries[0];
  
  const handleCountryChange = (code: string) => {
    setSelectedCountry(code);
    const newCountry = countries.find(c => c.code === code);
    const ddi = newCountry?.ddi.replace('+', '') || '55';
    const fullNumber = ddi + phoneOnly;
    onChange(fullNumber, code, phoneOnly);
  };
  
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = unformat(e.target.value);
    setPhoneOnly(rawValue);
    const ddi = currentCountry.ddi.replace('+', '');
    const fullNumber = ddi + rawValue;
    onChange(fullNumber, selectedCountry, rawValue);
  };
  
  // Format phone based on country
  const formatPhoneByCountry = (phone: string, countryCode: string) => {
    if (!phone) return '';
    
    // For Brazil, use the existing format
    if (countryCode === 'BR') {
      return formatPhone(phone);
    }
    
    // For US/Canada (+1), format as (XXX) XXX-XXXX
    if (countryCode === 'US' || countryCode === 'CA') {
      const digits = phone.replace(/\D/g, '');
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
    
    // For other countries, just add spaces every 3 digits
    const digits = phone.replace(/\D/g, '');
    return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <Select value={selectedCountry} onValueChange={handleCountryChange}>
        <SelectTrigger className="w-[120px] bg-secondary border-border text-foreground h-11 shrink-0">
          <SelectValue>
            <span className="flex items-center gap-2">
              <span className="text-lg">{currentCountry.flag}</span>
              <span className="text-sm">{currentCountry.ddi}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {countries.map((country) => (
            <SelectItem key={country.code} value={country.code}>
              <span className="flex items-center gap-2">
                <span className="text-lg">{country.flag}</span>
                <span>{country.ddi}</span>
                <span className="text-muted-foreground text-sm">{country.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Input
        placeholder={selectedCountry === 'BR' ? '(00) 00000-0000' : 'Número de telefone'}
        value={formatPhoneByCountry(phoneOnly, selectedCountry)}
        onChange={handlePhoneChange}
        className="bg-secondary border-border text-foreground h-11 flex-1"
        required={required}
      />
    </div>
  );
}
