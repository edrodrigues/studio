import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-server';
import { parseAllFaqPages, parseFaqContent, generateContentHash } from '@/lib/faq-content-parser';
import type { FaqContent, FaqContentSync } from '@/lib/types';

const FAQ_PAGES = [
  { id: 'main', url: 'https://contratos.cin.ufpe.br/', name: 'Página Principal' },
  { id: 'faq-templates', url: 'https://contratos.cin.ufpe.br/faq-templates', name: 'FAQ - Templates' },
  { id: 'proc-interno', url: 'https://contratos.cin.ufpe.br/proc-interno', name: 'Procedimentos Internos' },
];

/**
 * Endpoint de teste para sincronização manual de FAQ
 * Permite executar o sync manualmente para desenvolvimento
 * 
 * Uso: curl http://localhost:3000/api/admin/test-faq-sync
 */
export async function GET(request: Request) {
  try {
    console.log('[TestFaqSync] Iniciando sincronização de teste...');

    const results: {
      pageId: string;
      pageName: string;
      success: boolean;
      contentLength: number;
      sectionsCount: number;
      error?: string;
    }[] = [];

    // Testar cada página
    for (const page of FAQ_PAGES) {
      try {
        console.log(`[TestFaqSync] Testando: ${page.name}`);
        const content = await parseFaqContent(page.id);
        
        results.push({
          pageId: page.id,
          pageName: page.name,
          success: true,
          contentLength: content.content.length,
          sectionsCount: content.sections.length,
        });

        console.log(`[TestFaqSync] ✓ ${page.name}: ${content.content.length} caracteres, ${content.sections.length} seções`);
        
        // Delay entre requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`[TestFaqSync] ✗ ${page.name}: ${errorMsg}`);
        
        results.push({
          pageId: page.id,
          pageName: page.name,
          success: false,
          contentLength: 0,
          sectionsCount: 0,
          error: errorMsg,
        });
      }
    }

    // Verificar se existe conteúdo no Firestore
    const firestoreSnapshot = await db.collection('faqContent').get();
    const firestoreContent = firestoreSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      message: 'Teste de sincronização FAQ concluído',
      timestamp: new Date().toISOString(),
      results,
      firestore: {
        documentsCount: firestoreSnapshot.size,
        documents: firestoreContent.map((doc: any) => ({
          id: doc.id,
          title: doc.title,
          url: doc.url,
          contentLength: doc.content?.length || 0,
          sectionsCount: doc.sections?.length || 0,
          lastSyncedAt: doc.lastSyncedAt,
          syncStatus: doc.syncStatus,
        })),
      },
      nextSteps: [
        'Execute o CRON real em /api/cron/sync-faq-content para salvar no Firestore',
        'Verifique o ALEX respondendo perguntas sobre FAQ',
        'Monitore notificações para admins sobre mudanças',
      ],
    });

  } catch (error) {
    console.error('[TestFaqSync] Erro:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro no teste' 
      },
      { status: 500 }
    );
  }
}
