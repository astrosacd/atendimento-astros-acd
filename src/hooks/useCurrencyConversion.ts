import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface ExchangeRateResponse {
  USDBRL: {
    bid: string;
    ask: string;
  };
}

export function useCurrencyConversion() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastRate, setLastRate] = useState<number | null>(null);

  const fetchExchangeRate = useCallback(async (): Promise<number | null> => {
    setIsLoading(true);
    try {
      const response = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
      const data: ExchangeRateResponse = await response.json();
      
      // Usa o valor de compra (bid) para conversão BRL -> USD
      const rate = parseFloat(data.USDBRL.bid);
      setLastRate(rate);
      return rate;
    } catch (error) {
      console.error('Erro ao buscar cotação:', error);
      toast.error('Erro ao buscar cotação do dólar');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const convertBRLtoUSD = useCallback(async (brlValue: number): Promise<number | null> => {
    const rate = await fetchExchangeRate();
    if (rate && brlValue > 0) {
      const usdValue = brlValue / rate;
      return Math.round(usdValue * 100) / 100; // Arredonda para 2 casas decimais
    }
    return null;
  }, [fetchExchangeRate]);

  const convertUSDtoBRL = useCallback(async (usdValue: number): Promise<number | null> => {
    const rate = await fetchExchangeRate();
    if (rate && usdValue > 0) {
      const brlValue = usdValue * rate;
      return Math.round(brlValue * 100) / 100; // Arredonda para 2 casas decimais
    }
    return null;
  }, [fetchExchangeRate]);

  return {
    isLoading,
    lastRate,
    convertBRLtoUSD,
    convertUSDtoBRL,
    fetchExchangeRate,
  };
}
