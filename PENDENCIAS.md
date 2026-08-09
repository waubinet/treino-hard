# Pendências reais

Atualizado em **2026-08-09**. Versão publicada: **3.2.2**, esquema **11**,
em `https://waubinet.github.io/treino-hard/`.

A ficha não depende de nenhum documento externo: ela vive em `js/workouts.js` e é
travada pelos testes de conformidade.

Esta lista contém somente o que ainda **não** foi comprovado.

## Vídeos

Números extraídos de `js/workouts.js` e travados por testes de inventário:

| Medida | Valor |
|---|---|
| entradas | 41 |
| `accepted` | 29 |
| `pending` | 12 |
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

- [ ] Assistir e decidir os **12 itens `pending`**: 9 sem candidato e 3 com
      candidato registrado aguardando revisão.
- [ ] Reconferir os 29 aprovados assistindo aos vídeos. A revisão registrada é de
      execução anterior; esta rodada verificou apenas disponibilidade e metadados.

**Limite honesto desta rodada:** não assisti a nenhum vídeo. Aprovar exige ver a
demonstração e conferir exercício, equipamento, pegada, posição, trajetória,
amplitude e lateralidade — e isso não foi feito aqui. Nenhum item foi promovido a
`accepted` por título, canal ou miniatura.

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
