# Testes do Sistema de Sincronização de Templates

Este diretório contém testes para validar o sistema de sincronização automática de templates oficiais.

## Testes Disponíveis

### 1. Teste do Parser (`test-parser.ts`)

Valida a extração de templates da página FAQ-Templates.

```bash
npx ts-node src/lib/__tests__/test-parser.ts
```

**O que testa:**
- ✅ Extração correta de templates
- ✅ Sistema de cache (24h TTL)
- ✅ Validação de dados (nome, link, tipo, seção)
- ✅ Agrupamento por tipo de contrato

**Saída esperada:**
```
🧪 Iniciando testes do parser de templates oficiais

Teste 1: Parser básico
------------------------
✅ Sucesso! 25 templates extraídos

📊 Distribuição por tipo:
   TED: 8 templates
   Acordo de Parceria (Lei de Inovação): 10 templates
   ...
```

### 2. Teste da API de Sincronização (`test-sync.ts`)

Valida o endpoint de sincronização e proteção por CRON secret.

```bash
# Certifique-se de que o servidor está rodando
npm run dev

# Em outro terminal
npx ts-node src/app/api/cron/sync-templates/__tests__/test-sync.ts
```

**O que testa:**
- ✅ Proteção do endpoint (401 sem autorização)
- ✅ Acesso com CRON secret
- ✅ Execução da sincronização
- ✅ Criação de logs

## Testes Manuais

### Teste 1: Parser via Browser/Postman

```bash
# Endpoint de teste (não requer autorização)
curl http://localhost:3000/api/admin/test-sync

# Resposta esperada:
{
  "success": true,
  "data": {
    "totalTemplates": 25,
    "cacheInfo": {...},
    "groupedTemplates": {...}
  }
}
```

### Teste 2: Sincronização via curl

```bash
# Com CRON secret
curl -H "Authorization: Bearer your-secret-key-here" \
  http://localhost:3000/api/cron/sync-templates

# Resposta esperada:
{
  "success": true,
  "data": {
    "syncId": "...",
    "timestamp": "...",
    "status": "success",
    "templatesChecked": 25,
    "templatesUpdated": 3,
    "errors": [],
    "changes": [...]
  }
}
```

### Teste 3: Verificar UI

1. Acesse um projeto com tipo de contrato configurado
2. Vá para a aba "Contratos"
3. Verifique os badges de status nos templates:
   - 🟢 **Sincronizado**: Template atualizado com versão oficial
   - 🟡 **Atualização Pendente**: Nova versão disponível
   - 🔴 **Erro**: Falha na sincronização
   - ⚪ **Aguardando Sync**: Ainda não sincronizado

4. Passe o mouse sobre o badge para ver detalhes

### Teste 4: Notificações

1. Execute a sincronização manualmente
2. Verifique se notificações foram criadas no Firestore:
   ```
   Coleção: notifications
   Filtro: type = "template_updated"
   ```
3. Verifique o dropdown de notificações no header

### Teste 5: CRON Job

Para testar o CRON job (simulação):

```bash
# O CRON está configurado para rodar diariamente às 6h
# Verifique os logs do Vercel para confirmar execução
```

## Validação de Dados

### Templates Oficiais Esperados

| Tipo de Contrato | Quantidade Esperada |
|-----------------|---------------------|
| TED | ~8 templates |
| Acordo de Parceria (Lei de Inovação) | ~10 templates |
| Acordo de Parceria (Embrapii) | ~10 templates |
| Contrato de Extensão Tecnológica | ~5 templates |

**Total esperado: ~25-35 templates**

### Verificação no Firestore

Após sincronização, verifique:

```javascript
// Templates atualizados
db.collection('contractModels')
  .where('syncStatus', '==', 'synced')
  .get()

// Logs de sincronização
db.collection('officialTemplateSyncs')
  .orderBy('timestamp', 'desc')
  .limit(5)
  .get()

// Notificações criadas
db.collection('notifications')
  .where('type', '==', 'template_updated')
  .orderBy('createdAt', 'desc')
  .get()
```

## Troubleshooting

### Parser retorna 0 templates

- Verifique se a URL está acessível
- Confirme se a estrutura HTML da página mudou
- Verifique os logs de erro

### Sincronização falha

1. Verifique se CRON_SECRET está configurado
2. Confirme permissões do Firestore
3. Verifique logs no Vercel

### Cache não funciona

- Cache é mantido em memória (reinicia com deploy)
- TTL padrão: 24 horas
- Para invalidar: POST /api/admin/test-sync

## Checklist de Validação

- [ ] Parser extrai templates corretamente
- [ ] Cache funciona (segunda chamada é mais rápida)
- [ ] Endpoint protegido por CRON secret
- [ ] Sincronização atualiza templates no Firestore
- [ ] Logs são criados em officialTemplateSyncs
- [ ] Notificações são criadas para admins
- [ ] Badges de status aparecem na UI
- [ ] Tooltips mostram informações corretas
- [ ] Dropdown de notificações funciona
