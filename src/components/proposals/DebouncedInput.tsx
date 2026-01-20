import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface DebouncedInputProps extends Omit<React.ComponentProps<'input'>, 'onChange'> {
  value: string | number;
  onChange: (value: string) => void;
  debounceMs?: number;
}

interface DebouncedTextareaProps extends Omit<React.ComponentProps<'textarea'>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
}

/**
 * A debounced input that maintains local state to prevent cursor jumping.
 * Syncs with parent on blur or after debounce timeout.
 */
export function DebouncedInput({
  value,
  onChange,
  debounceMs = 300,
  className,
  ...props
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(String(value ?? ''));
  const timeoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local value when external value changes (but not from our own updates)
  const lastSyncedValue = useRef(String(value ?? ''));
  
  useEffect(() => {
    const externalValue = String(value ?? '');
    // Only update if the external value differs AND we're not focused
    if (externalValue !== lastSyncedValue.current && document.activeElement !== inputRef.current) {
      setLocalValue(externalValue);
      lastSyncedValue.current = externalValue;
    }
  }, [value]);

  const flushChange = useCallback((val: string) => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    lastSyncedValue.current = val;
    onChange(val);
  }, [onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Clear existing timeout
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    // Set new debounce timeout
    timeoutRef.current = window.setTimeout(() => {
      flushChange(newValue);
    }, debounceMs);
  };

  const handleBlur = () => {
    // Flush any pending changes immediately on blur
    flushChange(localValue);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Input
      ref={inputRef}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={cn(className)}
      {...props}
    />
  );
}

/**
 * A debounced textarea that maintains local state to prevent cursor jumping.
 */
export function DebouncedTextarea({
  value,
  onChange,
  debounceMs = 300,
  className,
  ...props
}: DebouncedTextareaProps) {
  const [localValue, setLocalValue] = useState(String(value ?? ''));
  const timeoutRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lastSyncedValue = useRef(String(value ?? ''));

  useEffect(() => {
    const externalValue = String(value ?? '');
    if (externalValue !== lastSyncedValue.current && document.activeElement !== textareaRef.current) {
      setLocalValue(externalValue);
      lastSyncedValue.current = externalValue;
    }
  }, [value]);

  const flushChange = useCallback((val: string) => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    lastSyncedValue.current = val;
    onChange(val);
  }, [onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      flushChange(newValue);
    }, debounceMs);
  };

  const handleBlur = () => {
    flushChange(localValue);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Textarea
      ref={textareaRef}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={cn(className)}
      {...props}
    />
  );
}
