<?php

use App\Support\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(fn (ValidationException $e, Request $request) => ApiResponse::error('Validasi gagal', 422, $e->errors()));
        $exceptions->render(fn (AuthenticationException $e, Request $request) => ApiResponse::error('Unauthenticated', 401));
        $exceptions->render(fn (AuthorizationException $e, Request $request) => ApiResponse::error('Forbidden', 403));
        $exceptions->render(fn (ModelNotFoundException $e, Request $request) => ApiResponse::error('Data tidak ditemukan', 404));
        $exceptions->render(fn (NotFoundHttpException $e, Request $request) => ApiResponse::error('Data tidak ditemukan', 404));
        $exceptions->render(function (HttpExceptionInterface $e, Request $request) {
            return ApiResponse::error($e->getMessage() ?: 'Terjadi kesalahan', $e->getStatusCode());
        });
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*') || config('app.debug')) {
                return null; // fall back to the default renderer (stack trace in debug)
            }

            return ApiResponse::error('Terjadi kesalahan pada server', 500);
        });
    })->create();
