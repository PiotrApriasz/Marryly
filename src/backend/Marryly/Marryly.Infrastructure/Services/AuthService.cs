using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Marryly.Application.Constants;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using JwtRegisteredClaimNames = Microsoft.IdentityModel.JsonWebTokens.JwtRegisteredClaimNames;

namespace Marryly.Infrastructure.Services;

public class AuthService(ILogger<AuthService> logger, IConfiguration configuration) : IAuthService
{
    private static readonly JwtSecurityTokenHandler JwtHandler = new()
    {
        MapInboundClaims = false
    };
    private static readonly PasswordHasher<string> PasswordHasher = new();

    public bool MatchesEmail(string left, string right) =>
        string.Equals(left.Trim(), right.Trim(), StringComparison.OrdinalIgnoreCase);

    public bool MatchesAccessCode(string candidateCode, string? configuredCode)
    {
        if (string.IsNullOrWhiteSpace(configuredCode))
        {
            return false;
        }

        return string.Equals(candidateCode.Trim(), configuredCode.Trim(), StringComparison.Ordinal);
    }

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

    public int GetAdminSessionHours()
    {
        var fromConfig = configuration["ADMIN_AUTH_SESSION_HOURS"];
        return int.TryParse(fromConfig, out var value) && value > 0 ? value : AuthConstants.DefaultAdminSessionHours;
    }

    public int GetGuestSessionHours()
    {
        var fromConfig = configuration["GUEST_AUTH_SESSION_HOURS"];
        return int.TryParse(fromConfig, out var value) && value > 0 ? value : AuthConstants.DefaultGuestSessionHours;
    }

    public string CreateSignedToken(AccessTokenContext context, DateTimeOffset expiresAt)
    {
        var signingKey = GetJwtSigningKey();
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);
        var now = DateTime.UtcNow;
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, context.Subject),
            new(AuthConstants.RoleClaimName, context.Role),
            new(AuthConstants.EventIdClaimName, context.EventId)
        };

        if (!string.IsNullOrWhiteSpace(context.Email))
        {
            claims.Add(new Claim(JwtRegisteredClaimNames.Email, context.Email));
        }

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
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

    public bool TryValidateToken(string token, out AccessTokenContext context)
    {
        context = null!;
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
            var subject = FindClaimValue(principal, JwtRegisteredClaimNames.Sub, ClaimTypes.NameIdentifier);
            var email = FindClaimValue(principal, JwtRegisteredClaimNames.Email, ClaimTypes.Email);
            var role = FindClaimValue(principal, AuthConstants.RoleClaimName, ClaimTypes.Role);
            var eventId = FindClaimValue(principal, AuthConstants.EventIdClaimName);

            if (string.IsNullOrWhiteSpace(subject) ||
                string.IsNullOrWhiteSpace(role) ||
                string.IsNullOrWhiteSpace(eventId) ||
                !IsSupportedRole(role))
            {
                logger.LogWarning("Access JWT validation failed: missing required claims.");
                return false;
            }

            context = new AccessTokenContext
            {
                Subject = subject,
                Email = email,
                Role = role,
                EventId = eventId
            };

            return true;
        }
        catch (SecurityTokenExpiredException ex)
        {
            logger.LogWarning(ex, "Access JWT validation failed: token expired.");
            return false;
        }
        catch (SecurityTokenInvalidSignatureException ex)
        {
            logger.LogWarning(ex, "Access JWT validation failed: invalid signature.");
            return false;
        }
        catch (SecurityTokenInvalidIssuerException ex)
        {
            logger.LogWarning(ex, "Access JWT validation failed: invalid issuer.");
            return false;
        }
        catch (SecurityTokenInvalidAudienceException ex)
        {
            logger.LogWarning(ex, "Access JWT validation failed: invalid audience.");
            return false;
        }
        catch (SecurityTokenNotYetValidException ex)
        {
            logger.LogWarning(ex, "Access JWT validation failed: token not yet valid.");
            return false;
        }
        catch (ArgumentException ex)
        {
            logger.LogWarning(ex, "Access JWT validation failed: malformed token.");
            return false;
        }
        catch (Exception)
        {
            logger.LogWarning("Access JWT validation failed: unexpected error.");
            return false;
        }
    }

    public string? ReadAccessToken(HttpRequestData req)
    {
        if (!req.Headers.TryGetValues(AuthConstants.AccessTokenHeaderName, out var values))
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
            throw new InvalidOperationException("AUTH_SECRET is not configured");
        }

        var secretBytes = Encoding.UTF8.GetBytes(secret);
        if (secretBytes.Length < 32)
        {
            throw new InvalidOperationException("AUTH_SECRET must be at least 32 bytes long.");
        }

        return new SymmetricSecurityKey(secretBytes);
    }

    private string GetJwtIssuer() => configuration["AUTH_JWT_ISSUER"] ?? configuration["ADMIN_AUTH_JWT_ISSUER"] ?? "marryly-backend";

    private string GetJwtAudience() => configuration["AUTH_JWT_AUDIENCE"] ?? configuration["ADMIN_AUTH_JWT_AUDIENCE"] ?? "marryly-app";

    private string? GetNormalizedSecret()
    {
        var secret = configuration["AUTH_SECRET"] ?? configuration["ADMIN_AUTH_SECRET"];
        return secret?.Trim();
    }

    private static string? FindClaimValue(ClaimsPrincipal principal, params string[] claimTypes)
    {
        foreach (var claimType in claimTypes)
        {
            var value = principal.FindFirst(claimType)?.Value;
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return null;
    }

    private static bool IsSupportedRole(string role) =>
        string.Equals(role, AuthConstants.AdminRole, StringComparison.Ordinal) ||
        string.Equals(role, AuthConstants.GuestRole, StringComparison.Ordinal);
}
