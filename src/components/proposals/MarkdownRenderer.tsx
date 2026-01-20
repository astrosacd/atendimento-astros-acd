import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Configure marked for simple formatting
marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true,    // GitHub Flavored Markdown
});

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const html = useMemo(() => {
    if (!content) return '';

    // Normalize newlines (Windows -> Unix) so spacing behaves consistently
    const normalized = content.replace(/\r\n/g, '\n');
    
    // Parse markdown to HTML
    const rawHtml = marked.parse(normalized, { async: false }) as string;
    
    // Sanitize HTML to prevent XSS
    return DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'blockquote', 'code', 'pre'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
  }, [content]);

  return (
    <div
      className={cn('prose prose-neutral max-w-none dark:prose-invert', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Hint text for users
export const markdownHint = `Dica: Use **negrito**, *itálico*, ~~riscado~~, ou - para listas`;
