FROM node:22.23.1-bookworm-slim AS build
WORKDIR /web
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL=""
ARG VITE_IDENTITY_API_BASE_URL=""
# 빌드 단계에서만 공용 원본을 읽으며 최종 이미지는 dist만 포함한다.
RUN --mount=from=slime-assets,target=/slime-assets,readonly \
    if [ -z "$VITE_IDENTITY_API_BASE_URL" ]; then unset VITE_IDENTITY_API_BASE_URL; fi; \
    npm run build
FROM nginx:1.28.0-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist /usr/share/nginx/html
EXPOSE 8080
