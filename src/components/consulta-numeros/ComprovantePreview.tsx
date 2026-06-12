import { Button } from "@/components/ui/button";
import { useSignedComprovanteUrl } from "@/hooks/useSignedComprovanteUrl";

interface Props {
  url: string;
}

export function ComprovantePreview({ url }: Props) {
  const signed = useSignedComprovanteUrl(url);
  if (!signed) {
    return (
      <div className="border rounded-md p-4 bg-muted text-center text-xs text-muted-foreground">
        Carregando comprovante…
      </div>
    );
  }
  return (
    <>
      <div className="border rounded-md overflow-hidden bg-muted">
        <img
          src={signed}
          alt="Comprovante do cliente"
          className="w-full max-h-64 object-contain"
        />
      </div>
      <Button size="sm" variant="outline" asChild className="w-full mt-2">
        <a href={signed} target="_blank" rel="noreferrer">
          Abrir comprovante em nova aba
        </a>
      </Button>
    </>
  );
}
