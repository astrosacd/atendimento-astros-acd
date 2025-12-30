-- Insert receipt configuration defaults
INSERT INTO billing_config (config_key, config_value) VALUES
  ('receipt_enabled', 'true'),
  ('receipt_email_enabled', 'true'),
  ('receipt_whatsapp_enabled', 'true'),
  ('receipt_email_subject', 'Recibo de Pagamento - {produto}'),
  ('receipt_email_template', '
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #10b981; margin: 0;">RECIBO DE PAGAMENTO</h1>
    <p style="color: #666; margin-top: 5px;">Comprovante de pagamento recebido</p>
  </div>
  
  <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="color: #333; margin-top: 0;">Dados do Cliente</h2>
    <p><strong>Nome:</strong> {nome}</p>
    <p><strong>Email:</strong> {email}</p>
    <p><strong>CPF/CNPJ:</strong> {cpf}</p>
  </div>
  
  <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="color: #333; margin-top: 0;">Dados do Pagamento</h2>
    <p><strong>Produto:</strong> {produto}</p>
    <p><strong>Plano:</strong> {plano}</p>
    <p><strong>Valor Pago:</strong> {valor}</p>
    <p><strong>Data do Pagamento:</strong> {data_pagamento}</p>
    <p><strong>Próxima Renovação:</strong> {proxima_renovacao}</p>
  </div>
  
  <div style="text-align: center; padding: 20px; border-top: 1px solid #eee;">
    <p style="color: #666; font-size: 12px;">Este é um recibo automático. Guarde para seu controle.</p>
    <p style="color: #666; font-size: 12px;">Em caso de dúvidas, entre em contato conosco.</p>
  </div>
</div>
'),
  ('receipt_whatsapp_template', '✅ *RECIBO DE PAGAMENTO*

━━━━━━━━━━━━━━━━━━━━━━
👤 *Cliente:* {nome}
📦 *Produto:* {produto}
📋 *Plano:* {plano}
━━━━━━━━━━━━━━━━━━━━━━

💰 *Valor Pago:* {valor}
📅 *Data:* {data_pagamento}
🔄 *Próxima Renovação:* {proxima_renovacao}

━━━━━━━━━━━━━━━━━━━━━━
Obrigado pela confiança! 🙏
Este é seu comprovante de pagamento.')
ON CONFLICT (config_key) DO NOTHING;