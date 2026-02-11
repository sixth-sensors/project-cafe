FROM node:latest AS builder
WORKDIR /app
COPY overbrew/package.json overbrew/package-lock.json* ./
RUN npm install
COPY overbrew/ ./
RUN npm run build

FROM nginx:latest
RUN rm -rf /etc/nginx/conf.d/default.conf
COPY overbrew/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
WORKDIR /usr/share/nginx/html
CMD ["/bin/bash", "-c", "nginx -g \"daemon off;\""]
