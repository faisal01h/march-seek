FROM php:8.5-fpm-alpine

RUN apk add --no-cache \
    git curl zip unzip libpng-dev libpq-dev nodejs npm

RUN docker-php-ext-install pdo pdo_pgsql gd pcntl bcmath

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY . .

RUN composer install --no-dev --optimize-autoloader
RUN npm ci && npm run build

RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

CMD ["php-fpm"]
