
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

// Basic Markdown to DOCX converter
const markdownToDocxComponents = (markdown: string) => {
  const components: Paragraph[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    // Heading 1
    if (line.startsWith('# ')) {
      components.push(new Paragraph({
        text: line.substring(2),
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      }));
      continue;
    }
    // Heading 2
    if (line.startsWith('## ')) {
      components.push(new Paragraph({
        text: line.substring(3),
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 },
      }));
      continue;
    }
    // Heading 3
    if (line.startsWith('### ')) {
       components.push(new Paragraph({
        text: line.substring(4),
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 200 },
      }));
      continue;
    }

    // Handle paragraphs with mixed formatting
    const paragraphRuns: TextRun[] = [];
    // Split by **bold** and our custom <span ...>highlight</span>
    const parts = line.split(/(\*\*.*?\*\*|<span.*?<\/span>)/g);

    for (const part of parts) {
      if (part.startsWith('**') && part.endsWith('**')) {
        // Bold text
        paragraphRuns.push(new TextRun({ text: part.slice(2, -2), bold: true }));
      } else if (part.startsWith('<span')) {
        // Highlighted text
        const textContent = part.replace(/<.*?>/g, '');
        paragraphRuns.push(new TextRun({
          text: textContent,
          highlight: "yellow",
        }));
      } else if (part) {
        // Regular text
        paragraphRuns.push(new TextRun(part));
      }
    }
    
    if (paragraphRuns.length > 0 || line.trim() === '') {
        components.push(new Paragraph({ children: paragraphRuns }));
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
