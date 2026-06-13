<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('llm_settings', function (Blueprint $table) {
            $table->id();
            $table->string('provider')->default('openrouter');
            $table->string('api_base_url')->default('https://openrouter.ai/api/v1');
            $table->text('api_key')->nullable();
            $table->string('model_slug')->default('openai/gpt-4o-mini');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('llm_settings');
    }
};
