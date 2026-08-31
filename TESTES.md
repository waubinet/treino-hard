# Plano e evidências de teste

## Estado da versão 3.5.1

Validado localmente em **2026-08-31**, esquema persistido **12**, cache
`treino-hard-v3.5.1`. A evidência pública será preenchida depois que o commit
funcional for integrado em `main`, publicado pelo GitHub Pages e testado com
cache-busting.

Resultados do gate local:

- sintaxe de `js/workouts.js`, `js/core.js`, `js/storage.js`,
  `js/measurements.js`, `js/app.js`, `sw.js` e do teste de navegador: **aprovada**;
- `manifest.webmanifest`: **JSON válido**;
- `git diff --check`: **aprovado**, sem erro de whitespace;
- `node --test tests/app.test.cjs`: **82/82 aprovados**;
- `node --test tests/browser.test.cjs`: **52/52 aprovados**
  em Google Chrome real via Playwright, **0 falhas**, exit code 0;
- suíte completa de navegador: **674.259,166 ms**;
- erros de console/página aceitos: **0**;
- smoke público: **pendente até a publicação desta candidata**.

## Ambiente e comandos

| Item | Valor |
|---|---|
| sistema | Windows, PowerShell |
| navegador | Google Chrome local controlado pelo Playwright |
| app | estático, servido em `127.0.0.1` por porta efêmera |
| dados | IndexedDB; testes explícitos de `localStorage` e somente leitura |
| branch validada | `codex/3.5.1-mobile-migration` |
| commit-base | `a1f7d07b1a74c732b2c6e3007cddafc3833e2060` |
| commit funcional publicado | pendente |
| URL pública | `https://waubinet.github.io/treino-hard/` |

```powershell
node --check js\workouts.js
node --check js\core.js
node --check js\storage.js
node --check js\measurements.js
node --check js\app.js
node --check sw.js
node --test --test-reporter=tap tests\app.test.cjs
$env:NODE_PATH = 'C:\Users\waubi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node --test --test-reporter=tap tests\browser.test.cjs
```

Nunca execute duas suítes Playwright ao mesmo tempo. O harness bloqueia service
workers por padrão para os testes de aplicação e os habilita explicitamente nos
casos offline/PWA, reduzindo acúmulo de sockets sem retirar a cobertura real.

## Cobertura comprovada

Os 82 testes de núcleo cobrem catálogo e ficha canônica, periodização,
progressão dupla, comparabilidade por máquina/variação/lado/faixa, migrações,
limites sem truncamento silencioso, IDs únicos, documentos corrompidos,
recuperação, staging, concorrência, snapshots, backups, criptografia,
prototype pollution, CSV, medidas, silhueta, inventário brasileiro de vídeos,
degrau configurável por aparelho e volume direto/secundário por músculo.

Os 52 cenários em Chrome cobrem:

- início, pausa, retomada, finalização parcial/completa, reabertura, cancelamento
  e remarcação, incluindo duração e pausa acumulada;
- modos calendário e sequência, semanas, deload, arquivamento e continuidade;
- carga, repetições, RIR, confirmação explícita, status, foco, rolagem,
  descanso, desfazer, histórico por máquina, degrau personalizado e séries adversas;
- caminhada, vacuum, medidas bilaterais, ciclos, volume muscular, evolução sem
  fragmentação por faixa, JSON, CSV,
  snapshots, backups comuns e criptografados;
- corrupção, importação hostil, esquema futuro, duas abas, queda de IndexedDB,
  falha de quota e ausência total de persistência em modo somente leitura;
- XSS, CSP, teclado, ARIA, contraste WCAG AA, 320–1280 px, zoom de 200%,
  texto ampliado e movimento reduzido;
- manifesto, ícones, zona maskable, funcionamento offline, atualização de cache,
  falha do service worker, migração da versão 2.2 e confirmação durável da
  atualização 3.4/esquema 11 antes do backup inicial;
- ficha canônica dos seis treinos e política de vídeo em pt-BR de criador/canal
  brasileiro com proveniência verificada.

## Limites ainda manuais

- leitor de tela real (NVDA, JAWS ou Narrador);
- instalação pelo prompt nativo `beforeinstallprompt` em perfil limpo;
- importação de um backup real do usuário, depois de guardar cópia externa;

Esses itens não são contados como aprovados pela suíte local.
