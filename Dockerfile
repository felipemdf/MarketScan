# Etapa 1 - Build
FROM public.ecr.aws/lambda/nodejs:22 AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./

RUN npm install

COPY . .

RUN npm run build

# Etapa 2 - Runtime
FROM public.ecr.aws/lambda/nodejs:22

WORKDIR ${LAMBDA_TASK_ROOT}

# Copiar dependências e código compilado
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./

# Handler correto
CMD ["index.handler"]

