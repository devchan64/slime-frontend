FROM node:22.23.1-bookworm-slim AS build
WORKDIR /web
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM nginx:1.28.0-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist /usr/share/nginx/html
EXPOSE 8080
