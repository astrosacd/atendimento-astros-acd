import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

interface Cliente {
  id: string;
  nome: string;
  email: string;
  numero: string;
  produto: string;
  plano: string | null;
  valor: number;
  cpf: string;
  data_renovacao: string;
  cobranca_ativa: boolean;
  moeda: string; // BRL or USD
}

interface BillingConfig {
  [key: string]: string;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  api_url: string;
  api_key: string;
  is_active: boolean;
}

interface RequestBody {
  clienteIds?: string[];
  messageType?: string;
}

interface PaymentData {
  linkPagamento?: string;
  boletoUrl?: string;
  valorCartao?: string;
  valorBoleto?: string;
  pixChave?: string;
  pixNome?: string;
  pixBanco?: string;
  stripePaymentLink?: string; // Stripe payment link for USD
  valorStripe?: string; // Stripe amount with fee
}

interface StripeConfig {
  stripe_secret_key: string;
  stripe_tax_percent: number;
  stripe_enabled: boolean;
}

interface StripePaymentResult {
  success: boolean;
  paymentLink: string | null;
  paymentId: string | null;
  finalAmount: number;
  error?: string;
}

// Validation functions
const validateEmail = (email: string): { valid: boolean; reason?: string } => {
  if (!email || email.trim() === '') {
    return { valid: false, reason: 'Email não informado' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, reason: `Email inválido: ${email}` };
  }
  return { valid: true };
};

const validateWhatsAppNumber = (numero: string): { valid: boolean; reason?: string; international?: boolean } => {
  if (!numero || numero.trim() === '') {
    return { valid: false, reason: 'Número de WhatsApp não informado' };
  }
  const cleanNumber = numero.replace(/\D/g, '');
  
  // Minimum length check
  if (cleanNumber.length < 7) {
    return { valid: false, reason: `Número WhatsApp inválido (${cleanNumber.length} dígitos): ${numero}` };
  }

  // Check if it's a Brazilian number (starts with 55) or looks like one
  const isBrazilianFormat = cleanNumber.startsWith('55') || (cleanNumber.length >= 10 && cleanNumber.length <= 11);

  if (isBrazilianFormat && !cleanNumber.startsWith('351') && !cleanNumber.startsWith('1')) {
    // Validate Brazilian number format
    const numberWithoutCountry = cleanNumber.startsWith('55') ? cleanNumber.slice(2) : cleanNumber;
    if (numberWithoutCountry.length >= 10) {
      const ddd = numberWithoutCountry.slice(0, 2);
      const dddNum = parseInt(ddd, 10);
      if (dddNum < 11 || dddNum > 99) {
        return { valid: false, reason: `DDD inválido (${ddd}): ${numero}` };
      }
    }
    return { valid: true };
  }

  // International number - accept any valid length (7 to 15 digits)
  if (cleanNumber.length >= 7 && cleanNumber.length <= 15) {
    return { valid: true, international: true };
  }

  return { valid: false, reason: `Número WhatsApp inválido (${cleanNumber.length} dígitos): ${numero}` };
};

const validateCPFCNPJ = (doc: string): { valid: boolean; reason?: string } => {
  if (!doc || doc.trim() === '') {
    return { valid: false, reason: 'CPF/CNPJ não informado' };
  }
  const cleanDoc = doc.replace(/\D/g, '');
  
  // Check if it's CPF (11 digits) or CNPJ (14 digits)
  if (cleanDoc.length === 11) {
    // Validate CPF
    if (/^(\d)\1{10}$/.test(cleanDoc)) {
      return { valid: false, reason: `CPF inválido (dígitos repetidos): ${doc}` };
    }
    // Validate CPF check digits
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanDoc.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanDoc.charAt(9))) {
      return { valid: false, reason: `CPF inválido (dígito verificador): ${doc}` };
    }
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanDoc.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanDoc.charAt(10))) {
      return { valid: false, reason: `CPF inválido (dígito verificador): ${doc}` };
    }
    return { valid: true };
  } else if (cleanDoc.length === 14) {
    // Validate CNPJ
    if (/^(\d)\1{13}$/.test(cleanDoc)) {
      return { valid: false, reason: `CNPJ inválido (dígitos repetidos): ${doc}` };
    }
    // Validate CNPJ check digits
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cleanDoc.charAt(i)) * weights1[i];
    }
    let remainder = sum % 11;
    let digit1 = remainder < 2 ? 0 : 11 - remainder;
    if (digit1 !== parseInt(cleanDoc.charAt(12))) {
      return { valid: false, reason: `CNPJ inválido (dígito verificador): ${doc}` };
    }
    
    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cleanDoc.charAt(i)) * weights2[i];
    }
    remainder = sum % 11;
    let digit2 = remainder < 2 ? 0 : 11 - remainder;
    if (digit2 !== parseInt(cleanDoc.charAt(13))) {
      return { valid: false, reason: `CNPJ inválido (dígito verificador): ${doc}` };
    }
    return { valid: true };
  } else {
    return { valid: false, reason: `CPF/CNPJ inválido (${cleanDoc.length} dígitos, esperado 11 ou 14): ${doc}` };
  }
};

const formatMessage = (template: string, cliente: Cliente, paymentData?: PaymentData): string => {
  // Format value based on client currency
  const currencySymbol = cliente.moeda === 'USD' ? '$' : 'R$';
  const formattedValue = `${currencySymbol} ${cliente.valor.toFixed(2)}`;
  
  let message = template
    .replace(/{nome}/g, cliente.nome)
    .replace(/{produto}/g, cliente.produto)
    .replace(/{plano}/g, cliente.plano || 'N/A')
    .replace(/{valor}/g, formattedValue)
    .replace(/{data_renovacao}/g, new Date(cliente.data_renovacao).toLocaleDateString('pt-BR'));

  if (paymentData) {
    message = message
      .replace(/{link_pagamento}/g, paymentData.linkPagamento || '')
      .replace(/{boleto_url}/g, paymentData.boletoUrl || '')
      .replace(/{valor_cartao}/g, paymentData.valorCartao || '')
      .replace(/{valor_boleto}/g, paymentData.valorBoleto || '')
      .replace(/{chave_pix}/g, paymentData.pixChave || '')
      .replace(/{nome_beneficiario}/g, paymentData.pixNome || '')
      .replace(/{banco_pix}/g, paymentData.pixBanco || '');
  }

  return message;
};

