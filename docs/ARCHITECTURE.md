# Arquitetura inicial

## Camadas

### 1. Kernel
Controla estado, transições, permissões, execução, budgets, retries, gates e encerramento.

### 2. Papéis
Definem responsabilidades operacionais. Papel é identidade canônica independente do fornecedor do modelo.

### 3. Skills
Pacotes de conhecimento, critérios, heurísticas e ferramentas especializados. Skills nunca controlam transições do kernel.

### 4. Adapters de modelo
Camada substituível para Anthropic, OpenAI, Google e outros provedores.

### 5. Contratos
O contrato define o destino. O mapa de execução define a rota. Cada etapa precisa de critério verificável.

### 6. Memória
- memória do contrato: fatos e decisões daquela execução;
- memória do papel: padrões relevantes ao papel;
- memória institucional: aprendizados promovidos após validação.

### 7. Supervisor de aprendizado
Roda no fechamento. Procura repetição e propõe somente três tipos de mudança: REGRA, REMOÇÃO ou CERCA. Não promove aprendizado sozinho.

## Regra de promoção de aprendizado

`observação -> candidato -> validação -> promovido`

Nenhuma conclusão de um único agente entra diretamente na memória institucional.
