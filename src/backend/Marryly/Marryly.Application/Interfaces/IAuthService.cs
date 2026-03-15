using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.IdentityModel.Tokens;

namespace Marryly.Application.Interfaces;

public interface IAuthService
{
    string? ReadCookie(HttpRequestData req, string name);
    string? ReadBearerToken(HttpRequestData req);
    string? ReadAccessToken(HttpRequestData req, string cookieName);
    bool TryValidateRequest(HttpRequestData req, string cookieName, out string email);
    void AppendSessionCookie(HttpResponseData response, string token, DateTimeOffset expiresAt);
    void AppendExpiredSessionCookie(HttpResponseData response);
    bool TryValidateToken(string token, out string email);
    bool TryValidateToken(string token, out string email, out string? diagnosticMessage);
    string GetSecretFingerprint();
    string GetJwtIssuer();
    string GetJwtAudience();
    string CreateSignedToken(string email, DateTimeOffset expiresAt);
    int GetSessionHours();
    bool MatchesPassword(string candidatePassword, string? passwordHash, string? plainTextPassword);
    bool MatchesEmail(string left, string right);
}