const generatePaymentLink = async (
  cliente: Cliente,
  config: BillingConfig
): Promise<{ url: string | null; created: boolean; error?: string; preferenceId?: string }> => {
  // Prioridade: token configurado no painel (billing_config) -> segredo do backend
  let accessToken = config.mp_access_token || Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  
  if (!accessToken) {
    console.log("⚠️ Mercado Pago access token not configured");
    return { url: null, created: false, error: "Token não configurado" };
  }
  
  // Remove "Bearer " prefix if already included in token
  if (accessToken.startsWith('Bearer ')) {
    accessToken = accessToken.replace('Bearer ', '');
  }

  // If fixed link is configured, use it
  if (config.mp_link_fixo) {
    console.log(`✅ Usando link fixo configurado: ${config.mp_link_fixo}`);
    return { url: config.mp_link_fixo, created: false };
  }

  if (config.mp_link_enabled !== 'true') {
    console.log("⚠️ Link de pagamento desabilitado nas configurações");
    return { url: null, created: false, error: "Link desabilitado" };
  }

  try {
    const taxaCartao = parseFloat(config.mp_taxa_cartao || '4.99') / 100;
    const valorComTaxa = cliente.valor / (1 - taxaCartao);

    // Datas de expiração - disponível IMEDIATAMENTE
    // Subtrair 1 minuto para garantir que já esteja disponível
    const nowUTC = new Date();
    const startDate = new Date(nowUTC.getTime() - 60000); // 1 minuto atrás para garantir disponibilidade imediata
    const expiresAt = new Date(nowUTC.getTime() + 24 * 60 * 60 * 1000); // 24 horas
    
    // Formato ISO 8601 com offset de Brasília (-03:00)
    // O servidor está em UTC, então precisamos ajustar para BRT
    const formatDateBR = (date: Date) => {
      // Converter UTC para horário de Brasília (UTC-3)
      const brDate = new Date(date.getTime() - (3 * 60 * 60 * 1000));
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${brDate.getUTCFullYear()}-${pad(brDate.getUTCMonth() + 1)}-${pad(brDate.getUTCDate())}T${pad(brDate.getUTCHours())}:${pad(brDate.getUTCMinutes())}:${pad(brDate.getUTCSeconds())}.000-03:00`;
    };
    
    // Excluded methods based on settings
    const excludedMethods = [];
    if (config.mp_immediate_payment === 'true') {
      excludedMethods.push({ id: "ticket" }); // ticket = boleto
      excludedMethods.push({ id: "atm" });
    } else {
      if (config.mp_allow_boleto === 'false') excludedMethods.push({ id: "ticket" });
    }
    
    const excludedTypes = [];
    if (config.mp_allow_credit_card === 'false') excludedTypes.push({ id: "credit_card" }, { id: "debit_card" });
    if (config.mp_allow_pix === 'false') excludedMethods.push({ id: "pix" });

    // Payload EXATO conforme n8n - SEM payer
    const preferenceBody: any = {
      items: [{
        title: cliente.produto,
        quantity: 1,
        unit_price: parseFloat(valorComTaxa.toFixed(2)),
      }],
      expires: true,
      expiration_date_from: formatDateBR(startDate),
      expiration_date_to: formatDateBR(expiresAt),
      statement_descriptor: config.mp_statement_descriptor || undefined,
      payment_methods: {
        excluded_payment_methods: excludedMethods,
        excluded_payment_types: excludedTypes,
        installments: 12,
      },
      metadata: {
        cliente_id: cliente.id,
        source: 'billing-cron'
      }
    };

    if (config.mp_success_url) {
      preferenceBody.back_urls = {
        success: config.mp_success_url,
        pending: config.mp_success_url,
        failure: config.mp_success_url,
      };
      preferenceBody.auto_return = "approved";
    }

    console.log(`🔗 LINK DE PAGAMENTO - Cliente ID: ${cliente.id}`);
    console.log(`   Valor original: R$ ${cliente.valor.toFixed(2)}`);
    console.log(`   Valor com taxa (${(taxaCartao * 100).toFixed(2)}%): R$ ${valorComTaxa.toFixed(2)}`);
    console.log(`   Endpoint: POST https://api.mercadopago.com/checkout/preferences`);

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferenceBody),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(`❌ ERRO Mercado Pago Link (${response.status}):`, responseText);
      return { url: null, created: false, error: `HTTP ${response.status}: ${responseText}` };
    }

    const data = JSON.parse(responseText);
    console.log(`✅ LINK CRIADO COM SUCESSO!`);
    console.log(`   ID da Preference: ${data.id}`);
    console.log(`   URL: ${data.init_point}`);
    return { url: data.init_point, created: true, preferenceId: data.id };
  } catch (error: any) {
    console.error('❌ Erro ao gerar link de pagamento:', error);
    return { url: null, created: false, error: error?.message };
  }
};

