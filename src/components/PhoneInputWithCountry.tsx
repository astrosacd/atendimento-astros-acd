import { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ChevronDown, Search } from 'lucide-react';
import { formatPhone, unformat } from '@/utils/formatters';

interface Country {
  code: string;
  name: string;
  ddi: string;
  flag: string;
}

const countries: Country[] = [
  // América do Sul
  { code: 'BR', name: 'Brasil', ddi: '+55', flag: '🇧🇷' },
  { code: 'AR', name: 'Argentina', ddi: '+54', flag: '🇦🇷' },
  { code: 'BO', name: 'Bolívia', ddi: '+591', flag: '🇧🇴' },
  { code: 'CL', name: 'Chile', ddi: '+56', flag: '🇨🇱' },
  { code: 'CO', name: 'Colômbia', ddi: '+57', flag: '🇨🇴' },
  { code: 'EC', name: 'Equador', ddi: '+593', flag: '🇪🇨' },
  { code: 'GY', name: 'Guiana', ddi: '+592', flag: '🇬🇾' },
  { code: 'PY', name: 'Paraguai', ddi: '+595', flag: '🇵🇾' },
  { code: 'PE', name: 'Peru', ddi: '+51', flag: '🇵🇪' },
  { code: 'SR', name: 'Suriname', ddi: '+597', flag: '🇸🇷' },
  { code: 'UY', name: 'Uruguai', ddi: '+598', flag: '🇺🇾' },
  { code: 'VE', name: 'Venezuela', ddi: '+58', flag: '🇻🇪' },
  // América Central e Caribe
  { code: 'CR', name: 'Costa Rica', ddi: '+506', flag: '🇨🇷' },
  { code: 'CU', name: 'Cuba', ddi: '+53', flag: '🇨🇺' },
  { code: 'DO', name: 'Rep. Dominicana', ddi: '+1809', flag: '🇩🇴' },
  { code: 'SV', name: 'El Salvador', ddi: '+503', flag: '🇸🇻' },
  { code: 'GT', name: 'Guatemala', ddi: '+502', flag: '🇬🇹' },
  { code: 'HT', name: 'Haiti', ddi: '+509', flag: '🇭🇹' },
  { code: 'HN', name: 'Honduras', ddi: '+504', flag: '🇭🇳' },
  { code: 'JM', name: 'Jamaica', ddi: '+1876', flag: '🇯🇲' },
  { code: 'NI', name: 'Nicarágua', ddi: '+505', flag: '🇳🇮' },
  { code: 'PA', name: 'Panamá', ddi: '+507', flag: '🇵🇦' },
  { code: 'PR', name: 'Porto Rico', ddi: '+1787', flag: '🇵🇷' },
  { code: 'TT', name: 'Trinidad e Tobago', ddi: '+1868', flag: '🇹🇹' },
  // América do Norte
  { code: 'US', name: 'Estados Unidos', ddi: '+1', flag: '🇺🇸' },
  { code: 'CA', name: 'Canadá', ddi: '+1', flag: '🇨🇦' },
  { code: 'MX', name: 'México', ddi: '+52', flag: '🇲🇽' },
  // Europa
  { code: 'DE', name: 'Alemanha', ddi: '+49', flag: '🇩🇪' },
  { code: 'AT', name: 'Áustria', ddi: '+43', flag: '🇦🇹' },
  { code: 'BE', name: 'Bélgica', ddi: '+32', flag: '🇧🇪' },
  { code: 'BG', name: 'Bulgária', ddi: '+359', flag: '🇧🇬' },
  { code: 'HR', name: 'Croácia', ddi: '+385', flag: '🇭🇷' },
  { code: 'DK', name: 'Dinamarca', ddi: '+45', flag: '🇩🇰' },
  { code: 'SK', name: 'Eslováquia', ddi: '+421', flag: '🇸🇰' },
  { code: 'SI', name: 'Eslovênia', ddi: '+386', flag: '🇸🇮' },
  { code: 'ES', name: 'Espanha', ddi: '+34', flag: '🇪🇸' },
  { code: 'FI', name: 'Finlândia', ddi: '+358', flag: '🇫🇮' },
  { code: 'FR', name: 'França', ddi: '+33', flag: '🇫🇷' },
  { code: 'GR', name: 'Grécia', ddi: '+30', flag: '🇬🇷' },
  { code: 'HU', name: 'Hungria', ddi: '+36', flag: '🇭🇺' },
  { code: 'IE', name: 'Irlanda', ddi: '+353', flag: '🇮🇪' },
  { code: 'IT', name: 'Itália', ddi: '+39', flag: '🇮🇹' },
  { code: 'NL', name: 'Holanda', ddi: '+31', flag: '🇳🇱' },
  { code: 'NO', name: 'Noruega', ddi: '+47', flag: '🇳🇴' },
  { code: 'PL', name: 'Polônia', ddi: '+48', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', ddi: '+351', flag: '🇵🇹' },
  { code: 'GB', name: 'Reino Unido', ddi: '+44', flag: '🇬🇧' },
  { code: 'CZ', name: 'Rep. Tcheca', ddi: '+420', flag: '🇨🇿' },
  { code: 'RO', name: 'Romênia', ddi: '+40', flag: '🇷🇴' },
  { code: 'RU', name: 'Rússia', ddi: '+7', flag: '🇷🇺' },
  { code: 'SE', name: 'Suécia', ddi: '+46', flag: '🇸🇪' },
  { code: 'CH', name: 'Suíça', ddi: '+41', flag: '🇨🇭' },
  { code: 'TR', name: 'Turquia', ddi: '+90', flag: '🇹🇷' },
  { code: 'UA', name: 'Ucrânia', ddi: '+380', flag: '🇺🇦' },
  // Ásia
  { code: 'CN', name: 'China', ddi: '+86', flag: '🇨🇳' },
  { code: 'KR', name: 'Coreia do Sul', ddi: '+82', flag: '🇰🇷' },
  { code: 'AE', name: 'Emirados Árabes', ddi: '+971', flag: '🇦🇪' },
  { code: 'PH', name: 'Filipinas', ddi: '+63', flag: '🇵🇭' },
  { code: 'IN', name: 'Índia', ddi: '+91', flag: '🇮🇳' },
  { code: 'ID', name: 'Indonésia', ddi: '+62', flag: '🇮🇩' },
  { code: 'IL', name: 'Israel', ddi: '+972', flag: '🇮🇱' },
  { code: 'JP', name: 'Japão', ddi: '+81', flag: '🇯🇵' },
  { code: 'MY', name: 'Malásia', ddi: '+60', flag: '🇲🇾' },
  { code: 'PK', name: 'Paquistão', ddi: '+92', flag: '🇵🇰' },
  { code: 'SA', name: 'Arábia Saudita', ddi: '+966', flag: '🇸🇦' },
  { code: 'SG', name: 'Singapura', ddi: '+65', flag: '🇸🇬' },
  { code: 'TH', name: 'Tailândia', ddi: '+66', flag: '🇹🇭' },
  { code: 'TW', name: 'Taiwan', ddi: '+886', flag: '🇹🇼' },
  { code: 'VN', name: 'Vietnã', ddi: '+84', flag: '🇻🇳' },
  // África
  { code: 'ZA', name: 'África do Sul', ddi: '+27', flag: '🇿🇦' },
  { code: 'AO', name: 'Angola', ddi: '+244', flag: '🇦🇴' },
  { code: 'CV', name: 'Cabo Verde', ddi: '+238', flag: '🇨🇻' },
  { code: 'EG', name: 'Egito', ddi: '+20', flag: '🇪🇬' },
  { code: 'GW', name: 'Guiné-Bissau', ddi: '+245', flag: '🇬🇼' },
  { code: 'MA', name: 'Marrocos', ddi: '+212', flag: '🇲🇦' },
  { code: 'MZ', name: 'Moçambique', ddi: '+258', flag: '🇲🇿' },
  { code: 'NG', name: 'Nigéria', ddi: '+234', flag: '🇳🇬' },
  { code: 'ST', name: 'São Tomé e Príncipe', ddi: '+239', flag: '🇸🇹' },
  { code: 'TZ', name: 'Tanzânia', ddi: '+255', flag: '🇹🇿' },
  { code: 'KE', name: 'Quênia', ddi: '+254', flag: '🇰🇪' },
  // Oceania
  { code: 'AU', name: 'Austrália', ddi: '+61', flag: '🇦🇺' },
  { code: 'NZ', name: 'Nova Zelândia', ddi: '+64', flag: '🇳🇿' },
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
  // Auto-detect country from value by matching DDI prefix (longest match first)
  const detectCountryFromValue = (val: string): { country: string; phone: string } => {
    if (!val) return { country: countryCode, phone: '' };
    const digits = val.replace(/\D/g, '');
    // Sort countries by DDI length descending to match longest prefix first
    const sorted = [...countries].sort((a, b) => 
      b.ddi.replace('+', '').length - a.ddi.replace('+', '').length
    );
    for (const c of sorted) {
      const ddi = c.ddi.replace('+', '');
      if (digits.startsWith(ddi)) {
        return { country: c.code, phone: digits.slice(ddi.length) };
      }
    }
    return { country: countryCode, phone: digits };
  };

  const detected = detectCountryFromValue(value);
  const [selectedCountry, setSelectedCountry] = useState(detected.country);
  const [phoneOnly, setPhoneOnly] = useState(detected.phone);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const currentCountry = countries.find(c => c.code === selectedCountry) || countries[0];

  // Re-detect country when value changes externally (e.g., clone form)
  useEffect(() => {
    if (!value) return;
    const newDetected = detectCountryFromValue(value);
    if (newDetected.country !== selectedCountry || newDetected.phone !== phoneOnly) {
      setSelectedCountry(newDetected.country);
      setPhoneOnly(newDetected.phone);
    }
  }, [value]);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearch('');
    }
  }, [open]);

  const filteredCountries = useMemo(() => {
    if (!search) return countries;
    const q = search.toLowerCase().replace('+', '');
    return countries.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.ddi.replace('+', '').includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  }, [search]);
  
  const handleCountryChange = (code: string) => {
    setSelectedCountry(code);
    const newCountry = countries.find(c => c.code === code);
    const ddi = newCountry?.ddi.replace('+', '') || '55';
    const fullNumber = ddi + phoneOnly;
    onChange(fullNumber, code, phoneOnly);
    setOpen(false);
  };
  
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = unformat(e.target.value);
    setPhoneOnly(rawValue);
    const ddi = currentCountry.ddi.replace('+', '');
    const fullNumber = ddi + rawValue;
    onChange(fullNumber, selectedCountry, rawValue);
  };
  
  const formatPhoneByCountry = (phone: string, countryCode: string) => {
    if (!phone) return '';
    if (countryCode === 'BR') return formatPhone(phone);
    if (countryCode === 'US' || countryCode === 'CA') {
      const digits = phone.replace(/\D/g, '');
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
    const digits = phone.replace(/\D/g, '');
    return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[130px] bg-secondary border-border text-foreground h-11 shrink-0 justify-between px-3"
          >
            <span className="flex items-center gap-1.5 truncate">
              <span className="text-lg">{currentCountry.flag}</span>
              <span className="text-sm">{currentCountry.ddi}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0 z-[9999]" align="start">
          <div className="flex items-center border-b border-border px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={searchInputRef}
              placeholder="Buscar país ou DDI..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-[250px] overflow-y-auto p-1">
            {filteredCountries.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum país encontrado</p>
            ) : (
              filteredCountries.map((country) => (
                <button
                  key={country.code}
                  onClick={() => handleCountryChange(country.code)}
                  className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground ${
                    selectedCountry === country.code ? 'bg-accent text-accent-foreground' : ''
                  }`}
                >
                  <span className="text-lg">{country.flag}</span>
                  <span className="font-medium">{country.ddi}</span>
                  <span className="text-muted-foreground text-xs truncate">{country.name}</span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      
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
