# STATE OF ART — runtimes por cota / 2026-08-28

## Objetivo

Não implementar adapters de Codex/Claude por memória ou por flags antigas. Registrar somente o que foi conferido antes da implementação específica.

## Codex

Fontes consultadas:
- OpenAI Help — Using Codex with your ChatGPT plan: https://help.openai.com/en/articles/11369540/
- repositório oficial `openai/codex`, CLI/exec e issues recentes.

Achados:
- Codex CLI pode autenticar com conta ChatGPT e consumir os limites/franquia do plano;
- `/status` em sessão ativa é a superfície documentada para consultar situação de uso quando disponível;
- o projeto oficial expõe `codex exec` como modo não-interativo;
- model/effort são conceitos configuráveis no ecossistema Codex atual;
- há issue recente aberta relatando hang de `codex exec` em ambiente não-TTY ao ler stdin, inclusive em automação.

### Consequência Morrow

O adapter específico de Codex NÃO deve herdar por suposição o transporte de prompt via stdin do `ProcessRuntimeAdapter` genérico. Devemos testar a versão real instalada e escolher transporte/PTY/app-server suportado que não bloqueie.

O Quota Guard não deve inventar consumo restante quando a CLI não fornecer informação estruturada confiável.

## Claude Code

Fontes consultadas:
- Anthropic Claude Code CLI reference: https://docs.anthropic.com/en/docs/claude-code/cli-usage
- Anthropic Claude Code getting started/authentication: https://docs.anthropic.com/en/docs/claude-code/getting-started

Achados:
- Claude Code pode autenticar via Claude App com plano Pro/Max;
- `claude -p`/`--print` fornece modo não-interativo;
- CLI expõe seleção de modelo, output estruturado, max turns, resume/continue e controles de ferramentas/permissão;
- a família atual de modelos usa effort configurável e o nível deve ser tratado como capability do runtime/modelo, não hardcoded pelo papel.

### Consequência Morrow

Claude Code é candidato natural ao primeiro adapter quota-session real porque o padrão subprocess/non-interactive já foi exercido na arquitetura de origem. Ainda assim, o Morrow deve implementar adapter próprio e medir versão atual, autenticação, effort e permissões em vez de copiar código legado inteiro.

## Regra

`ProcessRuntimeAdapter` é infraestrutura comum, não adapter de provider.

Cada provider/runtime específico deve provar:
1. autenticação por cota realmente ativa;
2. modo não-interativo confiável;
3. transporte de prompt sem truncamento/hang;
4. model e effort efetivamente aplicados;
5. permissões/capabilities efetivas;
6. saída completa/estruturada;
7. timeout e kill;
8. comportamento quando cota termina;
9. retomada de sessão quando suportada;
10. ausência de fallback silencioso para API.
