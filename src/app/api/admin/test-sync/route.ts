import { NextResponse } from 'next/server';
import { parseOfficialTemplates, invalidateCache, getCacheInfo } from '@/lib/official-templates-parser';

/**
 * Endpoint de teste para sincronização de templates
 * Permite executar o parser manualmente durante desenvolvimento
 * 
 * GET /api/admin/test-sync - Executa parser e retorna resultados
 * POST /api/admin/test-sync - Invalida cache e executa novamente
 */
export async function GET() {
  try {
    console.log('[TestSync] Executando teste de sincronização...');

    const cacheInfo = getCacheInfo();
    
    // Executar parser
    const templates = await parseOfficialTemplates();

    // Agrupar por tipo de contrato para visualização
    const grouped = templates.reduce((acc, template) => {
      if (!acc[template.contractType]) {
        acc[template.contractType] = [];
      }
      acc[template.contractType].push(template);
      return acc;
    }, {} as Record<string, typeof templates>);

    return NextResponse.json({
      success: true,
      data: {
        totalTemplates: templates.length,
        cacheInfo,
        groupedTemplates: grouped,
        templates: templates.slice(0, 10), // Limitar a 10 para não sobrecarregar
      },
    });

  } catch (error) {
    console.error('[TestSync] Erro:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Invalida cache e executa novamente
 */
export async function POST() {
  try {
    console.log('[TestSync] Invalidando cache e executando novamente...');
    
    invalidateCache();
    
    const templates = await parseOfficialTemplates();

    const grouped = templates.reduce((acc, template) => {
      if (!acc[template.contractType]) {
        acc[template.contractType] = [];
      }
      acc[template.contractType].push(template);
      return acc;
    }, {} as Record<string, typeof templates>);

    return NextResponse.json({
      success: true,
      message: 'Cache invalidado e templates extraídos com sucesso',
      data: {
        totalTemplates: templates.length,
        groupedTemplates: grouped,
        templates: templates.slice(0, 10),
      },
    });

  } catch (error) {
    console.error('[TestSync] Erro:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      },
      { status: 500 }
    );
  }
}
