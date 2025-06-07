# Базовый образ с Node.js
FROM node:18-alpine

# Установим рабочую директорию
WORKDIR /app

# Скопируем package.json и установим зависимости
COPY package.json package-lock.json* ./
RUN npm install

# Скопируем Prisma схему и остальные файлы
COPY prisma ./prisma/
COPY . .

# Сгенерируем Prisma Client
RUN npx prisma generate

# Скомпилируем TypeScript в JavaScript
RUN npm run build

# Устанавливаем Prisma глобально (если нужно для миграций)
RUN npm install -g prisma

RUN apk add --no-cache bash
ADD https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh /wait-for-it.sh
RUN chmod +x /wait-for-it.sh

ARG POSTGRES_PORT
ENV POSTGRES_PORT=${POSTGRES_PORT}

# Запускаем миграции и затем приложение
CMD ["/wait-for-it.sh", "db:5432", "--", "bash", "-c", "prisma migrate deploy && node dist/index.js"]