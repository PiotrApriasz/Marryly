using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Marryly.Application.Constants;
using Marryly.Application.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using JwtRegisteredClaimNames = Microsoft.IdentityModel.JsonWebTokens.JwtRegisteredClaimNames;

namespace Marryly.Infrastructure.Services;

public class AuthService(ILogger<AuthService> logger, IConfiguration configuration) : IAuthService
{
    private static readonly JwtSecurityTokenHandler JwtHandler = new();
    private static readonly PasswordHasher<string> PasswordHasher = new();
    
    public bool MatchesEmail(string left, string right) =>
        string.Equals(left.Trim(), right.Trim(), StringComparison.OrdinalIgnoreCase);

    public bool MatchesPassword(string candidatePassword, string? passwordHash, string? plainTextPassword)
    {
        if (!string.IsNullOrWhiteSpace(passwordHash))
        {
            var verificationResult = PasswordHasher.VerifyHashedPassword(string.Empty, passwordHash, candidatePassword);
            return verificationResult is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
        }

        if (string.IsNullOrEmpty(plainTextPassword))
        {
            return false;
        }

        logger.LogWarning("Using ADMIN_AUTH_PASSWORD plaintext fallback. Migrate to ADMIN_AUTH_PASSWORD_HASH");
        return string.Equals(candidatePassword, plainTextPassword, StringComparison.Ordinal);
    }

    public int GetSessionHours()
    {
        var fromConfig = configuration["ADMIN_AUTH_SESSION_HOURS"];
        return int.TryParse(fromConfig, out var value) && value > 0 ? value : AuthConstants.DefaultSessionHours;
    }

    public string CreateSignedToken(string email, DateTimeOffset expiresAt)
    {
        var signingKey = GetJwtSigningKey();
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);
        var now = DateTime.UtcNow;
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity([
                new Claim(JwtRegisteredClaimNames.Sub, email),
                new Claim(JwtRegisteredClaimNames.Email, email)
            ]),
            Expires = expiresAt.UtcDateTime,
            NotBefore = now,
            IssuedAt = now,
            Issuer = GetJwtIssuer(),
            Audience = GetJwtAudience(),
            SigningCredentials = credentials
        };

        var token = JwtHandler.CreateToken(tokenDescriptor);
        return JwtHandler.WriteToken(token);
    }

    public bool TryValidateToken(string token, out string email)
    {
        email = string.Empty;
        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = GetJwtIssuer(),
            ValidateAudience = true,
            ValidAudience = GetJwtAudience(),
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = GetJwtSigningKey(),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };

        try
        {
            var principal = JwtHandler.ValidateToken(token, validationParameters, out _);
            email = principal.FindFirst(JwtRegisteredClaimNames.Email)?.Value
                    ?? principal.FindFirst(ClaimTypes.Email)?.Value
                    ?? principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                    ?? string.Empty;
            return !string.IsNullOrWhiteSpace(email);
        }
        catch (SecurityTokenExpiredException ex)
        {
            logger.LogWarning(ex, "Admin JWT validation failed: token expired.");
            return false;
        }
        catch (SecurityTokenInvalidSignatureException ex)
        {
            logger.LogWarning(ex, "Admin JWT validation failed: invalid signature.");
            return false;
        }
        catch (SecurityTokenInvalidIssuerException ex)
        {
            logger.LogWarning(ex, "Admin JWT validation failed: invalid issuer.");
            return false;
        }
        catch (SecurityTokenInvalidAudienceException ex)
        {
            logger.LogWarning(ex, "Admin JWT validation failed: invalid audience.");
            return false;
        }
        catch (SecurityTokenNotYetValidException ex)
        {
            logger.LogWarning(ex, "Admin JWT validation failed: token not yet valid.");
            return false;
        }
        catch (ArgumentException ex)
        {
            logger.LogWarning(ex, "Admin JWT validation failed: malformed token.");
            return false;
        }
        catch (Exception)
        {
            logger.LogWarning("Admin JWT validation failed: unexpected error.");
            return false;
        }
    }

    public string? ReadAccessToken(HttpRequestData req)
    {
        if (!req.Headers.TryGetValues(AuthConstants.AdminTokenHeaderName, out var values))
        {
            return null;
        }

        foreach (var value in values)
        {
            var token = value.Trim();
            if (!string.IsNullOrWhiteSpace(token))
            {
                return token;
            }
        }

        return null;
    }

    private SymmetricSecurityKey GetJwtSigningKey()
    {
        var secret = GetNormalizedSecret();
        if (string.IsNullOrWhiteSpace(secret))
        {
            throw new InvalidOperationException("ADMIN_AUTH_SECRET is not configured");
        }

        var secretBytes = Encoding.UTF8.GetBytes(secret);
        if (secretBytes.Length < 32)
        {
            throw new InvalidOperationException("ADMIN_AUTH_SECRET must be at least 32 bytes long.");
        }

        return new SymmetricSecurityKey(secretBytes);
    }

    private string GetJwtIssuer() => configuration["ADMIN_AUTH_JWT_ISSUER"] ?? "marryly-backend";

    private string GetJwtAudience() => configuration["ADMIN_AUTH_JWT_AUDIENCE"] ?? "marryly-admin";

    private string? GetNormalizedSecret()
    {
        var secret = configuration["ADMIN_AUTH_SECRET"];
        return secret?.Trim();
    }
}
