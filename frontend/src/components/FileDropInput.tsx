import { InputHTMLAttributes, useState } from 'react';

interface FileDropInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  onFilesSelected: (files: File[]) => void;
  dropMessage?: string;
}

export function FileDropInput({
  onFilesSelected,
  className,
  multiple,
  disabled,
  dropMessage = 'Solte o arquivo aqui',
  ...rest
}: FileDropInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const mergedInputClassName = `${className ?? ''} text-transparent file:text-white`;

  function handleFiles(files: File[]) {
    if (!files.length) return;
    onFilesSelected(files);
  }

  return (
    <div
      className={`relative rounded-md ${isDragging ? 'ring-2 ring-primary ring-offset-2 ring-offset-transparent' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        if (disabled) return;
        handleFiles(Array.from(event.dataTransfer.files || []));
      }}
    >
      <input
        {...rest}
        type="file"
        multiple={multiple}
        disabled={disabled}
        className={mergedInputClassName}
        onChange={(event) => {
          handleFiles(Array.from(event.target.files || []));
          event.target.value = '';
        }}
      />
      {isDragging && !disabled && (
        <div className="pointer-events-none absolute inset-0 rounded-md border border-dashed border-primary bg-primary/10 flex items-center justify-center text-xs text-primary font-medium">
          {dropMessage}
        </div>
      )}
    </div>
  );
}
