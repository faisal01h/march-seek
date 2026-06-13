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
        Schema::create('raw_news', function (Blueprint $table) {
            $table->id();
            $table->string('headline');
            $table->longText('content')->nullable();
            $table->string('news_source_url')->unique();
            $table->string('news_provider')->nullable();
            $table->string('url_hash', 64)->unique();
            $table->enum('status', ['pending', 'processed', 'failed'])->default('pending');
            $table->timestamp('fetched_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('raw_news');
    }
};
