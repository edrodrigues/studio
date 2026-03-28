/**
 * Script de teste para validar o parser de templates oficiais
 * Execute com: npx ts-node src/lib/__tests__/test-parser.ts
 */

import { parseOfficialTemplates, invalidateCache, getCacheInfo } from '../official-templates-parser';

async function runTests() {
  console.log('🧪 Iniciando testes do parser de templates oficiais\n');

  // Teste 1: Parser básico
  console.log('Teste 1: Parser básico');
  console.log('------------------------');
  try {
    const templates = await parseOfficialTemplates();
    console.log(`✅ Sucesso! ${templates.length} templates extraídos`);
    
    // Agrupar por tipo
    const byType = templates.reduce((acc, t) => {
      acc[t.contractType] = (acc[t.contractType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\n📊 Distribuição por tipo:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} templates`);
    });

    // Mostrar primeiros 3 templates
    console.log('\n📝 Primeiros 3 templates:');
    templates.slice(0, 3).forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.documentName}`);
      console.log(`      Tipo: ${t.contractType}`);
      console.log(`      Link: ${t.documentLink.substring(0, 50)}...`);
      console.log(`      Seção: ${t.faqSection}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Falha no parser:', error);
    process.exit(1);
  }

  // Teste 2: Cache
  console.log('\nTeste 2: Sistema de cache');
  console.log('------------------------');
  try {
    const cacheInfo1 = getCacheInfo();
    console.log('Cache após primeira chamada:', cacheInfo1);

    // Segunda chamada (deve usar cache)
    const start = Date.now();
    await parseOfficialTemplates();
    const duration = Date.now() - start;
    
    console.log(`✅ Segunda chamada usou cache (${duration}ms)`);
    
    const cacheInfo2 = getCacheInfo();
    console.log('Cache após segunda chamada:', cacheInfo2);

    // Invalidar cache
    invalidateCache();
    const cacheInfo3 = getCacheInfo();
    console.log('Cache após invalidação:', cacheInfo3);

  } catch (error) {
    console.error('❌ Falha no teste de cache:', error);
  }

  // Teste 3: Validação de dados
  console.log('\nTeste 3: Validação de dados');
  console.log('------------------------');
  try {
    const templates = await parseOfficialTemplates();
    
    const errors: string[] = [];
    
    templates.forEach((t, i) => {
      if (!t.documentName || t.documentName === 'Documento sem nome') {
        errors.push(`Template ${i}: Nome vazio ou genérico`);
      }
      if (!t.documentLink || !t.documentLink.includes('docs.google.com')) {
        errors.push(`Template ${i}: Link inválido ou não é Google Doc`);
      }
      if (!t.contractType) {
        errors.push(`Template ${i}: Tipo de contrato vazio`);
      }
      if (!t.faqSection) {
        errors.push(`Template ${i}: Seção FAQ vazia`);
      }
    });

    if (errors.length === 0) {
      console.log('✅ Todos os templates têm dados válidos');
    } else {
      console.log(`⚠️ ${errors.length} problemas encontrados:`);
      errors.forEach(e => console.log(`   - ${e}`));
    }

  } catch (error) {
    console.error('❌ Falha na validação:', error);
  }

  console.log('\n✨ Testes concluídos!');
}

// Executar se for chamado diretamente
if (require.main === module) {
  runTests();
}

export { runTests };
