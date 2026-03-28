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
 * Extrai conteúdo estruturado do HTML
 */
function extractContentFromHTML(
  html: string,
  pageId: string,
  url: string,
  title: string
): FaqContent {
  const $ = load(html);
  
  // Extrair título da página (se disponível)
  const pageTitle = $('h1').first().text().trim() || 
                    $('title').text().trim() || 
                    title;
  
  // Extrair conteúdo principal
  const sections: FaqSection[] = [];
  
  // Estratégia: procurar por headings (h1, h2, h3) como divisores de seção
  const headings = $('h1, h2, h3');
  
  headings.each((_, element) => {
    const headingText = $(element).text().trim();
    if (!headingText) return;
    
    // Extrair conteúdo até o próximo heading
    let sectionContent = '';
    let nextElement = $(element).next();
    const links: Array<{ text: string; url: string }> = [];
    
    while (nextElement.length && !['h1', 'h2', 'h3'].includes(nextElement.prop('tagName')?.toLowerCase() || '')) {
      const tagName = nextElement.prop('tagName')?.toLowerCase();
      
      if (tagName === 'p') {
        const text = nextElement.text().trim();
        if (text) {
          sectionContent += text + '\n\n';
        }
      } else if (tagName === 'ul' || tagName === 'ol') {
        nextElement.find('li').each((_, li) => {
          const liText = $(li).text().trim();
          if (liText) {
            sectionContent += '- ' + liText + '\n';
          }
        });
        sectionContent += '\n';
      }
      
      // Extrair links
      nextElement.find('a[href]').each((_, link) => {
        const href = $(link).attr('href');
        const linkText = $(link).text().trim();
        if (href && linkText && !href.startsWith('#')) {
          links.push({
            text: linkText,
            url: href.startsWith('http') ? href : new URL(href, url).href,
          });
        }
      });
      
      nextElement = nextElement.next();
    }
    
    if (sectionContent.trim()) {
      sections.push({
        title: headingText,
        content: sectionContent.trim(),
        links: links.length > 0 ? links : undefined,
      });
    }
  });
  
  // Se não encontrou seções por headings, tenta extrair todo o conteúdo
  if (sections.length === 0) {
    const mainContent = $('main, .content, article, .gs-container').text();
    if (mainContent) {
      sections.push({
        title: 'Conteúdo Principal',
        content: mainContent.trim().substring(0, 50000), // Limitar tamanho
      });
    }
  }
  
  // Compilar conteúdo completo
  const fullContent = sections
    .map(s => `## ${s.title}\n\n${s.content}`)
    .join('\n\n');
  
  // Gerar hash do conteúdo
  const contentHash = generateContentHash(fullContent);
  
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
