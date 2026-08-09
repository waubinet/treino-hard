# Plano e evidências de teste

## Estado

Documento inicial criado e atualizado em **2026-08-08**. Há duas suítes aprovadas no estado local atual: **20/20 testes de núcleo** e **1/1 cenário integrado em Chrome real**. O que não foi coberto por essas evidências continua pendente ou parcial; publicação e curadoria audiovisual não foram presumidas.

Legenda:

- `PENDENTE`: ainda não executado ou sem evidência anexada;
- `PASSOU`: executado com procedimento e evidência registrados;
- `PARCIAL`: a parte descrita na evidência passou, mas o procedimento completo ainda tem etapas pendentes;
- `FALHOU`: falha reproduzida e ainda aberta;
- `CORRIGIDO/RETESTAR`: correção aplicada, mas reteste final pendente;
- `N/A JUSTIFICADO`: inaplicável com justificativa técnica explícita.

## Ambiente a registrar

| Item | Valor |
|---|---|
| commit testado | worktree local anterior ao commit final; publicação pendente |
| URL/local | servidor HTTP efêmero em `127.0.0.1`, criado por `tests/browser.test.cjs` |
| navegador e versão | Google Chrome 151.0.7922.77 via Playwright, executável local |
| sistema/tela | Windows; viewports 320×800, 360×800, 430×800 e 1280×800 |
| service worker/cache | permitido no contexto; página controlada e recarregada offline |
| data/hora | 2026-08-08 |
| executor | Node `node:test`, Playwright + Chrome e inspeção no Browser integrado |

## Rodadas executadas

```powershell
node --check js\workouts.js
node --check js\core.js
node --check js\storage.js
node --check js\measurements.js
node --check js\app.js
node --check sw.js
node --test tests\app.test.cjs
$env:NODE_PATH = '<diretório node_modules do runtime fornecido pelo Codex>'
node --test tests\browser.test.cjs
```

Resultados observados:

- sintaxe: **6/6 arquivos aprovados**;
- declarações de função nomeadas duplicadas dentro do mesmo módulo: **0**;
- `tests/app.test.cjs`: **20 testes, 20 aprovados, 0 reprovados**;
- `tests/browser.test.cjs`: **1 cenário, 1 aprovado, 0 reprovados**, em Chrome real;
- console/page errors no cenário automatizado: **0**;
- Browser integrado: **0 errors e 0 warnings**; seis sessões novas presentes; formulários de caminhada e vacuum presentes; medidas e silhueta sem `NaN`/`Infinity`; IDs duplicados: 0; manipuladores inline: 0; controles sem rótulo: 0;
- `exemplo-backup-v11.json`: normalizado e reempacotado pelo núcleo com uma sessão, uma medição e um registro legado reconhecido;
- `exemplo-registros-v11.csv`: aberto com 4 registros e 27 colunas, de acordo com o cabeçalho do exportador atual.

## Automatizados e inspeção estrutural

| # | Teste | Procedimento mínimo | Estado | Evidência |
|---:|---|---|---|---|
| 1 | Sintaxe JavaScript | `node --check` em cada arquivo de `js/` e `sw.js` | PASSOU | 6/6 arquivos, saída 0 |
| 2 | Funções duplicadas | busca estrutural/lint e inspeção de globais | PASSOU | varredura das declarações nomeadas: 0 duplicadas dentro do mesmo módulo |
| 3 | IDs duplicados | parsear HTML e conferir unicidade | PASSOU | Browser integrado: 0 IDs duplicados |
| 4 | Imports quebrados | carregar todos os scripts/folhas referenciados | PASSOU | Chrome carregou as 13 abas; service worker controlou a página |
| 5 | Recursos ausentes | comparar URLs locais do HTML, manifesto e cache com o disco | PARCIAL | shell principal carregou e funcionou offline; ícones 192/maskable continuam ausentes |
| 6 | Erros do console | abrir app limpo e executar os fluxos principais | PASSOU | Chrome: 0 console/page errors; Browser integrado: 0 errors/warnings |
| 7 | Escape de conteúdo | inserir caracteres HTML/script em notas e reabrir | PENDENTE | — |
| 8 | Importação maliciosa | testar chaves proibidas, excesso de profundidade e campos inesperados | PARCIAL | núcleo bloqueou prototype pollution e profundidade excessiva; fluxo UI e todos os campos inesperados ainda pendentes |
| 9 | Valores inválidos | datas, números, enumerações e tamanhos fora dos limites | PARCIAL | datas/medidas/RIR inválidos cobertos no núcleo; limites globais ainda pendentes |
| 10 | Limites de armazenamento | arquivo acima do limite e falha/quota do armazenamento | PENDENTE | — |

## Treinos e periodização

