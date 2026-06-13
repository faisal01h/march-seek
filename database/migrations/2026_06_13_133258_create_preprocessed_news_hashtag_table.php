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
        Schema::create('preprocessed_news_hashtag', function (Blueprint $table) {
            $table->uuid('preprocessed_news_id');
            $table->foreignId('news_hashtag_id')->constrained('news_hashtags')->onDelete('cascade');
            $table->timestamps();

            $table->primary(['preprocessed_news_id', 'news_hashtag_id']);
            $table->foreign('preprocessed_news_id')
                ->references('id')
                ->on('preprocessed_news')
                ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('preprocessed_news_hashtag');
    }
};
