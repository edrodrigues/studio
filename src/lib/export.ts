import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

// Basic Markdown to DOCX converter
const markdownToDocxComponents = (markdown: string) => {
  const lines = markdown.split('\n');
  const components = [];

  for (const line of lines) {
    if (line.startsWith('# ')) {
      components.push(new Paragraph({
        text: line.substring(2),
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      }));
    } else if (line.startsWith('## ')) {
      components.push(new Paragraph({
        text: line.substring(3),
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 },
      }));
    } else if (line.startsWith('### ')) {
       components.push(new Paragraph({
        text: line.substring(4),
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 200 },
      }));
    } else if (line.trim() === '') {
        components.push(new Paragraph({ text: '' }));
    }
    else {
      // Handle bold text **text**
      const runs = [];
      const parts = line.split(/(\*\*.*?\*\*)/g);
      for(const part of parts) {
        if (part.startsWith('**') && part.endsWith('**')) {
          runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
        } else {
          runs.push(new TextRun(part));
        }
      }
      components.push(new Paragraph({ children: runs }));
    }
  }

  return components;
};

export const exportToDocx = async (content: string, fileName: string) => {
  const doc = new Document({
    sections: [{
      properties: {},
      children: markdownToDocxComponents(content),
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${fileName}.docx`);
};
