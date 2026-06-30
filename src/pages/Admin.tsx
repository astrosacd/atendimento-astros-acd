import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '@/hooks/usePermissions';
import { 
  Users, 
  KeyRound, 
  Settings, 
  Shield,
  ArrowLeft,
  UserCheck,
  Database,
  MessageCircle,
  ShieldCheck,
  BookOpen,
  UserPlus,
  Package,
  Activity,
  Server,
  Clock,
} from 'lucide-react';

const Admin = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();


  const adminModules = [
    {
      key: 'manageUsers',
      title: t('admin.modules.manageUsers.title'),
      description: t('admin.modules.manageUsers.description'),
      icon: Users,
      path: '/usuarios',
      color: 'from-blue-500/20 to-blue-600/10',
    },
    {
      key: 'systemPermissions',
      title: t('admin.modules.systemPermissions.title'),
      description: t('admin.modules.systemPermissions.description'),
      icon: ShieldCheck,
      path: '/admin/permissoes',
      color: 'from-purple-500/20 to-purple-600/10',
    },
    {
      key: 'passwordRecovery',
      title: t('admin.modules.passwordRecovery.title'),
      description: t('admin.modules.passwordRecovery.description'),
      icon: KeyRound,
      path: '/admin/recuperacao-senha',
      color: 'from-amber-500/20 to-amber-600/10',
    },
    {
      key: 'welcomeMessages',
      title: t('admin.modules.welcomeMessages.title'),
      description: t('admin.modules.welcomeMessages.description'),
      icon: UserPlus,
      path: '/admin/boas-vindas',
      color: 'from-emerald-500/20 to-emerald-600/10',
    },
    {
      key: 'helpChat',
      title: t('admin.modules.helpChat.title'),
      description: t('admin.modules.helpChat.description'),
      icon: MessageCircle,
      path: '/admin/chat',
      color: 'from-pink-500/20 to-pink-600/10',
    },
    {
      key: 'recaptcha',
      title: 'Google reCAPTCHA',
      description: 'Habilitar/desabilitar e configurar credenciais do reCAPTCHA v2 na tela de login.',
      icon: Shield,
      path: '/admin/recaptcha',
      color: 'from-red-500/20 to-red-600/10',
    },
    {
      key: 'configurationGuide',
      title: t('admin.modules.configurationGuide.title'),
      description: t('admin.modules.configurationGuide.description'),
      icon: BookOpen,
      path: '/admin/guia',
      color: 'from-cyan-500/20 to-cyan-600/10',
    },
    {
      key: 'systemHealth',
      title: 'Saúde do Sistema',
      description: 'Monitoramento em tempo real de integrações, APIs e limites de crédito.',
      icon: Activity,
      path: '/admin/saude',
      color: 'from-emerald-500/20 to-emerald-600/10',
    },
    {
      key: 'mcp',
      title: t('admin.modules.mcp.title'),
      description: t('admin.modules.mcp.description'),
      icon: Server,
      path: '/admin/mcp',
      color: 'from-orange-500/20 to-orange-600/10',
    },
    {
      key: 'horarioComercial',
      title: 'Horário Comercial',
      description: 'Configure o expediente, bloqueios de datas e a exibição do status no Dashboard.',
      icon: Clock,
      path: '/admin/horario-comercial',
      color: 'from-amber-500/20 to-amber-600/10',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Settings className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{t('admin.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('admin.subtitle')}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <UserCheck className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('admin.stats.activeModules')}</p>
                  <p className="text-2xl font-bold text-foreground">{adminModules.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('admin.stats.accessLevel')}</p>
                  <p className="text-2xl font-bold text-foreground">{t('user.administrator')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('admin.stats.system')}</p>
                  <p className="text-2xl font-bold text-foreground">{t('admin.stats.online')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Modules */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">{t('admin.modulesTitle')}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminModules
            .filter(module => {
              if (module.key === 'manageUsers') return hasPermission('manage_users');
              if (module.key === 'systemPermissions') return hasPermission('manage_permissions');
              if (module.key === 'systemHealth') return hasPermission('manage_system_health');
              if (module.key === 'mcp') return hasPermission('view_mcp_config');
              if (module.key === 'horarioComercial') return hasPermission('manage_horario_comercial');
              return true;
            })
            .map((module) => (
            <Card
              key={module.key}
              className="border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-pointer group"
              onClick={() => navigate(module.path)}
            >
              <CardHeader>
                <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${module.color} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300`}>
                  <module.icon className="h-7 w-7 text-foreground" />
                </div>
                <CardTitle className="text-foreground group-hover:text-primary transition-colors">
                  {module.title}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {module.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-muted-foreground hover:text-primary hover:bg-primary/10"
                >
                  {t('admin.accessModule')} →
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

      </main>
    </div>
  );
};

export default Admin;
