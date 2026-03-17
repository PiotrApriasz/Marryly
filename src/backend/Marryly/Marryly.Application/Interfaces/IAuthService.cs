using Microsoft.Azure.Functions.Worker.Http;

namespace Marryly.Application.Interfaces;

public interface IAuthService
{
    string? ReadAccessToken(HttpRequestData req);
    bool TryValidateToken(string token, out string email);
    string CreateSignedToken(string email, DateTimeOffset expiresAt);
    int GetSessionHours();
    bool MatchesPassword(string candidatePassword, string? passwordHash, string? plainTextPassword);
    bool MatchesEmail(string left, string right);
}
