<?php

use Illuminate\Http\Request;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\LoanController;
use App\Http\Controllers\Api\LoanCalculationController;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// Public endpoints: rate-limited to reduce brute-force abuse.
Route::middleware('throttle:5,1')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

// All loan operations require a valid Sanctum bearer token.
Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/loans', [LoanController::class, 'store']);
    Route::get('/loans', [LoanController::class, 'index']);
    Route::get('/loans/{loan}', [LoanController::class, 'show']);
    Route::patch('/loans/{loan}/adjustments', [LoanController::class,'addAdjustment',]);
    Route::post('/loans/schedule', [LoanCalculationController::class,'schedule',]);
    Route::post('/loans/settlement', [LoanCalculationController::class,'settlement',]);
});
