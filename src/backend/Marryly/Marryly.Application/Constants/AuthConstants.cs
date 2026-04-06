namespace Marryly.Application.Constants;

public static class AuthConstants
{
    public const string AccessTokenHeaderName = "X-Marryly-Access-Token";
    public const string EventIdClaimName = "eventId";
    public const string RoleClaimName = "role";
    public const string AdminRole = "admin";
    public const string GuestRole = "guest";
    public const int DefaultAdminSessionHours = 12;
    public const int DefaultGuestSessionHours = 24;
}
