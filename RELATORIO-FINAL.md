# Relatório final

**Estado: publicado e verificado.** Versão do app **3.1.0**, esquema **11**, commit
`b877d1f`, em `https://waubinet.github.io/treino-hard/` (GitHub Pages, branch `main`).

## Resultado desta execução

- **3.1.0**: identidade visual da 2.2 restaurada sobre a arquitetura da v3 —
  paleta rosa/preto, largura de 760 px, oito semanas como botões, resumo
  unificado, abas em cápsula, exercícios como cartões com borda por categoria e
  séries com carga/reps/RIR em destaque. Nenhuma funcionalidade foi removida e o
  esquema continua 11.

- Ficha sincronizada com a versão canônica aprovada: remada unilateral registrada por
  lado, tríceps de Empurrar B com as duas execuções e faixa alta corrigida para 12–20.
- Cinco defeitos corrigidos, dois deles impediam o uso normal do aplicativo:
  Pernas A e Pernas B não abriam, e o service worker recarregava a página sozinho.
- Backup criptografado por senha implementado com Web Crypto.
- Cópias automáticas e recuperação bruta passaram a existir na interface.
- Ícones 192, 512 e maskable criados a partir da logo, com zona segura medida.
- Versão do app visível em Ajustes e no rodapé, separada do esquema e do cache.
- 34 testes de núcleo e 26 cenários em Chrome real, todos aprovados.
- Smoke test no app publicado: 41 verificações, nenhuma falha, zero erros de console.
- Caminho de atualização de quem tem a 2.2 instalada verificado ponta a ponta, com
  preservação do histórico legado.

## O que continua pendente

O PDF da ficha canônica não pôde ser lido: é um placeholder do iCloud e o provedor de
arquivos não está em execução. Quatro colunas da comparação seguem sem confronto com a
fonte original — aquecimentos, variações extras, variação padrão do agachamento e
orientação técnica. Os 34 vídeos continuam sem curadoria: nenhum foi assistido e
nenhum foi aprovado. Falta um teste com leitor de tela real e a instalação pelo prompt
do sistema. Detalhes em `PENDENCIAS.md`.

---

## Estado do relatório

**Revisado em 2026-08-08.** A versão local passou em **20/20 testes de núcleo** e **1/1 cenário integrado em Chrome real**. A publicação ainda não foi realizada. Curadoria audiovisual, ícones 192/`maskable`, criptografia por senha e os procedimentos manuais discriminados em `PENDENCIAS.md` continuam abertos; este relatório não os apresenta como concluídos.

## Resumo executivo

A reforma substitui o arquivo monolítico por uma estrutura estática modular e introduz seis treinos semanais, sessões cronológicas, RIR por série, descansos por exercício, progressão dupla, caminhada e rotina em casa separadas, armazenamento no esquema 11 e migração de dados legados. O catálogo de vídeos foi deliberadamente colocado em estado pendente: nenhum candidato foi assistido nesta execução e nenhum link incorreto será apresentado como instrução confiável.

A validação local combinou funções puras, persistência/migração em ambiente isolado e um fluxo real em Chrome. O cenário de navegador percorreu abas, foco, modal, início do treino, série, timer, desfazer, responsividade e reload offline sem registrar erro de console ou página.

O projeto continua pessoal, estático, sem conta e sem servidor próprio. Ele não é diagnóstico, não substitui acompanhamento profissional e não garante segurança universal de exercício, perda de peso ou reconstrução anatômica.

## Estado inicial

O estado inicial detalhado está em `AUDITORIA-INICIAL.md`. Em síntese, o app anterior concentrava interface, dados e lógica em um HTML extenso, usava três IDs internos ABC com rótulos históricos trocados, vinculava registros a oito semanas × duas ocorrências, aplicava regras uniformes e continha links de vídeo não comprovados. O armazenamento principal era `localStorage` no esquema 9.

## Arquivos

### Criados durante a reforma

- `styles.css`;
- módulos locais em `js/`;
- `AUDITORIA-INICIAL.md`;
- `CURADORIA-DE-VIDEOS.md`;
- `MIGRACAO-DE-DADOS.md`;
- `TESTES.md`;
- `CHANGELOG.md`;
- `RELATORIO-FINAL.md`;
- `PENDENCIAS.md`;
- `exemplo-backup-v11.json`;
- `exemplo-registros-v11.csv`;
- `tests/browser.test.cjs`.

### Modificados

- `index.html`;
- `manifest.webmanifest` e `sw.js`;
- `tests/app.test.cjs`.

