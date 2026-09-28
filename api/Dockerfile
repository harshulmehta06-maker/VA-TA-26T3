FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.json openapi.yaml ./
RUN npm ci

COPY src ./src

RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]

