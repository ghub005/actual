FROM node:22-alpine

WORKDIR /app

COPY package.json yarn.lock* ./
RUN corepack enable && yarn install --frozen-lockfile

COPY . .
RUN yarn build

EXPOSE 3050

ENV ML_SERVICE_PORT=3050

CMD ["node", "dist/index.js"]
