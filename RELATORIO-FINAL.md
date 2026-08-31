# Relatório final — Treino Hard (Fofo) 3.4.0

## Estado

**Versão local integralmente validada em 2026-08-30.** Esquema de dados **11** e
cache `treino-hard-v3.4.0`. No momento deste registro, integração em `main`, push,
confirmação do GitHub Pages e smoke público ainda seriam executados; por isso o
relatório não declara publicação antes da evidência externa.

## Resultado da auditoria

A revisão fechou os riscos de integridade, persistência, concorrência e uso real
que ainda estavam abertos na 3.4.0:

- documentos atuais, snapshots, backups e coleções auxiliares passam por
  validação profunda antes de substituir dados; conteúdo corrompido é preservado
  como recuperação e, se isso não for possível, o app bloqueia novas escritas;
- IndexedDB usa revisão exata; o fallback local usa staging, Web Lock e diário de
  transação. Sem Web Locks ou sem persistência durável, o app permanece somente
  leitura e nunca apresenta memória como salvamento;
- IDs duplicados, sessões fora da ficha canônica, campos inesperados, textos que
  exigiriam truncamento, prototype pollution e esquemas futuros são recusados;
- sessões arquivadas continuam em histórico, evolução, CSV, herança de máquina e
  feedback. A tela Hoje e o modo sequência selecionam apenas sessões correntes;
- finalizar uma sessão fecha corretamente a pausa aberta; cliques repetidos não
  duplicam finalização ou decisões de progressão;
- digitar carga e repetições rapidamente não remonta o DOM nem concatena valores;
  foco semântico, rolagem e blocos “Mais” abertos sobrevivem a remontagens;
- o resumo de encerramento é aguardado pelo estado real da interface, e avisos
  secundários da PWA não substituem erros críticos de armazenamento;
- o service worker busca assets de forma coerente, avisa falhas, pede confirmação
  antes de atualizar e preserva os dados durante a troca de cache;
- placeholders, textos pequenos, safe areas e rodapé foram ajustados para
  contraste, texto ampliado e dispositivos móveis;
- somente vídeos em português do Brasil, de criador/canal brasileiro e com
  proveniência verificada podem aparecer como aprovados. O catálogo atual tem
  **41 entradas: 10 aprovadas, 31 pendentes e 0 rejeitadas**.

## O que não foi alterado

- ficha canônica, ordem dos seis treinos, número de séries e periodização;
- esquema persistido 11 — nenhuma migração 12 foi introduzida;
- progressão continua sendo recomendação; o app não altera carga sozinho;
- vídeos pendentes não são apresentados como recomendação;
- o app continua estático, local, sem conta e sem servidor de dados.

## Evidência técnica

- sintaxe JavaScript e manifesto: aprovados;
- `git diff --check`: aprovado;
- núcleo: **78/78** testes aprovados;
- Chrome/Playwright: **50/50** cenários aprovados em uma única execução,
  **0 falhas**, exit code 0;
- detalhes completos: `TESTES.md`;
- pendências honestas: `PENDENCIAS.md`.

## Pendências não bloqueantes

Faltam leitor de tela real, instalação pelo prompt nativo, importação de um
backup real após cópia externa e decisões futuras sobre degraus configuráveis e
volume por músculo. Nenhuma dessas lacunas foi promovida artificialmente a
“aprovada”.
