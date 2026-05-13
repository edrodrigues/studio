# User Story: Onboarding e Autenticação

## Persona
**Advogado Junior** — Primeiro acesso à plataforma V-Lab. Precisa criar conta e entender o fluxo básico.

## História
```
Como um novo usuário,
Quero criar uma conta e fazer login de forma segura,
Para que eu possa acessar meus projetos e documentos com confiança.
```

## Critérios de Aceitação

### Cenário 1: Cadastro com email/senha
```gherkin
Dado que estou na página de autenticação
Quando insiro um email válido e senha com 6+ caracteres
E clico em "Criar Conta"
Então minha conta é criada no Firebase Auth
E sou redirecionado para o dashboard
E recebo email de verificação
```

### Cenário 2: Login com email/senha
```gherkin
Dado que já tenho uma conta verificada
Quando insiro meu email e senha corretos
E clico em "Entrar"
Então sou autenticado via Firebase Auth
E sou redirecionado para a página de projetos
```

### Cenário 3: Login social (Google)
```gherkin
Dado que estou na página de autenticação
Quando clico em "Continuar com Google"
E autorizo o acesso à minha conta Google
Então sou autenticado via Google OAuth
E meu perfil é criado com dados do Google
E sou redirecionado para o dashboard
```

### Cenário 4: Reset de senha
```gherkin
Dado que esqueci minha senha
Quando clico em "Esqueceu a senha?"
E insiro meu email cadastrado
Então recebo um email com link de reset
E ao clicar no link, posso definir uma nova senha
```

### Cenário 5: Validação de formulário
```gherkin
Dado que estou preenchendo o formulário de cadastro
Quando deixo o email em branco ou com formato inválido
Então uma mensagem de erro é exibida
E o botão de submit permanece desabilitado
```

## Regras de Negócio Relacionadas
- **RB-Au-001:** Senha mínima de 6 caracteres
- **RB-Au-002:** Email de verificação enviado após cadastro
- **RB-Au-003:** Login social via Google OAuth
- **RB-Au-004:** Sessão persistida via Firebase Auth state

## Métricas de Sucesso
- Taxa de conversão de cadastro: > 60%
- Tempo médio para primeiro login: < 2 minutos
- Taxa de erro de autenticação: < 5%

## Rastreabilidade
| SDD | Módulo | Arquivo |
|-----|--------|---------|
| `sdd/auth.md` | Auth | `src/components/auth/auth-forms.tsx` |
| `sdd/auth.md` | Auth | `src/context/auth-context.tsx` |
| `sdd/auth.md` | Auth | `src/components/auth/ProtectedRoute.tsx` |
