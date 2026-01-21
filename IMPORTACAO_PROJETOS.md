# Importação de Projetos via Excel

Esta funcionalidade permite importar projetos completos com etapas e checklists a partir de uma planilha Excel.

## Como Usar

1. Acesse a página de **Projetos**
2. Clique no botão **"Importar do Excel"**
3. Selecione um arquivo Excel (.xlsx ou .xls)
4. Clique em **"Importar Projetos"**

## Estrutura da Planilha

A planilha deve conter **3 abas** (planilhas):

### 1. Aba "Projetos" (Obrigatória)

Esta aba contém as informações dos projetos a serem importados.

| Coluna | Obrigatório | Descrição | Exemplo |
|--------|-------------|-----------|---------|
| `nome` | Sim | Nome do projeto | "Projeto de Infraestrutura" |
| `resumo` | Não | Resumo breve do projeto | "Modernização da infraestrutura de TI" |
| `objetivo` | Não | Objetivo do projeto | "Melhorar a infraestrutura de TI da empresa" |
| `valorTotal` | Não | Valor total do projeto (número) | 50000 |
| `supervisorEmail` | Não | Email do supervisor (se não informado, usa o usuário que está importando) | "joao@empresa.com" |
| `responsaveisEmails` | Não | Emails dos responsáveis separados por vírgula | "maria@empresa.com, pedro@empresa.com" |

**Exemplo de dados:**
```
nome                    | resumo                          | objetivo                    | valorTotal | supervisorEmail    | responsaveisEmails
Projeto Infraestrutura  | Modernização da infraestrutura  | Melhorar infraestrutura de TI| 50000      | joao@empresa.com   | maria@empresa.com, pedro@empresa.com
```

### 2. Aba "Etapas" (Opcional)

Esta aba contém as etapas (tarefas) de cada projeto.

| Coluna | Obrigatório | Descrição | Exemplo |
|--------|-------------|-----------|---------|
| `projetoNome` | Sim | Nome do projeto (deve corresponder exatamente ao nome na aba Projetos) | "Projeto de Infraestrutura" |
| `nome` | Sim | Nome da etapa | "Instalação de Servidores" |
| `descricao` | Não | Descrição detalhada da etapa | "Instalar e configurar servidores físicos" |
| `dataInicio` | Não | Data de início (formato: YYYY-MM-DD) | "2026-02-01" |
| `dataFim` | Não | Data de fim (formato: YYYY-MM-DD) | "2026-02-15" |
| `valorInsumos` | Não | Valor de insumos da etapa (número) | 10000 |
| `executorEmail` | Não | Email do executor (se não informado, usa o usuário que está importando) | "maria@empresa.com" |
| `integrantesEmails` | Não | Emails dos integrantes separados por vírgula | "pedro@empresa.com, ana@empresa.com" |

**Exemplo de dados:**
```
projetoNome              | nome                    | descricao                        | dataInicio  | dataFim    | valorInsumos | executorEmail    | integrantesEmails
Projeto Infraestrutura  | Instalação de Servidores | Instalar e configurar servidores  | 2026-02-01  | 2026-02-15 | 10000        | maria@empresa.com| pedro@empresa.com
Projeto Infraestrutura  | Configuração de Rede    | Configurar rede e firewall        | 2026-02-16  | 2026-02-28 | 5000         | pedro@empresa.com| ana@empresa.com
```

### 3. Aba "Checklist" (Opcional)

Esta aba contém os itens do checklist para cada etapa.

| Coluna | Obrigatório | Descrição | Exemplo |
|--------|-------------|-----------|---------|
| `projetoNome` | Sim | Nome do projeto | "Projeto de Infraestrutura" |
| `etapaNome` | Sim | Nome da etapa (deve corresponder exatamente ao nome na aba Etapas) | "Instalação de Servidores" |
| `itemTexto` | Sim | Texto do item do checklist | "Verificar especificações do servidor" |
| `itemDescricao` | Não | Descrição detalhada do item | "Verificar se o servidor atende aos requisitos mínimos" |
| `subitemTexto` | Não | Texto do subitem (se houver) | "Verificar processador" |
| `subitemDescricao` | Não | Descrição do subitem | "Processador deve ser Intel Xeon ou equivalente" |

**Exemplo de dados:**
```
projetoNome              | etapaNome                | itemTexto                        | itemDescricao                                    | subitemTexto        | subitemDescricao
Projeto Infraestrutura  | Instalação de Servidores | Verificar especificações         | Verificar se o servidor atende aos requisitos    | Verificar processador| Processador deve ser Intel Xeon
Projeto Infraestrutura  | Instalação de Servidores | Verificar especificações         | Verificar se o servidor atende aos requisitos    | Verificar memória   | Mínimo 32GB de RAM
Projeto Infraestrutura  | Instalação de Servidores | Instalar sistema operacional     | Instalar e configurar o sistema operacional      |                     |
```

**Observações sobre o Checklist:**
- Um item do checklist pode ter múltiplos subitens
- Para criar subitens, use a mesma linha do item principal e preencha `subitemTexto` e `subitemDescricao`
- Se um item não tiver subitens, deixe `subitemTexto` e `subitemDescricao` vazios

## Regras e Validações

1. **Emails**: Todos os emails devem corresponder a usuários existentes no sistema
2. **Nomes de Projetos e Etapas**: Devem corresponder exatamente entre as abas (case-sensitive)
3. **Datas**: Devem estar no formato YYYY-MM-DD
4. **Valores**: Devem ser números válidos
5. **Múltiplos Projetos**: Você pode importar vários projetos de uma vez, cada um em uma linha da aba "Projetos"

## Exemplo Completo

### Aba "Projetos"
```
nome                    | resumo                          | objetivo                    | valorTotal | supervisorEmail    | responsaveisEmails
Projeto Infraestrutura  | Modernização da infraestrutura  | Melhorar infraestrutura de TI| 50000      | joao@empresa.com   | maria@empresa.com
```

### Aba "Etapas"
```
projetoNome              | nome                    | descricao                        | dataInicio  | dataFim    | valorInsumos | executorEmail    | integrantesEmails
Projeto Infraestrutura  | Instalação de Servidores | Instalar e configurar servidores  | 2026-02-01  | 2026-02-15 | 10000        | maria@empresa.com| pedro@empresa.com
```

### Aba "Checklist"
```
projetoNome              | etapaNome                | itemTexto                        | itemDescricao                                    | subitemTexto        | subitemDescricao
Projeto Infraestrutura  | Instalação de Servidores | Verificar especificações         | Verificar se o servidor atende aos requisitos    | Verificar processador| Processador deve ser Intel Xeon
Projeto Infraestrutura  | Instalação de Servidores | Verificar especificações         | Verificar se o servidor atende aos requisitos    | Verificar memória   | Mínimo 32GB de RAM
Projeto Infraestrutura  | Instalação de Servidores | Instalar sistema operacional     | Instalar e configurar o sistema operacional      |                     |
```

## Tratamento de Erros

Se houver erros durante a importação:
- O sistema informará quais linhas/projetos falharam
- Verifique se os emails correspondem a usuários existentes
- Verifique se os nomes de projetos e etapas correspondem exatamente entre as abas
- Verifique se as datas estão no formato correto

## Dicas

1. **Prepare a planilha antes**: Certifique-se de que todos os emails correspondem a usuários existentes
2. **Use nomes consistentes**: Os nomes de projetos e etapas devem ser idênticos entre as abas
3. **Teste com um projeto pequeno primeiro**: Importe um projeto simples para verificar se tudo está funcionando
4. **Backup**: Faça backup dos dados antes de importar grandes volumes
