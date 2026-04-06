namespace Marryly.Application.Models.Auth;

public class AccessTokenContext
{
    public required string Subject { get; init; }
    public required string Role { get; init; }
    public required string EventId { get; init; }
    public string? Email { get; init; }

    public bool IsAdmin => string.Equals(Role, "admin", StringComparison.Ordinal);
    public bool IsGuest => string.Equals(Role, "guest", StringComparison.Ordinal);
}
