<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_is_redirected_to_login(): void
    {
        // Main auth middleware redirects to Fortify login route (/login)
        $response = $this->get('/admin');
        $response->assertRedirect('/login');
    }

    public function test_authenticated_user_can_access_admin_dashboard(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->get('/admin');
        $response->assertStatus(200);
    }

    public function test_admin_login_page_loads(): void
    {
        $response = $this->get('/admin/login');
        $response->assertStatus(200);
    }
}
