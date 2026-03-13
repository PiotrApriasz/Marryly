using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.IdentityModel.Tokens;

namespace Marryly.Application.Interfaces;

public interface IAuthService
{
    string? ReadCookie(HttpRequestData req, string name);
    string BuildSessionCookie(string token, DateTimeOffset expiresAt);
    string BuildExpiredSessionCookie();
    bool TryValidateToken(string token, out string email);
    string CreateSignedToken(string email, DateTimeOffset expiresAt);
    int GetSessionHours();
    bool MatchesPassword(string candidatePassword, string? passwordHash, string? plainTextPassword);
    bool MatchesEmail(string left, string right);
}
