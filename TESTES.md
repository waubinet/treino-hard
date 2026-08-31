# Plano e evidências de teste

## Estado da versão 3.4.0

Validado localmente em **2026-08-30**, esquema persistido **11**, cache
`treino-hard-v3.4.0`. No momento desta atualização documental, o commit ainda
não havia sido integrado em `main` nem confirmado no GitHub Pages.

Resultados do gate local:

- sintaxe de `js/workouts.js`, `js/core.js`, `js/storage.js`,
  `js/measurements.js`, `js/app.js`, `sw.js` e do teste de navegador: **aprovada**;
- `manifest.webmanifest`: **JSON válido**;
- `git diff --check`: **aprovado**, sem erro de whitespace;
- `node --test --test-reporter=tap tests/app.test.cjs`: **78/78 aprovados**;
- `node --test --test-reporter=tap tests/browser.test.cjs`: **50/50 aprovados**
  em Google Chrome real via Playwright, **0 falhas**, exit code 0;
- suíte completa de navegador: **831.593,5065 ms**;
- erros de console/página aceitos: **0**.

## Ambiente e comandos

| Item | Valor |
|---|---|
| sistema | Windows, PowerShell |
| navegador | Google Chrome local controlado pelo Playwright |
| app | estático, servido em `127.0.0.1` por porta efêmera |
| dados | IndexedDB; testes explícitos de `localStorage` e somente leitura |
| branch validada | `codex/3.4-integrity` |
| commit-base | `e2a5ef0ab0c6dc6d9785504c32da9edeb637a043` |

```powershell
node --check js\workouts.js
node --check js\core.js
node --check js\storage.js
node --check js\measurements.js
node --check js\app.js
node --check sw.js
node --test --test-reporter=tap tests\app.test.cjs
$env:NODE_PATH = 'C:\Users\waubi\AppData\Local\npm-cache\_npx\e41f203b7505f1fb\node_modules'
node --test --test-reporter=tap tests\browser.test.cjs
```

Nunca execute duas suítes Playwright ao mesmo tempo. O harness bloqueia service
workers por padrão para os testes de aplicação e os habilita explicitamente nos
casos offline/PWA, reduzindo acúmulo de sockets sem retirar a cobertura real.

## Cobertura comprovada

Os 78 testes de núcleo cobrem catálogo e ficha canônica, periodização,
progressão dupla, comparabilidade por máquina/variação/lado/faixa, migrações,
limites sem truncamento silencioso, IDs únicos, documentos corrompidos,
recuperação, staging, concorrência, snapshots, backups, criptografia,
prototype pollution, CSV, medidas, silhueta e inventário brasileiro de vídeos.

Os 50 cenários em Chrome cobrem:

- início, pausa, retomada, finalização parcial/completa, reabertura, cancelamento
  e remarcação, incluindo duração e pausa acumulada;
- modos calendário e sequência, semanas, deload, arquivamento e continuidade;
- carga, repetições, RIR, confirmação explícita, status, foco, rolagem,
  descanso, desfazer, histórico por máquina e séries adversas;
- caminhada, vacuum, medidas bilaterais, ciclos, evolução, JSON, CSV,
  snapshots, backups comuns e criptografados;
- corrupção, importação hostil, esquema futuro, duas abas, queda de IndexedDB,
  falha de quota e ausência total de persistência em modo somente leitura;
- XSS, CSP, teclado, ARIA, contraste WCAG AA, 320–1280 px, zoom de 200%,
  texto ampliado e movimento reduzido;
- manifesto, ícones, zona maskable, funcionamento offline, atualização de cache,
  falha do service worker e migração da versão 2.2;
- ficha canônica dos seis treinos e política de vídeo em pt-BR de criador/canal
  brasileiro com proveniência verificada.

## Limites ainda manuais

- leitor de tela real (NVDA, JAWS ou Narrador);
- instalação pelo prompt nativo `beforeinstallprompt` em perfil limpo;
- importação de um backup real do usuário, depois de guardar cópia externa;
- smoke test da URL pública e confirmação do commit exato do Pages após o push.

Esses itens não são contados como aprovados pela suíte local.
