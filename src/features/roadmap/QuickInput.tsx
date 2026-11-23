// Single-line input that submits on Enter (and stays focused for the next entry) and clears on Esc.
import { useState } from 'react';
import { Input } from '../../ui';

interface QuickInputProps {
  label: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  className?: string;
}

export function QuickInput({ label, placeholder, onSubmit, className }: QuickInputProps) {
  const [value, setValue] = useState('');
  return (
    <Input
      label={label}
      hideLabel
      placeholder={placeholder}
      value={value}
      className={className}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault();
          if (value.trim()) onSubmit(value.trim());
          setValue('');
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setValue('');
        }
      }}
    />
  );
}
