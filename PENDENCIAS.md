# Pendências reais

Atualizado em **2026-08-09**. Versão publicada: **3.2.1**, esquema **11**,
em `https://waubinet.github.io/treino-hard/`.

A ficha não depende de nenhum documento externo: ela vive em `js/workouts.js` e é
travada pelos testes de conformidade.

Esta lista contém somente o que ainda **não** foi comprovado.

## Vídeos

Números extraídos de `js/workouts.js` em 2026-08-09 e travados por testes de
inventário em `tests/app.test.cjs`:

| Medida | Valor |
|---|---|
| entradas no catálogo | 41 |
| `accepted` | 27 |
| `pending` | 14 |
| `rejected` | 0 |
| com identificador do YouTube | 32 |
| sem candidato | 9 |
| `technical_guide` / `objective_demo` / `visual_reference` | 15 / 12 / 2 |
| aprovados sem metadado de revisão | 0 |

O enum do código é `accepted`, `pending` e `rejected`. A documentação usa os
mesmos nomes.

A preferência de reprodução **já está implementada** em Ajustes, com os três
modos, persistência e prévia interna restrita a `youtube-nocookie.com`. Coberta
por teste de navegador.

Ainda pendente:

- [ ] Revisar os 14 itens `pending`: 9 nunca tiveram candidato e 5 têm candidato
      registrado mas sem aprovação.
- [ ] Reavaliar `squat_free_barbell` e `mob_hamstring_seated`, rebaixados de
      `accepted` para `pending` em 09/08/2026 porque deixaram de responder
      publicamente (oEmbed 401). A revisão de conteúdo continua registrada e pode
      ser reaproveitada se voltarem.
- [ ] A curadoria dos 27 aprovados foi feita em execução anterior; ela não foi
      reconferida assistindo aos vídeos nesta auditoria.

Um vídeo que não permite incorporação **não** é o mesmo que um vídeo errado: o
catálogo separa disponibilidade (`availability`, `embedCompatible`) de qualidade
da demonstração (`classification`).

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
