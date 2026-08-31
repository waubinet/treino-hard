# Relatório final — Treino Hard (Fofo) 3.5.0

## Estado

**Versão 3.5.0 integralmente validada e publicada em 2026-08-31.** Esquema de
dados **12**, cache `treino-hard-v3.5.0` e commit funcional
`9224b2d0299962fd6a340679e74918b6a2103935`. O GitHub Pages confirmou esse
commit com status `built`; a URL pública passou no Chrome com HTTP 200, 13 abas,
estado de salvamento ativo, versão/esquema/cache corretos e zero erros de
console ou página.

## Resultado da rodada

- O degrau real pode ser configurado por exercício, variação e máquina nos
  detalhes do exercício, consultado/removido em Ajustes e é preservado no novo
  esquema 12. Os dois lados do mesmo aparelho compartilham o valor.
- A recomendação de progressão usa esse degrau somente para chegar a uma carga
  disponível; nenhuma carga é alterada automaticamente.
- Evolução mostra séries diretas confirmadas por grupo muscular contra a ficha
  planejada e mantém participações secundárias explicitamente separadas.
- Exercícios unilaterais não duplicam volume: dois lados formam uma série
  corporal equivalente e um único lado confirmado pode aparecer como fração.
- O gráfico reúne faixas diferentes da periodização na mesma linha quando
  exercício, variação, máquina e lado são iguais. A faixa permanece visível em
  cada ponto e continua fazendo parte da comparação estrita da progressão.
- Migração 11 → 12, validação profunda e deduplicação preservam os documentos
  anteriores e recusam configurações inválidas ou excessivas.

## O que não foi alterado

- ficha canônica, ordem dos seis treinos, número de séries e periodização;
- vídeos e seus estados de curadoria;
- progressão como recomendação, nunca como alteração automática de carga;
- arquitetura estática e local, sem conta e sem servidor de dados.

## Evidência técnica local

- sintaxe JavaScript e manifesto: aprovados;
- `git diff --check`: aprovado;
- núcleo: **81/81** testes aprovados;
- Chrome/Playwright: **51/51** cenários aprovados em uma única execução final,
  **0 falhas**, exit code 0, em **617.727,4458 ms**;
- erros de console/página aceitos: **0**;
- GitHub Pages: commit funcional exato confirmado e smoke público aprovado;
- detalhes completos: `TESTES.md`;
- pendências honestas: `PENDENCIAS.md`.

## Pendências não bloqueantes

Faltam leitor de tela real, instalação pelo prompt nativo e importação de um
backup real do usuário após cópia externa. A revisão futura do mapa muscular é
necessária se a ficha canônica mudar. Nenhuma dessas lacunas foi promovida a
“aprovada”.
