FROM node:latest AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . ./
RUN npm run build

FROM nginx:latest
RUN rm -rf /etc/nginx/conf.d/default.conf
COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
WORKDIR /usr/share/nginx/html
CMD ["/bin/bash", "-c", "nginx -g \"daemon off;\""]
