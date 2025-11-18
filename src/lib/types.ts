
export interface Template {
  id: string;
  name: string;
  description: string;
  markdownContent: string;
  googleDocLink?: string;
  isNew?: boolean;
  contractTypes?: string[];
}

export interface Contract {
  id: string;
  contractModelId?: string;
  clientName: string;
  filledData: string;
  name: string;
  markdownContent: string; 
  createdAt: string;
}

export interface UploadedFile {
    id: string;
    file: File;
}
