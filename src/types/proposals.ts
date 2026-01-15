// =============================================
// TIPOS DO SISTEMA DE PROPOSTAS COMERCIAIS
// =============================================

export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected';

export type SectionType = 
  | 'cover' 
  | 'text' 
  | 'pricing' 
  | 'timeline' 
  | 'team' 
  | 'testimonials' 
  | 'gallery' 
  | 'terms' 
  | 'signature';

export interface Proposal {
  id: string;
  user_id: string;
  client_id: string | null;
  template_id: string | null;
  title: string;
  status: ProposalStatus;
  share_token: string;
  valid_until: string | null;
  total_value: number;
  notes: string | null;
  client_signature: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
  // Relacionamentos
  client?: {
    id: string;
    nome: string;
    email: string;
    numero: string;
  } | null;
}

export interface ProposalSection {
  id: string;
  proposal_id: string;
  section_type: SectionType;
  title: string | null;
  content: Record<string, unknown>;
  order_index: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProposalViewLog {
  id: string;
  proposal_id: string;
  viewed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  country: string | null;
  city: string | null;
}

// Tipos de conteúdo por seção
export interface CoverContent {
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
}

export interface TextContent {
  content?: string;
}

export interface PricingItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface PricingContent {
  items: PricingItem[];
}

export interface TimelinePhase {
  id: string;
  phase: string;
  duration: string;
  description: string;
}

export interface TimelineContent {
  items: TimelinePhase[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  photo?: string;
}

export interface TeamContent {
  members: TeamMember[];
}

export interface Testimonial {
  id: string;
  author: string;
  company?: string;
  content: string;
}

export interface TestimonialsContent {
  items: Testimonial[];
}

export interface GalleryImage {
  id: string;
  url: string;
  caption?: string;
}

export interface GalleryContent {
  images: GalleryImage[];
}

export interface TermsContent {
  content?: string;
}

export interface SignatureContent {
  signerName?: string;
  signerRole?: string;
  signerSignature?: string; // base64
}

// Status helpers
export const statusConfig: Record<ProposalStatus, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Rascunho', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  sent: { label: 'Enviada', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  viewed: { label: 'Visualizada', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  accepted: { label: 'Aceita', color: 'text-green-600', bgColor: 'bg-green-100' },
  rejected: { label: 'Recusada', color: 'text-red-600', bgColor: 'bg-red-100' },
};

export const sectionTypeConfig: Record<SectionType, { label: string; icon: string }> = {
  cover: { label: 'Capa', icon: 'Layout' },
  text: { label: 'Texto', icon: 'Type' },
  pricing: { label: 'Preços', icon: 'DollarSign' },
  timeline: { label: 'Cronograma', icon: 'Calendar' },
  team: { label: 'Equipe', icon: 'Users' },
  testimonials: { label: 'Depoimentos', icon: 'MessageSquare' },
  gallery: { label: 'Galeria', icon: 'Image' },
  terms: { label: 'Termos', icon: 'FileText' },
  signature: { label: 'Assinatura', icon: 'PenTool' },
};