| # | Teste | Procedimento mínimo | Estado | Evidência |
|---:|---|---|---|---|
| 11 | Seis treinos | renderizar Empurrar/Puxar/Pernas A e B | PASSOU | catálogo 6/6; Chrome exibiu as 13 abas |
| 12 | Ordem semanal | segunda a sábado na ordem especificada | PASSOU | teste automatizado do calendário |
| 13 | Domingo | confirmar descanso completo, sem meta obrigatória | PASSOU | teste automatizado sem treino no índice 0 |
| 14 | Mobilidades das pernas | mesma sequência, ordem e prescrição em A e B | PASSOU | comparação automatizada de Pernas A/B |
| 15 | Ausência do stiff | busca nos dados novos e interface; aceitar somente histórico legado rotulado | PASSOU | catálogo novo sem ocorrência de stiff |
| 16 | Supinos em máquinas | reto e inclinado presentes em A e B; barra não padrão | PASSOU | teste automatizado das duas exposições |
| 17 | Terra com esquema próprio | validar semanas 1–8 e ausência de recomendação de falha | PASSOU | progressão própria e deload cobertos no núcleo |
| 18 | RIR | opções, campo opcional e sinalização de ausência | PASSOU | oito semanas, `5+` e ausência retornando revisão |
| 19 | Progressão dupla | topo, faixa válida, abaixo do mínimo, dor/técnica, deload | PASSOU | todos os ramos descritos cobertos no núcleo |
| 20 | Descanso individual | padrões de 90/120/150/180 s e personalizado | PARCIAL | padrões e início explícito cobertos; valor personalizado não exercitado |
| 21 | Deload | séries/faixas/RIR por categoria na semana 8 | PASSOU | redução de séries e RIR alto testados |
| 22 | Exercício legado | histórico preservado e não adicionado à ficha atual | PASSOU | migração conserva reconhecidos/ambíguos como legado |
| 23 | Variações separadas | agachamento, flexora, panturrilha, remada e máquinas | PASSOU | chave comparável varia por exercício, variação, máquina, lado e faixa |

## Sessões

| # | Teste | Procedimento mínimo | Estado | Evidência |
|---:|---|---|---|---|
| 24 | Iniciar | criar/iniciar sessão com timestamps coerentes | PASSOU | Chrome iniciou Empurrar A e liberou registro por série |
| 25 | Pausar | pausar e conferir duração acumulada | PENDENTE | — |
| 26 | Concluir | concluir sessão e persistir status/horário | PENDENTE | — |
| 27 | Parcial | concluir parcialmente sem marcar exercícios ausentes como feitos | PENDENTE | — |
| 28 | Pular | registrar decisão sem fingir execução | PENDENTE | — |
| 29 | Remarcar | preservar origem e nova data | PARCIAL | modal abriu, fechou por Escape e devolveu foco; confirmação da nova data não foi executada |
| 30 | Recuperar | recarregar durante sessão e restaurar estado | PENDENTE | — |
| 31 | Mudar semana | alterar semana com confirmação/registro adequado | PENDENTE | — |
| 32 | Não avançar indevidamente | sessão pendente continua pendente no modo sequência | PENDENTE | — |

## Dados e exportação

| # | Teste | Procedimento mínimo | Estado | Evidência |
|---:|---|---|---|---|
| 33 | Salvamento | editar série e confirmar revisão/persistência | PARCIAL | Chrome registrou carga/repetições/RIR, concluiu e desfez a série; comparação após novo contexto não foi feita |
| 34 | Recarregamento | fechar/abrir e comparar documento | PARCIAL | reload online/offline passou; igualdade completa do documento não foi comparada |
| 35 | Exportação JSON | validar envelope e reimportar arquivo exportado | PARCIAL | exemplo v11 passou pelo normalizador e `buildBackup`; clique/exportação/importação UI ainda pendente |
| 36 | Exportação CSV | conferir campos, UTF-8, separador e proteção de fórmula | PARCIAL | `csvCell` passou ataques; exemplo com 4 linhas/27 colunas; download UI ainda pendente |
| 37 | Importação atual | prévia, snapshot, confirmação e resultado | PENDENTE | — |
| 38 | Migração | esquemas 9→10→11, aliases, ambíguos e fonte bruta | PASSOU | 9→10→11, duas ocorrências, aliases, ambíguos, metadados, arquivos, IDs desconhecidos/estáveis e fonte bruta cobertos |
| 39 | Snapshot | criação antes de operação destrutiva | PENDENTE | — |
| 40 | Desfazer | restaurar snapshot e conferir integridade | PENDENTE | — |
| 41 | Backup automático | criação diária, limite de três e restauração | PARCIAL | importação de até três cópias automáticas antigas sem apagar a fonte passou; ciclo diário/restauração UI ainda pendente |
| 42 | Dado corrompido | não sobrescrever e disponibilizar recuperação | PARCIAL | esquema futuro preservado e enviado à recuperação; corrupção geral ainda pendente |
| 43 | Medidas | esquerda/direita, validação e histórico | PASSOU | normalização/histórico/assimetria no núcleo; Browser integrado sem `NaN`/`Infinity` |
| 44 | Caminhada | salvar todos os estados/campos e relacionar sessão | PARCIAL | formulário presente no Browser integrado; salvamento de todos os estados não exercitado |
| 45 | Vacuum | salvar fora do volume/gráficos de musculação | PARCIAL | formulário separado presente; persistência e exclusão dos gráficos ainda não exercitadas |