// Generate Stripe payment link for USD clients
const generateStripePaymentLink = async (
  cliente: Cliente,
  stripeConfig: StripeConfig
): Promise<StripePaymentResult> => {
  const baseAmount = cliente.valor;
  const taxPercent = (stripeConfig.stripe_tax_percent || 0) / 100;
  const finalAmount = taxPercent > 0 ? baseAmount / (1 - taxPercent) : baseAmount;
  
  if (!stripeConfig.stripe_secret_key) {
    return {
      success: false,
      paymentLink: null,
      paymentId: null,
      finalAmount: baseAmount,
      error: 'Stripe secret key not configured',
    };
  }

  try {
    const amountInCents = Math.round(finalAmount * 100);
    
    // Create a product
    const productResponse = await fetch('https://api.stripe.com/v1/products', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeConfig.stripe_secret_key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        name: `${cliente.produto}${cliente.plano ? ` - ${cliente.plano}` : ''}`,
      }).toString(),
    });

    if (!productResponse.ok) {
      const errorText = await productResponse.text();
      console.error('Stripe product creation error:', errorText);
      return {
        success: false,
        paymentLink: null,
        paymentId: null,
        finalAmount,
        error: `Failed to create Stripe product: ${errorText}`,
      };
    }

    const product = await productResponse.json();
    console.log(`✅ Stripe product created: ${product.id}`);

    // Create a price for the product
    const priceResponse = await fetch('https://api.stripe.com/v1/prices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeConfig.stripe_secret_key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        product: product.id,
        unit_amount: amountInCents.toString(),
        currency: 'usd',
      }).toString(),
    });

    if (!priceResponse.ok) {
      const errorText = await priceResponse.text();
      console.error('Stripe price creation error:', errorText);
      return {
        success: false,
        paymentLink: null,
        paymentId: null,
        finalAmount,
        error: `Failed to create Stripe price: ${errorText}`,
      };
    }

    const price = await priceResponse.json();
    console.log(`✅ Stripe price created: ${price.id}`);

    // Create a payment link
    const paymentLinkResponse = await fetch('https://api.stripe.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeConfig.stripe_secret_key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'line_items[0][price]': price.id,
        'line_items[0][quantity]': '1',
        'metadata[cliente_id]': cliente.id,
        'metadata[cliente_nome]': cliente.nome,
        'metadata[produto]': cliente.produto,
      }).toString(),
    });

    if (!paymentLinkResponse.ok) {
      const errorText = await paymentLinkResponse.text();
      console.error('Stripe payment link creation error:', errorText);
      return {
        success: false,
        paymentLink: null,
        paymentId: null,
        finalAmount,
        error: `Failed to create Stripe payment link: ${errorText}`,
      };
    }

    const paymentLink = await paymentLinkResponse.json();
    console.log(`✅ Stripe payment link created: ${paymentLink.url}`);

    return {
      success: true,
      paymentLink: paymentLink.url,
      paymentId: paymentLink.id,
      finalAmount,
    };
  } catch (error: any) {
    console.error('Stripe API error:', error);
    return {
      success: false,
      paymentLink: null,
      paymentId: null,
      finalAmount: baseAmount,
      error: error?.message || 'Unknown error',
    };
  }
}

const generateBoleto = async (
  cliente: Cliente,
  config: BillingConfig
): Promise<{ url: string | null; created: boolean; error?: string; paymentId?: string }> => {
  // Prioridade: token configurado no painel (billing_config) -> segredo do backend
  let accessToken = config.mp_access_token || Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  
  if (!accessToken) {
    console.log("⚠️ Mercado Pago access token not configured para boleto");
    return { url: null, created: false, error: "Token não configurado" };
  }
  
  // Remove "Bearer " prefix if already included in token
  if (accessToken.startsWith('Bearer ')) {
    accessToken = accessToken.replace('Bearer ', '');
  }

  if (config.mp_boleto_enabled !== 'true') {
    console.log("⚠️ Boleto desabilitado nas configurações");
    return { url: null, created: false, error: "Boleto desabilitado" };
  }

  // BOLETO REQUER: CPF + Email válidos
  if (!cliente.cpf) {
    console.log(`⚠️ Cliente ${cliente.nome} sem CPF - BOLETO NÃO PODE SER CRIADO`);
    return { url: null, created: false, error: "CPF não informado" };
  }

  if (!cliente.email) {
    console.log(`⚠️ Cliente ${cliente.nome} sem Email - BOLETO NÃO PODE SER CRIADO`);
    return { url: null, created: false, error: "Email não informado" };
  }

  const taxaBoleto = parseFloat(config.mp_taxa_boleto || '1.99');
  const valorBoleto = cliente.valor + taxaBoleto;

  // Mercado Pago minimum for boleto is R$ 2.01
  if (valorBoleto < 2.01) {
    console.log(`⚠️ Valor R$ ${valorBoleto.toFixed(2)} abaixo do mínimo R$ 2.01 - BOLETO NÃO PODE SER CRIADO`);
    return { url: null, created: false, error: `Valor abaixo do mínimo (R$ ${valorBoleto.toFixed(2)} < R$ 2.01)` };
  }

  try {
    const cleanCpf = cliente.cpf.replace(/\D/g, '');
    const isCNPJ = cleanCpf.length === 14;
    
    // Separar nome em first_name e last_name
    const nameParts = cliente.nome.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;
    
    // Payload EXATO conforme especificação do n8n
    const paymentBody = {
      transaction_amount: parseFloat(valorBoleto.toFixed(2)),
      description: cliente.produto,
      payment_method_id: 'bolbradesco',
      payer: {
        email: cliente.email,
        first_name: firstName,
        last_name: lastName,
        identification: {
          type: isCNPJ ? 'CNPJ' : 'CPF',
          number: cleanCpf,
        },
        address: {
          zip_code: '60862083',
          street_name: 'Rua Tres Corações',
          street_number: '181',
          neighborhood: 'Passare',
          city: 'Fortaleza',
          federal_unit: 'CE',
        },
      },
    };
    
    console.log(`🧾 BOLETO - Cliente ID: ${cliente.id}`);
    console.log(`   Valor original: R$ ${cliente.valor.toFixed(2)}`);
    console.log(`   Valor com taxa: R$ ${valorBoleto.toFixed(2)}`);
    console.log(`   Tipo documento: ${isCNPJ ? 'CNPJ' : 'CPF'}`);
    console.log(`   Endpoint: POST https://api.mercadopago.com/v1/payments`);
    
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentBody),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(`❌ ERRO Mercado Pago Boleto (${response.status}):`, responseText);
      return { url: null, created: false, error: `HTTP ${response.status}: ${responseText}` };
    }

    const data = JSON.parse(responseText);
    const boletoUrl = data.transaction_details?.external_resource_url;
    
    console.log(`✅ BOLETO CRIADO COM SUCESSO!`);
    console.log(`   Payment ID: ${data.id}`);
    console.log(`   Status: ${data.status}`);
    console.log(`   URL: ${boletoUrl}`);
    
    return { url: boletoUrl, created: true, paymentId: data.id?.toString() };
  } catch (error: any) {
    console.error('❌ Erro ao gerar boleto:', error);
    return { url: null, created: false, error: error?.message };
  }
};

