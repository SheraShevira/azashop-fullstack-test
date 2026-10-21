<?php

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    // Comma separated list, e.g. "http://localhost:3000,https://shop.example.com"
    'allowed_origins' => array_filter(array_map('trim', explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:3000')))),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => ['Content-Disposition'],
    'max_age' => 0,
    // Auth is a Bearer token, not a cookie, so credentials are not needed.
    'supports_credentials' => false,
];
