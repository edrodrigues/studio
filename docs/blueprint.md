# **App Name**: Assistente de Contratos V-Lab

## Core Features:

- Upload de Documentos: Permitir o upload de Plano de Trabalho, Termo de Execução e Planilha de Orçamento para a geração do contrato.
- Geração de Contrato por IA: Utilizar a API do Google Gemini (gemini-2.5-pro) para gerar uma minuta de contrato completa em Markdown a partir dos documentos de base.  The prompt used includes structuring a contract. It structures based on the provided tools, specifically plan of work, execution term, and budget spreadsheets.
- Gerenciamento de Modelos: Criar, editar, visualizar e excluir modelos de contrato com destaque de variáveis (ex: {{NOME_DA_VARIAVEL}}).
- Editor de Contrato: Permitir a edição do contrato com visualização em tempo real do Markdown renderizado e destaque de variáveis.
- Geração e Exportação de Contratos: Listar contratos preenchidos e permitir sua visualização e exportação para os formatos MD e DOCX.
- Preenchimento Assistido por IA: Oferecer um assistente Gemini no editor de contrato para responder perguntas contextuais sobre as cláusulas ou o contrato (gemini-2.5-flash com googleSearch). The model used to answer questions is a tool to reason based on current data
- Auto-save no LocalStorage: Salvar automaticamente o progresso de preenchimento do contrato no localStorage para evitar perda de dados.

## Style Guidelines:

- Primary color: Dark corporate green (#004d40) for main titles, important icons, and highlight elements.
- Secondary color: Bright green (#4caf50) for CTAs, active states, links, and highlighting variables in contracts.
- Accent color: Accent green (#2e7d32) for :hover states of primary buttons.
- Neutral background: Light gray (#f5f7fa) for the main application background.
- Base background: White (#ffffff) for cards, modals, and headers.
- Dark text: Dark gray (#1f2937) for most of the text.
- Light text: Medium gray (#6b7280) for descriptions, placeholders, and help text.
- Danger color: Red (#e53e3e) for deletion buttons and alert messages.
- Font: 'Inter' (sans-serif). Use font weights (400, 500, 600, 700) to differentiate titles, subtitles, and body text. Note: currently only Google Fonts are supported.
- Use a set of SVG icons in the "outline" style (contour), clean and consistent throughout the application.
- Employ a professional, clean, organized, and reliable style with generous spacing, rounded borders, and subtle shadows for a clear visual hierarchy.
- Use subtle animations during contract generation and when transitioning between sections.