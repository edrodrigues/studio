/**
 * Parser para extrair conteúdo das páginas FAQ do CIn/UFPE
 * URLs: https://contratos.cin.ufpe.br/
 *       https://contratos.cin.ufpe.br/faq-templates
 *       https://contratos.cin.ufpe.br/proc-interno
 */

import { load } from 'cheerio';
import type { FaqContent, FaqSection } from './types';
import crypto from 'crypto';

const FAQ_PAGES = [
  { id: 'main', url: 'https://contratos.cin.ufpe.br/', name: 'Página Principal' },
  { id: 'faq-templates', url: 'https://contratos.cin.ufpe.br/faq-templates', name: 'FAQ - Templates' },
  { id: 'proc-interno', url: 'https://contratos.cin.ufpe.br/proc-interno', name: 'Procedimentos Internos' },
];

const CACHE_TTL = parseInt(process.env.FAQ_CONTENT_CACHE_TTL || '604800', 10); // 7 dias por padrão

// Cache simples em memória
const cache: Map<string, { data: FaqContent; timestamp: number }> = new Map();

/**
 * Parseia todas as páginas FAQ
 */
export async function parseAllFaqPages(): Promise<FaqContent[]> {
  const results: FaqContent[] = [];
  
  for (const page of FAQ_PAGES) {
    try {
      console.log(`[FaqContent] Parsing página: ${page.name}`);
      const content = await parseFaqContent(page.id);
      results.push(content);
      
      // Pequeno delay para não sobrecarregar o servidor
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[FaqContent] Erro ao parsear ${page.name}:`, error);
      // Se tiver cache, retorna o cache mesmo que expirado
      const cached = cache.get(page.id);
      if (cached) {
        console.log(`[FaqContent] Retornando cache expirado para ${page.name}`);
        results.push(cached.data);
      }
    }
  }
  
  return results;
}

/**
 * Parseia uma página específica FAQ
 */
export async function parseFaqContent(pageId: string): Promise<FaqContent> {
  const page = FAQ_PAGES.find(p => p.id === pageId);
  if (!page) {
    throw new Error(`Página FAQ não encontrada: ${pageId}`);
  }
  
  // Verificar cache
  const now = Date.now();
  const cached = cache.get(pageId);
  if (cached && now - cached.timestamp < CACHE_TTL * 1000) {
    console.log(`[FaqContent] Retornando dados do cache para ${page.name}`);
    return cached.data;
  }
  
  try {
    console.log(`[FaqContent] Buscando conteúdo de ${page.name}...`);
    
    // Fetch da página
    const response = await fetch(page.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Falha ao carregar página: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    const content = extractContentFromHTML(html, page.id, page.url, page.name);
    
    // Atualizar cache
    cache.set(pageId, { data: content, timestamp: now });
    
    console.log(`[FaqContent] Conteúdo extraído com sucesso: ${page.name} (${content.content.length} caracteres)`);
    return content;
    
  } catch (error) {
    console.error(`[FaqContent] Erro ao extrair ${page.name}:`, error);
    
    // Se tiver cache expirado, retornar mesmo assim
    if (cached) {
      console.log(`[FaqContent] Retornando cache expirado devido a erro`);
      return cached.data;
    }
    
    throw error;
  }
}

/**
 * Extrai texto visível de um elemento e todos os seus descendentes,
 * preservando quebras de linha para parágrafos e listas.
 */
function extractTextRecursive($: ReturnType<typeof load>, element: any): string {
  const tagName = $(element).prop('tagName')?.toLowerCase() || '';
  
  // Ignorar elementos não-visíveis
  if (['script', 'style', 'noscript', 'svg', 'img', 'video', 'audio', 'iframe'].includes(tagName)) {
    return '';
  }
  
  // Se é um nó de texto puro, retornar o texto
  if (element.type === 'text') {
    return $(element).text();
  }
  
  // Coletar texto dos filhos
  let text = '';
  $(element).contents().each((_: number, child: any) => {
    text += extractTextRecursive($, child);
  });
  
  text = text.trim();
  if (!text) return '';
  
  // Adicionar formatação baseada na tag
  if (['p', 'div', 'section', 'article', 'blockquote'].includes(tagName)) {
    return text + '\n\n';
  } else if (tagName === 'li') {
    return '- ' + text + '\n';
  } else if (tagName === 'br') {
    return '\n';
  } else if (['ul', 'ol'].includes(tagName)) {
    return text + '\n';
  }
  
  return text;
}

/**
 * Remove duplicações de texto que ocorrem em menus responsivos do Google Sites
 */
function deduplicateText(text: string): string {
  const lines = text.split('\n');
  const seen = new Set<string>();
  const result: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Pular linhas vazias duplicadas consecutivas
    if (!trimmed) {
      if (result.length > 0 && result[result.length - 1].trim() === '') {
        continue;
      }
      result.push(line);
      continue;
    }
    // Pular linhas duplicadas (menus repetidos no Google Sites)
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(line);
    }
  }
  
  return result.join('\n').trim();
}

/**
 * Extrai conteúdo estruturado do HTML
 * Compatível com Google Sites (que usa divs aninhadas em vez de tags semânticas)
 */
function extractContentFromHTML(
  html: string,
  pageId: string,
  url: string,
  title: string
): FaqContent {
  const $ = load(html);
  
  // 1. Remover elementos de navegação, scripts, estilos
  $('nav, header, footer, script, style, noscript, svg, [role="navigation"]').remove();
  
  // Remover menus de navegação do Google Sites (links repetitivos no topo)
  $('header').remove();
  
  // Extrair título da página
  const pageTitle = $('h1').first().text().trim() || 
                    $('title').text().trim() || 
                    title;
  
  // 2. Extrair conteúdo principal com estratégia robusta
  const sections: FaqSection[] = [];
  
  // Encontrar todos os headings no documento
  const headings = $('h1, h2, h3');
  
  if (headings.length > 0) {
    // Coletar todos os nós do body em ordem do documento
    const bodyElements: Array<{ type: 'heading' | 'content'; element: any }> = [];
    
    // Percorrer todos os elementos do body
    $('body *').each((_, el) => {
      const tag = $(el).prop('tagName')?.toLowerCase() || '';
      if (['h1', 'h2', 'h3'].includes(tag)) {
        bodyElements.push({ type: 'heading', element: el });
      }
    });
    
    // Para cada heading, extrair texto até o próximo heading
    for (let i = 0; i < bodyElements.length; i++) {
      const headingEl = bodyElements[i].element;
      const headingText = $(headingEl).text().trim();
      if (!headingText) continue;
      
      // Encontrar o container pai mais relevante do heading
      // No Google Sites, headings e conteúdo frequentemente estão em divs separadas
      let sectionContent = '';
      const links: Array<{ text: string; url: string }> = [];
      
      // Estratégia: percorrer todos os siblings e seus descendentes
      // até encontrar outro heading
      let current = $(headingEl).parent();
      
      // Subir até encontrar um container que tenha siblings relevantes
      while (current.length && current.next().length === 0 && !current.is('body')) {
        current = current.parent();
      }
      
      // Percorrer siblings após o container do heading
      let sibling = current.next();
      while (sibling.length) {
        // Verificar se este sibling contém o próximo heading
        const innerHeadings = sibling.find('h1, h2, h3');
        const siblingTag = sibling.prop('tagName')?.toLowerCase() || '';
        
        if (['h1', 'h2', 'h3'].includes(siblingTag)) {
          break; // Encontrou próximo heading como sibling direto
        }
        
        if (innerHeadings.length > 0) {
          // O sibling contém um heading interno — extrair texto antes dele
          break;
        }
        
        // Extrair texto recursivamente deste sibling
        const text = extractTextRecursive($, sibling[0]);
        if (text.trim()) {
          sectionContent += text;
        }
        
        // Extrair links
        sibling.find('a[href]').each((_: number, link: any) => {
          const href = $(link).attr('href');
          const linkText = $(link).text().trim();
          if (href && linkText && !href.startsWith('#') && href.startsWith('http')) {
            links.push({ text: linkText, url: href });
          }
        });
        
        sibling = sibling.next();
      }
      
      // Limpar e deduplificar
      sectionContent = deduplicateText(sectionContent);
      
      if (sectionContent.trim()) {
        sections.push({
          title: headingText,
          content: sectionContent.trim(),
          links: links.length > 0 ? links : [],  // Sempre array, nunca undefined
        });
      }
    }
  }
  
  // 3. Fallback: se não encontrou seções, extrair todo o conteúdo visível do body
  if (sections.length === 0) {
    console.log(`[FaqContent] Fallback: extraindo texto completo do body para ${pageId}`);
    
    // Remover links de navegação duplicados
    const bodyText = extractTextRecursive($, $('body')[0]);
    const cleanText = deduplicateText(bodyText);
    
    if (cleanText.trim()) {
      sections.push({
        title: pageTitle || 'Conteúdo Principal',
        content: cleanText.trim().substring(0, 50000), // Limitar tamanho
        links: [],
      });
    }
  }
  
  // 4. Compilar conteúdo completo
  const fullContent = sections
    .map(s => `## ${s.title}\n\n${s.content}`)
    .join('\n\n');
  
  // Gerar hash do conteúdo
  const contentHash = generateContentHash(fullContent);
  
  console.log(`[FaqContent] Extracted ${sections.length} sections, ${fullContent.length} chars for ${pageId}`);
  
  return {
    id: pageId,
    url: url,
    title: pageTitle,
    content: fullContent,
    sections: sections,
    contentHash: contentHash,
    lastSyncedAt: new Date().toISOString(),
    syncStatus: 'synced',
  };
}

/**
 * Gera hash SHA-256 do conteúdo para detectar mudanças
 */
export function generateContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Invalida o cache de uma página específica ou todas
 */
export function invalidateCache(pageId?: string): void {
  if (pageId) {
    cache.delete(pageId);
    console.log(`[FaqContent] Cache invalidado para: ${pageId}`);
  } else {
    cache.clear();
    console.log('[FaqContent] Todo o cache foi invalidado');
  }
}

/**
 * Retorna informações do cache atual
 */
export function getCacheInfo(): {
  pages: Array<{ id: string; age: number; isValid: boolean }>;
  totalCached: number;
} {
  const now = Date.now();
  const pages: Array<{ id: string; age: number; isValid: boolean }> = [];
  
  cache.forEach((value, key) => {
    pages.push({
      id: key,
      age: now - value.timestamp,
      isValid: now - value.timestamp < CACHE_TTL * 1000,
    });
  });
  
  return {
    pages,
    totalCached: cache.size,
  };
}

/**
 * Verifica se o conteúdo mudou comparando hashes
 */
export function hasContentChanged(newContent: string, oldHash: string): boolean {
  const newHash = generateContentHash(newContent);
  return newHash !== oldHash;
}
