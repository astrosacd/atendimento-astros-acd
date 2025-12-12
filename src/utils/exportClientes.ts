import { Cliente } from '@/hooks/useClientes';

export const exportToCSV = (clientes: Cliente[], filename = 'clientes') => {
  const headers = [
    'Nome',
    'CPF/CNPJ',
    'Email',
    'Telefone',
    'Produto',
    'Plano',
    'Valor',
    'Data Renovação',
    'Observação',
    'Criado em',
  ];

  const csvContent = [
    headers.join(';'),
    ...clientes.map(cliente => [
      cliente.nome,
      cliente.cpf,
      cliente.email,
      cliente.numero,
      cliente.produto,
      cliente.plano || '',
      cliente.valor.toFixed(2).replace('.', ','),
      formatDateBR(cliente.data_renovacao),
      (cliente.observacao || '').replace(/;/g, ',').replace(/\n/g, ' '),
      formatDateBR(cliente.created_at),
    ].map(field => `"${field}"`).join(';'))
  ].join('\n');

  // Add BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

const formatDateBR = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('pt-BR');
};

export const exportToJSON = (clientes: Cliente[], filename = 'clientes') => {
  const blob = new Blob([JSON.stringify(clientes, null, 2)], { type: 'application/json' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
};
