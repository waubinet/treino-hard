# Pendências reais

## Auditoria 3.6.4 — 2026-09-18

- O catálogo atual permanece com 46/46 entradas aprovadas em português por criadores/canais brasileiros. Supino inclinado, remada unilateral, posterior sentado e bracing deixaram de depender de demonstrações apenas aproximadas.
- Metadados públicos e recortes foram corrigidos para desenvolvimento na máquina, remada sentada, crossover e voador inverso.
- Novos vídeos cuja incorporação não foi confirmada são classificados de modo conservador como `external_only`: continuam acessíveis pelo botão do YouTube, sem prévia interna enganosa.
- A tabela numérica mais abaixo e as seções 3.6.0–3.6.2 são registros históricos, não descrevem o catálogo atual.
- Limites manuais restantes: testar em iPhone físico, leitor de tela real e instalação nativa em perfil limpo. Nenhum deles autoriza limpar dados locais.

## Curadoria 3.6.2 — 2026-09-17

- Quatro entradas adicionais foram aprovadas após inspeção visual individual: supino reto na máquina, extensão acima da cabeça com halter, remada sentada em máquina com apoio e remada articulada com apoio.
- Os vídeos são de Laércio Refundini ou Leandro Twin, em português do Brasil, com origem documentada nas páginas oficiais dos criadores. O inventário local passa a 24 aprovados e 22 pendentes.
- Supino inclinado na máquina, remada unilateral e remada articulada sem apoio continuam pendentes: os candidatos encontrados ainda não satisfazem simultaneamente correspondência visual, proveniência brasileira documentada e teste de incorporação.

## Ajuste 3.6.1 validado localmente — 2026-09-17

- Corda e remada unilateral foram corrigidas para três séries; os planos de teste ainda não iniciados passam a receber a ficha nova mesmo se houver campos preenchidos. Gate local: 124/124 de lógica e 60/60 em Chrome.

## Verificação de 2026-09-16

### Ajuste de 2026-09-17 — aquecimento e séries em aparelhos

- Na revisão 3.6.0, os aparelhos bilaterais passaram a três séries, mas corda e remada unilateral ainda tinham duas; isso motivou a correção 3.6.1 descrita acima.
- Terra e acessórios com peso livre mantêm suas prescrições próprias. Na semana 8/deload, a redução temporária para até duas séries continua intencional.
- Os primeiros exercícios mantêm aquecimento: 3 no supino reto, 2 nas puxadas, 3 no agachamento e 3 no terra. O leg press conserva 1 aquecimento adicional.
- Na 3.6.1, qualquer sessão ainda planejada recebe a ficha atual; preenchimentos de teste ainda não iniciados são descartados. Sessões iniciadas ou terminais continuam protegidas.
- Validação de lógica após a mudança: 124/124 testes passaram. Suíte completa de navegador e publicação ainda precisam terminar antes de declarar a versão pública atualizada.

- A versão 3.6.1 concluiu o gate local e foi publicada; a rodada 3.6.2 mantém as mesmas regras de ficha e acrescenta somente a curadoria descrita acima.
- Corrigido localmente o primeiro exercício de Empurrar B (3 registros de aquecimento) e Puxar B (2 registros opcionais), espelhando a exposição A. Não aumentam as séries de trabalho nem o volume principal. Retratos históricos não foram alterados.
- Vídeos locais: 20 aprovados e 26 pendentes. Além das três aprovações de 2026-09-07, a revisão individual aprovou mesa flexora, cadeira flexora, tríceps testa com halteres, puxadas supinada/neutra em recortes distintos, tríceps corda e rosca direta com barra W. Reprodução incorporada confirmou estado 1 no IFrame Player API. Não confundir aprovação local com disponibilidade pública.
- Ainda necessário validar recortes no app, concluir curadoria restante, oferecer atualização segura de sessões futuras vazias e concluir a suíte completa antes da publicação.

## Pedido de 2026-09-07 — crossover para voador

- Ficha local alterada: `machine_fly` substitui `cable_crossover` em Empurrar A, com 2 séries e 90 s. Rótulo Voador (peck deck) nas duas exposições de peito. Catálogo legado e registros existentes não foram renomeados.
- Candidato brasileiro: Treino em FOCO, `6Jis3DZBSYU`, 18:15, vinculado pela página oficial https://www.treinoemfoco.com.br/peck-deck-como-executar/ . Reprodução e trechos visuais de apoio/ajuste/trajetória conferidos; ainda **pending**, sem alegar revisão integral ou incorporação validada.
- Foto recebida em 2026-09-07 confirma pegadores nas mãos, sem apoio nos antebraços. Candidato do Treino em FOCO substituído por `FzCnfD0gOXo` (Leandro Twin), ainda pendente. Fila dos demais exercícios em `REVISAO-VIDEOS-2026-09-07.md`.
- 122/122 testes de lógica passaram após trocar a ficha; suíte de navegador e publicação seguem pendentes. A alteração do catálogo vale para novas sessões; planejar aplicação explícita nas sessões futuras vazias sem alterar as já executadas.

