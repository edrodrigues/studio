
"use client";

import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, UploadCloud, Bot, Database } from "lucide-react";

interface FileUploaderProps {
  icon: ReactNode;
  title: string;
  description: string;
  onFileSelect: (file: File | null) => void;
  onFeedbackClick: () => void;
  name: string;
}

export function FileUploader({ icon, title, description, onFileSelect, onFeedbackClick, name }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    setFile(selectedFile);
    onFileSelect(selectedFile);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="text-center">
      <CardHeader>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10 text-secondary">
          {icon}
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center space-y-2">
        <input
          type="file"
          name={name}
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.md,.xlsx,.xls"
        />
        <Button onClick={handleButtonClick} variant={file ? "secondary" : "default"} className="w-full">
          {file ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              {file.name.length > 20 ? `${file.name.slice(0, 17)}...` : file.name}
            </>
          ) : (
            <>
              <UploadCloud className="mr-2 h-4 w-4" />
              Carregar Arquivo
            </>
          )}
        </Button>
        <Button onClick={onFeedbackClick} variant="outline" className="w-full" disabled={!file}>
            <Bot className="mr-2 h-4 w-4" />
            Feedback de IA
        </Button>
        <Button variant="outline" className="w-full">
            <Database className="mr-2 h-4 w-4" />
            Documento indexado em JSON
        </Button>
      </CardContent>
    </Card>
  );
}