### Preservados

- `logo.png`;
- histórico do Git;
- cópia original exigida: **verificação final pendente**.

Nenhum arquivo deve ser considerado removido até a revisão do diff final.

## Treino

O catálogo em `js/workouts.js` define:

| Dia | Treino | Séries de trabalho planejadas |
|---|---|---:|
| segunda | Empurrar A | 17 |
| terça | Puxar A | 15 |
| quarta | Pernas A | 14 |
| quinta | Empurrar B | 15 |
| sexta | Puxar B | 14 |
| sábado | Pernas B | 14 |
| domingo | descanso completo planejado | 0 |

Pernas A e B incluem a sequência original de quatro mobilidades/alongamentos antes do trabalho. O catálogo novo não inclui stiff. O levantamento terra tem esquema próprio. Bracing aparece como orientação integrada; vacuum fica na rotina em casa e caminhada em módulo separado.

Os totais, a ordem semanal, o domingo sem treino, a mobilidade, a ausência do stiff, os supinos em máquina, a periodização, o deload e as chaves separadas passaram na suíte de núcleo. Chrome exibiu as 13 abas e iniciou uma sessão de Empurrar A. Fluxos de sessão não exercitados permanecem descritos em `TESTES.md`.

## Periodização

O código contém oito semanas por categoria:

- compostos superiores: 12–15 até 6–8, com RIR planejado, seguido de deload;
- agachamento/leg press: 12–15 até 8–10, sem obrigação de 6–8;
- acessórios: faixas moderadas, com opção 15–20 onde configurada;
- levantamento terra: 2 séries com faixas de 6–8 a 4–6 e no mínimo 2 RIR na semana mais pesada; deload próprio.

A progressão dupla apenas recomenda aumentar, manter ou revisar; ela não muda a carga automaticamente. Os ramos de topo da faixa, manutenção, abaixo do mínimo, dor, RIR ausente e deload passaram na suíte de núcleo. Em Chrome, carga, repetições e RIR foram preenchidos em uma série real.

Referências científicas prioritárias fornecidas para revisão:

