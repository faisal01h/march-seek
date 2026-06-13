<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class MapController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('map');
    }
}
