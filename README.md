# 🛒 MarketScan

Sistema automatizado para coleta de promoções de mercados no Instagram e envio via email.

## 🚀 Como Começar

### 1. **Instalação das Dependências**
```bash
npm install
```

### 2. **Configuração das Variáveis de Ambiente**
```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite o arquivo .env com suas configurações
```

### 3. **Configurações Necessárias**

#### **Banco de Dados (SQLite)**
```bash
# SQLite será criado automaticamente na primeira execução
# Localização: ./database/market_scan.db
# Não precisa instalar nada adicional!
```

#### **Google Vision API**
1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto ou use um existente
3. Ative a Vision API
4. Crie uma Service Account Key
5. Baixe o arquivo JSON e coloque em `./keys/google-vision-key.json`

#### **OpenAI API**
1. Acesse [OpenAI Platform](https://platform.openai.com/)
2. Crie uma API Key
3. Adicione ao `.env`

#### **Email (SendGrid ou AWS SES)**
**Para SendGrid:**
1. Crie conta no [SendGrid](https://sendgrid.com/)
2. Crie uma API Key
3. Verifique seu domínio de email

**Para AWS SES:**
1. Configure SES no AWS Console
2. Verifique seu email de envio
3. Configure credenciais AWS

### 4. **Teste Local**
```bash
# Compilar TypeScript
npm run build

# Executar localmente
npm run dev

# Executar testes
npm test
```

## 📁 Estrutura do Projeto

```
mercado-radar/
├── src/
│   ├── config/         # Configurações centralizadas
│   ├── lambda/         # Handler do Lambda
│   ├── core/           # Pipeline principal
│   ├── services/       # Serviços (Instagram, Vision, AI, Email)
│   ├── database/       # Entidades e repositórios
│   ├── types/          # Definições de tipos
│   └── utils/          # Utilitários (logger, validação, etc.)
├── temp/               # Arquivos temporários
├── tests/              # Testes unitários e integração
└── docs/               # Documentação adicional
```

## ⚡ Próximos Passos

Agora que você tem a base configurada, vamos implementar os módulos na seguinte ordem:

1. **Types e Interfaces** - Definir estruturas de dados
2. **Database** - Entidades e conexão
3. **Instagram Service** - Scraping de posts
4. **Google Vision Service** - OCR das imagens
5. **OpenAI Service** - Estruturação dos dados
6. **Email Service** - Envio de promoções
7. **Pipeline** - Orquestração completa
8. **Lambda Handler** - Entrypoint principal

## 🔧 Comandos Disponíveis

```bash
npm run build      # Compilar TypeScript
npm run dev        # Executar em desenvolvimento
npm run test       # Executar testes
npm run lint       # Verificar código
npm run clean      # Limpar arquivos compilados
npm run deploy     # Deploy para AWS Lambda
```

## 📝 Variáveis de Ambiente Obrigatórias

Certifique-se de configurar essas variáveis no seu `.env`:

```bash
# Banco de dados SQLite
DB_TYPE=sqlite
DB_DATABASE=./database/mercado_radar.db

# APIs
GOOGLE_VISION_PROJECT_ID=seu-project-id
OPENAI_API_KEY=sk-sua-chave-openai

# Email
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=sua-chave-sendgrid
SENDGRID_FROM_EMAIL=noreply@seudominio.com

# Instagram
INSTAGRAM_ACCOUNTS=supermercado1,supermercado2

# Recipients
EMAIL_RECIPIENTS=usuario1@email.com,usuario2@email.com
```

## 🐛 Troubleshooting

### **Erro de conexão com banco**
- SQLite será criado automaticamente
- Verifique se a pasta `./database/` existe
- Confirme permissões de escrita no diretório

### **Erro Google Vision API**
- Verifique se a API está ativada no Google Cloud
- Confirme caminho do arquivo de credenciais
- Teste permissões da Service Account

### **Instagram bloqueando requests**
- Adicione delays maiores entre requisições
- Use proxies rotativos (em desenvolvimento futuro)
- Considere usar Instagram API oficial

---

**Status**: ✅ Base configurada - Pronto para desenvolvimento dos services!

Próximo passo: Implementar as definições de tipos em `src/types/`