- [ACSM — posição de 2026 sobre prescrição do treinamento resistido](https://acsm.org/science-spotlight-acsm-releases-new-position-stand-on-resistance-training/)
- [PMID 41343037 — volume e frequência](https://pubmed.ncbi.nlm.nih.gov/41343037/)
- [PMID 38970765 — proximidade da falha](https://pubmed.ncbi.nlm.nih.gov/38970765/)
- [PMID 36334240 — falha e hipertrofia](https://pubmed.ncbi.nlm.nih.gov/36334240/)
- [PMID 39205815 — intervalos entre séries](https://pubmed.ncbi.nlm.nih.gov/39205815/)
- [PMID 38595233 — divisões de treino](https://pubmed.ncbi.nlm.nih.gov/38595233/)
- [PMID 37582807](https://pubmed.ncbi.nlm.nih.gov/37582807/) e [PMID 37535335](https://pubmed.ncbi.nlm.nih.gov/37535335/) — máquinas e pesos livres
- [PMID 34757594](https://pubmed.ncbi.nlm.nih.gov/34757594/) e [PMID 35476184](https://pubmed.ncbi.nlm.nih.gov/35476184/) — treinamento concorrente
- [PMID 21659901](https://pubmed.ncbi.nlm.nih.gov/21659901/) e [PMID 26642915](https://pubmed.ncbi.nlm.nih.gov/26642915/) — alongamento antes do exercício

As regras do app são uma configuração pessoal, não uma afirmação de superioridade universal.

## Dados e compatibilidade

O esquema 11 normaliza sessões, séries, cardio, rotina em casa, medidas, progressões, ciclos legados, arquivos, logs e quarentena. IndexedDB é preferido e `localStorage` é fallback. O código prevê snapshots, até três cópias automáticas e detecção de conflito por revisão.

As migrações 9→10→11 existem. Depois de uma lacuna detectada na leitura inicial, a implementação passou a converter metadados antigos de sessão, ciclos arquivados e até três cópias automáticas legadas, mantendo também a fonte bruta na recuperação. Os testes passaram para duas ocorrências, aliases, ambiguidades, IDs desconhecidos/estáveis, metadados, arquivos, cópias automáticas e fonte bruta. Ainda é prudente importar um backup real do usuário somente depois de guardar uma cópia externa; esse procedimento manual continua em `PENDENCIAS.md`.

## Vídeos

| Métrica | Quantidade confirmada |
|---|---:|
| candidatos novos cadastrados | 34 |
| referências legadas encontradas | 42 ocorrências / 37 IDs únicos |
| assistidos nesta execução | 0 |
| aceitos | 0 |
| substituídos | 0 |
| rejeitados após revisão | 0 |
| pendentes | todos |

O estado pendente é intencional. Título, miniatura e comentário do código não bastam para confirmar equipamento, pegada ou execução. Consulte `CURADORIA-DE-VIDEOS.md`.

## PWA

O projeto possui manifesto, logo e service worker. O cache inclui os módulos locais no app shell e mantém conteúdo externo, inclusive YouTube, fora do cache. No teste com Chrome real, o service worker controlou a página, o app recarregou offline, exibiu aviso de conectividade e permaneceu utilizável, sem console/page errors. Existe apenas um ícone 512×512 com finalidade `any`; ainda faltam um ícone 192×192 e uma arte `maskable`. Instalação pelo prompt, atualização de uma versão já publicada e verificação da URL pública permanecem pendentes.

Referências: [MDN — Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) e [web.dev — atualização de PWA](https://web.dev/learn/pwa/update/).

## Segurança e privacidade

O código inclui CSP, scripts locais, validação por whitelist, rejeição de chaves perigosas, limites de dados, neutralização de fórmulas CSV, URLs externas sem acesso à aba de origem e aviso de armazenamento não criptografado. A suíte bloqueou prototype pollution, profundidade excessiva e esquema futuro sem sobrescrita, e validou staging/conflito de revisão e proteção de fórmulas. O Browser integrado encontrou 0 manipuladores inline, 0 controles sem rótulo e 0 errors/warnings. Injeção de texto pela interface e CSP com um futuro vídeo aprovado ainda exigem teste manual. Backup criptografado por senha não foi implementado.

Referência: [OWASP — HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html).

## Acessibilidade

A marcação usa tablist, tabs/panels dinâmicos, regiões vivas, link de salto, foco do conteúdo e modais. Chrome confirmou uma única tab selecionada/focável, roving tabindex, ArrowRight + Enter, fechamento do modal por Escape e retorno ao acionador. As larguras 320, 360, 430 e 1280 px não tiveram overflow horizontal global. O Browser integrado encontrou 0 IDs duplicados e 0 controles sem rótulo. Home/End/Espaço, leitor de tela real, contraste medido, zoom 200%, movimento reduzido e fluxos completos em cada largura continuam pendentes.

Referências: [WAI-ARIA APG — Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) e [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

## Testes

Os 71 critérios exigidos estão estruturados em `TESTES.md`, com estados `PASSOU`, `PARCIAL` ou `PENDENTE` conforme a evidência. Resultados finais atuais:

- sintaxe: 6/6 arquivos aprovados por `node --check`;
- `node --test tests\app.test.cjs`: **20 testes, 20 aprovados, 0 falhas**;
- `node --test tests\browser.test.cjs`: **1 cenário, 1 aprovado, 0 falhas**, em Google Chrome 151.0.7922.77;
- navegador automatizado: 13 abas, teclado parcial, modal/foco, treino/série/timer/desfazer, 4 larguras, PWA/offline e 0 console/page errors;
- Browser integrado: 0 errors/warnings, seis sessões novas, formulários de caminhada/vacuum, medidas e silhueta sem `NaN`/`Infinity`, 0 IDs duplicados, 0 handlers inline e 0 controles sem rótulo;
- exemplos: backup v11 aceito pelo normalizador e CSV com 4 linhas × 27 colunas.

O teste de navegador está em `tests/browser.test.cjs`. As lacunas manuais não foram absorvidas pelos números acima.

## Pendências

As pendências reais estão em `PENDENCIAS.md`. As bloqueantes atuais são:

1. assistir e classificar individualmente os vídeos efetivamente usados, ou manter todos pendentes;
2. criar os ícones 192×192/`maskable`;
3. decidir e, se necessário, implementar corretamente o backup criptografado por senha;
4. concluir os fluxos manuais listados em `TESTES.md`, incluindo importação real e estados restantes de sessão;
5. revisar diff, cópia original e integridade;
6. registrar o commit final;
7. publicar e então verificar URL pública, instalação, cache e atualização.

## Critério de encerramento

A versão local possui evidência automatizada consistente, mas ainda não é correto dizer “tudo concluído”: a curadoria está em 0 assistidos/0 aceitos e a publicação não ocorreu. O encerramento de liberação exige decidir as pendências, produzir um commit imutável e comparar a versão pública ao mesmo artefato aprovado localmente.