## Rodada 3.6.0 em revisão — 2026-09-06

- Implementação local do esquema 13 e acompanhamento independente dos lados. Não publicada enquanto a suíte completa e a revisão final não encerrarem.
- Inventário atual: **46 entradas, 10 aprovadas, 36 pendentes**. Cinco entradas unilaterais novas aguardam fonte brasileira/pt-BR e inspeção visual exata; nenhuma foi aprovada por título ou reutilização de vídeo bilateral.
- A revisão não equivale a teste em iPhone físico nem a avaliação clínica. Não usar limpar dados/reinstalar como etapa de atualização.
- Resultados desta rodada serão consolidados no topo de `TESTES.md` e `RELATORIO-FINAL.md`.

## Registro da publicação anterior

Atualizado em **2026-08-31**. Versão **3.5.1**, esquema **12**, publicada em
`https://waubinet.github.io/treino-hard/`. O commit funcional
`6834706a33236ecedacb27524aad204ed238ad74` recebeu status `built` no GitHub
Pages e passou no smoke público, incluindo a reprodução da migração 11 → 12.

A ficha não depende de nenhum documento externo: ela vive em `js/workouts.js` e é
travada pelos testes de conformidade.

Esta lista contém somente o que ainda **não** foi comprovado.

## Vídeos

Números extraídos de `js/workouts.js` e travados por testes de inventário:

| Medida | Valor |
|---|---|
| entradas | 41 |
| `accepted` | 10 |
| `pending` | 31 |
| `rejected` | 0 |
| `available` | 30 |
| `external_only` | 2 |
| `removed_or_private` | 0 |
| sem candidato (`unknown`) | 9 |
| aprovados sem metadado | 0 |

Disponibilidade foi verificada com o IFrame Player API em 2026-08-09; não depende
mais de `oEmbed` isolado. A preferência de reprodução e o comportamento de
`external_only` estão cobertos por teste de navegador.

Ainda pendente:

- [ ] Assistir e decidir os **31 itens `pending`**: 9 sem candidato e 22 com
      candidato registrado ainda pendente ou incompatível com a política atual.
- [ ] Reconferir os 10 aprovados assistindo aos vídeos. A revisão registrada é de
      execução anterior; esta rodada verificou apenas disponibilidade e metadados.

**Limite honesto desta rodada:** não assisti a nenhum vídeo. Aprovar exige ver a
demonstração e conferir exercício, equipamento, pegada, posição, trajetória,
amplitude e lateralidade — e isso não foi feito aqui. Nenhum item foi promovido a
`accepted` por título, canal ou miniatura.

## Evolução e volume

- [ ] Revisar futuramente o mapa de músculos primários/secundários se a ficha
      canônica mudar. A versão 3.5.1 exibe participação secundária separada e não
      afirma equivalência biológica com série direta.

## Acessibilidade

- [ ] Teste com leitor de tela real (NVDA, JAWS ou Narrador), conferindo ordem de leitura e anúncios das regiões vivas.

Já coberto por teste automatizado: teclado completo nas abas (setas, Home, End, Enter,
Espaço, Tab e Shift+Tab), retenção cíclica de foco no modal em ambos os sentidos,
Escape com retorno ao acionador, papéis, `aria-selected`, `aria-controls` sem
referência quebrada, `aria-labelledby`, regiões vivas, contraste medido em nove abas,
zoom equivalente a 200%, texto ampliado e movimento reduzido.

## PWA

- [ ] Instalar pelo prompt do sistema em perfil limpo e conferir a aparência instalada
      (o `beforeinstallprompt` não é disparado em Chrome headless).

Já coberto: manifesto, ícones 192/512/maskable com dimensões e MIME conferidos, zona
segura do maskable medida pixel a pixel, service worker controlando a página, uso
offline completo, atualização entre duas versões de cache com confirmação do usuário,
remoção do cache antigo, descarte de cache incompleto e atualização a partir da 2.2
instalada com preservação do histórico legado.

## Dados

- [ ] Executar a importação de um backup real do usuário, mantendo cópia externa antes.

Já coberto: ida e volta do JSON pela interface, CSV com as 27 colunas, backup
criptografado com senha correta, incorreta, ciphertext adulterado, IV alterado, salt
alterado e truncamento, importações hostis e de esquema futuro, prototype pollution,
cópias automáticas restauradas, recuperação bruta exportada, conflito de revisão entre
abas, fallback para `localStorage` e falha de gravação por quota.

## Documentação

- [ ] Atualizar `CURADORIA-DE-VIDEOS.md` somente depois que houver vídeo assistido.
