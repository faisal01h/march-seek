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
        Schema::create('preprocessed_news', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('raw_news_id')->constrained('raw_news')->onDelete('cascade');
            $table->string('headline');
            $table->longText('content')->nullable();
            $table->text('summary')->nullable();
            $table->string('news_source_url');
            $table->string('news_provider')->nullable();
            $table->string('place_name')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('geocode_confidence')->nullable(); // street, district, city, region, country, none
            $table->timestamp('fetched_at')->nullable();
            $table->timestamps();

            $table->index(['latitude', 'longitude']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('preprocessed_news');
    }
};
