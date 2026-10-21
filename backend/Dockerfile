FROM php:8.4-cli-alpine

RUN apk add --no-cache postgresql-dev libzip-dev unzip git \
    && docker-php-ext-install pdo_pgsql bcmath zip pcntl
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-interaction --no-scripts --prefer-dist
COPY . .
RUN composer dump-autoload --optimize && chmod +x docker/entrypoint.sh \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache

EXPOSE 8000
ENTRYPOINT ["docker/entrypoint.sh"]
