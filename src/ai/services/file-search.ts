
'use server';
import {ai} from '@/ai/genkit';
import {
  GenerateContentRequest,
  HarmCategory,
  HarmBlockThreshold,
  VertexAI,
} from '@google-cloud/vertexai';
import {z} from 'zod';
import {v4 as uuidv4} from 'uuid';

function extractProjectAndLocation() {
  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) {
    throw new Error('GCLOUD_PROJECT environment variable is not set');
  }
  return {projectId, location: 'us-central1'};
}

async function getVertexAI() {
  const {projectId, location} = extractProjectAndLocation();
  const vertexAI = new VertexAI({project: projectId, location});
  return vertexAI;
}

function dataUriToGenAIFile(dataUri: string) {
  const [header, body] = dataUri.split(',');
  const mimeType = header.match(/:(.*?);/)?.[1];
  if (!mimeType) {
    throw new Error('Could not extract MIME type from data URI');
  }
  return {
    inlineData: {
      data: body,
      mimeType,
    },
  };
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const search = ai.defineTool(
  {
    name: 'search',
    description: 'Search for information in the uploaded files.',
    input: {
      schema: z.object({
        query: z.string(),
      }),
    },
    output: {
      schema: z.string(),
    },
  },
  async input => {
    return JSON.stringify(input);
  }
);

export const fileSearch = ai.defineTool(
  {
    name: 'fileSearch',
    description: 'Perform a search over the uploaded files.',
    input: {
      schema: z.object({
        queries: z.array(z.string()),
      }),
    },
    output: {
      schema: z.any(),
    },
  },
  async input => {
    return JSON.stringify(input);
  }
);

export async function uploadFiles(files: {name: string; dataUri: string}[]) {
  const vertexAI = await getVertexAI();

  const generativeModel = vertexAI.getGenerativeModel({
    model: 'gemini-1.5-flash-001',
  });
  const fileManager = generativeModel.fileManager;

  if (!fileManager) {
    throw new Error('FileManager is not available on this model.');
  }

  const uploadedFiles = await Promise.all(
    files.map(async ({name, dataUri}) => {
      const uniqueId = uuidv4();
      const file = dataUriToGenAIFile(dataUri);

      const result = await fileManager.uploadFile({
        file: file,
        displayName: `uploads/${uniqueId}/${name}`,
      });

      return {
        file: result.file,
        name,
      };
    })
  );

  const fileIds = uploadedFiles.map(f => f.file.name);

  // Poll for file processing to complete
  for (const fileId of fileIds) {
    let file = await fileManager.getFile(fileId);
    while (file.state === 'PROCESSING') {
      await sleep(10000); // Wait for 10 seconds before checking again
      file = await fileManager.getFile(fileId);
    }

    if (file.state !== 'ACTIVE') {
      throw new Error(
        `File ${file.name} failed to process. State: ${file.state}`
      );
    }
  }

  return fileIds;
}
