
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('loans', function (Blueprint $table) {
            $table->id();

            // Each loan has a server-generated, globally unique identifier.
            $table->string('loan_code', 40)->unique();

            // Prevent users from accessing another user's loans.
            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->decimal('principal', 15, 2);
            $table->decimal('annual_rate', 8, 4);
            $table->unsignedSmallInteger('term_months');

            // JSON objects keyed by instalment month, e.g. {"3": 5000}.
            $table->json('prepayments')->nullable();
            $table->json('late_days')->nullable();

            $table->string('currency', 3)->default('LKR');
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loans');
    }
};
