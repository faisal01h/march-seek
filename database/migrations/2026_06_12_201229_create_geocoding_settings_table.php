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
        Schema::create('geocoding_settings', function (Blueprint $table) {
            $table->id();
            $table->string('provider')->default('mapbox'); // mapbox, openstreetmap
            $table->text('api_key')->nullable(); // optional override for providers like mapbox
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('geocoding_settings');
    }
};