## Vídeos

Nenhum vídeo foi assistido nesta execução. Portanto, testes 46–49 de links candidatos não podem passar ainda; o comportamento esperado por enquanto é `pending`.

| # | Teste | Procedimento mínimo | Estado | Evidência |
|---:|---|---|---|---|
| 46 | Link disponível | abrir cada candidato | PENDENTE | nenhum candidato aprovado |
| 47 | Exercício correspondente | assistir e comparar exercício/equipamento/pegada/trajetória | PENDENTE | nenhum vídeo assistido |
| 48 | Embed | testar `youtube-nocookie.com` após aprovação | PENDENTE | — |
| 49 | Abrir externamente | testar URL aprovada em nova aba | PENDENTE | — |
| 50 | Offline | interface textual funciona e informa necessidade de internet | PARCIAL | app recarregou offline com aviso; candidato de vídeo não foi aberto |
| 51 | Vídeo pendente | card não quebra e não bloqueia conclusão | PASSOU | Chrome concluiu série com card de vídeo pendente |
| 52 | Classificação correta | comparar selo com cobertura registrada | PENDENTE | — |

## PWA

| # | Teste | Procedimento mínimo | Estado | Evidência |
|---:|---|---|---|---|
| 53 | Instalação | instalar em Chromium com perfil limpo | PARCIAL | service worker controlou contexto limpo; instalação standalone pelo prompt não foi executada |
| 54 | Manifesto | DevTools e validação de campos/ícones | PARCIAL | JSON válido e 512×512 existente; auditoria DevTools e ícones adicionais pendentes |
| 55 | Ícones | 404, dimensões e exibição instalada | PENDENTE | apenas 512×512 `any`; faltam 192×192 e `maskable` |
| 56 | Cache | app shell completo e nenhuma página externa | PASSOU | service worker controlou a página e o shell recarregou offline; origens externas não entram no cache |
| 57 | Offline | recarregar, registrar e consultar histórico sem rede | PARCIAL | reload e consulta visual com aviso passaram; novo registro offline não foi exercitado |
| 58 | Atualização | publicar nova versão e acionar atualização controlada | PENDENTE | — |
| 59 | Cache antigo | confirmar remoção após ativação | PENDENTE | — |
| 60 | Mensagem de falha | simular erro de registro/cache e verificar aviso | PENDENTE | — |

Referências: [MDN — Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) e [web.dev — PWA update](https://web.dev/learn/pwa/update/).

## Acessibilidade e responsividade

| # | Teste | Procedimento mínimo | Estado | Evidência |
|---:|---|---|---|---|
| 61 | Teclado | Tab, setas, Home, End, Enter, Espaço e Escape | PARCIAL | ArrowRight, Enter e Escape passaram; Tab/Home/End/Espaço não foram exercitados |
| 62 | Leitor de tela | nomes, estados, regiões vivas e ordem | PARCIAL | 0 controles sem rótulo e roles/nomes acessíveis no Browser; leitor de tela real pendente |
| 63 | Foco | foco visível e retorno após ações/modais | PARCIAL | retorno ao botão Remarcar passou; foco visível em todos os controles não foi auditado |
| 64 | Modal | retenção de foco, Escape e retorno ao acionador | PARCIAL | Escape e retorno de foco passaram; ciclo completo da retenção de foco não foi exercitado |
| 65 | Contraste | medir combinações de texto/controles | PENDENTE | — |
| 66 | Texto ampliado | zoom 200% e opção interna | PENDENTE | — |
| 67 | Movimento reduzido | `prefers-reduced-motion` | PENDENTE | — |
| 68 | Tela 320 px | fluxo completo sem perda/rolagem lateral indevida | PARCIAL | sem overflow horizontal global; fluxo completo não repetido nesta largura |
| 69 | Tela 360 px | fluxo completo | PARCIAL | sem overflow horizontal global; fluxo completo não repetido nesta largura |
| 70 | Tela 430 px | fluxo completo | PARCIAL | sem overflow horizontal global; fluxo completo não repetido nesta largura |
| 71 | Desktop | fluxo completo e navegação por teclado | PASSOU | 1280 px: tabs, modal, início, série, timer, desfazer e offline; 0 erros |

Referências: [WAI-ARIA APG — Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) e [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

## Modelo de evidência

Para converter um item em `PASSOU` ou `FALHOU`, registrar:

```text
Teste:
Data/hora:
Commit:
Ambiente:
Preparação:
Passos:
Resultado esperado:
Resultado observado:
Console/rede:
Artefato (captura/log):
Estado:
Correção/reteste:
```
