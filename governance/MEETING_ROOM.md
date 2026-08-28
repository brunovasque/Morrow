# Sala de reunião governada

A sala de reunião existe para resolver ambiguidade durante um contrato sem transformar conversa entre agentes em mudança silenciosa de escopo.

## Quando abrir

Qualquer papel pode pedir uma reunião quando:

- o material recebido contradiz evidência observada;
- uma instrução admite mais de uma leitura razoável;
- uma dependência necessária não ficou clara;
- um diagnóstico parece insuficiente para executar com segurança;
- dois papéis chegam a conclusões incompatíveis;
- surge uma dúvida que pode bloquear a etapa.

Achado lateral sem relação com o objetivo NÃO abre reunião para consertá-lo: vira achado/débito.

## Participantes

- **Orchestrator é obrigatório** e preside a reunião.
- entra o papel que levantou a dúvida;
- entra o papel/fonte capaz de responder com evidência;
- outros papéis entram somente se necessários.

Exemplo: Executor questiona uma causa medida → Executor + Diagnostician + Orchestrator.

## Papel do Orchestrator

O Orchestrator:

1. declara a pergunta exata antes do debate;
2. mantém o contrato e o objetivo visíveis;
3. impede que a conversa vire brainstorming fora do escopo;
4. exige evidência quando a questão for factual;
5. separa decisão de rota de decisão de destino;
6. registra o que ficou decidido, por quem e com qual prova;
7. cobra que a decisão seja refletida no mapa/memória viva antes de continuar;
8. escala ao dono quando a resposta exigir autoridade sobre destino, escopo, dinheiro, comportamento externo, segurança ou outro ponto reservado.

## Saídas possíveis

Toda reunião termina em exatamente uma:

- `CLARIFIED` — ambiguidade resolvida sem mudar o destino; mapa/pedido é atualizado e a execução segue;
- `DIAGNOSTIC_REQUIRED` — falta evidência; o Diagnostician recebe objetivo read-only e a etapa espera;
- `OWNER_DECISION_REQUIRED` — depende de autoridade do dono; execução bloqueada nesse ponto;
- `DEBT_RECORDED` — o tema é real, mas está fora do objetivo ativo; registra-se e volta-se ao contrato;
- `CONTRACT_CONFLICT` — a solução proposta mudaria o destino/critério contratado; não executar sem adendo aprovado ou novo contrato.

## Registro obrigatório

Cada reunião produz um registro append-only com:

- `meeting_id`;
- `contract_id` e `map_step`;
- pergunta de abertura;
- participantes e papéis;
- fatos/evidências apresentados;
- posições relevantes, sem transformar opinião em fato;
- decisão final do Orchestrator;
- artefato/mapa/pergunta/débito afetado;
- responsável pela ação seguinte;
- data/hora;
- classificação da dúvida: `PREFLIGHT_MISS | EMERGENT_UNKNOWN | EXECUTION_CONFLICT`.

## Relação com aprendizado

Uma dúvida classificada como `PREFLIGHT_MISS` entra obrigatoriamente na retrospectiva. O Supervisor verifica qual pergunta, papel, checklist ou gate poderia tê-la antecipado.

## Independência de revisão

Reviewer e Auditor não recebem automaticamente debates e hipóteses do Executor. A sala não pode destruir a independência deles.

Se Reviewer/Auditor abrirem uma reunião por achado próprio, recebem apenas o contexto necessário para resolver a pergunta. A conclusão anterior de outro papel continua sendo hipótese até conferência independente.

## Regra central

Reunião resolve **dúvida de execução**. Ela não cria licença para mudar **o que foi contratado**.