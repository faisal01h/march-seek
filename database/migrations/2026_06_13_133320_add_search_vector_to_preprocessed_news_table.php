<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('preprocessed_news', function (Blueprint $table) {
            $table->tsvector('search_vector')->nullable();
            $table->index('search_vector', 'preprocessed_news_search_vector_idx', 'gin');
        });

        // Update existing rows (optional, for existing data)
        DB::statement("
            UPDATE preprocessed_news 
            SET search_vector = to_tsvector('english', 
                coalesce(headline, '') || ' ' || 
                coalesce(summary, '') || ' ' || 
                coalesce(content, '')
            )
            WHERE search_vector IS NULL
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('preprocessed_news', function (Blueprint $table) {
            $table->dropIndex('preprocessed_news_search_vector_idx');
            $table->dropColumn('search_vector');
        });
    }
};