const generateAIMessage = async (
  cliente: Cliente,
  messageType: string,
  config: BillingConfig,
  paymentData?: PaymentData
): Promise<string> => {
  const provider = config.ai_provider;
  
  if (provider === 'none' || !provider) {
    return '';
  }

  const contextPrompt = config.ai_prompt_context || 'Você é um assistente de cobrança profissional.';
  
  const typeDescriptions: Record<string, string> = {
    'd_menos_3': '3 dias antes do vencimento (lembrete amigável)',
    'd_zero': 'dia do vencimento',
    'd_mais_1': '1 dia após o vencimento (primeiro aviso)',
    'd_mais_2': '2 dias após o vencimento (segundo aviso)',
    'd_mais_15': '15 dias após o vencimento (aviso de pendência)',
    'd_mais_30': '30 dias após o vencimento (aviso final antes do cancelamento)',
  };
  const clientCurrency = cliente.moeda || 'BRL';
  const currencySymbol = clientCurrency === 'USD' ? '$' : 'R$';

  let paymentInfo = '';
  if (paymentData) {
    if (paymentData.pixChave && clientCurrency === 'BRL') {
      paymentInfo += `\nPIX disponível - Chave: ${paymentData.pixChave} (${paymentData.pixNome})`;
    }
    if (paymentData.linkPagamento && clientCurrency === 'BRL') {
      paymentInfo += `\nLink de pagamento por cartão: ${paymentData.linkPagamento} (valor com taxa: R$ ${paymentData.valorCartao})`;
    }
    if (paymentData.boletoUrl && clientCurrency === 'BRL') {
      paymentInfo += `\nBoleto disponível (valor com taxa: R$ ${paymentData.valorBoleto})`;
    }
    if (paymentData.stripePaymentLink && clientCurrency === 'USD') {
      paymentInfo += `\nStripe payment link: ${paymentData.stripePaymentLink} (amount: $ ${paymentData.valorStripe})`;
    }
  }

  const clientCurrencySymbol = cliente.moeda === 'USD' ? '$' : 'R$';
  const clientCurrencyValue = `${clientCurrencySymbol} ${cliente.valor.toFixed(2)}`;

  const prompt = `${contextPrompt}

Cliente: ${cliente.nome}
Produto: ${cliente.produto}
Plano: ${cliente.plano || 'N/A'}
Valor: ${clientCurrencyValue}
Data de Renovação: ${new Date(cliente.data_renovacao).toLocaleDateString('pt-BR')}
Tipo de mensagem: ${typeDescriptions[messageType] || messageType}
${paymentInfo}

Gere uma mensagem de cobrança personalizada, educada e profissional. A mensagem deve ser curta (máximo 3 parágrafos) e adequada para envio por WhatsApp. Inclua as informações de pagamento disponíveis.`;

  try {
    let apiUrl: string;
    let apiKey: string;
    let model: string;
    let headers: Record<string, string>;

    if (provider === 'openai') {
      apiKey = config.openai_api_key;
      if (!apiKey) return '';
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      model = config.ai_model || 'gpt-4o-mini';
      headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
    } else if (provider === 'groq') {
      apiKey = config.groq_api_key;
      if (!apiKey) return '';
      apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      model = config.ai_model || 'llama-3.1-70b-versatile';
      headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
    } else {
      return '';
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', await response.text());
      return '';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('AI generation error:', error);
    return '';
  }
};

const sendEmail = async (
  to: string,
  subject: string,
  body: string,
  gmailUser: string,
  gmailPassword: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const emailBody = body;

    // Use SMTP with Gmail App Password
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailPassword,
        },
      },
    });

    await client.send({
      from: gmailUser,
      to: to,
      subject: subject,
      content: emailBody,
    });

    await client.close();
    console.log(`Email sent successfully to [EMAIL]`);
    return { success: true };
  } catch (error: any) {
    console.error('Email send error:', error);
    return { success: false, error: error?.message || 'Erro ao enviar email' };
  }
};

const sendWhatsAppOfficial = async (
  numero: string,
  templateName: string,
  languageCode: string,
  components: any[],
  credentials: { access_token: string; phone_number_id: string }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const cleanNumber = numero.replace(/\D/g, '');
    // Só prefixa 55 (Brasil) quando o número está em formato BR local (10 ou 11 dígitos).
    // Números internacionais (12+ dígitos com DDI próprio) são enviados como estão.
    const formattedNumber = (cleanNumber.length === 10 || cleanNumber.length === 11)
      ? `55${cleanNumber}`
      : cleanNumber;

    const response = await fetch(`https://graph.facebook.com/v21.0/${credentials.phone_number_id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: formattedNumber,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: languageCode || 'pt_BR'
          },
          components: components
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Meta API error: ${errorText}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error('WhatsApp Official send error:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
};

const sendWhatsApp = async (
  numero: string,
  message: string,
  instance: WhatsAppInstance
): Promise<{ success: boolean; error?: string }> => {
  try {
    const cleanNumber = numero.replace(/\D/g, '');
    // Só prefixa 55 (Brasil) quando o número está em formato BR local (10 ou 11 dígitos).
    // Números internacionais (12+ dígitos com DDI próprio) são enviados como estão.
    const formattedNumber = (cleanNumber.length === 10 || cleanNumber.length === 11)
      ? `55${cleanNumber}`
      : cleanNumber;

    const response = await fetch(`${instance.api_url}/message/sendText/${instance.instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': instance.api_key,
      },
      body: JSON.stringify({
        number: formattedNumber,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WhatsApp API error: ${errorText}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error('WhatsApp send error:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
};

// SECURITY: Sanitize PII from error messages to prevent data leakage
const sanitizePII = (text: string): string => {
  return text
    // Redact emails
    .replace(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
    // Redact CPF patterns (XXX.XXX.XXX-XX or 11 digits)
    .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '[CPF]')
    .replace(/\b\d{11}\b/g, '[CPF]')
    // Redact phone patterns (10-11 digits)
    .replace(/\b\d{10,11}\b/g, '[PHONE]')
    // Redact potential names (First Last pattern) - be conservative
    .replace(/\b[A-Z][a-záàâãéèêíïóôõúç]+ [A-Z][a-záàâãéèêíïóôõúç]+\b/g, '[NOME]');
};

const sendErrorNotification = async (
  errorCount: number,
  errorDetails: { cliente: string; channel: string; error: string }[],
  gmailUser: string,
  gmailPassword: string,
  notificationEmail: string
): Promise<void> => {
  if (!notificationEmail || !gmailUser || !gmailPassword || errorCount === 0) return;
  
  try {
    // SECURITY: Sanitize customer names and errors to prevent PII leakage
    const errorList = errorDetails
      .slice(0, 10)
      .map((e, idx) => `• Cliente #${idx + 1} (${e.channel}): ${sanitizePII(e.error)}`)
      .join('\n');
    
    const body = `⚠️ ALERTA: ${errorCount} erro(s) detectado(s) no sistema de cobrança

Data/Hora: ${new Date().toLocaleString('pt-BR')}

Erros encontrados:
${errorList}
${errorCount > 10 ? `\n... e mais ${errorCount - 10} erro(s)` : ''}

Acesse o painel administrativo para mais detalhes.`;

    const emailContent = `From: ${gmailUser}\r\nTo: ${notificationEmail}\r\nSubject: [ALERTA] Erros no Sistema de Cobrança\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`;
    const base64Email = btoa(unescape(encodeURIComponent(emailContent)));

    await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gmailPassword}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64Email.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }),
    });

    console.log(`Error notification sent to ${notificationEmail}`);
  } catch (error) {
    console.error('Failed to send error notification:', error);
  }
};

