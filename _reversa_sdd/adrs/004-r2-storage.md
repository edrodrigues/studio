# ADR-004: Cloudflare R2 como storage primário de documentos

**Status:** Aceito  
**Data:** 2026-04-26 a 2026-04-29  
**Fonte:** Commits `b5407c2`, `6608dac`, `96d2adf`  
**Decisores:** Ed

## Contexto

Firebase Storage tem custos elevados de egress para documentos grandes. R2 oferece S3-compatible storage com zero egress fees, ideal para PDFs e documentos jurídicos.

## Decisão

Adotar Cloudflare R2 como storage primário para documentos de projeto:
- Presigned URLs para upload/download seguros
- `ProjectDocumentsUploader` component com integração R2
- `storageProvider` field em `ProjectDocument` para migração gradual
- `migrateToR2()` function para migrar docs existentes do Firebase Storage
- Presigned PUT URLs com expiration de 1h, GET com 15min

## Alternativas Consideradas

1. **Manter Firebase Storage** — Mais simples, mas custos crescentes.
2. **AWS S3** — Mais features, mas mais caro. R2 é 100% S3-compatible com preços menores.
3. **Supabase Storage** — Similar pricing, mas menos maduro.

## Consequências

### Positivas
- Zero egress fees — economia significativa
- S3-compatible — SDK maduro do AWS
- Presigned URLs — segurança de upload/download sem expor credentials

### Negativas
- AWS SDK v3 CRC32 checksum incompatível com R2 — requer desabilitar (`6608dac`)
- Presigned URLs expiram — UX precisa lidar com refresh
- Migração gradual necessária — coexistência de dois providers
