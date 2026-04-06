using Marryly.Application.Models.Auth;
using Microsoft.Azure.Functions.Worker.Http;

namespace Marryly.Application.Interfaces;

public interface IAuthService
{
    string? ReadAccessToken(HttpRequestData req);
    bool TryValidateToken(string token, out AccessTokenContext context);
    string CreateSignedToken(AccessTokenContext context, DateTimeOffset expiresAt);
    int GetAdminSessionHours();
    int GetGuestSessionHours();
    bool MatchesAccessCode(string candidateCode, string? configuredCode);
    bool MatchesPassword(string candidatePassword, string? passwordHash, string? plainTextPassword);
    bool MatchesEmail(string left, string right);
}
