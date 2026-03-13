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
        catch (Exception)
        {
            return false;
        }
    }

    public string BuildSessionCookie(string token, DateTimeOffset expiresAt)
    {
        var secure = IsSecureCookieEnabled() ? "; Secure" : string.Empty;
        var sameSite = GetCookieSameSiteValue();
        var domain = GetCookieDomainAttribute();
        var maxAge = (int)Math.Max((expiresAt - DateTimeOffset.UtcNow).TotalSeconds, 0);
        return
            $"{AuthConstants.SessionCookieName}={token}; Path=/; HttpOnly; SameSite={sameSite}; Max-Age={maxAge}; Expires={expiresAt:ddd, dd MMM yyyy HH:mm:ss GMT}{secure}{domain}";
    }

    public string BuildExpiredSessionCookie()
    {
        var secure = IsSecureCookieEnabled() ? "; Secure" : string.Empty;
        var sameSite = GetCookieSameSiteValue();
        var domain = GetCookieDomainAttribute();
        return
            $"{AuthConstants.SessionCookieName}=; Path=/; HttpOnly; SameSite={sameSite}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT{secure}{domain}";
    }

    public bool IsSecureCookieEnabled()
    {
        var fromConfig = configuration["ADMIN_AUTH_COOKIE_SECURE"];
        return !string.Equals(fromConfig, "false", StringComparison.OrdinalIgnoreCase);
    }

    public string GetCookieSameSiteValue()
    {
        var configured = configuration["ADMIN_AUTH_COOKIE_SAMESITE"];
        if (string.IsNullOrWhiteSpace(configured))
        {
            return IsSecureCookieEnabled() ? "None" : "Lax";
        }

        return configured switch
        {
            "None" => "None",
            "Strict" => "Strict",
            _ => "Lax"
        };
    }

    public string GetCookieDomainAttribute()
    {
        var cookieDomain = configuration["ADMIN_AUTH_COOKIE_DOMAIN"];
        if (string.IsNullOrWhiteSpace(cookieDomain))
        {
            return string.Empty;
        }

        return $"; Domain={cookieDomain.Trim()}";
    }

    public string GetJwtIssuer() => configuration["ADMIN_AUTH_JWT_ISSUER"] ?? "marryly-backend";

    public string GetJwtAudience() => configuration["ADMIN_AUTH_JWT_AUDIENCE"] ?? "marryly-admin";

    public SymmetricSecurityKey GetJwtSigningKey()
    {
        var secret = configuration["ADMIN_AUTH_SECRET"];
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
