# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS build

WORKDIR /app

COPY frontend/package*.json /app/
RUN --mount=type=cache,target=/root/.npm npm ci

COPY frontend /app

ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
