import { NextResponse } from 'next/server';
import { executeTemplateSync } from '@/lib/template-sync';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * API Route para sincronização automática de templates oficiais
 * Executado pelo CRON job diariamente
 */
export async function GET(request: Request) {
  try {
    // Verificar autorização (apenas CRON)
    const authHeader = request.headers.get('authorization');
    const isCronRequest = authHeader === `Bearer ${CRON_SECRET}`;
    
    // Permitir execução manual em desenvolvimento ou com secret correto
    if (!isCronRequest && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Executar sincronização usando a função compartilhada
    const result = await executeTemplateSync();

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          syncId: result.data?.syncId,
          timestamp: result.data?.timestamp,
          status: result.data?.status,
          templatesChecked: result.data?.templatesChecked,
          templatesUpdated: result.data?.templatesUpdated,
        },
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[SyncTemplates] Erro na sincronização:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro na sincronização' 
      },
      { status: 500 }
    );
  }
}
