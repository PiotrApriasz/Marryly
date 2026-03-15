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
using System.Security.Cryptography;
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
        return TryValidateToken(token, out email, out _);
    }

    public bool TryValidateToken(string token, out string email, out string? diagnosticMessage)
    {
        email = string.Empty;
        diagnosticMessage = null;
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
            diagnosticMessage = $"JWT expired at {ex.Expires:O}.";
            logger.LogWarning(ex, "Admin JWT validation failed: token expired.");
            return false;
        }
        catch (SecurityTokenInvalidSignatureException ex)
        {
            diagnosticMessage = "JWT signature validation failed. Check ADMIN_AUTH_SECRET across all environments.";
            logger.LogWarning(ex, "Admin JWT validation failed: invalid signature.");
            return false;
        }
        catch (SecurityTokenInvalidIssuerException ex)
        {
            diagnosticMessage = $"JWT issuer mismatch. Expected '{GetJwtIssuer()}', received '{ex.InvalidIssuer ?? "unknown"}'.";
            logger.LogWarning(ex, "Admin JWT validation failed: invalid issuer.");
            return false;
        }
        catch (SecurityTokenInvalidAudienceException ex)
        {
            diagnosticMessage = $"JWT audience mismatch. Expected '{GetJwtAudience()}', received '{ex.InvalidAudience ?? "unknown"}'.";
            logger.LogWarning(ex, "Admin JWT validation failed: invalid audience.");
            return false;
        }
        catch (SecurityTokenNotYetValidException ex)
        {
            diagnosticMessage = $"JWT is not valid before {ex.NotBefore:O}.";
            logger.LogWarning(ex, "Admin JWT validation failed: token not yet valid.");
            return false;
        }
        catch (ArgumentException ex)
        {
            diagnosticMessage = $"JWT format is invalid: {ex.Message}";
            logger.LogWarning(ex, "Admin JWT validation failed: malformed token.");
            return false;
        }
        catch (CryptographicException ex)
        {
            diagnosticMessage = $"JWT cryptographic validation failed: {ex.Message}";
            logger.LogWarning(ex, "Admin JWT validation failed: cryptographic error.");
            return false;
        }
        catch (Exception)
        {
            diagnosticMessage = "JWT validation failed for an unexpected reason.";
            logger.LogWarning("Admin JWT validation failed: unexpected error.");
            return false;
        }
    }

    public string? ReadBearerToken(HttpRequestData req)
    {
        if (!req.Headers.TryGetValues("Authorization", out var values))
        {
            return null;
        }

        foreach (var value in values)
        {
            if (!value.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var token = value["Bearer ".Length..].Trim();
            if (!string.IsNullOrWhiteSpace(token))
            {
                return token;
            }
        }

        return null;
    }

    public string? ReadCustomHeaderToken(HttpRequestData req)
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

    public string? ReadAccessToken(HttpRequestData req, string cookieName)
    {
        return ReadCustomHeaderToken(req) ?? ReadBearerToken(req) ?? ReadCookie(req, cookieName);
    }

    public bool TryValidateRequest(HttpRequestData req, string cookieName, out string email)
    {
        email = string.Empty;
        var token = ReadAccessToken(req, cookieName);
        return !string.IsNullOrWhiteSpace(token) && TryValidateToken(token, out email);
    }

    public void AppendSessionCookie(HttpResponseData response, string token, DateTimeOffset expiresAt)
    {
        var maxAge = (int)Math.Max((expiresAt - DateTimeOffset.UtcNow).TotalSeconds, 0);
        var cookie = new HttpCookie(AuthConstants.SessionCookieName, token)
        {
            Path = "/",
            HttpOnly = true,
            Secure = IsSecureCookieEnabled(),
            SameSite = GetCookieSameSiteValue(),
            MaxAge = maxAge,
            Expires = expiresAt.UtcDateTime,
        };

        var domain = GetCookieDomain();
        if (!string.IsNullOrWhiteSpace(domain))
        {
            cookie.Domain = domain;
        }

        response.Cookies.Append(cookie);
    }

    public void AppendExpiredSessionCookie(HttpResponseData response)
    {
        var cookie = new HttpCookie(AuthConstants.SessionCookieName, string.Empty)
        {
            Path = "/",
            HttpOnly = true,
            Secure = IsSecureCookieEnabled(),
            SameSite = GetCookieSameSiteValue(),
            MaxAge = 0,
            Expires = DateTime.UnixEpoch,
        };

        var domain = GetCookieDomain();
        if (!string.IsNullOrWhiteSpace(domain))
        {
            cookie.Domain = domain;
        }

        response.Cookies.Append(cookie);
    }

    public bool IsSecureCookieEnabled()
    {
        var fromConfig = configuration["ADMIN_AUTH_COOKIE_SECURE"];
        return !string.Equals(fromConfig, "false", StringComparison.OrdinalIgnoreCase);
    }

    public SameSite GetCookieSameSiteValue()
    {
        var configured = configuration["ADMIN_AUTH_COOKIE_SAMESITE"];
        if (string.IsNullOrWhiteSpace(configured))
        {
            return IsSecureCookieEnabled() ? SameSite.None : SameSite.Lax;
        }

        return configured switch
        {
            "None" => SameSite.None,
            "Strict" => SameSite.Strict,
            "ExplicitNone" => SameSite.ExplicitNone,
            _ => SameSite.Lax
        };
    }

    public string? GetCookieDomain()
    {
        var cookieDomain = configuration["ADMIN_AUTH_COOKIE_DOMAIN"];
        if (string.IsNullOrWhiteSpace(cookieDomain))
        {
            return null;
        }

        return cookieDomain.Trim();
    }

    public string GetJwtIssuer() => configuration["ADMIN_AUTH_JWT_ISSUER"] ?? "marryly-backend";

    public string GetJwtAudience() => configuration["ADMIN_AUTH_JWT_AUDIENCE"] ?? "marryly-admin";

    public string GetSecretFingerprint()
    {
        var secret = GetNormalizedSecret();
        if (string.IsNullOrWhiteSpace(secret))
        {
            return "missing";
        }

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(secret));
        return Convert.ToHexString(hash)[..12];
    }

    public string GetNormalizedSecretForDiagnostics() => GetNormalizedSecret() ?? string.Empty;

    public string GetTokenFingerprint(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return "missing";
        }

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token.Trim()));
        return Convert.ToHexString(hash)[..12];
    }

    public SymmetricSecurityKey GetJwtSigningKey()
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

    private string? GetNormalizedSecret()
    {
        var secret = configuration["ADMIN_AUTH_SECRET"];
        return secret?.Trim();
    }

    public string? ReadCookie(HttpRequestData req, string name)
    {
        if (!req.Headers.TryGetValues("Cookie", out var values))
        {
            return null;
        }

        foreach (var header in values)
        {
            var cookies = header.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var cookie in cookies)
            {
                var index = cookie.IndexOf('=');
                if (index <= 0)
                {
                    continue;
                }

                var cookieName = cookie[..index];
                if (!string.Equals(cookieName, name, StringComparison.Ordinal))
                {
                    continue;
                }

                return cookie[(index + 1)..];
            }
        }

        return null;
    }
}
