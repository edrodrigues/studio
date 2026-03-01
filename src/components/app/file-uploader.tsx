
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, UploadCloud, Bot } from "lucide-react";

interface FileUploaderProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  handleFileSelect: (file: File | null) => void;
  handleFeedback: () => void;
  name: string;
  disabled?: boolean;
  feedbackDisabled?: boolean;
}

export function FileUploader({ handleFileSelect, handleFeedback, name, disabled = false, feedbackDisabled }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    setFile(selectedFile);
    handleFileSelect(selectedFile);
  };

  const handleButtonClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const isFeedbackDisabled = feedbackDisabled !== undefined ? feedbackDisabled : !file;

  return (
    <div className={cn("flex flex-col gap-2 w-full", disabled && "opacity-50 grayscale pointer-events-none")}>
      <input
        type="file"
        name={name}
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.md,.xlsx,.xls"
        disabled={disabled}
      />
      <Button onClick={handleButtonClick} variant={file ? "secondary" : "default"} className="w-full" disabled={disabled}>
        {file ? (
          <>
            <Check className="mr-2 h-4 w-4" />
            {file.name.length > 20 ? `${file.name.slice(0, 17)}...` : file.name}
          </>
        ) : (
          <>
            <UploadCloud className="mr-2 h-4 w-4" />
            Carregar Documentos de IA
          </>
        )}
      </Button>
      <Button onClick={handleFeedback} variant="outline" className="w-full" disabled={isFeedbackDisabled}>
        <Bot className="mr-2 h-4 w-4" />
        Feedback de IA
      </Button>
    </div>
  );
}
