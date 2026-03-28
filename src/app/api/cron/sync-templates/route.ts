import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-server';
import { parseOfficialTemplates } from '@/lib/official-templates-parser';
import type { OfficialTemplate, Template, OfficialTemplateSync } from '@/lib/types';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * API Route para sincronização automática de templates oficiais
 * Executado pelo CRON job diariamente ou manualmente via admin
 */
export async function GET(request: Request) {
  try {
    // Verificar autorização (apenas CRON ou admin)
    const authHeader = request.headers.get('authorization');
    const isCronRequest = authHeader === `Bearer ${CRON_SECRET}`;
    
    // Permitir execução manual em desenvolvimento ou com secret correto
    if (!isCronRequest && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[SyncTemplates] Iniciando sincronização...');

    // 1. Buscar templates oficiais
    const officialTemplates = await parseOfficialTemplates();
    
    // 2. Buscar templates locais do Firestore
    const templatesSnapshot = await db.collection('contractModels').get();
    const localTemplates: Template[] = [];
    templatesSnapshot.forEach((doc) => {
      localTemplates.push({ id: doc.id, ...doc.data() } as Template);
    });

    // 3. Comparar e sincronizar
    const syncResults = await syncTemplates(officialTemplates, localTemplates);

    // 4. Salvar log de sincronização
    const syncLog: Omit<OfficialTemplateSync, 'id'> = {
      timestamp: new Date().toISOString(),
      status: syncResults.errors.length > 0 
        ? (syncResults.templatesUpdated > 0 ? 'partial' : 'error')
        : 'success',
      templatesChecked: officialTemplates.length,
      templatesUpdated: syncResults.templatesUpdated,
      errors: syncResults.errors,
      changes: syncResults.changes,
    };

    const syncRef = await db.collection('officialTemplateSyncs').add(syncLog);

    // 5. Criar notificações para mudanças importantes
    if (syncResults.changes.length > 0) {
      await createNotifications(syncResults.changes, syncRef.id);
    }

    console.log('[SyncTemplates] Sincronização concluída:', {
      checked: officialTemplates.length,
      updated: syncResults.templatesUpdated,
      errors: syncResults.errors.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        syncId: syncRef.id,
        ...syncLog,
      },
    });

  } catch (error) {
    console.error('[SyncTemplates] Erro na sincronização:', error);
    
    // Salvar log de erro
    await db.collection('officialTemplateSyncs').add({
      timestamp: new Date().toISOString(),
      status: 'error',
      templatesChecked: 0,
      templatesUpdated: 0,
      errors: [error instanceof Error ? error.message : 'Erro desconhecido'],
      changes: [],
    });

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro na sincronização' 
      },
      { status: 500 }
    );
  }
}

/**
 * Sincroniza templates oficiais com templates locais
 */
async function syncTemplates(
  official: OfficialTemplate[],
  local: Template[]
): Promise<{
  templatesUpdated: number;
  errors: string[];
  changes: OfficialTemplateSync['changes'];
}> {
  let templatesUpdated = 0;
  const errors: string[] = [];
  const changes: OfficialTemplateSync['changes'] = [];

  // Agrupar templates oficiais por tipo de contrato
  const groupedOfficials = groupByContractType(official);

  // Para cada grupo de tipo de contrato
  for (const [contractType, officials] of Object.entries(groupedOfficials)) {
    // Encontrar templates locais do mesmo tipo
    const localsOfType = local.filter(
      (t) => t.contractTypes?.includes(contractType)
    );

    // Para cada template oficial
    for (const officialTemplate of officials) {
      try {
        // Tentar encontrar template local correspondente
        const matchingLocal = findMatchingTemplate(officialTemplate, localsOfType);

        if (matchingLocal) {
          // Verificar se precisa atualizar
          const needsUpdate = checkIfNeedsUpdate(officialTemplate, matchingLocal);
          
          if (needsUpdate) {
            // Atualizar template local
            await updateTemplate(officialTemplate, matchingLocal);
            templatesUpdated++;
            
            changes.push({
              templateId: matchingLocal.id,
              templateName: matchingLocal.name,
              changeType: 'link_updated',
              oldValue: matchingLocal.googleDocLink,
              newValue: officialTemplate.documentLink,
            });
          }
        } else {
          // Template não existe localmente - pode criar novo (opcional)
          console.log(`[SyncTemplates] Template não encontrado localmente: ${officialTemplate.documentName}`);
          
          // Se quiser criar automaticamente, descomente:
          // await createNewTemplate(officialTemplate);
          // templatesUpdated++;
          // changes.push({...});
        }
      } catch (error) {
        const errorMsg = `Erro ao processar ${officialTemplate.documentName}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
        console.error('[SyncTemplates]', errorMsg);
        errors.push(errorMsg);
      }
    }
  }

  return { templatesUpdated, errors, changes };
}

/**
 * Agrupa templates oficiais por tipo de contrato
 */
function groupByContractType(
  templates: OfficialTemplate[]
): Record<string, OfficialTemplate[]> {
  return templates.reduce((acc, template) => {
    if (!acc[template.contractType]) {
      acc[template.contractType] = [];
    }
    acc[template.contractType].push(template);
    return acc;
  }, {} as Record<string, OfficialTemplate[]>);
}

/**
 * Encontra template local correspondente ao template oficial
 */
function findMatchingTemplate(
  official: OfficialTemplate,
  locals: Template[]
): Template | undefined {
  // Estratégia: comparar por nome similar
  const officialName = normalizeName(official.documentName);
  
  return locals.find((local) => {
    const localName = normalizeName(local.name);
    
    // Verificar se nomes são similares
    return (
      localName.includes(officialName) ||
      officialName.includes(localName) ||
      calculateSimilarity(localName, officialName) > 0.6
    );
  });
}

/**
 * Verifica se template precisa ser atualizado
 */
function checkIfNeedsUpdate(
  official: OfficialTemplate,
  local: Template
): boolean {
  // Verificar se link mudou
  if (local.googleDocLink !== official.documentLink) {
    return true;
  }

  // Verificar se nunca foi sincronizado
  if (!local.lastOfficialSync) {
    return true;
  }

  return false;
}

/**
 * Atualiza template local com dados do oficial
 */
async function updateTemplate(
  official: OfficialTemplate,
  local: Template
): Promise<void> {
  const updateData = {
    googleDocLink: official.documentLink,
    officialSourceUrl: official.documentLink,
    lastOfficialSync: new Date().toISOString(),
    syncStatus: 'synced' as const,
    syncError: undefined,
    updatedAt: new Date().toISOString(),
  };

  await db.collection('contractModels').doc(local.id).update(updateData);
  
  console.log(`[SyncTemplates] Template atualizado: ${local.name}`);
}

/**
 * Cria notificações para admins sobre mudanças
 */
async function createNotifications(
  changes: OfficialTemplateSync['changes'],
  syncId: string
): Promise<void> {
  // Buscar usuários admin
  const usersSnapshot = await db.collection('users').where('role', '==', 'admin').get();
  
  const notifications = changes.map((change) => ({
    type: 'template_updated' as const,
    title: 'Template Atualizado',
    message: `O template "${change.templateName}" foi atualizado automaticamente com a versão oficial.`,
    data: {
      templateId: change.templateId,
      templateName: change.templateName,
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
  
  console.log(`[SyncTemplates] ${notifications.length} notificações criadas`);
}

/**
 * Normaliza nome para comparação
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
    .trim();
}

/**
 * Calcula similaridade entre duas strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calcula distância de Levenshtein
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}
