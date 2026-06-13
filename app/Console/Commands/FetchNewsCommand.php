<?php

namespace App\Console\Commands;

use App\Jobs\FetchNewsJob;
use Illuminate\Console\Command;

class FetchNewsCommand extends Command
{
    protected $signature = 'news:fetch';

    protected $description = 'Dispatch the news fetch job';

    public function handle(): void
    {
        FetchNewsJob::dispatch();
        $this->info('FetchNewsJob dispatched.');
    }
}
