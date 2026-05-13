# ADR-006: FAQ sync para base de conhecimento ALEX

**Status:** Aceito  
**Data:** 2026-03-29 a 2026-04-03  
**Fonte:** Commits `567b637`, `53248ec`, `c467f17`  
**Decisores:** Ed

## Contexto

Chatbot ALEX precisa de base de conhecimento atualizada com FAQ oficial da V-LAB. Conteúdo FAQ muda com frequência e precisa ser sincronizado automaticamente.

## Decisão

Implementar FAQ sync automatizado:
- Firebase Admin para scraping server-side de páginas FAQ
- Cheerio para parse HTML
- Content hash (`contentHash`) para detectar mudanças
- CRON semanal (`/api/cron/sync-faq-content`)
- `FaqContentParser` com caching para performance
- Google AI File Search store para indexação de documentos

## Alternativas Consideradas

1. **FAQ hardcoded no frontend** — Desatualizado rapidamente.
2. **API REST do site oficial** — Não disponível.
3. **Google Sheets como CMS** — Adicionaria camada de gestão manual.

## Consequências

### Positivas
- ALEX sempre com conteúdo atualizado
- Hash detection evita re-indexação desnecessária
- Firestore rules impedem edição client-side (`allow create: if false`)

### Negativas
- Scraping HTML frágil
- Firebase Admin requer server-side (não roda no client)
- Google AI File Search indexing pode ter delays
