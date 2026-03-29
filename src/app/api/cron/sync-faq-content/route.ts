import { NextResponse } from 'next/server';
import { executeFaqSync } from '@/lib/faq-sync';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * API Route para sincronização automática de conteúdo FAQ
 * Executado pelo CRON job semanalmente
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
    const result = await executeFaqSync();

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          syncId: result.data?.syncId,
          timestamp: result.data?.timestamp,
          status: result.data?.status,
          pagesChecked: result.data?.pagesChecked,
          pagesUpdated: result.data?.pagesUpdated,
        },
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[SyncFaqContent] Erro na sincronização:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro na sincronização' 
      },
      { status: 500 }
    );
  }
}
