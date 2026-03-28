/**
 * Parser para extrair templates oficiais da página FAQ-Templates do CIn/UFPE
 * URL: https://contratos.cin.ufpe.br/faq-templates
 */

import { load } from 'cheerio';
import type { OfficialTemplate } from './types';

const FAQ_TEMPLATES_URL = process.env.OFFICIAL_TEMPLATES_URL || 'https://contratos.cin.ufpe.br/faq-templates';
const CACHE_TTL = parseInt(process.env.OFFICIAL_TEMPLATES_CACHE_TTL || '86400', 10); // 24 horas

// Cache simples em memória (seria melhor usar Redis em produção)
let cache: {
  data: OfficialTemplate[] | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

/**
 * Extrai templates oficiais da página FAQ-Templates
 * Usa cache para evitar múltiplos requests
 */
export async function parseOfficialTemplates(): Promise<OfficialTemplate[]> {
  // Verificar cache
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL * 1000) {
    console.log('[OfficialTemplates] Retornando dados do cache');
    return cache.data;
  }

  try {
    console.log('[OfficialTemplates] Buscando templates oficiais...');
    
    // Fetch da página
    const response = await fetch(FAQ_TEMPLATES_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Falha ao carregar página: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const templates = extractTemplatesFromHTML(html);

    // Atualizar cache
    cache = {
      data: templates,
      timestamp: now,
    };

    console.log(`[OfficialTemplates] ${templates.length} templates extraídos com sucesso`);
    return templates;

  } catch (error) {
    console.error('[OfficialTemplates] Erro ao extrair templates:', error);
    
    // Se tiver cache expirado, retornar mesmo assim em caso de erro
    if (cache.data) {
      console.log('[OfficialTemplates] Retornando cache expirado devido a erro');
      return cache.data;
    }
    
    throw error;
  }
}

/**
 * Extrai templates do HTML usando cheerio
 */
function extractTemplatesFromHTML(html: string): OfficialTemplate[] {
  const $ = load(html);
  const templates: OfficialTemplate[] = [];

  // Mapeamento de seções FAQ para tipos de contrato
  const sectionToContractType: Record<string, string> = {
    'FAQ 5': 'Acordo de Parceria (Lei de Inovação)',
    'FAQ 6': 'Acordo de Parceria (Embrapii)',
    'FAQ 7': 'TED',
    'FAQ 8': 'Contrato de Extensão Tecnológica (Prestação de Serviços Técnicos)',
  };

  // Procurar por seções FAQ
  $('h1, h2, h3').each((_, element) => {
    const text = $(element).text().trim();
    
    // Encontrar qual seção FAQ estamos
    let currentSection = '';
    let currentContractType = '';
    
    for (const [section, contractType] of Object.entries(sectionToContractType)) {
      if (text.includes(section)) {
        currentSection = section;
        currentContractType = contractType;
        break;
      }
    }

    if (currentSection && currentContractType) {
      // Procurar por links na seção seguinte
      let nextElement = $(element).next();
      let sectionEnd = false;

      while (nextElement.length && !sectionEnd) {
        const tagName = nextElement.prop('tagName')?.toLowerCase();
        
        // Parar se encontrar outro heading
        if (tagName && ['h1', 'h2', 'h3'].includes(tagName)) {
          sectionEnd = true;
          break;
        }

        // Procurar por links de Google Docs
        nextElement.find('a[href*="docs.google.com"]').each((_, link) => {
          const href = $(link).attr('href');
          const linkText = $(link).text().trim();
          
          if (href && href.includes('docs.google.com/document')) {
            // Extrair nome do documento do texto ao redor
            const parentText = $(link).parent().text().trim();
            const documentName = extractDocumentName(parentText, linkText);

            templates.push({
              contractType: currentContractType,
              documentName: documentName || linkText || 'Documento sem nome',
              documentLink: href,
              faqSection: currentSection,
            });
          }
        });

        nextElement = nextElement.next();
      }
    }
  });

  return templates;
}

/**
 * Extrai o nome do documento do texto contexto
 */
function extractDocumentName(parentText: string, linkText: string): string {
  // Tentar extrair nome do documento do texto ao redor
  // Padrões comuns: "faça download do modelo aqui", "modelo disponível aqui"
  
  const patterns = [
    /modelo[^aqui]*aqui/i,
    /download[^do]*do[^modelo]*modelo/i,
    /Termo[^de]*de/i,
    /Acordo[^de]*de/i,
    /Plano[^de]*de/i,
    /Requerimento/i,
  ];

  for (const pattern of patterns) {
    const match = parentText.match(pattern);
    if (match) {
      // Limpar e retornar o nome encontrado
      return match[0]
        .replace(/aqui/gi, '')
        .replace(/clique/gi, '')
        .replace(/download/gi, '')
        .replace(/modelo/gi, '')
        .replace(/do/gi, '')
        .replace(/para/gi, '')
        .replace(/faça/gi, '')
        .trim();
    }
  }

  // Se não encontrar padrão, usar o texto do link
  return linkText;
}

/**
 * Invalida o cache atual
 */
export function invalidateCache(): void {
  cache = {
    data: null,
    timestamp: 0,
  };
  console.log('[OfficialTemplates] Cache invalidado');
}

/**
 * Retorna informações do cache atual
 */
export function getCacheInfo(): {
  hasData: boolean;
  age: number;
  isValid: boolean;
} {
  const now = Date.now();
  return {
    hasData: cache.data !== null,
    age: now - cache.timestamp,
    isValid: cache.data !== null && now - cache.timestamp < CACHE_TTL * 1000,
  };
}
