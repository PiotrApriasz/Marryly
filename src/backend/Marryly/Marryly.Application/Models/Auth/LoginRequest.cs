namespace Marryly.Application.Models.Auth;

public class LoginRequest
{
    public string? Email { get; init; }
    public string? Password { get; init; }
}