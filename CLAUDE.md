# Treino Hard (Fofo)

Diário de treino pessoal, estático, sem servidor próprio e sem conta. Roda como PWA.

- Publicação: GitHub Pages, **branch `main`, raiz**, em `https://waubinet.github.io/treino-hard/`.
  Não há workflow do Actions; o Pages compila direto da branch. Não troque esse método.
- Branch de trabalho: `agent/v3-six-day-sessions`, integrada por fast-forward em `main`.

## Arquitetura

| Arquivo | Responsabilidade |
|---|---|
| `index.html` | casca, CSP em `<meta>`, sem manipulador inline |
| `styles.css` | tema escuro único |
| `js/workouts.js` | `THFData`: catálogo, ficha, periodização, vídeos |
| `js/core.js` | `THFCore`: normalização, migração, backup, cripto, regras |
| `js/storage.js` | `THFStorage`: IndexedDB com fallback em `localStorage` |
| `js/measurements.js` | `THFMeasurements`: métricas e silhueta |
| `js/app.js` | interface, eventos delegados, service worker |
| `sw.js` | app shell, atualização e offline |

Toda a interface é montada por `element()` com `textContent`. Nada de `innerHTML`,
nada de `on*` inline: a CSP proíbe.

## Referência visual

A referência visual canônica é `treino-hard-original-v2.2-2026-08-08/index.html`
(cópia preservada da 2.2): paleta, proporções, espaçamento, cards, abas, seletor
de semana, resumo e estados. Extraia dela apenas o **sistema visual** — a
arquitetura e o JavaScript continuam sendo os da v3.

A referência do **cartão de exercício** é a captura do card da 2.2: nome + botão
Marcar, subtítulo, selo, bloco Alvo, bloco do vídeo, cabeçalho das séries com o
alvo, ações rápidas, linhas de série (carga × reps · RIR · confirmar), "Como me
senti" recolhido e o botão de descanso em largura total. Nada de aparência de
ficha impressa, planilha, tabela horizontal ou formulário administrativo.

## Invariantes

- Aplicação local, estática, sem conta e sem servidor.
- `SCHEMA_VERSION = 11`. Só muda quando o formato gravado muda de verdade.
- `APP_VERSION`, `SCHEMA_VERSION` e o nome do cache são coisas distintas e visíveis
  em Ajustes → "Sobre esta versão".
- IndexedDB preferencial, `localStorage` como fallback, memória como último recurso.
- Migração 9 → 10 → 11 preserva ciclos legados; IDs ambíguos (`a_remada_smith`,
  `a_remada_unilateral`, `c_flexor_sentado`) **continuam ambíguos** e nunca viram
  exercício atual.
- Falha de gravação nunca aparece como sucesso.
- Conflito de revisão entre abas é detectado; a aba atrasada não sobrescreve.
- Sessões cronológicas; RIR por série; descanso por exercício; progressão dupla é
  recomendação e nunca altera carga sozinha.
- O cronômetro só inicia por ação explícita, nunca por `blur` de campo.
- Caminhada separada; vacuum em casa, fora do volume; bracing é orientação, não série.
- Silhueta é **representação comparativa aproximada**. Não é estimador de gordura,
  modelo anatômico, diagnóstico nem inferência de força.
- O service worker não recarrega a página sem confirmação do usuário.

## Ficha canônica

A ficha é **congelada** e vive em três lugares, nesta ordem de autoridade:
`js/workouts.js`, a especificação abaixo e os testes de conformidade de
`tests/app.test.cjs`. Não há dependência de nenhum documento externo.
**Não altere a ficha por preferência própria**; qualquer mudança precisa alterar
a tabela desses testes junto com o código.

```
Segunda  Empurrar A  17 séries
Terça    Puxar A     15 séries
Quarta   Pernas A    14 séries
Quinta   Empurrar B  15 séries
Sexta    Puxar B     14 séries
Sábado   Pernas B    14 séries
Domingo  descanso completo, sem meta obrigatória
```

- Supino reto e inclinado **na máquina**, nas duas exposições de peito.
- Sem stiff e sem terra romeno. Terra com barra só em Pernas B, com periodização própria.
- Remada unilateral: 2 séries **por lado**; dois registros (`side` esquerdo/direito),
  volume contado uma vez.
- Tríceps de Empurrar B: escolha entre extensão acima da cabeça e testa com halteres.
- Faixa alta opcional (elevação lateral, crucifixo invertido, panturrilhas): **12–20**.
- Descansos: compostos 120 s, agachamento/leg press 150 s, terra 180 s, isoladores 90 s.
- Mobilidade idêntica em Pernas A e B, nas duas.

## Comandos

```powershell
node --check js\workouts.js
node --check js\core.js
node --check js\storage.js
node --check js\measurements.js
node --check js\app.js
node --check sw.js
node --test tests\app.test.cjs
$env:NODE_PATH = 'C:\Users\waubi\AppData\Local\npm-cache\_npx\e41f203b7505f1fb\node_modules'
node --test tests\browser.test.cjs
```

`tests/browser.test.cjs` exige `playwright` e o Chrome local; o pacote vive fora do
repositório, por isso o `NODE_PATH`. Use `--test-reporter=tap` em execuções longas:
a suíte completa leva vários minutos e o relatório padrão fica bufferizado.

Nunca rode duas execuções da suíte de navegador ao mesmo tempo: elas competem pelo
Chrome e os cenários de concorrência falham por timeout.

## Segurança

- CSP sem `unsafe-inline` e sem `unsafe-eval`; `frame-src` só `youtube-nocookie.com`.
- Chaves `__proto__`, `prototype` e `constructor` são recusadas na importação, junto
  com profundidade acima de 20 e campos inesperados do esquema 11.
- Fórmulas do CSV são neutralizadas com apóstrofo.
- Backup criptografado: AES-GCM 256, PBKDF2-SHA-256 com **600 000** iterações em
  arquivos novos, salt e IV aleatórios, cabeçalho autenticado como AAD, formato
  versionado. Backups antigos com 310 000 iterações continuam abrindo: o número de
  iterações vem do próprio arquivo. A senha nunca é gravada, registrada nem
  incluída no arquivo. Não escreva criptografia própria.

## Fluxo de entrega

Editar → testar → corrigir → retestar → commit → integrar em `main` → push →
aguardar o Pages → abrir a URL → conferir `APP_VERSION` → smoke test no app publicado.

Ao mexer em arquivo do app shell: revise `CACHE_NAME` em `sw.js`, atualize `APP_SHELL`
e confirme que o cache antigo é removido na ativação.

Um push não é uma publicação. Confirme o build do Pages e a versão exibida na URL.

## Pendências atuais

Ver `PENDENCIAS.md`. Em resumo: parte do catálogo de vídeos segue `pending`, falta
teste com leitor de tela real e a instalação pelo prompt do sistema não foi
exercitada.
