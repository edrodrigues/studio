import { db } from '@/lib/firebase-server';
import { parseAllFaqPages, parseFaqContent, generateContentHash } from '@/lib/faq-content-parser';
import type { FaqContent, FaqContentSync } from '@/lib/types';

const FAQ_PAGES = [
  { id: 'main', url: 'https://contratos.cin.ufpe.br/', name: 'Página Principal' },
  { id: 'faq-templates', url: 'https://contratos.cin.ufpe.br/faq-templates', name: 'FAQ - Templates' },
  { id: 'proc-interno', url: 'https://contratos.cin.ufpe.br/proc-interno', name: 'Procedimentos Internos' },
];

/**
 * Executa a sincronização de conteúdo FAQ
 * Esta função pode ser chamada tanto pelo CRON quanto por server actions
 */
export async function executeFaqSync(): Promise<{
  success: boolean;
  data?: {
    pagesChecked: number;
    pagesUpdated: number;
    status: string;
    syncId: string;
    timestamp: string;
  };
  error?: string;
}> {
  try {
    console.log('[SyncFaqContent] Iniciando sincronização de FAQ...');

    // 1. Buscar conteúdo atual das páginas FAQ
    const faqContents: FaqContent[] = [];
    const errors: string[] = [];
    
    for (const page of FAQ_PAGES) {
      try {
        console.log(`[SyncFaqContent] Processando: ${page.name}`);
        const content = await parseFaqContent(page.id);
        faqContents.push(content);
        
        // Delay entre requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        const errorMsg = `Erro ao processar ${page.name}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
        console.error(`[SyncFaqContent] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // 2. Buscar conteúdo anterior do Firestore
    const previousContents = await getPreviousContents();

    // 3. Comparar e sincronizar
    const syncResults = await syncFaqContents(faqContents, previousContents);

    // 4. Salvar log de sincronização
    const syncLog: Omit<FaqContentSync, 'id'> = {
      timestamp: new Date().toISOString(),
      status: errors.length > 0 
        ? (syncResults.pagesUpdated > 0 ? 'partial' : 'error')
        : 'success',
      pagesChecked: FAQ_PAGES.length,
      pagesUpdated: syncResults.pagesUpdated,
      errors: [...errors, ...syncResults.errors],
      changes: syncResults.changes,
    };

    const syncRef = await db.collection('faqContentSyncs').add(syncLog);

    // 5. Criar notificações para mudanças importantes
    if (syncResults.changes.length > 0) {
      await createNotifications(syncResults.changes, syncRef.id);
    }

    console.log('[SyncFaqContent] Sincronização concluída:', {
      checked: FAQ_PAGES.length,
      updated: syncResults.pagesUpdated,
      errors: errors.length + syncResults.errors.length,
      changes: syncResults.changes.length,
    });

    return {
      success: true,
      data: {
        pagesChecked: FAQ_PAGES.length,
        pagesUpdated: syncResults.pagesUpdated,
        status: syncLog.status,
        syncId: syncRef.id,
        timestamp: syncLog.timestamp,
      },
    };

  } catch (error) {
    console.error('[SyncFaqContent] Erro na sincronização:', error);
    
    // Salvar log de erro
    await db.collection('faqContentSyncs').add({
      timestamp: new Date().toISOString(),
      status: 'error',
      pagesChecked: 0,
      pagesUpdated: 0,
      errors: [error instanceof Error ? error.message : 'Erro desconhecido'],
      changes: [],
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro na sincronização',
    };
  }
}

/**
 * Busca conteúdo anterior do Firestore
 */
async function getPreviousContents(): Promise<Map<string, FaqContent>> {
  const contents = new Map<string, FaqContent>();
  
  try {
    const snapshot = await db.collection('faqContent').get();
    
    snapshot.forEach((doc) => {
      const data = doc.data() as FaqContent;
      contents.set(data.id, data);
    });
    
    console.log(`[SyncFaqContent] ${contents.size} páginas FAQ encontradas no Firestore`);
  } catch (error) {
    console.error('[SyncFaqContent] Erro ao buscar conteúdo anterior:', error);
  }
  
  return contents;
}

/**
 * Sincroniza conteúdo FAQ com o Firestore
 */
async function syncFaqContents(
  newContents: FaqContent[],
  previousContents: Map<string, FaqContent>
): Promise<{
  pagesUpdated: number;
  errors: string[];
  changes: FaqContentSync['changes'];
}> {
  let pagesUpdated = 0;
  const errors: string[] = [];
  const changes: FaqContentSync['changes'] = [];

  for (const content of newContents) {
    try {
      const previous = previousContents.get(content.id);
      
      // Verificar se precisa atualizar
      if (!previous || previous.contentHash !== content.contentHash) {
        // Salvar no Firestore
        const docRef = db.collection('faqContent').doc(content.id);
        await docRef.set(content, { merge: true });
        
        pagesUpdated++;
        
        // Registrar mudança
        changes.push({
          pageId: content.id,
          pageTitle: content.title,
          changeType: !previous ? 'content_updated' : 'structure_changed',
          oldHash: previous?.contentHash ?? '',
          newHash: content.contentHash,
        });
        
        console.log(`[SyncFaqContent] Página atualizada: ${content.title}`);
      } else {
        console.log(`[SyncFaqContent] Página sem mudanças: ${content.title}`);
      }
    } catch (error) {
      const errorMsg = `Erro ao sincronizar ${content.id}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
      console.error(`[SyncFaqContent] ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  return { pagesUpdated, errors, changes };
}

/**
 * Cria notificações para admins sobre mudanças
 */
async function createNotifications(
  changes: FaqContentSync['changes'],
  syncId: string
): Promise<void> {
  try {
    // Buscar usuários admin
    const usersSnapshot = await db.collection('users').where('role', '==', 'admin').get();
    
    if (usersSnapshot.empty) {
      console.log('[SyncFaqContent] Nenhum usuário admin encontrado para notificar');
      return;
    }

    const notifications = changes.map((change) => ({
      type: 'faq_updated' as const,
      title: 'Conteúdo FAQ Atualizado',
      message: `A página "${change.pageTitle}" foi atualizada com novas informações do site oficial.`,
      data: {
        pageId: change.pageId,
        pageTitle: change.pageTitle,
        changeType: change.changeType,
        syncId,
      },
      read: false,
      createdAt: new Date().toISOString(),
    }));

    // Criar notificação para cada admin
    const batch = db.batch();
    
    usersSnapshot.forEach((userDoc) => {
      notifications.forEach((notification) => {
        const notifRef = db.collection('notifications').doc();
        batch.set(notifRef, {
          ...notification,
          userId: userDoc.id,
        });
      });
    });

    await batch.commit();
    
    console.log(`[SyncFaqContent] ${notifications.length} notificações criadas para ${usersSnapshot.size} admins`);
  } catch (error) {
    console.error('[SyncFaqContent] Erro ao criar notificações:', error);
  }
}