const buildPaymentMessage = (config: BillingConfig, paymentData: PaymentData, cliente: Cliente): string => {
  const taxaCartao = parseFloat(config.mp_taxa_cartao || '4.99') / 100;
  const taxaBoleto = parseFloat(config.mp_taxa_boleto || '1.99');
  const clientCurrency = cliente.moeda || 'BRL';
  
  let parts: string[] = [];
  
  // USD clients - Stripe payment link
  if (clientCurrency === 'USD' && paymentData.stripePaymentLink) {
    parts.push(`*PAYMENT LINK*

CLICK HERE: ${paymentData.stripePaymentLink}

Amount: $ ${paymentData.valorStripe}
\`Note: This is your secure payment link.\``);
  } else {
    // BRL clients - PIX Section
    if (paymentData.pixChave) {
      parts.push(`*PIX*

DADOS CHAVE PIX
NOME: ${paymentData.pixNome}
${paymentData.pixBanco ? `Banco: ${paymentData.pixBanco}\n` : ''}
CHAVE PIX: ${paymentData.pixChave}`);
    }
    
    // Card payment link (BRL only)
    if (paymentData.linkPagamento) {
      const valorCartao = (cliente.valor / (1 - taxaCartao)).toFixed(2);
      parts.push(`*CARTÃO DE CRÉDITO*

CLIQUE AQUI: ${paymentData.linkPagamento}

Valor: R$ ${valorCartao}
\`Atenção: pagamentos via cartão estão sujeitos a taxa administrativa.\``);
    }
    
    // Boleto (BRL only)
    if (paymentData.boletoUrl) {
      const valorBoleto = (cliente.valor + taxaBoleto).toFixed(2);
      parts.push(`*BOLETO*

O boleto foi enviado para seu e-mail ou acesse:
${paymentData.boletoUrl}

Valor: R$ ${valorBoleto}
\`Atenção: pagamentos via boleto estão sujeitos a taxa administrativa.\``);
    }
  }
  
  if (parts.length === 0) {
    return '';
  }
  
  return '\n\n*INFORMAÇÕES PARA PAGAMENTO*\n\n' + parts.join('\n\n');
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Authenticate request using CRON_SECRET from environment variable ONLY
  // SECURITY: Database storage was removed to prevent plaintext secret exposure
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  
  if (!cronSecret) {
    console.error("CRON_SECRET not configured in environment variables");
    return new Response(
      JSON.stringify({ error: "CRON_SECRET not configured", hint: "Configure CRON_SECRET nas variáveis de ambiente do projeto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  const isValidAuth = authHeader === `Bearer ${cronSecret}`;
  
  if (!isValidAuth) {
    console.error("Unauthorized billing-cron request - invalid or missing secret");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    let requestBody: RequestBody = {};
    try {
      const bodyText = await req.text();
      if (bodyText) {
        requestBody = JSON.parse(bodyText);
      }
    } catch {
      // Empty body is fine for automatic billing
    }

    const isManualBilling = requestBody.clienteIds && requestBody.clienteIds.length > 0;
    console.log(`Billing mode: ${isManualBilling ? 'Manual' : 'Automatic'}`);

    // Get billing configuration
    const { data: configData, error: configError } = await supabase
      .from('billing_config')
      .select('config_key, config_value');

    if (configError) throw configError;

    const config: BillingConfig = {};
    configData?.forEach((item: { config_key: string; config_value: string }) => {
      config[item.config_key] = item.config_value;
    });

    // Check if billing is enabled (skip for manual billing)
    if (!isManualBilling && config.billing_enabled !== 'true') {
      console.log('Billing is disabled');
      return new Response(JSON.stringify({ message: 'Billing is disabled' }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get active billing WhatsApp instances
    const { data: whatsappInstances } = await supabase
      .from('billing_whatsapp_instances')
      .select('*')
      .eq('is_active', true);

    // Get Meta credentials for Official API
    const { data: metaCreds } = await supabase
      .from('meta_credentials')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    // Get Stripe config for USD clients
    const { data: stripeConfigData } = await supabase
      .from('billing_stripe_config')
      .select('*')
      .limit(1)
      .single();

    const stripeConfig: StripeConfig = stripeConfigData ? {
      stripe_secret_key: stripeConfigData.stripe_secret_key || '',
      stripe_tax_percent: stripeConfigData.stripe_tax_percent || 0,
      stripe_enabled: stripeConfigData.stripe_enabled || false,
    } : {
      stripe_secret_key: '',
      stripe_tax_percent: 0,
      stripe_enabled: false,
    };

    let totalSent = 0;
    let totalErrors = 0;
    let whatsappInstanceIndex = 0;
    const errorDetails: { cliente: string; channel: string; error: string }[] = [];

    const processClient = async (cliente: Cliente, messageType: string, template: string) => {
      // Validate client data first
      const emailValidation = validateEmail(cliente.email);
      const whatsappValidation = validateWhatsAppNumber(cliente.numero);
      const cpfValidation = validateCPFCNPJ(cliente.cpf);
      
      // Generate payment data for D0 (vencimento) messages
      let paymentData: PaymentData = {};
      const paymentSkipReasons: string[] = [];
      
      // Always include PIX if configured
      if (config.pix_chave) {
        paymentData.pixChave = config.pix_chave;
        paymentData.pixNome = config.pix_nome_beneficiario || '';
        paymentData.pixBanco = config.pix_banco || '';
      } else {
        paymentSkipReasons.push('PIX: Chave PIX não configurada');
      }
      
      // Generate payment link and boleto for D0 and later
      if (['d_zero', 'd_mais_1', 'd_mais_2', 'd_mais_15', 'd_mais_30'].includes(messageType)) {
        const clientCurrency = cliente.moeda || 'BRL';
        const billingDate = cliente.data_renovacao;
        
        // USD clients use Stripe, BRL clients use Mercado Pago
        if (clientCurrency === 'USD') {
          console.log(`💵 Cliente ${cliente.nome} é USD - usando Stripe`);
          
          if (!stripeConfig.stripe_enabled) {
            paymentSkipReasons.push('Stripe: Não habilitado para cobranças USD');
          } else if (!stripeConfig.stripe_secret_key) {
            paymentSkipReasons.push('Stripe: Secret key não configurada');
          } else {
            const stripeResult = await generateStripePaymentLink(cliente, stripeConfig);
            
            if (stripeResult.success && stripeResult.paymentLink) {
              paymentData.stripePaymentLink = stripeResult.paymentLink;
              paymentData.valorStripe = stripeResult.finalAmount.toFixed(2);
              
              // Register Stripe payment
              await supabase.from('client_payments').insert({
                cliente_id: cliente.id,
                payment_id: stripeResult.paymentId || `stripe_${cliente.id}_${Date.now()}`,
                payment_type: 'stripe_link',
                amount: stripeResult.finalAmount,
                status: 'pending',
                billing_date: billingDate,
              });
              console.log(`✅ Stripe link criado para ${cliente.nome}: ${stripeResult.paymentLink}`);
            } else {
              paymentSkipReasons.push(`Stripe: ${stripeResult.error || 'Erro desconhecido'}`);
            }
          }
        } else {
          // BRL clients use Mercado Pago (original logic)
          console.log(`💰 Cliente ${cliente.nome} é BRL - usando Mercado Pago`);
          const accessToken = config.mp_access_token || Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
          
          if (!accessToken) {
            paymentSkipReasons.push('Link Cartão: Token Mercado Pago não configurado');
          } else if (config.mp_link_enabled !== 'true' && !config.mp_link_fixo) {
            paymentSkipReasons.push('Link Cartão: Geração de link desabilitada');
          }
          
          // Check boleto with CPF validation
          if (!accessToken) {
            paymentSkipReasons.push('Boleto: Token Mercado Pago não configurado');
          } else if (config.mp_boleto_enabled !== 'true') {
            paymentSkipReasons.push('Boleto: Geração de boleto desabilitada');
          } else if (!cpfValidation.valid) {
            paymentSkipReasons.push(`Boleto: ${cpfValidation.reason}`);
          } else {
            const taxaBoleto = parseFloat(config.mp_taxa_boleto || '1.99');
            const valorBoleto = cliente.valor + taxaBoleto;
            if (valorBoleto < 2.01) {
              paymentSkipReasons.push(`Boleto: Valor R$ ${valorBoleto.toFixed(2)} abaixo do mínimo R$ 2.01`);
            }
          }
          
          // Only generate payment link and boleto if validations pass
          const [linkResult, boletoResult] = await Promise.all([
            generatePaymentLink(cliente, config),
            cpfValidation.valid && emailValidation.valid ? generateBoleto(cliente, config) : Promise.resolve({ url: null, created: false, error: "CPF ou Email inválido", paymentId: null }),
          ]);
        
          // Register PIX payment if configured (BRL only)
          if (config.pix_chave) {
            await supabase.from('client_payments').insert({
              cliente_id: cliente.id,
              payment_id: `pix_${cliente.id}_${Date.now()}`,
              payment_type: 'pix',
              amount: cliente.valor,
              status: 'pending',
              billing_date: billingDate,
            });
            console.log(`📊 PIX registrado para ${cliente.nome}`);
          }
          
          // Log do resultado do link
          if (linkResult.created) {
            console.log(`📊 Link criado no MP para ${cliente.nome}`);
            await supabase.from('client_payments').insert({
              cliente_id: cliente.id,
              payment_id: `link_${cliente.id}_${Date.now()}`,
              preference_id: linkResult.preferenceId || null,
              payment_type: 'link_cartao',
              amount: parseFloat((cliente.valor / (1 - parseFloat(config.mp_taxa_cartao || '4.99') / 100)).toFixed(2)),
              status: 'pending',
              billing_date: billingDate,
            });
          } else if (linkResult.error) {
            paymentSkipReasons.push(`Link: ${linkResult.error}`);
          }
          
          if (linkResult.url) {
            paymentData.linkPagamento = linkResult.url;
            const taxaCartao = parseFloat(config.mp_taxa_cartao || '4.99') / 100;
            paymentData.valorCartao = (cliente.valor / (1 - taxaCartao)).toFixed(2);
          }
          
          // Log do resultado do boleto
          if (boletoResult.created) {
            console.log(`📊 Boleto criado no MP para ${cliente.nome}`);
            const taxaBoleto = parseFloat(config.mp_taxa_boleto || '1.99');
            await supabase.from('client_payments').insert({
              cliente_id: cliente.id,
              payment_id: boletoResult.paymentId || `boleto_${cliente.id}_${Date.now()}`,
              payment_type: 'boleto',
              amount: cliente.valor + taxaBoleto,
              status: 'pending',
              billing_date: billingDate,
            });
          } else if (boletoResult.error) {
            paymentSkipReasons.push(`Boleto: ${boletoResult.error}`);
          }
          
          if (boletoResult.url) {
            paymentData.boletoUrl = boletoResult.url;
            const taxaBoleto = parseFloat(config.mp_taxa_boleto || '1.99');
            paymentData.valorBoleto = (cliente.valor + taxaBoleto).toFixed(2);
          }
        } // End of BRL block
      } // End of D0+ payment generation block
      
      // Try AI-generated message first, fallback to template
      let message = await generateAIMessage(cliente, messageType, config, paymentData);
      if (!message) {
        message = formatMessage(template, cliente, paymentData);
        
        // Append payment information if we have any
        const paymentSection = buildPaymentMessage(config, paymentData, cliente);
        if (paymentSection) {
          message += paymentSection;
        }
      }
      
      const subject = `Cobrança - ${cliente.produto}`;
      
      // Build complete log notes
      const logNotes: string[] = [];
      if (paymentSkipReasons.length > 0) {
        logNotes.push(`Pagamentos: ${paymentSkipReasons.join('; ')}`);
      }

      // Send Email if enabled
      const canSendEmail = config.email_enabled === 'true' && 
                           config.billing_gmail_user && 
                           config.billing_gmail_password;
      
      if (canSendEmail) {
        if (!emailValidation.valid) {
          // Log email skip due to invalid email
          await supabase.from('billing_logs').insert({
            cliente_id: cliente.id,
            cliente_nome: cliente.nome,
            cliente_email: cliente.email,
            cliente_numero: cliente.numero,
            cliente_produto: cliente.produto,
            cliente_observacoes: (cliente as any).observacao || '',
            message_type: messageType,
            channel: 'email',
            status: 'skipped',
            error_message: `Email não enviado: ${emailValidation.reason}${logNotes.length > 0 ? '; ' + logNotes.join('; ') : ''}`,
          });
          console.log(`Skipping email for ${cliente.nome}: ${emailValidation.reason}`);
        } else {
          const emailResult = await sendEmail(
            cliente.email,
            subject,
            message,
            config.billing_gmail_user,
            config.billing_gmail_password
          );

          // Include payment skip reasons in error_message if any
          const logError = emailResult.error || (logNotes.length > 0 ? logNotes.join('; ') : null);

          await supabase.from('billing_logs').insert({
            cliente_id: cliente.id,
            cliente_nome: cliente.nome,
            cliente_email: cliente.email,
            cliente_numero: cliente.numero,
            cliente_produto: cliente.produto,
            cliente_observacoes: (cliente as any).observacao || '',
            message_type: messageType,
            channel: 'email',
            status: emailResult.success ? 'sent' : 'error',
            error_message: logError,
            message_body: message,
          });

          if (emailResult.success) {
            totalSent++;
          } else {
            totalErrors++;
            errorDetails.push({ cliente: cliente.nome, channel: 'email', error: emailResult.error || 'Erro desconhecido' });
          }
        }
      }

      // Send WhatsApp if enabled
      const isOfficial = config.whatsapp_provider === 'official';
      const canSendWhatsApp = config.whatsapp_enabled === 'true' && 
                              (isOfficial ? !!metaCreds : (whatsappInstances && whatsappInstances.length > 0));
      
      if (canSendWhatsApp) {
        if (!whatsappValidation.valid) {
          // Log WhatsApp skip due to invalid number
          await supabase.from('billing_logs').insert({
            cliente_id: cliente.id,
            cliente_nome: cliente.nome,
            cliente_email: cliente.email,
            cliente_numero: cliente.numero,
            cliente_produto: cliente.produto,
            cliente_observacoes: (cliente as any).observacao || '',
            message_type: messageType,
            channel: 'whatsapp',
            status: 'skipped',
            error_message: `WhatsApp não enviado: ${whatsappValidation.reason}${logNotes.length > 0 ? '; ' + logNotes.join('; ') : ''}`,
          });
          console.log(`Skipping WhatsApp for ${cliente.nome}: ${whatsappValidation.reason}`);
        } else {
          let whatsappResult: { success: boolean; error?: string };
          let providerUsed = 'evolution';

          if (isOfficial) {
            providerUsed = 'official';
            // Dynamic variable mapping
            const getFieldValue = (field: string) => {
              const currencySymbol = cliente.moeda === 'USD' ? '$' : 'R$';
              const formattedValue = `${currencySymbol} ${cliente.valor.toFixed(2)}`;
              const paymentLink = paymentData.stripePaymentLink || paymentData.linkPagamento || paymentData.boletoUrl || paymentData.pixChave || '';
              const dueDate = new Date(cliente.data_renovacao).toLocaleDateString('pt-BR');

              switch (field) {
                case 'nome': return cliente.nome || '';
                case 'valor': return formattedValue;
                case 'data_renovacao': return dueDate;
                case 'link_pagamento': return paymentLink;
                case 'produto': return cliente.produto || '';
                case 'plano': return cliente.plano || 'N/A';
                case 'cpf': return cliente.cpf || '';
                case 'email': return cliente.email || '';
                case 'whatsapp_support': return config.whatsapp_support_link || '';
                case 'custom_link_1': return config.custom_link_1 || '';
                case 'none': return '';
                default: return '';
              }
            };

            const components: any[] = [];
            const bodyParams: any[] = [];
            const headerParams: any[] = [];
            const button1Params: any[] = [];
            const button2Params: any[] = [];

            [1, 2, 3, 4, 5, 6, 7, 8].forEach(num => {
              const field = config[`meta_var_${num}_field`];
              const target = config[`meta_var_${num}_target`] || 'body';
              if (!field || field === 'none') return;

              const val = getFieldValue(field);
              const param = { type: "text", text: val };

              if (target === 'body') bodyParams.push(param);
              else if (target === 'header') headerParams.push(param);
              else if (target === 'button_1') button1Params.push(param);
              else if (target === 'button_2') button2Params.push(param);
            });

            if (headerParams.length > 0) components.push({ type: "header", parameters: headerParams });
            if (bodyParams.length > 0) components.push({ type: "body", parameters: bodyParams });
            if (button1Params.length > 0) components.push({ type: "button", sub_type: "url", index: "0", parameters: button1Params });
            if (button2Params.length > 0) components.push({ type: "button", sub_type: "url", index: "1", parameters: button2Params });

            // Get credentials from config (module specific) or fallback to global meta_credentials
            const accessToken = config.meta_access_token || (metaCreds?.access_token);
            const phoneNumberId = config.meta_phone_number_id || (metaCreds?.phone_number_id);

            // Get template name from config
            const templateName = config[`template_${messageType}`];
            
            if (!accessToken || !phoneNumberId) {
              whatsappResult = { success: false, error: "Credenciais da Meta não configuradas." };
            } else if (!templateName) {
              whatsappResult = { success: false, error: `Template Meta não configurado para ${messageType}` };
            } else {
              whatsappResult = await sendWhatsAppOfficial(
                cliente.numero,
                templateName,
                'pt_BR',
                components,
                { access_token: accessToken, phone_number_id: phoneNumberId }
              );
            }
          } else {
            // Select instance - random if enabled, otherwise round-robin
            let instance;
            if (config.whatsapp_random_rotation === 'true') {
              const randomIndex = Math.floor(Math.random() * whatsappInstances.length);
              instance = whatsappInstances[randomIndex];
              console.log(`Using random WhatsApp instance: ${instance.instance_name} (index ${randomIndex})`);
            } else {
              instance = whatsappInstances[whatsappInstanceIndex % whatsappInstances.length];
              whatsappInstanceIndex++;
            }
            
            // Apply delay if configured
            const delaySeconds = parseInt(config.whatsapp_delay || '0', 10);
            if (delaySeconds > 0 && whatsappInstanceIndex > 1) {
              console.log(`Waiting ${delaySeconds} seconds before sending WhatsApp...`);
              await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
            }

            whatsappResult = await sendWhatsApp(cliente.numero, message, instance);
            
            if (whatsappResult.success && instance) {
              await supabase
                .from('billing_whatsapp_instances')
                .update({ last_used_at: new Date().toISOString() })
                .eq('id', instance.id);
            }
          }
          
          // Include payment skip reasons and provider in error_message if any
          const logError = whatsappResult.error || (logNotes.length > 0 ? logNotes.join('; ') : null);
          const providerInfo = `[Provider: ${providerUsed}]`;

          await supabase.from('billing_logs').insert({
            cliente_id: cliente.id,
            cliente_nome: cliente.nome,
            cliente_email: cliente.email,
            cliente_numero: cliente.numero,
            cliente_produto: cliente.produto,
            cliente_observacoes: (cliente as any).observacao || '',
            message_type: messageType,
            channel: 'whatsapp',
            status: whatsappResult.success ? 'sent' : 'error',
            error_message: logError ? `${providerInfo} ${logError}` : providerInfo,
            message_body: message,
          });

          if (whatsappResult.success) {
            totalSent++;
          } else {
            totalErrors++;
            errorDetails.push({ cliente: cliente.nome, channel: 'whatsapp', error: whatsappResult.error || 'Erro desconhecido' });
          }
        }
      }

      // Call Baserow integration for billing events
      try {
        const baserowEvent = `billing.${messageType}`;
        const payload = {
          module: 'billing',
          event: baserowEvent,
          lead_name: cliente.nome,
          lead_phone: cliente.numero,
          lead_date: new Date().toLocaleDateString('pt-BR'),
          lead_produto: cliente.produto,
        };

        console.log(`📦 [billing-cron] sending to Baserow: ${JSON.stringify(payload)}`);
        
        const baserowResp = await fetch(`${supabaseUrl}/functions/v1/baserow-create-lead`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
          },
          body: JSON.stringify(payload),
        });

        const baserowText = await baserowResp.text();
        if (!baserowResp.ok) {
          console.error(`❌ [billing-cron] Baserow HTTP error (${baserowEvent}): ${baserowResp.status} - ${baserowText}`);
        } else {
          console.log(`✅ [billing-cron] Baserow response (${baserowEvent}): ${baserowText}`);
        }
      } catch (baserowErr: any) {
        console.error(`⚠️ [billing-cron] Baserow error (non-blocking): ${baserowErr.message}`);
      }
    };

    if (isManualBilling) {
      const messageType = requestBody.messageType || 'd_zero';
      const templateKey = `message_${messageType}`;
      const template = config[templateKey] || config.message_d_zero;

      console.log(`Manual billing for ${requestBody.clienteIds?.length} clients with type ${messageType}`);

      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('*')
        .in('id', requestBody.clienteIds!);

      if (clientesError) throw clientesError;

      for (const cliente of (clientes as Cliente[]) || []) {
        await processClient(cliente, messageType, template);
      }
    } else {
      // Use Brasília timezone (UTC-3) for date comparison
      const nowUTC = new Date();
      const brasiliaOffset = -3 * 60 * 60 * 1000; // UTC-3
      const brasiliaDate = new Date(nowUTC.getTime() + brasiliaOffset);
      const today = brasiliaDate.toISOString().split('T')[0];
      console.log(`Automatic billing - checking for date: ${today} (Brasília time)`);

      const messageTypes = [
        { type: 'd_menos_3', column: 'data_d_menos_3', template: config.message_d_menos_3 },
        { type: 'd_zero', column: 'data_renovacao', template: config.message_d_zero },
        { type: 'd_mais_1', column: 'data_d_mais_1', template: config.message_d_mais_1 },
        { type: 'd_mais_2', column: 'data_d_mais_2', template: config.message_d_mais_2 },
        { type: 'd_mais_15', column: 'data_d_mais_15', template: config.message_d_mais_15 },
        { type: 'd_mais_30', column: 'data_d_mais_30', template: config.message_d_mais_30 },
      ];

      for (const msgType of messageTypes) {
        const { data: clientes, error: clientesError } = await supabase
          .from('clientes')
          .select('*')
          .eq(msgType.column, today)
          .eq('cobranca_ativa', true);

        if (clientesError) {
          console.error(`Error fetching clients for ${msgType.type}:`, clientesError);
          continue;
        }

        if (!clientes || clientes.length === 0) {
          console.log(`No clients found for ${msgType.type} on ${today}`);
          // Log quando não há clientes para este tipo de mensagem
          await supabase.from('billing_logs').insert({
            cliente_id: null,
            cliente_nome: 'Sistema',
            cliente_email: null,
            cliente_numero: null,
            message_type: msgType.type,
            channel: 'sistema',
            status: 'info',
            error_message: `Nenhum cliente encontrado para ${msgType.type} em ${today}`,
          });
          continue;
        }

        console.log(`Found ${clientes.length} clients for ${msgType.type}`);

        for (const cliente of clientes as Cliente[]) {
          await processClient(cliente, msgType.type, msgType.template || '');
        }
      }
    }

    console.log(`Billing completed: ${totalSent} sent, ${totalErrors} errors`);

    // Send error notification if enabled and there are errors
    if (totalErrors > 0 && config.error_notifications_enabled === 'true') {
      await sendErrorNotification(
        totalErrors,
        errorDetails,
        config.billing_gmail_user || '',
        config.billing_gmail_password || '',
        config.error_notification_email || ''
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: totalSent, 
        errors: totalErrors,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Billing cron error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
