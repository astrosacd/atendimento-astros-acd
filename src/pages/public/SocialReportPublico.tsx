import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, Heart, MessageCircle, Image as ImgIcon, Film, Layers, Download, Instagram, ExternalLink } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR");
}

export default function SocialReportPublico() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_social_media_report_by_token" as any, { p_token: token });
        if (error) throw error;
        if (!data) throw new Error("Relatório não encontrado");
        setReport((data as any).report);
        setProfile((data as any).profile);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handlePDF() {
    setDownloading(true);
    try {
      const el = document.getElementById("social-report-content");
      if (!el) return;
      const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(img, "PNG", 0, position, pageW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(img, "PNG", 0, position, pageW, imgH);
        heightLeft -= pageH;
      }
      pdf.save(`relatorio-${profile?.username}-${report?.month}.pdf`);
    } finally { setDownloading(false); }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (error || !report) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-2 text-center p-6">
      <h1 className="text-2xl font-bold">Relatório indisponível</h1>
      <p className="text-muted-foreground">{error || "Link inválido ou expirado"}</p>
    </div>
  );

  const d = report.data || {};
  const f = d.followers || {};
  const posts = d.posts || {};
  const eng = d.engagement || {};
  const top = d.top_post;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-amber-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-6 px-4">
      <div id="social-report-content" className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 p-6 text-white">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-white/50">
                {profile?.profile_picture_url && <AvatarImage src={profile.profile_picture_url} />}
                <AvatarFallback>{profile?.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{profile?.display_name || profile?.username}</h1>
                <p className="opacity-90 flex items-center gap-1"><Instagram className="h-4 w-4" />@{profile?.username}</p>
              </div>
              <Badge className="bg-white/20 text-white border-white/30 text-base">{report.month}</Badge>
            </div>
          </div>
        </Card>

        {/* Seguidores */}
        <Card>
          <CardHeader><CardTitle className="text-lg">👥 Seguidores</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Atual" value={fmt(f.end)} />
              <Metric label="Saldo do mês" value={f.gain != null ? (f.gain >= 0 ? "+" : "") + fmt(f.gain) : "—"} color={f.gain >= 0 ? "emerald" : "red"} icon={f.gain >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} />
              <Metric label="Crescimento" value={f.pct_growth != null ? f.pct_growth.toFixed(1) + "%" : "—"} color="blue" />
            </div>
            {f.vs_prev_month_gain != null && (
              <p className="text-xs text-muted-foreground mt-3">Mês anterior: {f.vs_prev_month_gain >= 0 ? "+" : ""}{f.vs_prev_month_gain} seguidores</p>
            )}
          </CardContent>
        </Card>

        {/* Posts */}
        <Card>
          <CardHeader><CardTitle className="text-lg">📸 Publicações no mês</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              <Metric label="Total" value={String(posts.total ?? 0)} />
              <Metric label="Reels" value={String(posts.reels ?? 0)} color="amber" icon={<Film className="h-4 w-4" />} />
              <Metric label="Carrossel" value={String(posts.carousels ?? 0)} color="blue" icon={<Layers className="h-4 w-4" />} />
              <Metric label="Imagem" value={String(posts.images ?? 0)} color="pink" icon={<ImgIcon className="h-4 w-4" />} />
            </div>
          </CardContent>
        </Card>

        {/* Engajamento */}
        <Card>
          <CardHeader><CardTitle className="text-lg">💖 Engajamento</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric label="Curtidas" value={fmt(eng.total_likes)} color="red" icon={<Heart className="h-4 w-4" />} />
              <Metric label="Comentários" value={fmt(eng.total_comments)} color="blue" icon={<MessageCircle className="h-4 w-4" />} />
              <Metric label="Engajamento total" value={fmt(eng.total)} />
              <Metric label="Média / post" value={fmt(Math.round(eng.avg_per_post || 0))} />
            </div>
          </CardContent>
        </Card>

        {/* Top post */}
        {top && (
          <Card>
            <CardHeader><CardTitle className="text-lg">🏆 Post de maior destaque</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {top.thumbnail_url && (
                  <img src={top.thumbnail_url} alt="" className="w-24 h-24 rounded-md object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-3">{top.caption || "(sem legenda)"}</p>
                  <div className="flex gap-3 mt-2 text-sm text-muted-foreground">
                    <span>❤️ {fmt(top.likes)}</span>
                    <span>💬 {fmt(top.comments)}</span>
                  </div>
                  {top.permalink && (
                    <a href={top.permalink} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-primary mt-2">
                      Ver no Instagram <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Histórico simples */}
        {d.daily_history?.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">📈 Evolução de seguidores</CardTitle></CardHeader>
            <CardContent>
              <Sparkline data={d.daily_history} />
            </CardContent>
          </Card>
        )}

        <div className="text-center text-xs text-muted-foreground py-4">
          Relatório gerado em {new Date(report.generated_at).toLocaleString("pt-BR")}
        </div>
      </div>

      <div className="max-w-3xl mx-auto mt-4 flex justify-center">
        <Button onClick={handlePDF} disabled={downloading} size="lg">
          {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
          Baixar PDF
        </Button>
      </div>
    </div>
  );
}

function Metric({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: React.ReactNode }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400",
    red: "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400",
    blue: "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400",
    amber: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400",
    pink: "bg-pink-50 dark:bg-pink-950/20 text-pink-700 dark:text-pink-400",
  };
  const c = color ? colors[color] : "bg-muted/50";
  return (
    <div className={`p-3 rounded-md ${c} text-center`}>
      <div className="text-2xl font-bold flex items-center justify-center gap-1">{icon}{value}</div>
      <div className="text-[11px] uppercase tracking-wide opacity-80 mt-1">{label}</div>
    </div>
  );
}

function Sparkline({ data }: { data: { date: string; followers: number }[] }) {
  const valid = data.filter(d => d.followers != null);
  if (valid.length < 2) return <p className="text-sm text-muted-foreground">Histórico ainda em coleta.</p>;
  const max = Math.max(...valid.map(d => d.followers));
  const min = Math.min(...valid.map(d => d.followers));
  const range = max - min || 1;
  const w = 600, h = 80;
  const pts = valid.map((d, i) => {
    const x = (i / (valid.length - 1)) * w;
    const y = h - ((d.followers - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
        <polyline points={pts} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>{valid[0].date} ({fmt(valid[0].followers)})</span>
        <span>{valid[valid.length - 1].date} ({fmt(valid[valid.length - 1].followers)})</span>
      </div>
    </div>
  );
}
