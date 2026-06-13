<?php

namespace Database\Seeders;

use App\Models\MapSetting;
use Illuminate\Database\Seeder;

class MapSettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        MapSetting::current();
    }
}
