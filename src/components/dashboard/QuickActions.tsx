import { Button } from "@/components/ui/button";
import { FileText, Search, CreditCard, PlusCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function QuickActions() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const actions = [
    {
      label: "Criar Proposta Rápida",
      icon: PlusCircle,
      path: "/propostas",
      color: "bg-primary/10 text-primary hover:bg-primary/20",
    },
    {
      label: "Consultar Número",
      icon: Search,
      path: "/admin/consulta-numeros",
      color: "bg-info/10 text-info hover:bg-info/20",
    },
    {
      label: "Recuperação de Boleto",
      icon: CreditCard,
      path: "/admin/cobranca?tab=recovery",
      color: "bg-update/10 text-update hover:bg-update/20",
    },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="ghost"
          className={`flex items-center gap-2 border border-transparent transition-all duration-200 ${action.color}`}
          onClick={() => navigate(action.path)}
        >
          <action.icon className="h-4 w-4" />
          <span className="font-medium">{action.label}</span>
        </Button>
      ))}
    </div>
  );
}
