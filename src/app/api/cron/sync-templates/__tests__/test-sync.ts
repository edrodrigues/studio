/**
 * Script de teste para validar a API de sincronização
 * Execute com: npx ts-node src/app/api/cron/sync-templates/__tests__/test-sync.ts
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-key-here-change-in-production';

async function testSyncEndpoint() {
  console.log('🧪 Testando endpoint de sincronização\n');

  // Teste 1: Sem autorização
  console.log('Teste 1: Acesso sem autorização');
  console.log('--------------------------------');
  try {
    const response = await fetch(`${BASE_URL}/api/cron/sync-templates`);
    console.log(`Status: ${response.status}`);
    
    if (response.status === 401) {
      console.log('✅ Corretamente rejeitado (401 Unauthorized)');
    } else {
      console.log('⚠️ Esperado 401, recebido:', response.status);
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  }

  // Teste 2: Com autorização
  console.log('\nTeste 2: Acesso com autorização');
  console.log('--------------------------------');
  try {
    const response = await fetch(`${BASE_URL}/api/cron/sync-templates`, {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });
    
    console.log(`Status: ${response.status}`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Sincronização executada com sucesso');
      console.log('Resposta:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Erro na sincronização:', data);
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  }

  console.log('\n✨ Testes concluídos!');
}

// Teste 3: Endpoint de teste
async function testSyncTestEndpoint() {
  console.log('\n🧪 Testando endpoint de teste (/api/admin/test-sync)\n');

  console.log('Teste: Executar parser manualmente');
  console.log('--------------------------------');
  try {
    const response = await fetch(`${BASE_URL}/api/admin/test-sync`);
    
    console.log(`Status: ${response.status}`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Parser executado com sucesso');
      console.log(`Total de templates: ${data.data.totalTemplates}`);
      console.log('Cache:', data.data.cacheInfo);
    } else {
      console.log('❌ Erro:', data);
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  }

  console.log('\n✨ Teste concluído!');
}

// Executar todos os testes
async function runAllTests() {
  await testSyncEndpoint();
  await testSyncTestEndpoint();
}

if (require.main === module) {
  runAllTests();
}

export { testSyncEndpoint, testSyncTestEndpoint, runAllTests };
