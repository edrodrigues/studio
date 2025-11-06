
export interface Template {
  id: string;
  name: string;
  description: string;
  content: string; // Markdown content
  googleDocLink?: string;
}

export interface Contract {
  id: string;
  templateId?: string; // Optional if generated directly
  name: string;
  content: string; // Markdown content with filled values
  createdAt: string;
}

export interface UploadedFile {
    id: string;
    file: File;
}
