import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eraser, Check, PenLine, Keyboard } from 'lucide-react';

interface SignatureCanvasProps {
  signature: string;
  onChange: (signature: string) => void;
  disabled?: boolean;
  clientName?: string;
}

// Fonts for typed signature
const signatureFonts = [
  { name: 'Cursive', style: 'font-signature-cursive' },
  { name: 'Elegant', style: 'font-signature-elegant' },
  { name: 'Script', style: 'font-signature-script' },
];

export function SignatureCanvas({ signature, onChange, disabled, clientName = '' }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!signature);
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState(clientName);
  const [selectedFont, setSelectedFont] = useState(0);

  // Update typed name when clientName changes
  useEffect(() => {
    if (clientName && !typedName) {
      setTypedName(clientName);
    }
  }, [clientName]);

  // Configurar canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configurar para alta resolução
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Configurar estilo do traço
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Carregar assinatura existente
    if (signature && mode === 'draw') {
      const img = new window.Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasSignature(true);
      };
      img.src = signature;
    }
  }, [signature, mode]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    saveSignature();
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
    setHasSignature(true);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    onChange('');
    setHasSignature(false);
    setTypedName('');
  };

  // Generate signature from typed name
  const generateTypedSignature = (name: string, fontIndex: number) => {
    if (!name.trim()) {
      onChange('');
      setHasSignature(false);
      return;
    }

    // Create a temporary canvas to generate the signature image
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    const width = 400;
    const height = 160;
    const dpr = 2;
    
    tempCanvas.width = width * dpr;
    tempCanvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background (transparent)
    ctx.clearRect(0, 0, width, height);

    // Set font based on selection
    const fonts = [
      '"Brush Script MT", cursive',
      '"Lucida Handwriting", cursive',
      '"Segoe Script", cursive',
    ];

    ctx.font = `italic 48px ${fonts[fontIndex]}`;
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw the name
    ctx.fillText(name, width / 2, height / 2);

    // Draw a line under the signature
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, height - 30);
    ctx.lineTo(width - 40, height - 30);
    ctx.stroke();

    const dataUrl = tempCanvas.toDataURL('image/png');
    onChange(dataUrl);
    setHasSignature(true);
  };

  const handleTypedNameChange = (name: string) => {
    setTypedName(name);
    generateTypedSignature(name, selectedFont);
  };

  const handleFontChange = (index: number) => {
    setSelectedFont(index);
    if (typedName) {
      generateTypedSignature(typedName, index);
    }
  };

  const handleModeChange = (newMode: string) => {
    setMode(newMode as 'draw' | 'type');
    clearSignature();
  };

  return (
    <div className="space-y-3">
      <Tabs value={mode} onValueChange={handleModeChange}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="draw" disabled={disabled}>
            <PenLine className="h-4 w-4 mr-2" />
            Desenhar
          </TabsTrigger>
          <TabsTrigger value="type" disabled={disabled}>
            <Keyboard className="h-4 w-4 mr-2" />
            Digitar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draw" className="mt-3">
          <div className="relative">
            <canvas
              ref={canvasRef}
              className={`w-full h-40 border rounded-lg ${
                disabled ? 'bg-muted cursor-not-allowed' : 'bg-white cursor-crosshair'
              } touch-none`}
              style={{ touchAction: 'none' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            
            {!hasSignature && !disabled && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-muted-foreground text-sm">Assine aqui</span>
              </div>
            )}

            {hasSignature && (
              <div className="absolute top-2 right-2">
                <Check className="h-5 w-5 text-green-500" />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="type" className="mt-3 space-y-3">
          <Input
            placeholder="Digite seu nome completo"
            value={typedName}
            onChange={(e) => handleTypedNameChange(e.target.value)}
            disabled={disabled}
            className="text-lg"
          />

          <div className="flex gap-2">
            {signatureFonts.map((font, index) => (
              <Button
                key={font.name}
                variant={selectedFont === index ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFontChange(index)}
                disabled={disabled}
                className="flex-1"
              >
                {font.name}
              </Button>
            ))}
          </div>

          {/* Preview */}
          <div className="relative h-40 border rounded-lg bg-white flex items-center justify-center">
            {typedName ? (
              <div className="text-center">
                <p 
                  className="text-4xl italic text-gray-900"
                  style={{ 
                    fontFamily: selectedFont === 0 
                      ? '"Brush Script MT", cursive' 
                      : selectedFont === 1 
                        ? '"Lucida Handwriting", cursive'
                        : '"Segoe Script", cursive'
                  }}
                >
                  {typedName}
                </p>
                <div className="w-64 h-px bg-gray-900 mx-auto mt-2" />
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">
                Digite seu nome acima
              </span>
            )}
            
            {hasSignature && (
              <div className="absolute top-2 right-2">
                <Check className="h-5 w-5 text-green-500" />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {!disabled && hasSignature && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={clearSignature}>
            <Eraser className="h-4 w-4 mr-2" />
            Limpar
          </Button>
        </div>
      )}
    </div>
  );
}